// email-server/server.js
// HyveMail — Private Email Server for hyvechain.com
// 
// This is the backend API server that powers the HyveMail service.
// It handles email account management, IMAP/SMTP proxy, and Hyve Social integration.
//
// Prerequisites:
//   - Node.js 18+
//   - MongoDB (for account storage)
//   - A mail server (Postfix + Dovecot) configured for hyvechain.com
//   - DKIM, SPF, and DMARC DNS records configured
//
// Run: npm install && node server.js

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { execSync } from 'child_process';
import crypto from 'crypto';

const app = express();
const PORT = process.env.EMAIL_PORT || 4500;
const JWT_SECRET = process.env.EMAIL_JWT_SECRET || 'hyvemail-secret-change-in-production';
const SOCIAL_JWT_SECRET = process.env.SOCIAL_JWT_SECRET || 'hyve_super_secret_jwt_key_change_this_12345';
const MONGO_URI = process.env.EMAIL_MONGO_URI || 'mongodb://localhost:27017/hyvemail';
const MAIL_DOMAIN = 'hyvechain.com';

// Mail server configuration
const IMAP_HOST = process.env.IMAP_HOST || 'mail.hyvechain.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993');
const SMTP_HOST = process.env.SMTP_HOST || 'mail.hyvechain.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');

// ========================================
// DATABASE MODELS
// ========================================

mongoose.connect(MONGO_URI);

const emailAccountSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, default: '' },
  recoveryCodeHashes: [{ type: String }], // bcrypt hashes of 2 one-time recovery codes
  socialUserId: { type: String, default: null }, // Linked Hyve Social account
  socialUsername: { type: String, default: null },
  storageUsed: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 1073741824 }, // 1GB default
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  settings: {
    signature: { type: String, default: '' },
    autoReply: { type: Boolean, default: false },
    autoReplyMessage: { type: String, default: '' },
    theme: { type: String, default: 'dark' },
  },
});

emailAccountSchema.index({ email: 1 });
emailAccountSchema.index({ socialUserId: 1 });

const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);

// ========================================
// MIDDLEWARE
// ========================================

app.use(helmet());
app.use(cors({
  origin: [
    'https://social.hyvechain.com',
    'https://mail.hyvechain.com',
    'https://mail-api.hyvechain.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many signup attempts, please try again later' },
});

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { error: 'Email sending rate limit reached' },
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.emailUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ========================================
// IMAP/SMTP HELPERS
// ========================================

async function getImapClient(email, password) {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  return client;
}

function getSmtpTransport(email, password) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false },
  });
}

// Decrypt user password from token for IMAP/SMTP access
function getUserCredentials(req) {
  // The token includes the email; we need the password stored in session
  // In production, use a session store or encrypted cookie
  const password = req.headers['x-email-password'] || req.emailUser.sessionKey;
  return { email: req.emailUser.email, password };
}

// ========================================
// SYSTEM MAIL ACCOUNT MANAGEMENT
// ========================================

/**
 * Create a system-level mail account on the mail server.
 * Adds user to Dovecot passwd-file, Postfix vmailbox, and creates Maildir.
 */
async function createSystemMailAccount(username, password) {
  const email = `${username}@${MAIL_DOMAIN}`;
  
  try {
    // 1. Hash password for Dovecot using doveadm
    const escapedPass = password.replace(/'/g, "'\\''");
    const hashedPassword = execSync(`doveadm pw -s BLF-CRYPT -p '${escapedPass}'`).toString().trim();
    
    // 2. Add user to Dovecot passwd-file (/etc/dovecot/users)
    const dovecotLine = `${email}:${hashedPassword}`;
    const usersFile = '/etc/dovecot/users';
    
    // Read existing file, check if user already exists
    const { readFileSync, writeFileSync, mkdirSync, chownSync } = await import('fs');
    let usersContent = '';
    try { usersContent = readFileSync(usersFile, 'utf8'); } catch (e) { /* file may not exist yet */ }
    
    // Remove existing entry if any, then add new one
    const lines = usersContent.split('\n').filter(l => !l.startsWith(`${email}:`));
    lines.push(dovecotLine);
    writeFileSync(usersFile, lines.filter(l => l.trim()).join('\n') + '\n');
    
    // 3. Add user to Postfix vmailbox (/etc/postfix/vmailbox)
    const vmailboxFile = '/etc/postfix/vmailbox';
    let vmailboxContent = '';
    try { vmailboxContent = readFileSync(vmailboxFile, 'utf8'); } catch (e) {}
    
    const vmailboxLines = vmailboxContent.split('\n').filter(l => !l.startsWith(`${email} `));
    vmailboxLines.push(`${email} ${MAIL_DOMAIN}/${username}/`);
    writeFileSync(vmailboxFile, vmailboxLines.filter(l => l.trim()).join('\n') + '\n');
    
    // Rebuild Postfix lookup table
    execSync('postmap /etc/postfix/vmailbox');
    
    // 4. Create Maildir structure
    const mailHome = `/var/vmail/${MAIL_DOMAIN}/${username}/Maildir`;
    const folders = ['', '.Sent', '.Drafts', '.Trash', '.Spam', '.Starred'];
    const subdirs = ['cur', 'new', 'tmp'];
    
    for (const folder of folders) {
      for (const sub of subdirs) {
        const dir = `${mailHome}/${folder}${folder ? '/' : ''}${sub}`;
        mkdirSync(dir, { recursive: true });
      }
    }
    
    // Set ownership to vmail user (uid/gid 5000)
    execSync(`chown -R 5000:5000 /var/vmail/${MAIL_DOMAIN}/${username}`);
    
    // 5. Reload Postfix to pick up new mailbox
    try { execSync('postfix reload 2>/dev/null'); } catch (e) { /* non-fatal */ }
    
    console.log(`Created mail account: ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to create system mail account for ${email}:`, error);
    throw new Error('Failed to create mail account on server');
  }
}

// ========================================
// AUTH ROUTES
// ========================================

// Check username availability
app.get('/api/email/check/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Validate username format
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.json({ available: false, reason: 'Invalid username format' });
    }

    // Check reserved usernames
    const reserved = ['admin', 'postmaster', 'webmaster', 'info', 'support', 'noreply', 
                       'no-reply', 'abuse', 'security', 'root', 'mail', 'hostmaster',
                       'help', 'contact', 'team', 'hyve', 'hyvechain'];
    if (reserved.includes(username.toLowerCase())) {
      return res.json({ available: false, reason: 'This username is reserved' });
    }

    const existing = await EmailAccount.findOne({ username: username.toLowerCase() });
    res.json({ available: !existing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Create email account
app.post('/api/email/signup', signupLimiter, async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    // Validate
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const lowerUsername = username.toLowerCase();
    const email = `${lowerUsername}@${MAIL_DOMAIN}`;

    // Check if exists
    const existing = await EmailAccount.findOne({ $or: [{ username: lowerUsername }, { email }] });
    if (existing) {
      return res.status(409).json({ error: 'This username is already taken' });
    }

    // Create system mail account
    await createSystemMailAccount(lowerUsername, password);

    // Generate 5 one-time recovery codes
    const recoveryCodes = [];
    const recoveryCodeHashes = [];
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomBytes(12).toString('hex').toUpperCase();
      recoveryCodes.push(code);
      recoveryCodeHashes.push(await bcrypt.hash(code, 12));
    }

    // Hash password and create DB record
    const passwordHash = await bcrypt.hash(password, 12);
    const account = new EmailAccount({
      username: lowerUsername,
      email,
      passwordHash,
      displayName: displayName || username,
      recoveryCodeHashes,
    });
    await account.save();

    // Generate token
    const token = jwt.sign(
      { id: account._id, email, username: lowerUsername, sessionKey: password },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return recovery codes in plaintext ONCE — client must save them
    res.status(201).json({
      token,
      recoveryCodes,
      account: {
        username: lowerUsername,
        email,
        displayName: account.displayName,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Reset password using recovery code
app.post('/api/email/reset-password', authLimiter, async (req, res) => {
  try {
    const { username, recoveryCode, newPassword } = req.body;
    if (!username || !recoveryCode || !newPassword) {
      return res.status(400).json({ error: 'Username, recovery code, and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const lowerUsername = username.toLowerCase().trim();
    const account = await EmailAccount.findOne({ username: lowerUsername });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (!account.recoveryCodeHashes || account.recoveryCodeHashes.length === 0) {
      return res.status(400).json({ error: 'No recovery codes set for this account' });
    }

    // Check which recovery code matches
    const codeUpper = recoveryCode.toUpperCase().trim();
    let matchedIndex = -1;
    for (let i = 0; i < account.recoveryCodeHashes.length; i++) {
      const isMatch = await bcrypt.compare(codeUpper, account.recoveryCodeHashes[i]);
      if (isMatch) { matchedIndex = i; break; }
    }
    if (matchedIndex === -1) {
      return res.status(401).json({ error: 'Invalid recovery code' });
    }

    // Update password in MongoDB
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    account.passwordHash = newPasswordHash;

    // Generate 5 NEW recovery codes (all old ones consumed)
    const newRecoveryCodes = [];
    const newHashes = [];
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomBytes(12).toString('hex').toUpperCase();
      newRecoveryCodes.push(code);
      newHashes.push(await bcrypt.hash(code, 12));
    }
    account.recoveryCodeHashes = newHashes;
    await account.save();

    // Update password in Dovecot system
    try {
      const escapedPass = newPassword.replace(/'/g, "'\\''");
      const hashedPassword = execSync(`doveadm pw -s BLF-CRYPT -p '${escapedPass}'`).toString().trim();
      const email = `${lowerUsername}@${MAIL_DOMAIN}`;
      const dovecotLine = `${email}:${hashedPassword}`;
      const usersFile = '/etc/dovecot/users';
      const { readFileSync, writeFileSync } = await import('fs');
      let usersContent = '';
      try { usersContent = readFileSync(usersFile, 'utf8'); } catch (e) {}
      const lines = usersContent.split('\n').filter(l => !l.startsWith(`${email}:`));
      lines.push(dovecotLine);
      writeFileSync(usersFile, lines.filter(l => l.trim()).join('\n') + '\n');
      console.log(`Password reset for: ${email}`);
    } catch (sysErr) {
      console.error('Failed to update system password:', sysErr);
      // DB was updated, system will be out of sync — but DB is source of truth
    }

    res.json({
      message: 'Password reset successfully',
      newRecoveryCodes, // Return new recovery codes — user must save them again
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Email login
app.post('/api/email/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().includes('@') 
      ? email.toLowerCase() 
      : `${email.toLowerCase()}@${MAIL_DOMAIN}`;

    const account = await EmailAccount.findOne({ email: normalizedEmail });
    if (!account) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!account.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const validPassword = await bcrypt.compare(password, account.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    account.lastLogin = new Date();
    await account.save();

    const token = jwt.sign(
      { id: account._id, email: normalizedEmail, username: account.username, sessionKey: password },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      account: {
        username: account.username,
        email: normalizedEmail,
        displayName: account.displayName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ========================================
// ACCOUNT ROUTES
// ========================================

// Get account info
app.get('/api/email/account', authenticate, async (req, res) => {
  try {
    const account = await EmailAccount.findById(req.emailUser.id).select('-passwordHash');
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ account });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Update account settings
app.put('/api/email/account', authenticate, async (req, res) => {
  try {
    const { displayName, signature, autoReply, autoReplyMessage } = req.body;
    const account = await EmailAccount.findById(req.emailUser.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (displayName !== undefined) account.displayName = displayName;
    if (signature !== undefined) account.settings.signature = signature;
    if (autoReply !== undefined) account.settings.autoReply = autoReply;
    if (autoReplyMessage !== undefined) account.settings.autoReplyMessage = autoReplyMessage;

    await account.save();
    res.json({ account });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Change password
app.put('/api/email/account/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const account = await EmailAccount.findById(req.emailUser.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    account.passwordHash = await bcrypt.hash(newPassword, 12);
    await account.save();

    // Update Dovecot passwd-file with new password
    try {
      const escapedPass = newPassword.replace(/'/g, "'\\'\''");
      const hashedPassword = execSync(`doveadm pw -s BLF-CRYPT -p '${escapedPass}'`).toString().trim();
      const { readFileSync, writeFileSync } = await import('fs');
      const usersFile = '/etc/dovecot/users';
      let usersContent = '';
      try { usersContent = readFileSync(usersFile, 'utf8'); } catch (e) {}
      const email = account.email;
      const lines = usersContent.split('\n').filter(l => !l.startsWith(`${email}:`));
      lines.push(`${email}:${hashedPassword}`);
      writeFileSync(usersFile, lines.filter(l => l.trim()).join('\n') + '\n');
    } catch (e) {
      console.error('Failed to update Dovecot password:', e);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ========================================
// MAILBOX ROUTES (IMAP Proxy)
// ========================================

// Get messages
app.get('/api/email/messages', authenticate, async (req, res) => {
  try {
    const { folder = 'INBOX', page = 1, limit = 50 } = req.query;
    const { email, password } = getUserCredentials(req);

    const folderMap = {
      inbox: 'INBOX',
      sent: 'Sent',
      drafts: 'Drafts',
      trash: 'Trash',
      spam: 'Spam',
      starred: 'INBOX', // We'll filter starred separately
    };

    const imapFolder = folderMap[folder.toLowerCase()] || folder;
    const client = await getImapClient(email, password);

    try {
      const lock = await client.getMailboxLock(imapFolder);
      try {
        const messages = [];
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch messages in reverse order (newest first)
        const totalMessages = client.mailbox.exists;
        const start = Math.max(1, totalMessages - offset - parseInt(limit) + 1);
        const end = Math.max(1, totalMessages - offset);

        if (totalMessages > 0 && start <= end) {
          for await (const msg of client.fetch(`${start}:${end}`, { 
            envelope: true, 
            flags: true, 
            bodyStructure: true,
            source: true
          })) {
            let preview = '';
            try {
              const parsed = await simpleParser(msg.source);
              preview = (parsed.text || parsed.html?.replace(/<[^>]+>/g, '') || '').substring(0, 200).trim();
            } catch (e) {
              preview = '';
            }
            messages.push({
              id: msg.uid,
              seq: msg.seq,
              from: msg.envelope?.from?.[0]?.address || '',
              fromName: msg.envelope?.from?.[0]?.name || '',
              to: msg.envelope?.to?.map(t => t.address) || [],
              subject: msg.envelope?.subject || '',
              date: msg.envelope?.date?.toISOString() || new Date().toISOString(),
              read: msg.flags?.has('\\Seen') || false,
              starred: msg.flags?.has('\\Flagged') || false,
              preview,
              hasAttachments: false,
            });
          }
        }

        // Reverse to newest first
        messages.reverse();

        // Filter starred if requested
        const filtered = folder === 'starred' 
          ? messages.filter(m => m.starred) 
          : messages;

        res.json({
          messages: filtered,
          total: totalMessages,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages', messages: [] });
  }
});

// Get single message
app.get('/api/email/messages/:id', authenticate, async (req, res) => {
  try {
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;
    const folder = req.query.folder || 'INBOX';
    const folderMap = { inbox: 'INBOX', sent: 'Sent', drafts: 'Drafts', trash: 'Trash', spam: 'Spam' };
    const imapFolder = folderMap[folder.toLowerCase()] || folder;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock(imapFolder);
      try {
        const msg = await client.fetchOne(messageId, {
          envelope: true,
          flags: true,
          source: true,
        }, { uid: true });

        if (!msg) {
          return res.status(404).json({ error: 'Message not found' });
        }

        // Mark as seen
        await client.messageFlagsAdd(messageId, ['\\Seen'], { uid: true });

        // Parse the MIME source using mailparser
        const parsed = await simpleParser(msg.source);

        res.json({
          id: msg.uid,
          from: msg.envelope?.from?.[0]?.address || '',
          fromName: msg.envelope?.from?.[0]?.name || '',
          to: msg.envelope?.to?.map(t => t.address) || [],
          cc: msg.envelope?.cc?.map(t => t.address) || [],
          subject: msg.envelope?.subject || '',
          date: msg.envelope?.date?.toISOString() || '',
          read: true,
          starred: msg.flags?.has('\\Flagged') || false,
          body: parsed.text || '',
          html: parsed.html || null,
          attachments: (parsed.attachments || []).map(a => ({ filename: a.filename, size: a.size, contentType: a.contentType })),
        });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    console.error('Fetch message error:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Send email
app.post('/api/email/send', [authenticate, sendLimiter], async (req, res) => {
  try {
    const { to, cc, bcc, subject, body } = req.body;
    const { email, password } = getUserCredentials(req);

    if (!to || (Array.isArray(to) && to.length === 0)) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    const account = await EmailAccount.findById(req.emailUser.id);
    const transport = getSmtpTransport(email, password);

    const mailOptions = {
      from: `"${account?.displayName || email}" <${email}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject || '',
      text: body || '',
    };

    if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;

    // Add signature if set
    if (account?.settings?.signature) {
      mailOptions.text += `\n\n--\n${account.settings.signature}`;
    }

    await transport.sendMail(mailOptions);
    transport.close();

    // Save a copy to Sent folder via IMAP
    try {
      const client = await getImapClient(email, password);
      try {
        const rawMessage = [
          `From: ${mailOptions.from}`,
          `To: ${mailOptions.to}`,
          cc ? `Cc: ${mailOptions.cc}` : null,
          `Subject: ${mailOptions.subject || ''}`,
          `Date: ${new Date().toUTCString()}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=utf-8`,
          '',
          mailOptions.text || '',
        ].filter(l => l !== null).join('\r\n');

        await client.append('Sent', rawMessage, ['\\Seen']);
      } finally {
        await client.logout();
      }
    } catch (sentErr) {
      console.error('Failed to save to Sent folder:', sentErr);
      // Non-fatal - email was still sent
    }

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Mark message read/unread
app.put('/api/email/messages/:id/read', authenticate, async (req, res) => {
  try {
    const { read } = req.body;
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        if (read) {
          await client.messageFlagsAdd(messageId, ['\\Seen'], { uid: true });
        } else {
          await client.messageFlagsRemove(messageId, ['\\Seen'], { uid: true });
        }
        res.json({ success: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Star/unstar message
app.put('/api/email/messages/:id/star', authenticate, async (req, res) => {
  try {
    const { starred } = req.body;
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        if (starred) {
          await client.messageFlagsAdd(messageId, ['\\Flagged'], { uid: true });
        } else {
          await client.messageFlagsRemove(messageId, ['\\Flagged'], { uid: true });
        }
        res.json({ success: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Move message to folder
app.put('/api/email/messages/:id/move', authenticate, async (req, res) => {
  try {
    const { folder } = req.body;
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;

    const folderMap = { inbox: 'INBOX', sent: 'Sent', trash: 'Trash', spam: 'Spam', drafts: 'Drafts' };
    const targetFolder = folderMap[folder?.toLowerCase()] || folder;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageMove(messageId, targetFolder, { uid: true });
        res.json({ success: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to move message' });
  }
});

// Delete message permanently
app.delete('/api/email/messages/:id', authenticate, async (req, res) => {
  try {
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock('Trash');
      try {
        await client.messageFlagsAdd(messageId, ['\\Deleted'], { uid: true });
        await client.messageDelete(messageId, { uid: true });
        res.json({ success: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Save draft
app.post('/api/email/drafts', authenticate, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const { email, password } = getUserCredentials(req);

    const client = await getImapClient(email, password);
    try {
      const rawMessage = [
        `From: ${email}`,
        `To: ${Array.isArray(to) ? to.join(', ') : (to || '')}`,
        `Subject: ${subject || ''}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        '',
        body || '',
      ].join('\r\n');

      await client.append('Drafts', rawMessage, ['\\Draft']);
      res.json({ success: true });
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Get unread counts
app.get('/api/email/unread', authenticate, async (req, res) => {
  try {
    const { email, password } = getUserCredentials(req);
    const client = await getImapClient(email, password);

    const counts = {};
    const folders = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'];
    const folderKeys = ['inbox', 'sent', 'drafts', 'trash', 'spam'];

    try {
      for (let i = 0; i < folders.length; i++) {
        try {
          const status = await client.status(folders[i], { unseen: true });
          counts[folderKeys[i]] = status.unseen || 0;
        } catch {
          counts[folderKeys[i]] = 0;
        }
      }
    } finally {
      await client.logout();
    }

    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});

// Search emails
app.get('/api/email/search', authenticate, async (req, res) => {
  try {
    const { q, folder = 'INBOX' } = req.query;
    const { email, password } = getUserCredentials(req);

    if (!q) return res.json({ messages: [] });

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock(folder === 'all' ? 'INBOX' : folder);
      try {
        const results = await client.search({
          or: [
            { subject: q },
            { from: q },
            { to: q },
            { body: q },
          ],
        });

        const messages = [];
        if (results.length > 0) {
          const uids = results.slice(0, 50); // Limit results
          for await (const msg of client.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
            messages.push({
              id: msg.uid,
              from: msg.envelope?.from?.[0]?.address || '',
              fromName: msg.envelope?.from?.[0]?.name || '',
              to: msg.envelope?.to?.map(t => t.address) || [],
              subject: msg.envelope?.subject || '',
              date: msg.envelope?.date?.toISOString() || '',
              read: msg.flags?.has('\\Seen') || false,
              starred: msg.flags?.has('\\Flagged') || false,
            });
          }
        }

        res.json({ messages });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    res.status(500).json({ error: 'Search failed', messages: [] });
  }
});

// ========================================
// HYVE SOCIAL INTEGRATION
// ========================================

// Login to Hyve Social using email credentials
app.post('/api/email/social-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = email.toLowerCase().includes('@')
      ? email.toLowerCase()
      : `${email.toLowerCase()}@${MAIL_DOMAIN}`;

    // Verify email credentials
    const account = await EmailAccount.findOne({ email: normalizedEmail });
    if (!account) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, account.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate email session token
    const emailToken = jwt.sign(
      { id: account._id, email: normalizedEmail, username: account.username, sessionKey: password },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // If linked to a social account, generate social token
    if (account.socialUserId) {
      // Use the stored socialUserId as the wallet address for the token.
      // For email-only registered users, this is the pseudo-address (0x + sha256(email)).
      // For wallet users who linked their email, this is their real wallet address.
      const walletAddress = account.socialUserId;

      const socialToken = jwt.sign(
        { walletAddress },
        SOCIAL_JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        emailToken,
        socialToken,
        user: {
          walletAddress,
          username: account.socialUsername,
          email: normalizedEmail,
        },
      });
    }

    // No linked social account — frontend will prompt to create one
    res.json({
      emailToken,
      socialToken: null,
      user: null,
    });
  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Link email to existing social account
app.post('/api/email/link-social', authenticate, async (req, res) => {
  try {
    const { socialToken, walletAddress, username } = req.body;

    let resolvedWallet = null;
    let resolvedUsername = username;

    // Try verifying social token first
    if (socialToken) {
      try {
        const socialUser = jwt.verify(socialToken, SOCIAL_JWT_SECRET);
        resolvedWallet = socialUser.walletAddress || socialUser.userId || socialUser._id || socialUser.id;
        resolvedUsername = socialUser.username || username;
      } catch (err) {
        console.warn('Social token verification failed:', err.message);
      }
    }

    // Fall back to directly provided walletAddress
    if (!resolvedWallet && walletAddress) {
      resolvedWallet = walletAddress;
    }

    if (!resolvedWallet) {
      return res.status(401).json({ error: 'No valid social token or wallet address provided' });
    }

    const account = await EmailAccount.findById(req.emailUser.id);
    if (!account) return res.status(404).json({ error: 'Email account not found' });

    account.socialUserId = resolvedWallet;
    account.socialUsername = resolvedUsername || account.username;
    await account.save();

    res.json({ success: true, message: 'Accounts linked successfully' });
  } catch (error) {
    console.error('Link social error:', error);
    res.status(500).json({ error: 'Failed to link accounts' });
  }
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/email/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'HyveMail',
    domain: MAIL_DOMAIN,
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`\n🐝 HyveMail server running on port ${PORT}`);
  console.log(`   Domain: ${MAIL_DOMAIN}`);
  console.log(`   IMAP: ${IMAP_HOST}:${IMAP_PORT}`);
  console.log(`   SMTP: ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`   MongoDB: ${MONGO_URI}\n`);
});

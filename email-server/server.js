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
import multer from 'multer';

// Configure multer for file uploads (store in memory, 25MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

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

// SMTP Relay configuration (for when outbound port 25 is blocked)
// Set SMTP_RELAY_HOST to use a relay service (SendGrid, Mailgun, Amazon SES, etc.)
const SMTP_RELAY_HOST = process.env.SMTP_RELAY_HOST || ''; // e.g., 'smtp.sendgrid.net'
const SMTP_RELAY_PORT = parseInt(process.env.SMTP_RELAY_PORT || '587');
const SMTP_RELAY_USER = process.env.SMTP_RELAY_USER || ''; // e.g., 'apikey' for SendGrid
const SMTP_RELAY_PASS = process.env.SMTP_RELAY_PASS || '';
const SMTP_RELAY_SECURE = process.env.SMTP_RELAY_SECURE === 'true';

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
  // If an SMTP relay is configured, use it for outbound delivery
  // This is needed when the hosting provider blocks outbound port 25
  if (SMTP_RELAY_HOST) {
    console.log(`Using SMTP relay: ${SMTP_RELAY_HOST}:${SMTP_RELAY_PORT}`);
    return nodemailer.createTransport({
      host: SMTP_RELAY_HOST,
      port: SMTP_RELAY_PORT,
      secure: SMTP_RELAY_SECURE,
      auth: {
        user: SMTP_RELAY_USER,
        pass: SMTP_RELAY_PASS,
      },
      tls: { rejectUnauthorized: true },
      // Pool connections for better performance
      pool: true,
      maxConnections: 5,
    });
  }

  // Default: send via local Postfix (requires outbound port 25 open)
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: email, pass: password },
    tls: {
      rejectUnauthorized: false,
      // Force STARTTLS upgrade
      requireTLS: true,
    },
    // Enable debug logging for troubleshooting delivery issues
    debug: process.env.SMTP_DEBUG === 'true',
    logger: process.env.SMTP_DEBUG === 'true',
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

    // Also generate social token if email is linked to a social account
    let socialToken = null;
    let socialUser = null;
    if (account.socialUserId) {
      socialToken = jwt.sign(
        { walletAddress: account.socialUserId },
        SOCIAL_JWT_SECRET,
        { expiresIn: '7d' }
      );
      socialUser = {
        walletAddress: account.socialUserId,
        username: account.socialUsername,
        email: normalizedEmail,
      };
    }

    res.json({
      token,
      socialToken,
      socialUser,
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
          attachments: (parsed.attachments || []).map((a, idx) => ({
            filename: a.filename || `attachment-${idx}`,
            size: a.size,
            contentType: a.contentType,
            index: idx,
            url: `/api/email/messages/${msg.uid}/attachments/${idx}?folder=${folder}`,
          })),
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

// Send email (supports multipart/form-data with attachments)
app.post('/api/email/send', [authenticate, sendLimiter, upload.array('attachments', 10)], async (req, res) => {
  try {
    let to, cc, bcc, subject, body;

    // Handle both JSON and multipart/form-data
    if (req.is('multipart/form-data')) {
      // Parse fields from form data — 'to' and 'cc'/'bcc' may be JSON arrays or strings
      const parseField = (val) => {
        if (!val) return undefined;
        try { return JSON.parse(val); } catch { return val; }
      };
      to = parseField(req.body.to);
      cc = parseField(req.body.cc);
      bcc = parseField(req.body.bcc);
      subject = req.body.subject;
      body = req.body.body;
    } else {
      ({ to, cc, bcc, subject, body } = req.body);
    }

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

    // Attach uploaded files
    if (req.files && req.files.length > 0) {
      mailOptions.attachments = req.files.map(file => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      }));
    }

    // Verify SMTP connection before sending
    try {
      await transport.verify();
    } catch (verifyErr) {
      console.error('SMTP connection verification failed:', verifyErr);
      transport.close();
      return res.status(502).json({ 
        error: 'Mail server connection failed. Please try again later.',
        detail: process.env.NODE_ENV === 'development' ? verifyErr.message : undefined,
      });
    }

    const info = await transport.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId} to ${mailOptions.to} (response: ${info.response})`);
    transport.close();

    // Save a copy to Sent folder via IMAP
    try {
      const client = await getImapClient(email, password);
      try {
        // Build raw MIME message for Sent copy (including attachments)
        const boundary = `----HyveMail_${crypto.randomUUID()}`;
        const hasAttachments = req.files && req.files.length > 0;

        let rawMessage;
        if (hasAttachments) {
          const parts = [
            `From: ${mailOptions.from}`,
            `To: ${mailOptions.to}`,
            cc ? `Cc: ${mailOptions.cc}` : null,
            `Subject: ${mailOptions.subject || ''}`,
            `Date: ${new Date().toUTCString()}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            '',
            mailOptions.text || '',
          ].filter(l => l !== null);

          for (const file of req.files) {
            parts.push(
              `--${boundary}`,
              `Content-Type: ${file.mimetype}; name="${file.originalname}"`,
              `Content-Disposition: attachment; filename="${file.originalname}"`,
              `Content-Transfer-Encoding: base64`,
              '',
              file.buffer.toString('base64').match(/.{1,76}/g).join('\r\n'),
            );
          }
          parts.push(`--${boundary}--`);
          rawMessage = parts.join('\r\n');
        } else {
          rawMessage = [
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
        }

        await client.append('Sent', rawMessage, ['\\Seen']);
      } finally {
        await client.logout();
      }
    } catch (sentErr) {
      console.error('Failed to save to Sent folder:', sentErr);
      // Non-fatal - email was still sent
    }

    res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    console.error('Send email error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
    });

    // Provide more specific error messages
    let userMessage = 'Failed to send email';
    if (error.code === 'ECONNREFUSED') {
      userMessage = 'Mail server is unreachable. Please try again later.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      userMessage = 'Connection to mail server timed out. Please try again.';
    } else if (error.responseCode === 550) {
      userMessage = 'Recipient rejected. Please check the email address.';
    } else if (error.responseCode === 553 || error.responseCode === 551) {
      userMessage = 'Sender address not authorized.';
    } else if (error.responseCode === 452) {
      userMessage = 'Mailbox full or quota exceeded.';
    } else if (error.code === 'EENVELOPE') {
      userMessage = 'Invalid email address format.';
    }

    res.status(500).json({ 
      error: userMessage,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Download attachment from a message
app.get('/api/email/messages/:id/attachments/:index', authenticate, async (req, res) => {
  try {
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;
    const attachmentIndex = parseInt(req.params.index);
    const folder = req.query.folder || 'INBOX';
    const folderMap = { inbox: 'INBOX', sent: 'Sent', drafts: 'Drafts', trash: 'Trash', spam: 'Spam' };
    const imapFolder = folderMap[folder.toLowerCase()] || folder;

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock(imapFolder);
      try {
        const msg = await client.fetchOne(messageId, { source: true }, { uid: true });
        if (!msg) {
          return res.status(404).json({ error: 'Message not found' });
        }

        const parsed = await simpleParser(msg.source);
        const attachments = parsed.attachments || [];

        if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
          return res.status(404).json({ error: 'Attachment not found' });
        }

        const att = attachments[attachmentIndex];
        res.set({
          'Content-Type': att.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || 'attachment')}"`,
          'Content-Length': att.size || att.content.length,
        });
        res.send(att.content);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
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

// Get social token from email session (authenticated)
app.get('/api/email/social-token', authenticate, async (req, res) => {
  try {
    const account = await EmailAccount.findById(req.emailUser.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found', socialToken: null });
    }

    if (!account.socialUserId) {
      return res.json({ socialToken: null, user: null });
    }

    const socialToken = jwt.sign(
      { walletAddress: account.socialUserId },
      SOCIAL_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      socialToken,
      user: {
        walletAddress: account.socialUserId,
        username: account.socialUsername,
        email: account.email,
      },
    });
  } catch (error) {
    console.error('Social token error:', error);
    res.status(500).json({ error: 'Failed to get social token', socialToken: null });
  }
});

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
// HEALTH CHECK & DIAGNOSTICS
// ========================================

app.get('/api/email/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'HyveMail',
    domain: MAIL_DOMAIN,
    timestamp: new Date().toISOString(),
  });
});

// Diagnostic endpoint — checks SMTP, DNS, DKIM, SPF
// Protected: only accessible with admin token or from localhost
app.get('/api/email/diagnostics', async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '';
  const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  const adminKey = process.env.ADMIN_KEY || '';
  
  if (!isLocal && req.headers['x-admin-key'] !== adminKey) {
    return res.status(403).json({ error: 'Diagnostics only available from localhost or with admin key' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      domain: MAIL_DOMAIN,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      imapHost: IMAP_HOST,
      imapPort: IMAP_PORT,
      relayConfigured: !!SMTP_RELAY_HOST,
      relayHost: SMTP_RELAY_HOST || 'none',
    },
    checks: {},
  };

  // Check 1: SMTP connectivity
  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: { user: `postmaster@${MAIL_DOMAIN}`, pass: 'test' },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
    });
    await transport.verify();
    results.checks.smtpConnection = { status: 'ok', message: 'SMTP server reachable' };
    transport.close();
  } catch (err) {
    results.checks.smtpConnection = { 
      status: 'fail', 
      message: err.message,
      code: err.code,
      hint: err.code === 'ECONNREFUSED' 
        ? 'Postfix may not be running. Run: systemctl start postfix'
        : 'Check SMTP credentials and server status',
    };
  }

  // Check 2: SMTP relay (if configured)
  if (SMTP_RELAY_HOST) {
    try {
      const relay = nodemailer.createTransport({
        host: SMTP_RELAY_HOST,
        port: SMTP_RELAY_PORT,
        secure: SMTP_RELAY_SECURE,
        auth: { user: SMTP_RELAY_USER, pass: SMTP_RELAY_PASS },
        connectionTimeout: 10000,
      });
      await relay.verify();
      results.checks.smtpRelay = { status: 'ok', message: `Relay ${SMTP_RELAY_HOST} reachable` };
      relay.close();
    } catch (err) {
      results.checks.smtpRelay = { status: 'fail', message: err.message };
    }
  }

  // Check 3: DNS records
  try {
    const dns = await import('dns');
    const { resolve, resolveMx, resolveTxt } = dns.promises;

    // MX record
    try {
      const mx = await resolveMx(MAIL_DOMAIN);
      results.checks.mxRecord = { status: 'ok', records: mx };
    } catch (e) {
      results.checks.mxRecord = { status: 'fail', message: 'No MX record found', hint: `Add MX record pointing to ${SMTP_HOST}` };
    }

    // SPF record
    try {
      const txt = await resolveTxt(MAIL_DOMAIN);
      const spf = txt.flat().find(r => r.startsWith('v=spf1'));
      results.checks.spfRecord = spf 
        ? { status: 'ok', record: spf }
        : { status: 'fail', message: 'No SPF record found', hint: 'Add TXT record: v=spf1 mx a:mail.hyvechain.com -all' };
    } catch (e) {
      results.checks.spfRecord = { status: 'fail', message: 'DNS lookup failed' };
    }

    // DKIM record
    try {
      const dkimTxt = await resolveTxt(`mail._domainkey.${MAIL_DOMAIN}`);
      const dkim = dkimTxt.flat().find(r => r.includes('v=DKIM1'));
      results.checks.dkimRecord = dkim 
        ? { status: 'ok', record: dkim.substring(0, 80) + '...' }
        : { status: 'fail', message: 'DKIM record found but invalid' };
    } catch (e) {
      results.checks.dkimRecord = { status: 'fail', message: 'No DKIM record found', hint: 'Run setup-mail.sh to generate DKIM keys, then add the TXT record' };
    }

    // DMARC record
    try {
      const dmarcTxt = await resolveTxt(`_dmarc.${MAIL_DOMAIN}`);
      const dmarc = dmarcTxt.flat().find(r => r.startsWith('v=DMARC1'));
      results.checks.dmarcRecord = dmarc 
        ? { status: 'ok', record: dmarc }
        : { status: 'fail', message: 'No DMARC record found', hint: 'Add TXT record for _dmarc: v=DMARC1; p=quarantine; rua=mailto:postmaster@hyvechain.com' };
    } catch (e) {
      results.checks.dmarcRecord = { status: 'fail', message: 'No DMARC record found' };
    }

    // PTR record (reverse DNS)
    try {
      const addresses = await resolve(SMTP_HOST);
      if (addresses.length > 0) {
        const ptr = await dns.promises.reverse(addresses[0]);
        results.checks.ptrRecord = { status: 'ok', ip: addresses[0], ptr };
      }
    } catch (e) {
      results.checks.ptrRecord = { 
        status: 'warn', 
        message: 'Could not verify PTR record',
        hint: 'Set reverse DNS (PTR) via your hosting provider to point to mail.hyvechain.com',
      };
    }
  } catch (dnsErr) {
    results.checks.dns = { status: 'error', message: dnsErr.message };
  }

  // Check 4: Outbound port 25 (direct delivery)
  try {
    const net = await import('net');
    const port25Open = await new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(5000);
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.on('timeout', () => { sock.destroy(); resolve(false); });
      sock.connect(25, 'gmail-smtp-in.l.google.com');
    });
    results.checks.outboundPort25 = port25Open
      ? { status: 'ok', message: 'Outbound port 25 is open — direct delivery works' }
      : { 
          status: 'fail', 
          message: 'Outbound port 25 is BLOCKED',
          hint: 'Your hosting provider blocks port 25. Configure SMTP_RELAY_HOST to use a relay service (SendGrid, Mailgun, Amazon SES).',
        };
  } catch (e) {
    results.checks.outboundPort25 = { status: 'error', message: e.message };
  }

  // Summary
  const failCount = Object.values(results.checks).filter(c => c.status === 'fail').length;
  results.summary = failCount === 0 
    ? 'All checks passed — outbound delivery should work'
    : `${failCount} issue(s) found that may prevent outbound delivery`;

  res.json(results);
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

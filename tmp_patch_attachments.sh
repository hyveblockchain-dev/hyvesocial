#!/bin/bash
# Patch server.js to add attachment support

cd /opt/hyvemail

# 1. Add multer import after the crypto import
sed -i "/^import crypto from 'crypto';/a import multer from 'multer';\n\n// Configure multer for attachment uploads (25MB max)\nconst upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });" server.js

# 2. Add attachment download endpoint - insert before "// Send email" line
cat > /tmp/attachment_endpoint.js << 'ENDPOINT'

// Download attachment from a message
app.get('/api/email/messages/:id/attachments/:index', authenticate, async (req, res) => {
  try {
    const { email, password } = getUserCredentials(req);
    const messageId = req.params.id;
    const attachIndex = parseInt(req.params.index);
    const folder = req.query.folder || 'INBOX';

    const client = await getImapClient(email, password);
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(messageId, { source: true }, { uid: true });
        if (!msg?.source) {
          return res.status(404).json({ error: 'Message not found' });
        }
        const parsed = await simpleParser(msg.source);
        const attachments = parsed.attachments || [];
        if (attachIndex < 0 || attachIndex >= attachments.length) {
          return res.status(404).json({ error: 'Attachment not found' });
        }
        const att = attachments[attachIndex];
        res.setHeader('Content-Type', att.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${att.filename || 'attachment'}"`);
        res.setHeader('Content-Length', att.size || att.content.length);
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

ENDPOINT

# Insert the attachment download endpoint before "// Send email"
sed -i '/^\/\/ Send email$/r /tmp/attachment_endpoint.js' server.js

# 3. Replace the send endpoint to support file attachments
# First find and replace the send route line to use multer
sed -i "s|app.post('/api/email/send', \[authenticate, sendLimiter\], async|app.post('/api/email/send', [authenticate, sendLimiter, upload.array('attachments', 10)], async|" server.js

# 4. Add attachment handling in the send endpoint - after text: body line in mailOptions
# We need to add attachments from req.files to mailOptions
cat > /tmp/fix_send.py << 'PYEOF'
import re

with open('/opt/hyvemail/server.js', 'r') as f:
    content = f.read()

# Find the mailOptions text line and add attachment handling after it
old_block = """    if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;

    // Add signature if set"""

new_block = """    if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;

    // Add file attachments from multer
    if (req.files && req.files.length > 0) {
      mailOptions.attachments = req.files.map(f => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      }));
    }

    // Add signature if set"""

content = content.replace(old_block, new_block)

# Also fix the raw message builder for Sent folder to include attachments info
old_sent = """          `Content-Type: text/plain; charset=utf-8`,
          '',
          mailOptions.text || '',
        ].filter(l => l !== null).join('\\r\\n');"""

new_sent = """          `Content-Type: text/plain; charset=utf-8`,
          '',
          mailOptions.text || '',
        ].filter(l => l !== null).join('\\r\\n');
        // Note: Sent copy is plain text only; attachments are in the delivered email"""

content = content.replace(old_sent, new_sent)

# Also need to handle body from FormData (multer changes req.body parsing)
# The destructuring `const { to, cc, bcc, subject, body } = req.body;` should still work
# because multer populates req.body with text fields. But 'to' might come as a string, not array.

with open('/opt/hyvemail/server.js', 'w') as f:
    f.write(content)

print("Send endpoint patched successfully")
PYEOF

python3 /tmp/fix_send.py

# 5. Restart the server
pm2 restart hyvemail
echo "Server restarted"

# Verify
sleep 2
pm2 status hyvemail
echo "PATCH COMPLETE"

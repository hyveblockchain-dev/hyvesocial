import sys

with open('/root/server.js', 'r') as f:
    content = f.read()

# 1. Update wallet login to also check linked_wallet
old_login_query = """    // Check if user exists
    const userResult = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    const userExists = userResult.rows.length > 0;
    const user = userExists ? transformUser(userResult.rows[0], true) : null;"""

new_login_query = """    // Check if user exists (by wallet_address OR linked_wallet)
    let userResult = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    // If not found by primary wallet, check linked_wallet
    if (userResult.rows.length === 0) {
      userResult = await db.query(
        'SELECT * FROM users WHERE linked_wallet = $1',
        [addressLower]
      );
    }

    const userExists = userResult.rows.length > 0;
    const user = userExists ? transformUser(userResult.rows[0], true) : null;

    // If found via linked_wallet, generate token for the primary wallet_address
    const tokenAddress = userExists ? userResult.rows[0].wallet_address : addressLower;"""

content = content.replace(old_login_query, new_login_query)

# 2. Update token generation in login to use tokenAddress
old_token = """    // Generate JWT token
    const token = generateToken(addressLower);"""
new_token = """    // Generate JWT token (use primary wallet_address for linked accounts)
    const token = generateToken(tokenAddress);"""
content = content.replace(old_token, new_token)

# 3. Add link-email and link-wallet endpoints before /api/auth/me
insert_marker = """// Get current authenticated user
app.get('/api/auth/me', authenticateToken, async (req, res) => {"""

link_endpoints = """// Link HyveMail email to an existing social account (for wallet users)
app.post('/api/auth/link-email', authenticateToken, async (req, res) => {
  try {
    const { email, emailPassword } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase();
    if (!normalizedEmail.endsWith('@hyvechain.com')) {
      return res.status(400).json({ error: 'Only @hyvechain.com emails are supported' });
    }

    // Verify the email credentials against the mail server
    const https = require('https');
    const verifyData = JSON.stringify({ email: normalizedEmail, password: emailPassword });
    
    const emailVerified = await new Promise((resolve, reject) => {
      const verifyReq = https.request({
        hostname: 'mail-api.hyvechain.com',
        path: '/api/email/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(verifyData)
        }
      }, (verifyRes) => {
        let body = '';
        verifyRes.on('data', d => body += d);
        verifyRes.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(verifyRes.statusCode === 200 ? parsed : null);
          } catch { resolve(null); }
        });
      });
      verifyReq.on('error', () => resolve(null));
      verifyReq.write(verifyData);
      verifyReq.end();
    });

    if (!emailVerified || !emailVerified.token) {
      return res.status(401).json({ error: 'Invalid email credentials' });
    }

    // Check if email is already linked to another account
    const emailTaken = await db.query('SELECT * FROM users WHERE email = $1 AND wallet_address != $2', [normalizedEmail, req.userAddress]);
    if (emailTaken.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already linked to another account' });
    }

    // Update user's email
    await db.query('UPDATE users SET email = $1 WHERE wallet_address = $2', [normalizedEmail, req.userAddress]);

    // Link on the mail server side
    try {
      const socialToken = req.headers['authorization'].split(' ')[1];
      const linkData = JSON.stringify({ socialToken, username: req.userAddress });
      const linkReq = https.request({
        hostname: 'mail-api.hyvechain.com',
        path: '/api/email/link-social',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + emailVerified.token,
          'Content-Length': Buffer.byteLength(linkData)
        }
      }, (linkRes) => {
        let body = '';
        linkRes.on('data', d => body += d);
        linkRes.on('end', () => console.log('Mail link result:', body));
      });
      linkReq.on('error', (e) => console.warn('Mail link failed:', e.message));
      linkReq.write(linkData);
      linkReq.end();
    } catch (linkErr) {
      console.warn('Mail link error:', linkErr.message);
    }

    res.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error('Link email error:', error);
    res.status(500).json({ error: 'Failed to link email' });
  }
});

// Link a wallet to an existing email-based social account
app.post('/api/auth/link-wallet', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ error: 'Wallet address and signature are required' });
    }

    const addressLower = walletAddress.toLowerCase();

    // Get and verify nonce
    const nonceData = nonces.get(addressLower);
    if (!nonceData || Date.now() > nonceData.expires) {
      return res.status(400).json({ error: 'Nonce expired. Please request a new one.' });
    }

    const isValid = verifySignature(nonceData.nonce, signature, addressLower);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid wallet signature' });
    }

    nonces.delete(addressLower);

    // Check wallet isn't already used as a primary address
    const walletExists = await db.query('SELECT * FROM users WHERE wallet_address = $1', [addressLower]);
    if (walletExists.rows.length > 0) {
      return res.status(400).json({ error: 'This wallet is already linked to another account' });
    }

    // Check wallet isn't already linked to another account
    const linkedExists = await db.query('SELECT * FROM users WHERE linked_wallet = $1', [addressLower]);
    if (linkedExists.rows.length > 0) {
      return res.status(400).json({ error: 'This wallet is already linked to another account' });
    }

    // Update user with linked wallet
    await db.query('UPDATE users SET linked_wallet = $1 WHERE wallet_address = $2', [addressLower, req.userAddress]);

    res.json({ success: true, linkedWallet: addressLower });
  } catch (error) {
    console.error('Link wallet error:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

// Get current authenticated user
app.get('/api/auth/me', authenticateToken, async (req, res) => {"""

content = content.replace(insert_marker, link_endpoints)

# 4. Update transformUser to include email and linked_wallet
old_transform = """    followingCount: dbUser.following_count,
    email: dbUser.email || null
  };"""
new_transform = """    followingCount: dbUser.following_count,
    email: dbUser.email || null,
    linkedWallet: dbUser.linked_wallet || null
  };"""
content = content.replace(old_transform, new_transform)

with open('/root/server.js', 'w') as f:
    f.write(content)

print('All account linking patches applied successfully')

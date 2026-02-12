import sys

with open('/root/server.js', 'r') as f:
    content = f.read()

old = """    // Link on the mail server side
    try {
      const socialToken = req.headers['authorization'].split(' ')[1];
      const linkData = JSON.stringify({ socialToken, username: req.userAddress });"""

new = """    // Get user's username for the link
    const currentUser = await db.query('SELECT username FROM users WHERE wallet_address = $1', [req.userAddress]);
    const currentUsername = currentUser.rows.length > 0 ? currentUser.rows[0].username : req.userAddress;

    // Link on the mail server side
    try {
      const socialToken = req.headers['authorization'].split(' ')[1];
      const linkData = JSON.stringify({ socialToken, walletAddress: req.userAddress, username: currentUsername });"""

content = content.replace(old, new)

with open('/root/server.js', 'w') as f:
    f.write(content)

print('Patched link-email to send walletAddress and username')

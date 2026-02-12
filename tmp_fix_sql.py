import sys

with open('/root/server.js', 'r') as f:
    lines = f.readlines()

with open('/root/server.js', 'w') as f:
    for line in lines:
        if 'WHERE email' in line and 'normalizedEmail' in line and '$1' not in line:
            line = "    const emailExists = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);\n"
        elif 'WHERE username' in line and '[username]' in line and '$1' not in line:
            line = "    const usernameTaken = await db.query('SELECT * FROM users WHERE username = $1', [username]);\n"
        elif 'VALUES' in line and 'wallet_address, username, email' in line and '$1' not in line:
            line = "      'INSERT INTO users (wallet_address, username, email, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',\n"
        f.write(line)

print('Fixed SQL placeholders')

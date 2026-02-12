import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Read the social server.js auth verification logic
stdin, stdout, stderr = ssh.exec_command("grep -n 'auth/me\\|verifyToken\\|jwt.verify\\|authenticate\\|walletAddress\\|middleware' /root/server.js | head -30")
print('=== AUTH RELATED LINES ===')
print(stdout.read().decode())

# Read the auth middleware
stdin, stdout, stderr = ssh.exec_command("wc -l /root/server.js")
print('=== FILE LENGTH ===')
print(stdout.read().decode())

# Get the auth/me endpoint
stdin, stdout, stderr = ssh.exec_command("grep -n -A 30 \"api/auth/me\" /root/server.js | head -40")
print('=== /api/auth/me ===')
print(stdout.read().decode())

# Get the auth middleware
stdin, stdout, stderr = ssh.exec_command("grep -n -B 2 -A 15 'function.*auth\\|const.*auth.*=.*\\(req' /root/server.js | head -40")
print('=== AUTH MIDDLEWARE ===')
print(stdout.read().decode())

ssh.close()

import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Search for TLON user
stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d hyve_social -c \"SELECT wallet_address, username FROM users WHERE LOWER(username) LIKE '%tlon%'\"")
print('=== TLON IN SOCIAL DB ===')
print(stdout.read().decode())

# Also check the wallet address
stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d hyve_social -c \"SELECT wallet_address, username FROM users WHERE wallet_address = '0x3985b1dbfa132b0a0acb79183c872e46d38c2301'\"")
print('=== WALLET CHECK ===')
print(stdout.read().decode())

# Count total users
stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d hyve_social -c \"SELECT COUNT(*) FROM users\"")
print('=== TOTAL USERS ===')
print(stdout.read().decode())

# Check all users
stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d hyve_social -c \"SELECT wallet_address, username FROM users ORDER BY created_at DESC\"")
print('=== ALL USERS ===')
print(stdout.read().decode())

ssh.close()

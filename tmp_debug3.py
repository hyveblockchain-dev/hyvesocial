import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Find the social API app and its JWT secret
stdin, stdout, stderr = ssh.exec_command("pm2 list")
print('=== PM2 PROCESSES ===')
print(stdout.read().decode())

# Find .env files
stdin, stdout, stderr = ssh.exec_command("find /opt -name '.env' 2>/dev/null; find /root -name '.env' 2>/dev/null; find /var/www -name '.env' 2>/dev/null")
print('=== ENV FILES ===')
print(stdout.read().decode())

# Find JWT secret in env files
stdin, stdout, stderr = ssh.exec_command("grep -ri 'JWT_SECRET\\|jwt_secret' /opt/*/.env /root/*/.env /var/www/*/.env 2>/dev/null | head -10")
print('=== JWT SECRETS ===')
print(stdout.read().decode())

ssh.close()

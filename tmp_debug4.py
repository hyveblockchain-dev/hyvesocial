import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Check root .env
stdin, stdout, stderr = ssh.exec_command("cat /root/.env")
print('=== /root/.env ===')
print(stdout.read().decode())

# Find where hyve-backend lives
stdin, stdout, stderr = ssh.exec_command("pm2 describe hyve-backend | grep 'script path\\|exec cwd\\|script\\|cwd'")
print('=== HYVE-BACKEND INFO ===')
print(stdout.read().decode())

# Check for .env in the app directory
stdin, stdout, stderr = ssh.exec_command("pm2 describe hyve-backend | grep 'exec cwd'")
cwd = stdout.read().decode().strip()
print('CWD:', cwd)

# Find .env in the backend's directory
stdin, stdout, stderr = ssh.exec_command("find / -maxdepth 4 -name '.env' 2>/dev/null")
print('=== ALL ENV FILES ===')
print(stdout.read().decode())

ssh.close()

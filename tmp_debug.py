import paramiko, json
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('68.168.218.138', username='root', password='JEsus$20252026')

# Check what the email login returns for tlon
stdin, stdout, stderr = ssh.exec_command("""curl -s -X POST http://localhost:4500/api/email/login -H 'Content-Type: application/json' -d '{"email":"tlon@hyvechain.com","password":"test123"}' """)
print('=== LOGIN RESPONSE (test password) ===')
out = stdout.read().decode()
print(out[:500])

# Check the social API JWT secret
stdin, stdout, stderr = ssh.exec_command("grep -i 'jwt\\|secret' /opt/hyvechain/.env 2>/dev/null || echo 'No .env found'; cat /opt/hyvechain/.env 2>/dev/null | head -20 || echo 'trying other paths'")
print('\n=== SOCIAL API ENV ===')
print(stdout.read().decode())

# Check where social API lives
stdin, stdout, stderr = ssh.exec_command("pm2 list")
print('\n=== PM2 PROCESSES ===')
print(stdout.read().decode())

ssh.close()

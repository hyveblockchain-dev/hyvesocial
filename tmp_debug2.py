import paramiko, json
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('68.168.218.138', username='root', password='JEsus$20252026')

# Find the social API
stdin, stdout, stderr = ssh.exec_command("find / -name '.env' -path '*/hyve*' 2>/dev/null; find / -name 'server.js' -path '*/hyve*' 2>/dev/null | grep -v node_modules | grep -v hyvemail")
print('=== FILES ===')
print(stdout.read().decode())

# Check email server env for SOCIAL_JWT_SECRET
stdin, stdout, stderr = ssh.exec_command("grep SOCIAL_JWT_SECRET /opt/hyvemail/.env 2>/dev/null; echo '---'; cat /opt/hyvemail/.env 2>/dev/null || echo 'no .env'")
print('=== HYVEMAIL ENV ===')
print(stdout.read().decode())

# Check what social-api.hyvechain.com resolves to
stdin, stdout, stderr = ssh.exec_command("dig +short social-api.hyvechain.com 2>/dev/null || nslookup social-api.hyvechain.com 2>/dev/null")
print('=== SOCIAL API DNS ===')
print(stdout.read().decode())

# Check nginx for social API proxy
stdin, stdout, stderr = ssh.exec_command("grep -r 'social-api\\|social_api\\|proxy_pass' /etc/nginx/ 2>/dev/null | head -20")
print('=== NGINX CONFIG ===')
print(stdout.read().decode())

ssh.close()

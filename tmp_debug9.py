import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Check how server.js connects to PG
stdin, stdout, stderr = ssh.exec_command("grep -n 'Pool\\|pg\\|postgres\\|DB_\\|database' /root/server.js | head -20")
print('=== DB CONFIG ===')
print(stdout.read().decode())

# Read db connection setup
stdin, stdout, stderr = ssh.exec_command("head -50 /root/server.js")
print('=== SERVER HEAD ===')
print(stdout.read().decode())

# Try postgres user directly  
stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d hyve_social -c \"SELECT wallet_address, username FROM users LIMIT 10\"")
print('=== USERS VIA POSTGRES ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()

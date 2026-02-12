import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Try with host flag for password auth
stdin, stdout, stderr = ssh.exec_command("""PGPASSWORD='JEsus\$20252026' psql -h localhost -U hyve_admin -d hyve_social -c "SELECT wallet_address, username FROM users LIMIT 10" """)
print('=== ALL USERS ===')
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
print(err)

ssh.close()

import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Check if tlon's wallet exists in social DB
stdin, stdout, stderr = ssh.exec_command("""PGPASSWORD='JEsus$20252026' psql -U hyve_admin -d hyve_social -c "SELECT wallet_address, username FROM users WHERE wallet_address = '0x3985b1dbfa132b0a0acb79183c872e46d38c2301'" """)
print('=== TLON USER IN SOCIAL DB ===')
print(stdout.read().decode())
print(stderr.read().decode())

# Also check case-insensitive
stdin, stdout, stderr = ssh.exec_command("""PGPASSWORD='JEsus$20252026' psql -U hyve_admin -d hyve_social -c "SELECT wallet_address, username FROM users WHERE LOWER(wallet_address) = LOWER('0x3985b1dbfa132b0a0acb79183c872e46d38c2301')" """)
print('=== TLON USER (case insensitive) ===')
print(stdout.read().decode())

# List all users to see what's there
stdin, stdout, stderr = ssh.exec_command("""PGPASSWORD='JEsus$20252026' psql -U hyve_admin -d hyve_social -c "SELECT wallet_address, username FROM users LIMIT 10" """)
print('=== ALL USERS ===')
print(stdout.read().decode())

ssh.close()

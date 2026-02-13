import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# First try to find the DB connection string in server.js
cmd = "grep -n 'connectionString\\|DATABASE_URL\\|new Pool' /root/server.js | head -10"
print(f"=== Finding DB config ===")
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out: print(out)
if err: print("STDERR:", err)

# Try with sudo -u postgres psql instead
cmd2 = """sudo -u postgres psql -d hyve_social -c "SELECT id, metadata::text FROM posts ORDER BY id DESC LIMIT 3;" """
print(f"=== DB query via psql ===")
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=15)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out: print(out)
if err: print("STDERR:", err)

# Also check the column type
cmd3 = """sudo -u postgres psql -d hyve_social -c "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='posts' AND column_name='metadata';" """
print(f"=== Column type ===")
stdin, stdout, stderr = ssh.exec_command(cmd3, timeout=15)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out: print(out)
if err: print("STDERR:", err)

ssh.close()

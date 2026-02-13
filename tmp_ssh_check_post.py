import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

commands = [
    "sed -n '998,1005p' /root/server.js",
    """node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://localhost/hyve_social' });
pool.query('SELECT id, metadata FROM posts ORDER BY id DESC LIMIT 3').then(r => {
  r.rows.forEach(row => {
    console.log('Post', row.id, '- type:', typeof row.metadata, '- value:', JSON.stringify(row.metadata).slice(0, 200));
  });
  pool.end();
});
"
"""
]

for cmd in commands:
    print(f"=== COMMAND: {cmd.strip().splitlines()[0]} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print("STDERR:", err)
    print()

ssh.close()

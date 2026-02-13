import paramiko
import sys

host = "157.250.207.109"
user = "root"
password = "JEsus$20252026"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

def run(cmd, desc):
    print(f"\n{'='*60}")
    print(f"STEP: {desc}")
    print(f"CMD:  {cmd}")
    print(f"{'='*60}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out)
    if err.strip():
        print(f"STDERR: {err}")
    return out, err

# Step 1: Check nginx site configs
run("ls -la /etc/nginx/sites-enabled/", "Check nginx site configs")

# Step 2: Read site config
out, _ = run("ls /etc/nginx/sites-enabled/", "List site config filenames")
site_files = out.strip().split('\n')
for f in site_files:
    f = f.strip()
    if f:
        run(f"cat /etc/nginx/sites-enabled/{f}", f"Read site config: {f}")

# Step 3: Add client_max_body_size to site config(s)
# First check if it's already there
out, _ = run("grep -n 'client_max_body_size' /etc/nginx/sites-enabled/* 2>/dev/null || echo 'NOT FOUND'", "Check if client_max_body_size exists in site configs")

for f in site_files:
    f = f.strip()
    if not f:
        continue
    # Check if already set in this file
    check_out, _ = run(f"grep -c 'client_max_body_size' /etc/nginx/sites-enabled/{f} 2>/dev/null || echo '0'", f"Check if already in {f}")
    count = check_out.strip()
    if count != '0' and count != '':
        # Already exists, update it
        run(f"sed -i 's/client_max_body_size.*/client_max_body_size 50m;/' /etc/nginx/sites-enabled/{f}",
            f"Update existing client_max_body_size in {f}")
    else:
        # Insert after first 'listen' directive block - find last listen line and insert after it
        run(f"""python3 -c "
import re
with open('/etc/nginx/sites-enabled/{f}', 'r') as fh:
    content = fh.read()

# Insert client_max_body_size after the first server {{ block opening
# Find first 'server {{' and insert after the listen directives
lines = content.split('\\n')
new_lines = []
inserted = False
in_server = False
for i, line in enumerate(lines):
    new_lines.append(line)
    if not inserted and 'server {{' in line.replace(' ', ''):
        in_server = True
    if in_server and not inserted and ('listen' in line or 'server_name' in line):
        # Check if next line is also listen/server_name
        if i+1 < len(lines) and ('listen' in lines[i+1] or 'server_name' in lines[i+1]):
            continue
        new_lines.append('    client_max_body_size 50m;')
        inserted = True

with open('/etc/nginx/sites-enabled/{f}', 'w') as fh:
    fh.write('\\n'.join(new_lines))
print('Inserted client_max_body_size 50m; into {f}')
"
""", f"Insert client_max_body_size into {f}")

# Step 4: Add to /etc/nginx/nginx.conf http block as fallback
run("cat /etc/nginx/nginx.conf", "Read nginx.conf")

check_out, _ = run("grep -c 'client_max_body_size' /etc/nginx/nginx.conf 2>/dev/null || echo '0'", "Check if client_max_body_size in nginx.conf")
count = check_out.strip()
if count != '0' and count != '':
    run("sed -i 's/client_max_body_size.*/client_max_body_size 50m;/' /etc/nginx/nginx.conf",
        "Update existing client_max_body_size in nginx.conf")
else:
    run("""sed -i '/http {/a\\    client_max_body_size 50m;' /etc/nginx/nginx.conf""",
        "Insert client_max_body_size into nginx.conf http block")

# Step 5: Test nginx config
run("nginx -t", "Test nginx configuration")

# Step 6: Reload nginx
run("systemctl reload nginx", "Reload nginx")

# Step 7: Verify
run("grep -n 'client_max_body_size' /etc/nginx/sites-enabled/* /etc/nginx/nginx.conf", "Verify client_max_body_size everywhere")

client.close()
print("\n\nDONE - All steps completed.")

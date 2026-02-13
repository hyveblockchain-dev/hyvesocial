import paramiko

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
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out)
    if err.strip():
        print(f"STDERR: {err}")
    return out, err

# Step 3: Insert client_max_body_size into site config
# Use sed to insert after the second "server {" line (the SSL server block)
# Actually, add it to BOTH server blocks for safety
run(
    r"""sed -i '/^server {/a\    client_max_body_size 50m;' /etc/nginx/sites-available/social-api.hyvechain.com""",
    "Insert client_max_body_size after every 'server {' in site config"
)

# Verify it was added
run("cat /etc/nginx/sites-available/social-api.hyvechain.com", "Verify site config after edit")

# Step 4: Insert client_max_body_size into nginx.conf http{} block
run(
    r"""sed -i '/^http {/a\    client_max_body_size 50m;' /etc/nginx/nginx.conf""",
    "Insert client_max_body_size into nginx.conf http block"
)

# Verify
run("cat /etc/nginx/nginx.conf", "Verify nginx.conf after edit")

# Step 5: Test nginx config
run("nginx -t", "Test nginx configuration")

# Step 6: Reload nginx
run("systemctl reload nginx", "Reload nginx")

# Step 7: Verify all occurrences
run("grep -n 'client_max_body_size' /etc/nginx/sites-available/social-api.hyvechain.com /etc/nginx/nginx.conf",
    "Verify client_max_body_size everywhere")

client.close()
print("\n\nDONE")

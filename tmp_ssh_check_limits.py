import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

commands = [
    "echo '=== CMD1: Body parser grep ===' && grep -n 'bodyParser\\|body-parser\\|express.json\\|express.urlencoded\\|json({.*limit\\|urlencoded\\|body_parser\\|payload\\|limit.*mb\\|limit.*kb' /root/server.js",
    "echo '=== CMD2: app.use middleware grep ===' && grep -n 'app.use.*json\\|app.use.*urlencoded\\|app.use.*raw\\|app.use.*text' /root/server.js",
    "echo '=== CMD3: nginx config ===' && cat /etc/nginx/sites-enabled/default 2>/dev/null || cat /etc/nginx/nginx.conf 2>/dev/null || echo 'No nginx config found'",
    "echo '=== CMD4: client_max_body_size ===' && grep -n 'client_max_body_size' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* /etc/nginx/nginx.conf 2>/dev/null || echo 'No nginx body size limit found'",
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(out)
    if err:
        print("STDERR:", err)
    print()

ssh.close()

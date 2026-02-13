import paramiko

host = "157.250.207.109"
user = "root"
password = "JEsus$20252026"

commands = [
    'psql -U hyve_social -d hyve_social -c "SELECT id, LEFT(image_url, 120) as url_preview, metadata FROM posts WHERE metadata::text LIKE \'%isGif%\' ORDER BY created_at DESC LIMIT 5;"',
    'psql -U hyve_social -d hyve_social -c "SELECT id, image_url FROM posts WHERE metadata::text LIKE \'%isGif%\' ORDER BY created_at DESC LIMIT 3;"',
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password)

for cmd in commands:
    print(f"\n{'='*80}")
    print(f"COMMAND: {cmd}")
    print('='*80)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print("STDERR:", err)

client.close()
print("\nDone.")

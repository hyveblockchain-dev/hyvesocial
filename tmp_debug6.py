import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('157.250.207.109', username='root', password='JEsus$20252026')

# Read the auth.js module
stdin, stdout, stderr = ssh.exec_command("cat /root/auth.js")
print(stdout.read().decode())

ssh.close()

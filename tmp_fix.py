with open('/root/nsfw-ai/nsfw_service.py', 'r') as f:
    c = f.read()

c = c.replace('NSFW_THRESHOLD = 0.35', 'NSFW_THRESHOLD = 0.15')

with open('/root/nsfw-ai/nsfw_service.py', 'w') as f:
    f.write(c)

print('Done - threshold lowered to 0.15')

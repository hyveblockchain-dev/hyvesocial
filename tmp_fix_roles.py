import re

with open('/root/server.js', 'r') as f:
    content = f.read()

# Fix assign role: add resolveAddress
old_assign = 'const targetAddress = req.params.address;\n    const { roleId } = req.body;'
new_assign = 'const targetAddress = await resolveAddress(req.params.address);\n    const { roleId } = req.body;'

count1 = content.count(old_assign)
print(f'Assign role match count: {count1}')
content = content.replace(old_assign, new_assign, 1)

# Fix remove role: add resolveAddress
old_remove = 'const targetAddress = req.params.address;\n    const roleId = parseInt(req.params.roleId);'
new_remove = 'const targetAddress = await resolveAddress(req.params.address);\n    const roleId = parseInt(req.params.roleId);'

count2 = content.count(old_remove)
print(f'Remove role match count: {count2}')
content = content.replace(old_remove, new_remove, 1)

with open('/root/server.js', 'w') as f:
    f.write(content)

print('Done!')

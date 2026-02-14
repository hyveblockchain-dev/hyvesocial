import sys

with open('/root/server.js', 'r') as f:
    content = f.read()

search = """    const result = await db.query(
      'UPDATE channel_messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *',"""

replace = """    // Save edit history before updating
    await db.query('INSERT INTO message_edit_history (message_id, old_content) VALUES ($1, $2)', [messageId, msg.rows[0].content]);

    const result = await db.query(
      'UPDATE channel_messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *',"""

if search in content:
    content = content.replace(search, replace, 1)
    with open('/root/server.js', 'w') as f:
        f.write(content)
    print('SUCCESS: edit history injection done')
else:
    print('FAIL: search string not found')
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'UPDATE channel_messages SET content' in line:
            print(f'Found at line {i+1}: {repr(line)}')
            for j in range(max(0,i-3), min(len(lines),i+3)):
                print(f'  {j+1}: {repr(lines[j])}')
    sys.exit(1)

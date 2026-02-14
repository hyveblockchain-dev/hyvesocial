const fs = require('fs');
const lines = fs.readFileSync('/root/server.js', 'utf8').split('\n');

// 1. nsfw/slowmode to add after permissions lines
const nsfw_slowmode = [
  "    if (req.body.nsfw !== undefined) { sets.push('nsfw = $' + i++); vals.push(!!req.body.nsfw); }",
  "    if (req.body.slowmode !== undefined) { sets.push('slowmode = $' + i++); vals.push(parseInt(req.body.slowmode) || 0); }"
];

// 2. Fix role assignment resolveAddress
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "const targetAddress = req.params.address;") {
    const context = lines.slice(Math.max(0, i-5), i).join('\n');
    if (context.includes('/roles') || context.includes('assign role') || context.includes('remove role')) {
      lines[i] = lines[i].replace(
        "const targetAddress = req.params.address;",
        "const targetAddress = await resolveAddress(req.params.address);"
      );
    }
  }
}

// 3. New endpoints to insert
const newEndpointsStr = [
  '',
  '// ── PATCH /api/groups/:id/categories/:catId — update/rename category ──',
  "app.patch('/api/groups/:id/categories/:catId', authenticateToken, async (req, res) => {",
  '  try {',
  '    const groupId = parseInt(req.params.id);',
  '    const catId = parseInt(req.params.catId);',
  '    const { name, position } = req.body;',
  '',
  "    const _canDo = await hasPermission(groupId, req.userAddress, 'manageChannels');",
  "    if (!_canDo) return res.status(403).json({ error: 'You need the Manage Channels permission' });",
  '',
  '    const sets = [];',
  '    const vals = [];',
  '    let i = 1;',
  "    if (name !== undefined) { sets.push('name = $' + i++); vals.push(name.trim()); }",
  "    if (position !== undefined) { sets.push('position = $' + i++); vals.push(position); }",
  '',
  "    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });",
  '    vals.push(catId, groupId);',
  '',
  '    const result = await db.query(',
  "      'UPDATE channel_categories SET ' + sets.join(', ') + ' WHERE id = $' + i++ + ' AND group_id = $' + i + ' RETURNING *',",
  '      vals',
  '    );',
  '    res.json({ category: result.rows[0] });',
  '  } catch (error) {',
  "    console.error('Update category error:', error);",
  "    res.status(500).json({ error: 'Failed to update category' });",
  '  }',
  '});',
  '',
  '// ── POST /api/channels/:channelId/messages/:messageId/pin — toggle pin ──',
  "app.post('/api/channels/:channelId/messages/:messageId/pin', authenticateToken, async (req, res) => {",
  '  try {',
  '    const channelId = parseInt(req.params.channelId);',
  '    const messageId = parseInt(req.params.messageId);',
  '',
  "    const chResult = await db.query('SELECT group_id FROM channels WHERE id = $1', [channelId]);",
  "    if (!chResult.rows[0]) return res.status(404).json({ error: 'Channel not found' });",
  '    const groupId = chResult.rows[0].group_id;',
  '',
  "    const _canDo = await hasPermission(groupId, req.userAddress, 'manageMessages');",
  "    if (!_canDo) return res.status(403).json({ error: 'You need the Manage Messages permission' });",
  '',
  "    const msg = await db.query('SELECT is_pinned FROM channel_messages WHERE id = $1 AND channel_id = $2', [messageId, channelId]);",
  "    if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });",
  '',
  '    const newPinned = !msg.rows[0].is_pinned;',
  '    const result = await db.query(',
  "      'UPDATE channel_messages SET is_pinned = $1, pinned_at = $2, pinned_by = $3 WHERE id = $4 RETURNING *',",
  '      [newPinned, newPinned ? new Date() : null, newPinned ? req.userAddress : null, messageId]',
  '    );',
  '    res.json({ message: result.rows[0], pinned: newPinned });',
  '  } catch (error) {',
  "    console.error('Pin message error:', error);",
  "    res.status(500).json({ error: 'Failed to pin message' });",
  '  }',
  '});',
  '',
  '// ── GET /api/channels/:channelId/pins — get pinned messages ──',
  "app.get('/api/channels/:channelId/pins', authenticateToken, async (req, res) => {",
  '  try {',
  '    const channelId = parseInt(req.params.channelId);',
  '    const result = await db.query(',
  "      `SELECT cm.*, u.username, u.profile_image",
  '       FROM channel_messages cm',
  '       LEFT JOIN users u ON u.wallet_address = cm.user_address',
  '       WHERE cm.channel_id = $1 AND cm.is_pinned = true',
  '       ORDER BY cm.pinned_at DESC`,',
  '      [channelId]',
  '    );',
  '    res.json({ pins: result.rows });',
  '  } catch (error) {',
  "    console.error('Get pins error:', error);",
  "    res.status(500).json({ error: 'Failed to get pinned messages' });",
  '  }',
  '});',
  '',
];

// Find the exact insertion point
let insertBeforeIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('GET /api/channels/:channelId/messages')) {
    insertBeforeIndex = i;
    break;
  }
}

// Insert new endpoints
if (insertBeforeIndex >= 0) {
  lines.splice(insertBeforeIndex, 0, ...newEndpointsStr);
  console.log('Inserted new endpoints at line ' + (insertBeforeIndex + 1));
}

// Add nsfw/slowmode after permissions lines (iterate from bottom to top)
let insertedCount = 0;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes("if (permissions !== undefined) { sets.push('permissions = $'")) {
    lines.splice(i + 1, 0, ...nsfw_slowmode);
    insertedCount++;
  }
}
console.log('Added nsfw/slowmode after ' + insertedCount + ' permissions lines');

fs.writeFileSync('/root/server.js', lines.join('\n'));
console.log('Server.js patched! Total lines: ' + lines.length);

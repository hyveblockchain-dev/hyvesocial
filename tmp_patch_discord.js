// patch_discord_features.js — adds channel, message, role, and presence endpoints to server.js
const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// ── Helper: find insertion point before the server.listen or final line ──
// We'll insert before the very last app.listen or server.listen block
const listenIdx = code.lastIndexOf('server.listen(');
if (listenIdx === -1) {
  console.error('Could not find server.listen in server.js');
  process.exit(1);
}

const ENDPOINTS = `

// ===================================================================
// ═══════════════ DISCORD-LIKE CHANNELS & MESSAGING ═════════════════
// ===================================================================

// ── Auto-create #general channel when a group is created (if none exist) ──
async function ensureDefaultChannel(groupId) {
  const existing = await db.query('SELECT id FROM channels WHERE group_id = $1 LIMIT 1', [groupId]);
  if (existing.rows.length === 0) {
    // Create a "Text Channels" category
    const cat = await db.query(
      'INSERT INTO channel_categories (group_id, name, position) VALUES ($1, $2, 0) RETURNING *',
      [groupId, 'Text Channels']
    );
    // Create #general
    await db.query(
      'INSERT INTO channels (group_id, category_id, name, position, is_default) VALUES ($1, $2, $3, 0, true) RETURNING *',
      [groupId, cat.rows[0].id, 'general']
    );
  }
}

// ── GET /api/groups/:id/channels — list all channels (with categories) ──
app.get('/api/groups/:id/channels', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    await ensureDefaultChannel(groupId);

    const categories = await db.query(
      'SELECT * FROM channel_categories WHERE group_id = $1 ORDER BY position, id',
      [groupId]
    );
    const channels = await db.query(
      'SELECT * FROM channels WHERE group_id = $1 ORDER BY position, id',
      [groupId]
    );
    res.json({ categories: categories.rows, channels: channels.rows });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// ── POST /api/groups/:id/channels — create a channel ──
app.post('/api/groups/:id/channels', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, categoryId, topic, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Channel name is required' });

    // Check admin
    const member = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2',
      [groupId, req.userAddress]
    );
    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create channels' });
    }

    const channelName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const maxPos = await db.query('SELECT COALESCE(MAX(position), 0) + 1 as next FROM channels WHERE group_id = $1', [groupId]);

    const result = await db.query(
      'INSERT INTO channels (group_id, category_id, name, topic, type, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [groupId, categoryId || null, channelName, topic || '', type || 'text', maxPos.rows[0].next]
    );
    res.json({ channel: result.rows[0] });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// ── PATCH /api/groups/:id/channels/:channelId — update channel ──
app.patch('/api/groups/:id/channels/:channelId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const channelId = parseInt(req.params.channelId);
    const { name, topic, categoryId, position, permissions } = req.body;

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can edit channels' });
    }

    const sets = [];
    const vals = [];
    let i = 1;
    if (name !== undefined) { sets.push('name = $' + i++); vals.push(name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')); }
    if (topic !== undefined) { sets.push('topic = $' + i++); vals.push(topic); }
    if (categoryId !== undefined) { sets.push('category_id = $' + i++); vals.push(categoryId); }
    if (position !== undefined) { sets.push('position = $' + i++); vals.push(position); }
    if (permissions !== undefined) { sets.push('permissions = $' + i++); vals.push(JSON.stringify(permissions)); }

    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(channelId, groupId);

    const result = await db.query(
      'UPDATE channels SET ' + sets.join(', ') + ' WHERE id = $' + i++ + ' AND group_id = $' + i + ' RETURNING *',
      vals
    );
    res.json({ channel: result.rows[0] });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// ── DELETE /api/groups/:id/channels/:channelId ──
app.delete('/api/groups/:id/channels/:channelId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const channelId = parseInt(req.params.channelId);

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can delete channels' });
    }

    // Prevent deleting the last channel
    const count = await db.query('SELECT COUNT(*) as cnt FROM channels WHERE group_id = $1', [groupId]);
    if (parseInt(count.rows[0].cnt) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last channel' });
    }

    await db.query('DELETE FROM channels WHERE id = $1 AND group_id = $2', [channelId, groupId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// ── POST /api/groups/:id/categories — create a category ──
app.post('/api/groups/:id/categories', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create categories' });
    }

    const maxPos = await db.query('SELECT COALESCE(MAX(position), 0) + 1 as next FROM channel_categories WHERE group_id = $1', [groupId]);
    const result = await db.query(
      'INSERT INTO channel_categories (group_id, name, position) VALUES ($1, $2, $3) RETURNING *',
      [groupId, name.trim(), maxPos.rows[0].next]
    );
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ── DELETE /api/groups/:id/categories/:catId ──
app.delete('/api/groups/:id/categories/:catId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const catId = parseInt(req.params.catId);

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can delete categories' });
    }

    // Move channels in this category to uncategorized
    await db.query('UPDATE channels SET category_id = NULL WHERE category_id = $1', [catId]);
    await db.query('DELETE FROM channel_categories WHERE id = $1 AND group_id = $2', [catId, groupId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ── GET /api/channels/:channelId/messages — get messages (paginated) ──
app.get('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    // Verify channel exists and user is a group member
    const channel = await db.query('SELECT group_id FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

    const groupId = channel.rows[0].group_id;
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const group = await db.query('SELECT owner_address, privacy FROM groups WHERE id = $1', [groupId]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    if (!isOwner && member.rows.length === 0 && group.rows[0]?.privacy === 'private') {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    let query, params;
    if (before) {
      query = \`SELECT m.*, u.username, u.profile_image
               FROM channel_messages m
               JOIN users u ON m.user_address = u.wallet_address
               WHERE m.channel_id = $1 AND m.id < $2
               ORDER BY m.created_at DESC LIMIT $3\`;
      params = [channelId, before, limit];
    } else {
      query = \`SELECT m.*, u.username, u.profile_image
               FROM channel_messages m
               JOIN users u ON m.user_address = u.wallet_address
               WHERE m.channel_id = $1
               ORDER BY m.created_at DESC LIMIT $2\`;
      params = [channelId, limit];
    }

    const result = await db.query(query, params);
    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ── POST /api/channels/:channelId/messages — send a message ──
app.post('/api/channels/:channelId/messages', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const { content, imageUrl, replyTo } = req.body;

    if (!content || !content.trim()) return res.status(400).json({ error: 'Message content is required' });

    const channel = await db.query('SELECT group_id, permissions FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

    const groupId = channel.rows[0].group_id;
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    if (!isOwner && member.rows.length === 0) {
      return res.status(403).json({ error: 'Join the group to send messages' });
    }

    // Check channel permissions
    const perms = channel.rows[0].permissions || {};
    const memberRole = isOwner ? 'owner' : (member.rows[0]?.role || 'member');
    if (perms.readOnly && memberRole === 'member') {
      return res.status(403).json({ error: 'This channel is read-only' });
    }

    const result = await db.query(
      \`INSERT INTO channel_messages (channel_id, user_address, content, image_url, reply_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
      [channelId, req.userAddress, content.trim(), imageUrl || '', replyTo || null]
    );

    // Get user info for the response
    const userInfo = await db.query('SELECT username, profile_image FROM users WHERE wallet_address = $1', [req.userAddress]);
    const message = {
      ...result.rows[0],
      username: userInfo.rows[0]?.username,
      profile_image: userInfo.rows[0]?.profile_image,
    };

    // Broadcast via Socket.io
    io.to('channel-' + channelId).emit('channel_message', message);

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── DELETE /api/channels/:channelId/messages/:messageId ──
app.delete('/api/channels/:channelId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const messageId = parseInt(req.params.messageId);

    const msg = await db.query('SELECT * FROM channel_messages WHERE id = $1 AND channel_id = $2', [messageId, channelId]);
    if (msg.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

    const channel = await db.query('SELECT group_id FROM channels WHERE id = $1', [channelId]);
    const groupId = channel.rows[0].group_id;
    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const isAuthor = msg.rows[0].user_address.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;

    if (!isAuthor && !isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await db.query('DELETE FROM channel_messages WHERE id = $1', [messageId]);
    io.to('channel-' + channelId).emit('channel_message_deleted', { messageId, channelId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ── PATCH /api/channels/:channelId/messages/:messageId — edit message ──
app.patch('/api/channels/:channelId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const messageId = parseInt(req.params.messageId);
    const { content } = req.body;

    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

    const msg = await db.query('SELECT * FROM channel_messages WHERE id = $1 AND channel_id = $2', [messageId, channelId]);
    if (msg.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    if (msg.rows[0].user_address.toLowerCase() !== req.userAddress.toLowerCase()) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const result = await db.query(
      'UPDATE channel_messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *',
      [content.trim(), messageId]
    );

    const userInfo = await db.query('SELECT username, profile_image FROM users WHERE wallet_address = $1', [req.userAddress]);
    const message = { ...result.rows[0], username: userInfo.rows[0]?.username, profile_image: userInfo.rows[0]?.profile_image };
    io.to('channel-' + channelId).emit('channel_message_edited', message);
    res.json({ message });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// ===================================================================
// ═══════════════ CUSTOM GROUP ROLES ════════════════════════════════
// ===================================================================

// ── GET /api/groups/:id/roles — list roles ──
app.get('/api/groups/:id/roles', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const roles = await db.query(
      'SELECT r.*, (SELECT COUNT(*) FROM member_roles mr WHERE mr.role_id = r.id) as member_count FROM group_roles r WHERE r.group_id = $1 ORDER BY r.position, r.id',
      [groupId]
    );
    res.json({ roles: roles.rows });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// ── POST /api/groups/:id/roles — create a role ──
app.post('/api/groups/:id/roles', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, color, permissions } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Role name is required' });

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create roles' });
    }

    const maxPos = await db.query('SELECT COALESCE(MAX(position), 0) + 1 as next FROM group_roles WHERE group_id = $1', [groupId]);
    const result = await db.query(
      'INSERT INTO group_roles (group_id, name, color, permissions, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [groupId, name.trim(), color || '#ffffff', JSON.stringify(permissions || {}), maxPos.rows[0].next]
    );
    res.json({ role: result.rows[0] });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// ── PATCH /api/groups/:id/roles/:roleId — update role ──
app.patch('/api/groups/:id/roles/:roleId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const roleId = parseInt(req.params.roleId);
    const { name, color, permissions, position } = req.body;

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const mRole = member.rows[0]?.role;
    if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can edit roles' });
    }

    const sets = [];
    const vals = [];
    let i = 1;
    if (name !== undefined) { sets.push('name = $' + i++); vals.push(name.trim()); }
    if (color !== undefined) { sets.push('color = $' + i++); vals.push(color); }
    if (permissions !== undefined) { sets.push('permissions = $' + i++); vals.push(JSON.stringify(permissions)); }
    if (position !== undefined) { sets.push('position = $' + i++); vals.push(position); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(roleId, groupId);
    const result = await db.query(
      'UPDATE group_roles SET ' + sets.join(', ') + ' WHERE id = $' + i++ + ' AND group_id = $' + i + ' RETURNING *',
      vals
    );
    res.json({ role: result.rows[0] });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ── DELETE /api/groups/:id/roles/:roleId ──
app.delete('/api/groups/:id/roles/:roleId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const roleId = parseInt(req.params.roleId);

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the owner can delete roles' });
    }

    await db.query('DELETE FROM group_roles WHERE id = $1 AND group_id = $2', [roleId, groupId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ── POST /api/groups/:id/members/:address/roles — assign role to member ──
app.post('/api/groups/:id/members/:address/roles', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetAddress = req.params.address;
    const { roleId } = req.body;

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can assign roles' });
    }

    await db.query(
      'INSERT INTO member_roles (group_id, user_address, role_id) VALUES ($1, $2, $3) ON CONFLICT (group_id, user_address, role_id) DO NOTHING',
      [groupId, targetAddress, roleId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// ── DELETE /api/groups/:id/members/:address/roles/:roleId — remove role from member ──
app.delete('/api/groups/:id/members/:address/roles/:roleId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetAddress = req.params.address;
    const roleId = parseInt(req.params.roleId);

    const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
    const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);
    const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const role = member.rows[0]?.role;
    if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can remove roles' });
    }

    await db.query('DELETE FROM member_roles WHERE group_id = $1 AND user_address = $2 AND role_id = $3', [groupId, targetAddress, roleId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// ── GET /api/groups/:id/members-with-roles — members with their custom roles ──
app.get('/api/groups/:id/members-with-roles', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const members = await db.query(
      \`SELECT gm.user_address, gm.role, u.username, u.profile_image,
              COALESCE(
                (SELECT json_agg(json_build_object('id', gr.id, 'name', gr.name, 'color', gr.color))
                 FROM member_roles mr JOIN group_roles gr ON mr.role_id = gr.id
                 WHERE mr.group_id = $1 AND mr.user_address = gm.user_address),
                '[]'
              ) as custom_roles
       FROM group_members gm
       JOIN users u ON gm.user_address = u.wallet_address
       WHERE gm.group_id = $1
       ORDER BY
         CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         u.username\`,
      [groupId]
    );
    res.json({ members: members.rows });
  } catch (error) {
    console.error('Get members with roles error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// ===================================================================
// ═══════════════ GROUP PRESENCE (online status) ═══════════════════
// ===================================================================

// ── GET /api/groups/:id/online — get online members for a group ──
app.get('/api/groups/:id/online', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    // Get all members of the group
    const members = await db.query(
      'SELECT gm.user_address, u.username FROM group_members gm JOIN users u ON gm.user_address = u.wallet_address WHERE gm.group_id = $1',
      [groupId]
    );
    // Check which ones are in onlineUsers map
    const online = [];
    const offline = [];
    for (const m of members.rows) {
      const entry = onlineUsers.get(m.user_address.toLowerCase());
      if (entry && entry.sockets && entry.sockets.size > 0) {
        online.push(m.username);
      } else {
        offline.push(m.username);
      }
    }
    res.json({ online, offline, onlineCount: online.length, totalCount: members.rows.length });
  } catch (error) {
    console.error('Get online members error:', error);
    res.status(500).json({ error: 'Failed to get online members' });
  }
});

`;

// Insert before server.listen
code = code.slice(0, listenIdx) + ENDPOINTS + code.slice(listenIdx);
changes++;
console.log('Inserted all Discord endpoints before server.listen');

// ── Add Socket.io channel join/leave handling ──
// Find the io.on('connection') block and add channel room logic
const socketConnectionIdx = code.indexOf("io.on('connection'");
if (socketConnectionIdx === -1) {
  console.log('WARNING: Could not find io.on(connection) — Socket.io channel rooms not added');
} else {
  // Find the callback body start
  const socketBodyStart = code.indexOf('{', code.indexOf('=>', socketConnectionIdx));
  if (socketBodyStart !== -1) {
    const channelSocketCode = `
    // ── Channel room management ──
    socket.on('join_channel', (channelId) => {
      socket.join('channel-' + channelId);
      console.log('Socket joined channel-' + channelId);
    });
    socket.on('leave_channel', (channelId) => {
      socket.leave('channel-' + channelId);
      console.log('Socket left channel-' + channelId);
    });
    // ── Group presence ──
    socket.on('join_group', (groupId) => {
      socket.join('group-' + groupId);
      io.to('group-' + groupId).emit('group_presence_update', { groupId });
    });
    socket.on('leave_group', (groupId) => {
      socket.leave('group-' + groupId);
      io.to('group-' + groupId).emit('group_presence_update', { groupId });
    });
    socket.on('typing_channel', ({ channelId, username }) => {
      socket.to('channel-' + channelId).emit('channel_typing', { channelId, username });
    });
`;
    code = code.slice(0, socketBodyStart + 1) + channelSocketCode + code.slice(socketBodyStart + 1);
    changes++;
    console.log('Added Socket.io channel room handlers');
  }
}

fs.writeFileSync('/root/server.js', code);
console.log(`\nDone! Applied ${changes} changes to server.js`);

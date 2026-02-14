import sys

with open('/root/server.js', 'r') as f:
    content = f.read()

# Find the insertion point: right before server.listen
search = """server.listen(PORT, () => {"""

new_endpoints = r"""
// ═══════════════════════════════════════════════════════════
// BATCH 3: BOOKMARK / SAVED MESSAGES
// ═══════════════════════════════════════════════════════════

app.post('/api/channels/:channelId/messages/:messageId/save', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId, messageId } = req.params;
    const { note } = req.body;
    const existing = await db.query('SELECT id FROM saved_messages WHERE user_address = $1 AND message_id = $2', [address, messageId]);
    if (existing.rows[0]) {
      await db.query('DELETE FROM saved_messages WHERE id = $1', [existing.rows[0].id]);
      return res.json({ saved: false });
    }
    await db.query('INSERT INTO saved_messages (user_address, channel_id, message_id, note) VALUES ($1, $2, $3, $4)', [address, channelId, parseInt(messageId), note || '']);
    res.json({ saved: true });
  } catch (err) {
    console.error('Save message error:', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

app.get('/api/saved-messages', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const result = await db.query(
      `SELECT sm.*, cm.content, cm.image_url, cm.created_at AS message_created_at,
              u.username, u.profile_image, c.name AS channel_name, c.group_id
       FROM saved_messages sm
       JOIN channel_messages cm ON cm.id = sm.message_id
       JOIN users u ON LOWER(u.wallet_address) = LOWER(cm.user_address)
       JOIN channels c ON c.id = sm.channel_id
       WHERE sm.user_address = $1
       ORDER BY sm.created_at DESC
       LIMIT 100`,
      [address]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Get saved messages error:', err);
    res.status(500).json({ error: 'Failed to get saved messages' });
  }
});

app.delete('/api/saved-messages/:id', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    await db.query('DELETE FROM saved_messages WHERE id = $1 AND user_address = $2', [req.params.id, address]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete saved message error:', err);
    res.status(500).json({ error: 'Failed to delete saved message' });
  }
});


// ═══════════════════════════════════════════════════════════
// MESSAGE EDIT HISTORY
// ═══════════════════════════════════════════════════════════

app.get('/api/channels/:channelId/messages/:messageId/edit-history', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await db.query(
      'SELECT * FROM message_edit_history WHERE message_id = $1 ORDER BY edited_at DESC',
      [messageId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Edit history error:', err);
    res.status(500).json({ error: 'Failed to get edit history' });
  }
});


// ═══════════════════════════════════════════════════════════
// SERVER NICKNAMES
// ═══════════════════════════════════════════════════════════

app.put('/api/groups/:id/nickname', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const groupId = req.params.id;
    const { nickname } = req.body;
    if (!nickname || !nickname.trim()) {
      await db.query('DELETE FROM server_nicknames WHERE group_id = $1 AND user_address = $2', [groupId, address]);
      return res.json({ nickname: null });
    }
    if (nickname.length > 32) return res.status(400).json({ error: 'Nickname max 32 chars' });
    const result = await db.query(
      `INSERT INTO server_nicknames (group_id, user_address, nickname, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (group_id, user_address)
       DO UPDATE SET nickname = $3, updated_at = NOW()
       RETURNING *`,
      [groupId, address, nickname.trim()]
    );
    res.json({ nickname: result.rows[0].nickname });
  } catch (err) {
    console.error('Set nickname error:', err);
    res.status(500).json({ error: 'Failed to set nickname' });
  }
});

app.get('/api/groups/:id/nicknames', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT user_address, nickname FROM server_nicknames WHERE group_id = $1', [req.params.id]);
    const map = {};
    result.rows.forEach(r => { map[r.user_address.toLowerCase()] = r.nickname; });
    res.json({ nicknames: map });
  } catch (err) {
    console.error('Get nicknames error:', err);
    res.status(500).json({ error: 'Failed to get nicknames' });
  }
});


// ═══════════════════════════════════════════════════════════
// SCHEDULED MESSAGES
// ═══════════════════════════════════════════════════════════

app.post('/api/channels/:channelId/schedule', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId } = req.params;
    const { content, sendAt, imageUrl } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
    if (!sendAt) return res.status(400).json({ error: 'Send time required' });
    const sendTime = new Date(sendAt);
    if (sendTime <= new Date()) return res.status(400).json({ error: 'Send time must be in the future' });
    const result = await db.query(
      'INSERT INTO scheduled_messages (channel_id, user_address, content, image_url, send_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [channelId, address, content.trim(), imageUrl || '', sendTime]
    );
    res.json({ scheduled: result.rows[0] });
  } catch (err) {
    console.error('Schedule message error:', err);
    res.status(500).json({ error: 'Failed to schedule message' });
  }
});

app.get('/api/channels/:channelId/scheduled', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const result = await db.query(
      'SELECT * FROM scheduled_messages WHERE channel_id = $1 AND user_address = $2 AND sent = FALSE ORDER BY send_at ASC',
      [req.params.channelId, address]
    );
    res.json({ scheduled: result.rows });
  } catch (err) {
    console.error('Get scheduled error:', err);
    res.status(500).json({ error: 'Failed to get scheduled messages' });
  }
});

app.delete('/api/scheduled/:id', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    await db.query('DELETE FROM scheduled_messages WHERE id = $1 AND user_address = $2', [req.params.id, address]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete scheduled error:', err);
    res.status(500).json({ error: 'Failed to delete scheduled message' });
  }
});

// Scheduled message processor (runs every 30 seconds)
setInterval(async () => {
  try {
    const pending = await db.query(
      'SELECT * FROM scheduled_messages WHERE sent = FALSE AND send_at <= NOW() LIMIT 20'
    );
    for (const sched of pending.rows) {
      try {
        const userInfo = await db.query('SELECT username, profile_image FROM users WHERE wallet_address = $1', [sched.user_address]);
        const result = await db.query(
          'INSERT INTO channel_messages (channel_id, user_address, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
          [sched.channel_id, sched.user_address, sched.content, sched.image_url || '']
        );
        const message = { ...result.rows[0], username: userInfo.rows[0]?.username, profile_image: userInfo.rows[0]?.profile_image };
        io.to('channel_' + sched.channel_id).emit('channel_message', message);
        await db.query('UPDATE scheduled_messages SET sent = TRUE WHERE id = $1', [sched.id]);
      } catch (e) { console.error('Failed to send scheduled msg', sched.id, e); }
    }
  } catch (err) { /* silent */ }
}, 30000);


// ═══════════════════════════════════════════════════════════
// USER ACTIVITY STATUS (Playing, Listening, Streaming)
// ═══════════════════════════════════════════════════════════

app.patch('/api/users/activity', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { activityType, activityName, activityDetails } = req.body;
    await db.query(
      'UPDATE users SET activity_type = $1, activity_name = $2, activity_details = $3 WHERE wallet_address = $4',
      [activityType || '', activityName || '', activityDetails || '', address]
    );
    io.emit('user_activity_update', { address, activityType: activityType || '', activityName: activityName || '', activityDetails: activityDetails || '' });
    res.json({ success: true });
  } catch (err) {
    console.error('Activity update error:', err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});


// ═══════════════════════════════════════════════════════════
// SERVER INSIGHTS / ANALYTICS
// ═══════════════════════════════════════════════════════════

app.get('/api/groups/:id/insights', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const groupId = req.params.id;
    const hasPerm = await hasPermission(groupId, address, 'viewAuditLog');
    if (!hasPerm) return res.status(403).json({ error: 'No permission' });

    const days = parseInt(req.query.days) || 30;

    const memberCount = await db.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [groupId]);
    const msgCount = await db.query(
      `SELECT COUNT(*) FROM channel_messages cm
       JOIN channels c ON c.id = cm.channel_id
       WHERE c.group_id = $1 AND cm.created_at > NOW() - INTERVAL '1 day' * $2`,
      [groupId, days]
    );
    const activeMembers = await db.query(
      `SELECT COUNT(DISTINCT cm.user_address) FROM channel_messages cm
       JOIN channels c ON c.id = cm.channel_id
       WHERE c.group_id = $1 AND cm.created_at > NOW() - INTERVAL '7 days'`,
      [groupId]
    );
    const newMembers = await db.query(
      `SELECT COUNT(*) FROM group_members
       WHERE group_id = $1 AND joined_at > NOW() - INTERVAL '1 day' * $2`,
      [groupId, days]
    );
    const dailyMessages = await db.query(
      `SELECT DATE(cm.created_at) AS date, COUNT(*) AS count
       FROM channel_messages cm
       JOIN channels c ON c.id = cm.channel_id
       WHERE c.group_id = $1 AND cm.created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(cm.created_at) ORDER BY date`,
      [groupId, days]
    );
    const dailyMembers = await db.query(
      `SELECT DATE(joined_at) AS date, COUNT(*) AS count
       FROM group_members
       WHERE group_id = $1 AND joined_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(joined_at) ORDER BY date`,
      [groupId, days]
    );
    const topChannels = await db.query(
      `SELECT c.name, COUNT(cm.id) AS messages
       FROM channel_messages cm
       JOIN channels c ON c.id = cm.channel_id
       WHERE c.group_id = $1 AND cm.created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY c.name ORDER BY messages DESC LIMIT 10`,
      [groupId, days]
    );
    const topPosters = await db.query(
      `SELECT u.username, u.profile_image, COUNT(cm.id) AS messages
       FROM channel_messages cm
       JOIN channels c ON c.id = cm.channel_id
       JOIN users u ON LOWER(u.wallet_address) = LOWER(cm.user_address)
       WHERE c.group_id = $1 AND cm.created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY u.username, u.profile_image ORDER BY messages DESC LIMIT 10`,
      [groupId, days]
    );

    res.json({
      memberCount: parseInt(memberCount.rows[0].count),
      messageCount: parseInt(msgCount.rows[0].count),
      activeMembers: parseInt(activeMembers.rows[0].count),
      newMembers: parseInt(newMembers.rows[0].count),
      dailyMessages: dailyMessages.rows,
      dailyMembers: dailyMembers.rows,
      topChannels: topChannels.rows,
      topPosters: topPosters.rows,
      days,
    });
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});


// ═══════════════════════════════════════════════════════════
// ANNOUNCEMENT PUBLISH
// ═══════════════════════════════════════════════════════════

app.post('/api/channels/:channelId/messages/:messageId/publish', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId, messageId } = req.params;
    const ch = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
    if (!ch.rows[0]) return res.status(404).json({ error: 'Channel not found' });
    if (ch.rows[0].type !== 'announcement') return res.status(400).json({ error: 'Only announcement channels can publish' });
    const hasPerm = await hasPermission(ch.rows[0].group_id, address, 'manageMessages');
    if (!hasPerm) return res.status(403).json({ error: 'No permission' });
    const existing = await db.query('SELECT id FROM published_announcements WHERE message_id = $1', [messageId]);
    if (existing.rows[0]) return res.status(400).json({ error: 'Already published' });
    await db.query('INSERT INTO published_announcements (message_id, channel_id, published_by) VALUES ($1, $2, $3)', [messageId, channelId, address]);
    res.json({ published: true });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish' });
  }
});


// ═══════════════════════════════════════════════════════════
// USER PREFERENCES (Compact mode, Reply ping)
// ═══════════════════════════════════════════════════════════

app.patch('/api/users/preferences', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { compactMode, replyPing } = req.body;
    const updates = [];
    const vals = [];
    let idx = 1;
    if (compactMode !== undefined) { updates.push(`compact_mode = $${idx++}`); vals.push(compactMode); }
    if (replyPing !== undefined) { updates.push(`reply_ping = $${idx++}`); vals.push(replyPing); }
    if (updates.length === 0) return res.json({ success: true });
    vals.push(address);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE wallet_address = $${idx}`, vals);
    res.json({ success: true });
  } catch (err) {
    console.error('Preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

app.get('/api/users/preferences', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const result = await db.query('SELECT compact_mode, reply_ping FROM users WHERE wallet_address = $1', [address]);
    res.json(result.rows[0] || { compact_mode: false, reply_ping: true });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});


// ═══════════════════════════════════════════════════════════
// MARK ALL CHANNELS AS READ
// ═══════════════════════════════════════════════════════════

app.post('/api/groups/:id/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const groupId = req.params.id;
    const channels = await db.query('SELECT id FROM channels WHERE group_id = $1', [groupId]);
    for (const ch of channels.rows) {
      const lastMsg = await db.query('SELECT id FROM channel_messages WHERE channel_id = $1 ORDER BY id DESC LIMIT 1', [ch.id]);
      if (lastMsg.rows[0]) {
        await db.query(
          `INSERT INTO channel_read_state (channel_id, user_address, last_read_message_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel_id, user_address)
           DO UPDATE SET last_read_message_id = $3`,
          [ch.id, address, lastMsg.rows[0].id]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});


"""

if search in content:
    content = content.replace(search, new_endpoints + "\n" + search, 1)
    with open('/root/server.js', 'w') as f:
        f.write(content)
    print('SUCCESS: All batch 3 endpoints injected')
else:
    print('FAIL: server.listen not found')
    sys.exit(1)

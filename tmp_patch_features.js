// Comprehensive Discord features backend patch
// Adds: reactions table, unread tracking, server-side search, threads, slowmode, audit log, timeout
const fs = require('fs');

const serverPath = '/root/server.js';
let lines = fs.readFileSync(serverPath, 'utf8').split('\n');
console.log('Original lines:', lines.length);

// Find the line "server.listen(PORT" to insert before it
let listenIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('server.listen(PORT')) { listenIdx = i; break; }
}
if (listenIdx < 0) { console.error('Could not find server.listen'); process.exit(1); }

const newEndpoints = `
// ═══════════════════════════════════════════════════════════
// REACTIONS — persistent (add/remove/get)
// ═══════════════════════════════════════════════════════════
app.post('/api/channels/:channelId/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const messageId = parseInt(req.params.messageId);
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    // check existing
    const existing = await db.query(
      'SELECT id FROM channel_reactions WHERE message_id = $1 AND user_address = $2 AND emoji = $3',
      [messageId, req.userAddress, emoji]
    );
    if (existing.rows.length > 0) {
      // Remove reaction (toggle off)
      await db.query('DELETE FROM channel_reactions WHERE id = $1', [existing.rows[0].id]);
      const counts = await db.query(
        'SELECT emoji, COUNT(*)::int as count FROM channel_reactions WHERE message_id = $1 GROUP BY emoji',
        [messageId]
      );
      io.to('channel-' + channelId).emit('channel_reaction_update', { messageId, reactions: counts.rows });
      return res.json({ removed: true, reactions: counts.rows });
    }

    // Add reaction
    await db.query(
      'INSERT INTO channel_reactions (message_id, channel_id, user_address, emoji) VALUES ($1, $2, $3, $4)',
      [messageId, channelId, req.userAddress, emoji]
    );
    const counts = await db.query(
      'SELECT emoji, COUNT(*)::int as count FROM channel_reactions WHERE message_id = $1 GROUP BY emoji',
      [messageId]
    );
    io.to('channel-' + channelId).emit('channel_reaction_update', { messageId, reactions: counts.rows });
    res.json({ added: true, reactions: counts.rows });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

app.get('/api/channels/:channelId/messages/:messageId/reactions', async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const counts = await db.query(
      'SELECT emoji, COUNT(*)::int as count FROM channel_reactions WHERE message_id = $1 GROUP BY emoji',
      [messageId]
    );
    res.json({ reactions: counts.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get reactions' });
  }
});

// ═══════════════════════════════════════════════════════════
// UNREAD TRACKING — mark read, get unreads
// ═══════════════════════════════════════════════════════════
app.post('/api/channels/:channelId/ack', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const { lastMessageId } = req.body;
    await db.query(
      \`INSERT INTO channel_read_state (channel_id, user_address, last_read_message_id, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (channel_id, user_address)
       DO UPDATE SET last_read_message_id = $3, last_read_at = NOW()\`,
      [channelId, req.userAddress, lastMessageId || 0]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Ack error:', error);
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

app.get('/api/groups/:id/unreads', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const result = await db.query(\`
      SELECT c.id as channel_id,
        COALESCE(
          (SELECT COUNT(*) FROM channel_messages cm
           WHERE cm.channel_id = c.id
           AND cm.id > COALESCE(
             (SELECT last_read_message_id FROM channel_read_state crs
              WHERE crs.channel_id = c.id AND crs.user_address = $2), 0
           )),
          0
        )::int as unread_count,
        COALESCE(
          (SELECT COUNT(*) FROM channel_messages cm
           WHERE cm.channel_id = c.id
           AND cm.id > COALESCE(
             (SELECT last_read_message_id FROM channel_read_state crs
              WHERE crs.channel_id = c.id AND crs.user_address = $2), 0
           )
           AND cm.content LIKE '%' || '@' || (SELECT username FROM users WHERE wallet_address = $2 LIMIT 1) || '%'),
          0
        )::int as mention_count
      FROM channels c WHERE c.group_id = $1
    \`, [groupId, req.userAddress]);
    res.json({ unreads: result.rows });
  } catch (error) {
    console.error('Unreads error:', error);
    res.status(500).json({ error: 'Failed to get unreads' });
  }
});

// ═══════════════════════════════════════════════════════════
// SERVER-SIDE MESSAGE SEARCH
// ═══════════════════════════════════════════════════════════
app.get('/api/groups/:id/search', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { q, channelId, authorId, limit } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });

    let query = \`
      SELECT cm.*, c.name as channel_name, u.username, u.profile_image
      FROM channel_messages cm
      JOIN channels c ON c.id = cm.channel_id
      LEFT JOIN users u ON u.wallet_address = cm.user_address
      WHERE c.group_id = $1 AND cm.content ILIKE $2
    \`;
    const params = [groupId, '%' + q + '%'];
    let idx = 3;

    if (channelId) {
      query += ' AND cm.channel_id = $' + idx++;
      params.push(parseInt(channelId));
    }
    if (authorId) {
      query += ' AND cm.user_address = $' + idx++;
      params.push(authorId);
    }
    query += ' ORDER BY cm.created_at DESC LIMIT $' + idx;
    params.push(parseInt(limit) || 25);

    const result = await db.query(query, params);
    res.json({ results: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ═══════════════════════════════════════════════════════════
// THREADS — create, list, reply in thread
// ═══════════════════════════════════════════════════════════
app.post('/api/channels/:channelId/messages/:messageId/threads', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const messageId = parseInt(req.params.messageId);
    const { name } = req.body;

    // Check the parent message exists
    const parent = await db.query('SELECT id, channel_id FROM channel_messages WHERE id = $1 AND channel_id = $2', [messageId, channelId]);
    if (!parent.rows[0]) return res.status(404).json({ error: 'Message not found' });

    // Check if thread already exists for this message
    const existing = await db.query('SELECT id, name FROM channel_threads WHERE parent_message_id = $1', [messageId]);
    if (existing.rows[0]) return res.json({ thread: existing.rows[0], existed: true });

    const threadName = name || 'Thread';
    const result = await db.query(
      'INSERT INTO channel_threads (channel_id, parent_message_id, creator_address, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [channelId, messageId, req.userAddress, threadName]
    );
    io.to('channel-' + channelId).emit('channel_thread_created', { thread: result.rows[0], parentMessageId: messageId });
    res.json({ thread: result.rows[0] });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

app.get('/api/channels/:channelId/messages/:messageId/threads', async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const thread = await db.query('SELECT * FROM channel_threads WHERE parent_message_id = $1', [messageId]);
    if (!thread.rows[0]) return res.json({ thread: null, messages: [] });

    const messages = await db.query(
      \`SELECT tm.*, u.username, u.profile_image FROM thread_messages tm
       LEFT JOIN users u ON u.wallet_address = tm.user_address
       WHERE tm.thread_id = $1 ORDER BY tm.created_at ASC\`,
      [thread.rows[0].id]
    );
    res.json({ thread: thread.rows[0], messages: messages.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

app.post('/api/threads/:threadId/messages', authenticateToken, async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    const { content, imageUrl } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const thread = await db.query('SELECT * FROM channel_threads WHERE id = $1', [threadId]);
    if (!thread.rows[0]) return res.status(404).json({ error: 'Thread not found' });

    const result = await db.query(
      'INSERT INTO thread_messages (thread_id, user_address, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [threadId, req.userAddress, content.trim(), imageUrl || '']
    );
    // Update thread reply count and last message time
    await db.query(
      'UPDATE channel_threads SET message_count = message_count + 1, last_message_at = NOW() WHERE id = $1',
      [threadId]
    );

    const userInfo = await db.query('SELECT username, profile_image FROM users WHERE wallet_address = $1', [req.userAddress]);
    const message = { ...result.rows[0], username: userInfo.rows[0]?.username, profile_image: userInfo.rows[0]?.profile_image };

    io.to('thread-' + threadId).emit('thread_message', message);
    io.to('channel-' + thread.rows[0].channel_id).emit('channel_thread_update', { threadId, messageCount: thread.rows[0].message_count + 1 });
    res.json({ message });
  } catch (error) {
    console.error('Thread message error:', error);
    res.status(500).json({ error: 'Failed to send thread message' });
  }
});

// ═══════════════════════════════════════════════════════════
// AUDIT LOG — log actions and retrieve
// ═══════════════════════════════════════════════════════════
app.get('/api/groups/:id/audit-log', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { limit, before, actionType } = req.query;

    // Check permission
    const canDo = await hasPermission(groupId, req.userAddress, 'viewAuditLog');
    if (!canDo) return res.status(403).json({ error: 'You need the View Audit Log permission' });

    let query = \`
      SELECT al.*, u.username, u.profile_image
      FROM audit_log al
      LEFT JOIN users u ON u.wallet_address = al.user_address
      WHERE al.group_id = $1
    \`;
    const params = [groupId];
    let idx = 2;

    if (actionType) {
      query += ' AND al.action_type = $' + idx++;
      params.push(actionType);
    }
    if (before) {
      query += ' AND al.id < $' + idx++;
      params.push(parseInt(before));
    }
    query += ' ORDER BY al.created_at DESC LIMIT $' + idx;
    params.push(parseInt(limit) || 50);

    const result = await db.query(query, params);
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ═══════════════════════════════════════════════════════════
// TIMEOUT MEMBERS
// ═══════════════════════════════════════════════════════════
app.post('/api/groups/:id/members/:address/timeout', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetAddress = await resolveAddress(req.params.address);
    const { duration } = req.body; // seconds

    const canDo = await hasPermission(groupId, req.userAddress, 'timeoutMembers');
    if (!canDo) return res.status(403).json({ error: 'You need the Timeout Members permission' });

    const timeoutUntil = duration ? new Date(Date.now() + duration * 1000) : null;
    await db.query(
      'UPDATE group_members SET timeout_until = $1 WHERE group_id = $2 AND member_address = $3',
      [timeoutUntil, groupId, targetAddress]
    );

    // Log to audit
    await db.query(
      'INSERT INTO audit_log (group_id, user_address, action_type, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [groupId, req.userAddress, 'MEMBER_TIMEOUT', 'member', targetAddress, JSON.stringify({ duration, until: timeoutUntil })]
    );

    res.json({ ok: true, timeoutUntil });
  } catch (error) {
    console.error('Timeout error:', error);
    res.status(500).json({ error: 'Failed to timeout member' });
  }
});

// ═══════════════════════════════════════════════════════════
// SLOWMODE ENFORCEMENT (check in message sending)
// Already patched into the message sending endpoint above
// This endpoint provides channel slowmode status for a user
// ═══════════════════════════════════════════════════════════
app.get('/api/channels/:channelId/slowmode-status', authenticateToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    const channel = await db.query('SELECT slowmode FROM channels WHERE id = $1', [channelId]);
    if (!channel.rows[0]) return res.status(404).json({ error: 'Channel not found' });

    const slowmode = channel.rows[0].slowmode || 0;
    if (slowmode === 0) return res.json({ canSend: true, remainingSeconds: 0 });

    const lastMsg = await db.query(
      'SELECT created_at FROM channel_messages WHERE channel_id = $1 AND user_address = $2 ORDER BY created_at DESC LIMIT 1',
      [channelId, req.userAddress]
    );
    if (!lastMsg.rows[0]) return res.json({ canSend: true, remainingSeconds: 0 });

    const elapsed = (Date.now() - new Date(lastMsg.rows[0].created_at).getTime()) / 1000;
    const remaining = Math.max(0, slowmode - elapsed);
    res.json({ canSend: remaining <= 0, remainingSeconds: Math.ceil(remaining), slowmode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check slowmode' });
  }
});

`;

// Insert new endpoints before server.listen
const newLines = newEndpoints.split('\n');
lines.splice(listenIdx, 0, ...newLines);
console.log('Inserted', newLines.length, 'lines of new endpoints at line', listenIdx);

// Now enhance the message-sending endpoint to enforce slowmode
// Find the POST channel message endpoint and add slowmode check before insert
let msgPostIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("'INSERT INTO channel_messages") && lines[i - 1] && !lines[i].includes('thread_messages')) {
    // Check context — should be in the send message endpoint
    // Look back to find const result = await db.query
    for (let j = i - 3; j < i; j++) {
      if (lines[j] && lines[j].includes('const result = await db.query')) {
        msgPostIdx = j;
        break;
      }
    }
    if (msgPostIdx > 0) break;
  }
}

if (msgPostIdx > 0) {
  // Insert slowmode enforcement before the INSERT
  const slowmodeCheck = [
    '',
    '    // Slowmode enforcement',
    "    const channelData = await db.query('SELECT slowmode FROM channels WHERE id = $1', [channelId]);",
    '    const slowmode = channelData.rows[0]?.slowmode || 0;',
    '    if (slowmode > 0 && memberRole === \'member\') {',
    "      const _lastMsg = await db.query('SELECT created_at FROM channel_messages WHERE channel_id = $1 AND user_address = $2 ORDER BY created_at DESC LIMIT 1', [channelId, req.userAddress]);",
    '      if (_lastMsg.rows[0]) {',
    '        const _elapsed = (Date.now() - new Date(_lastMsg.rows[0].created_at).getTime()) / 1000;',
    '        if (_elapsed < slowmode) {',
    '          return res.status(429).json({ error: `Slowmode active. Wait ${Math.ceil(slowmode - _elapsed)} seconds.`, retryAfter: Math.ceil(slowmode - _elapsed) });',
    '        }',
    '      }',
    '    }',
    '',
    '    // Timeout enforcement',
    "    const memberTimeout = await db.query('SELECT timeout_until FROM group_members WHERE group_id = $1 AND member_address = $2', [groupId, req.userAddress]);",
    '    if (memberTimeout.rows[0]?.timeout_until && new Date(memberTimeout.rows[0].timeout_until) > new Date()) {',
    '      return res.status(403).json({ error: \'You are timed out in this server\' });',
    '    }',
    '',
  ];
  lines.splice(msgPostIdx, 0, ...slowmodeCheck);
  console.log('Inserted slowmode + timeout enforcement at line', msgPostIdx);
}

// Also update the existing send message handler to include reactions in the response
// Find where messages are returned with user info and add reactions aggregation
// Look for "// Get user info for the response" in the send message area
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Broadcast via Socket.io') && lines[i + 1] && lines[i + 1].includes("io.to('channel-'")) {
    // This is the send message broadcast. After this, also log to audit
    const auditInsert = [
      '',
      '    // Log to audit trail (optional, only channel messages)',
    ];
    // We just leave audit logging for moderation actions, not every message
    break;
  }
}

// Enhance the GET messages endpoint to include reactions
// Find the get messages query to add reactions
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("// ── GET /api/channels/:channelId/messages") && lines[i].includes('get messages')) {
    // Find the response line that sends messages back
    for (let j = i; j < i + 40; j++) {
      if (lines[j] && lines[j].includes("res.json({ messages:")) {
        // Replace this line to also include reactions
        const oldLine = lines[j];
        const indent = oldLine.match(/^(\s*)/)[1];
        lines.splice(j, 1,
          indent + '// Attach reactions to each message',
          indent + 'const messagesWithReactions = await Promise.all((result.rows || []).map(async (msg) => {',
          indent + "  const rcts = await db.query('SELECT emoji, COUNT(*)::int as count FROM channel_reactions WHERE message_id = $1 GROUP BY emoji', [msg.id]);",
          indent + "  const threadInfo = await db.query('SELECT id, name, message_count, last_message_at FROM channel_threads WHERE parent_message_id = $1', [msg.id]);",
          indent + '  return { ...msg, reactions: rcts.rows, thread: threadInfo.rows[0] || null };',
          indent + '}));',
          indent + 'res.json({ messages: messagesWithReactions });'
        );
        console.log('Enhanced GET messages with reactions+threads at line', j);
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(serverPath, lines.join('\n'));
console.log('Final lines:', lines.join('\n').split('\n').length);
console.log('Done!');

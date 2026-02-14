// Backend patch: Add endpoints for polls, custom emoji, invites, events, custom status,
// automod, welcome screen, forum channels, channel reorder, bulk delete, announcement publish
// Run on server: node tmp_patch_features2.js

const fs = require('fs');

let code = fs.readFileSync('/root/server.js', 'utf8');
const lines = code.split('\n');

// Find insertion point: line before server.listen
let insertIdx = lines.findIndex(l => l.includes('server.listen(PORT'));
if (insertIdx === -1) { console.error('Cannot find server.listen'); process.exit(1); }

const newEndpoints = `

// ═══════════════════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════════════════

// Create a poll (sent as a special message)
app.post('/api/channels/:channelId/polls', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId } = req.params;
    const { question, options, allowMultiple, expiresIn } = req.body;
    if (!question || !options || options.length < 2 || options.length > 10)
      return res.status(400).json({ error: 'Need question + 2-10 options' });

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 3600000).toISOString() : null;

    // Create poll record
    const pollRes = await db.query(
      'INSERT INTO channel_polls (channel_id, creator_address, question, allow_multiple, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [channelId, address, question, !!allowMultiple, expiresAt]
    );
    const poll = pollRes.rows[0];

    // Create options
    for (let i = 0; i < options.length; i++) {
      await db.query(
        'INSERT INTO channel_poll_options (poll_id, label, emoji, position) VALUES ($1,$2,$3,$4)',
        [poll.id, options[i].label, options[i].emoji || null, i]
      );
    }

    // Create a message that references the poll
    const msgRes = await db.query(
      'INSERT INTO channel_messages (channel_id, user_address, content, poll_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [channelId, address, \`📊 **\${question}**\`, poll.id]
    );
    await db.query('UPDATE channel_polls SET message_id = $1 WHERE id = $2', [msgRes.rows[0].id, poll.id]);

    // Get full poll with options
    const optRes = await db.query('SELECT * FROM channel_poll_options WHERE poll_id = $1 ORDER BY position', [poll.id]);

    const userRow = await db.query('SELECT username, profile_image FROM users WHERE LOWER(wallet_address) = LOWER($1)', [address]);
    const fullMsg = { ...msgRes.rows[0], username: userRow.rows[0]?.username, profile_image: userRow.rows[0]?.profile_image, poll: { ...poll, options: optRes.rows.map(o => ({ ...o, votes: 0, voters: [] })) } };

    io.to('channel_' + channelId).emit('channel_message', fullMsg);
    res.json(fullMsg);
  } catch (err) {
    console.error('Poll create error:', err);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Vote on a poll
app.post('/api/polls/:pollId/vote', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { pollId } = req.params;
    const { optionId } = req.body;

    const poll = await db.query('SELECT * FROM channel_polls WHERE id = $1', [pollId]);
    if (!poll.rows[0]) return res.status(404).json({ error: 'Poll not found' });
    if (poll.rows[0].expires_at && new Date(poll.rows[0].expires_at) < new Date())
      return res.status(400).json({ error: 'Poll has expired' });

    // If not allow_multiple, remove previous vote
    if (!poll.rows[0].allow_multiple) {
      await db.query('DELETE FROM channel_poll_votes WHERE poll_id = $1 AND user_address = $2', [pollId, address]);
    }

    // Toggle vote
    const existing = await db.query('SELECT id FROM channel_poll_votes WHERE poll_id=$1 AND option_id=$2 AND user_address=$3', [pollId, optionId, address]);
    if (existing.rows[0]) {
      await db.query('DELETE FROM channel_poll_votes WHERE id = $1', [existing.rows[0].id]);
    } else {
      await db.query('INSERT INTO channel_poll_votes (poll_id, option_id, user_address) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [pollId, optionId, address]);
    }

    // Return updated poll
    const optionsRes = await db.query('SELECT * FROM channel_poll_options WHERE poll_id = $1 ORDER BY position', [pollId]);
    const votesRes = await db.query('SELECT option_id, user_address FROM channel_poll_votes WHERE poll_id = $1', [pollId]);
    const opts = optionsRes.rows.map(o => ({
      ...o,
      votes: votesRes.rows.filter(v => v.option_id === o.id).length,
      voted: votesRes.rows.some(v => v.option_id === o.id && v.user_address.toLowerCase() === address.toLowerCase()),
    }));
    const totalVotes = votesRes.rows.length;

    io.to('channel_' + poll.rows[0].channel_id).emit('poll_update', { pollId: parseInt(pollId), options: opts, totalVotes });
    res.json({ options: opts, totalVotes });
  } catch (err) {
    console.error('Poll vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Get poll details
app.get('/api/polls/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await db.query('SELECT * FROM channel_polls WHERE id = $1', [pollId]);
    if (!poll.rows[0]) return res.status(404).json({ error: 'Poll not found' });
    const optionsRes = await db.query('SELECT * FROM channel_poll_options WHERE poll_id = $1 ORDER BY position', [pollId]);
    const votesRes = await db.query('SELECT option_id, user_address FROM channel_poll_votes WHERE poll_id = $1', [pollId]);
    const opts = optionsRes.rows.map(o => ({
      ...o,
      votes: votesRes.rows.filter(v => v.option_id === o.id).length,
      voters: votesRes.rows.filter(v => v.option_id === o.id).map(v => v.user_address),
    }));
    res.json({ ...poll.rows[0], options: opts, totalVotes: votesRes.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get poll' });
  }
});


// ═══════════════════════════════════════════════════════════
// CUSTOM EMOJI
// ═══════════════════════════════════════════════════════════

// Upload custom emoji
app.post('/api/groups/:id/emoji', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { id } = req.params;
    const { name, imageData } = req.body;
    if (!name || !imageData) return res.status(400).json({ error: 'Name and image required' });

    const hasPerm = await hasPermission(id, address, 'manageExpressions');
    if (!hasPerm) return res.status(403).json({ error: 'Missing manage expressions permission' });

    // Count existing emoji (limit 50 for free)
    const countRes = await db.query('SELECT COUNT(*) FROM custom_emoji WHERE group_id = $1', [id]);
    if (parseInt(countRes.rows[0].count) >= 50) return res.status(400).json({ error: 'Emoji limit reached (50)' });

    const result = await db.query(
      'INSERT INTO custom_emoji (group_id, name, image_url, creator_address) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, name.toLowerCase().replace(/[^a-z0-9_]/g, ''), imageData, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Emoji upload error:', err);
    res.status(500).json({ error: 'Failed to upload emoji' });
  }
});

// Get server emoji
app.get('/api/groups/:id/emoji', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM custom_emoji WHERE group_id = $1 ORDER BY created_at', [req.params.id]);
    res.json({ emoji: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emoji' });
  }
});

// Delete emoji
app.delete('/api/groups/:id/emoji/:emojiId', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageExpressions');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });
    await db.query('DELETE FROM custom_emoji WHERE id = $1 AND group_id = $2', [req.params.emojiId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete emoji' });
  }
});


// ═══════════════════════════════════════════════════════════
// INVITE LINKS (Real tracking)
// ═══════════════════════════════════════════════════════════

// Create invite link
app.post('/api/groups/:id/invites', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { id } = req.params;
    const { channelId, maxUses, maxAge } = req.body;
    const hasPerm = await hasPermission(id, address, 'createInvite');
    if (!hasPerm) return res.status(403).json({ error: 'Missing create invite permission' });

    const code = Math.random().toString(36).substring(2, 10);
    const ageSeconds = maxAge || 604800; // default 7 days
    const expiresAt = new Date(Date.now() + ageSeconds * 1000).toISOString();

    const result = await db.query(
      'INSERT INTO group_invites (group_id, code, creator_address, channel_id, max_uses, max_age, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, code, address, channelId || null, maxUses || 0, ageSeconds, expiresAt]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Invite create error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Get invites for group
app.get('/api/groups/:id/invites', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(\`
      SELECT gi.*, u.username, u.profile_image
      FROM group_invites gi
      LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(gi.creator_address)
      WHERE gi.group_id = $1
      ORDER BY gi.created_at DESC
    \`, [req.params.id]);
    res.json({ invites: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Delete invite
app.delete('/api/groups/:id/invites/:code', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageServer');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });
    await db.query('DELETE FROM group_invites WHERE code = $1 AND group_id = $2', [req.params.code, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invite' });
  }
});

// Join via invite code
app.post('/api/invites/:code/join', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const invite = await db.query('SELECT * FROM group_invites WHERE code = $1', [req.params.code]);
    if (!invite.rows[0]) return res.status(404).json({ error: 'Invalid invite' });

    const inv = invite.rows[0];
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return res.status(400).json({ error: 'Invite has expired' });
    if (inv.max_uses > 0 && inv.uses >= inv.max_uses)
      return res.status(400).json({ error: 'Invite has reached max uses' });

    // Check if already member
    const existing = await db.query('SELECT id FROM group_members WHERE group_id = $1 AND LOWER(user_address) = LOWER($2)', [inv.group_id, address]);
    if (existing.rows[0]) return res.json({ already_member: true, group_id: inv.group_id });

    // Add member
    await db.query('INSERT INTO group_members (group_id, user_address, role) VALUES ($1,$2,$3)', [inv.group_id, address, 'member']);
    await db.query('UPDATE groups SET member_count = member_count + 1 WHERE id = $1', [inv.group_id]);
    await db.query('UPDATE group_invites SET uses = uses + 1 WHERE id = $1', [inv.id]);

    res.json({ success: true, group_id: inv.group_id });
  } catch (err) {
    console.error('Invite join error:', err);
    res.status(500).json({ error: 'Failed to join via invite' });
  }
});


// ═══════════════════════════════════════════════════════════
// SCHEDULED EVENTS
// ═══════════════════════════════════════════════════════════

app.post('/api/groups/:id/events', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { id } = req.params;
    const { name, description, location, eventType, channelId, startTime, endTime, imageUrl } = req.body;
    const hasPerm = await hasPermission(id, address, 'manageEvents');
    if (!hasPerm) return res.status(403).json({ error: 'Missing manage events permission' });

    const result = await db.query(
      'INSERT INTO group_events (group_id, creator_address, name, description, location, event_type, channel_id, start_time, end_time, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [id, address, name, description || null, location || null, eventType || 'voice', channelId || null, startTime, endTime || null, imageUrl || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Event create error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.get('/api/groups/:id/events', async (req, res) => {
  try {
    const result = await db.query(\`
      SELECT ge.*, u.username, u.profile_image,
        (SELECT COUNT(*) FROM group_event_rsvps WHERE event_id = ge.id) as interested_count
      FROM group_events ge
      LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(ge.creator_address)
      WHERE ge.group_id = $1 AND (ge.status = 'scheduled' OR ge.start_time > NOW() - INTERVAL '1 day')
      ORDER BY ge.start_time ASC
    \`, [req.params.id]);
    res.json({ events: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.delete('/api/groups/:id/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageEvents');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });
    await db.query('DELETE FROM group_events WHERE id = $1 AND group_id = $2', [req.params.eventId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.post('/api/events/:eventId/rsvp', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const existing = await db.query('SELECT id FROM group_event_rsvps WHERE event_id=$1 AND user_address=$2', [req.params.eventId, address]);
    if (existing.rows[0]) {
      await db.query('DELETE FROM group_event_rsvps WHERE id = $1', [existing.rows[0].id]);
      res.json({ interested: false });
    } else {
      await db.query('INSERT INTO group_event_rsvps (event_id, user_address) VALUES ($1,$2)', [req.params.eventId, address]);
      res.json({ interested: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});


// ═══════════════════════════════════════════════════════════
// CUSTOM STATUS
// ═══════════════════════════════════════════════════════════

app.patch('/api/users/status', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { text, emoji, expiresIn } = req.body;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 3600000).toISOString() : null;

    await db.query('UPDATE users SET custom_status=$1, status_emoji=$2, status_expires_at=$3 WHERE LOWER(wallet_address)=LOWER($4)', [text || null, emoji || null, expiresAt, address]);

    // Broadcast to online users
    io.emit('user_status_update', { address, custom_status: text, status_emoji: emoji });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.get('/api/users/:address/status', async (req, res) => {
  try {
    const targetAddress = await resolveAddress(req.params.address);
    const result = await db.query('SELECT custom_status, status_emoji, status_expires_at FROM users WHERE LOWER(wallet_address)=LOWER($1)', [targetAddress]);
    if (!result.rows[0]) return res.json({ custom_status: null });
    const status = result.rows[0];
    if (status.status_expires_at && new Date(status.status_expires_at) < new Date()) {
      await db.query('UPDATE users SET custom_status=NULL, status_emoji=NULL, status_expires_at=NULL WHERE LOWER(wallet_address)=LOWER($1)', [targetAddress]);
      return res.json({ custom_status: null });
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});


// ═══════════════════════════════════════════════════════════
// AUTOMOD
// ═══════════════════════════════════════════════════════════

app.get('/api/groups/:id/automod', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM automod_rules WHERE group_id = $1 ORDER BY created_at', [req.params.id]);
    res.json({ rules: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch automod rules' });
  }
});

app.post('/api/groups/:id/automod', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageServer');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });

    const { name, ruleType, triggerMetadata, actions, exemptRoles, exemptChannels } = req.body;
    const result = await db.query(
      'INSERT INTO automod_rules (group_id, name, rule_type, trigger_metadata, actions, exempt_roles, exempt_channels) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id, name, ruleType, JSON.stringify(triggerMetadata || {}), JSON.stringify(actions || []), exemptRoles || [], exemptChannels || []]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('AutoMod create error:', err);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

app.patch('/api/groups/:id/automod/:ruleId', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageServer');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });

    const { enabled, triggerMetadata, actions, exemptRoles, exemptChannels } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;
    if (enabled !== undefined) { sets.push('enabled=$' + idx++); vals.push(enabled); }
    if (triggerMetadata) { sets.push('trigger_metadata=$' + idx++); vals.push(JSON.stringify(triggerMetadata)); }
    if (actions) { sets.push('actions=$' + idx++); vals.push(JSON.stringify(actions)); }
    if (exemptRoles) { sets.push('exempt_roles=$' + idx++); vals.push(exemptRoles); }
    if (exemptChannels) { sets.push('exempt_channels=$' + idx++); vals.push(exemptChannels); }
    sets.push('updated_at=NOW()');

    vals.push(req.params.ruleId, req.params.id);
    await db.query('UPDATE automod_rules SET ' + sets.join(',') + ' WHERE id=$' + idx++ + ' AND group_id=$' + idx, vals);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

app.delete('/api/groups/:id/automod/:ruleId', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageServer');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });
    await db.query('DELETE FROM automod_rules WHERE id=$1 AND group_id=$2', [req.params.ruleId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});


// ═══════════════════════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════════════════════

app.get('/api/groups/:id/welcome-screen', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM group_welcome_screen WHERE group_id = $1', [req.params.id]);
    res.json(result.rows[0] || { enabled: false, description: '', welcome_channels: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch welcome screen' });
  }
});

app.put('/api/groups/:id/welcome-screen', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageServer');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });

    const { enabled, description, welcomeChannels } = req.body;
    const existing = await db.query('SELECT id FROM group_welcome_screen WHERE group_id = $1', [req.params.id]);
    if (existing.rows[0]) {
      await db.query('UPDATE group_welcome_screen SET enabled=$1, description=$2, welcome_channels=$3, updated_at=NOW() WHERE group_id=$4',
        [enabled, description, JSON.stringify(welcomeChannels || []), req.params.id]);
    } else {
      await db.query('INSERT INTO group_welcome_screen (group_id, enabled, description, welcome_channels) VALUES ($1,$2,$3,$4)',
        [req.params.id, enabled, description, JSON.stringify(welcomeChannels || [])]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save welcome screen' });
  }
});


// ═══════════════════════════════════════════════════════════
// FORUM CHANNELS
// ═══════════════════════════════════════════════════════════

app.post('/api/channels/:channelId/forum-posts', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId } = req.params;
    const { title, content, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

    const result = await db.query(
      'INSERT INTO forum_posts (channel_id, creator_address, title, content, tags) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [channelId, address, title, content || '', tags || []]
    );
    const userRow = await db.query('SELECT username, profile_image FROM users WHERE LOWER(wallet_address)=LOWER($1)', [address]);
    res.json({ ...result.rows[0], username: userRow.rows[0]?.username, profile_image: userRow.rows[0]?.profile_image });
  } catch (err) {
    console.error('Forum post error:', err);
    res.status(500).json({ error: 'Failed to create forum post' });
  }
});

app.get('/api/channels/:channelId/forum-posts', async (req, res) => {
  try {
    const { sort } = req.query;
    let orderBy = 'fp.last_message_at DESC';
    if (sort === 'newest') orderBy = 'fp.created_at DESC';
    if (sort === 'oldest') orderBy = 'fp.created_at ASC';

    const result = await db.query(\`
      SELECT fp.*, u.username, u.profile_image
      FROM forum_posts fp
      LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(fp.creator_address)
      WHERE fp.channel_id = $1
      ORDER BY fp.pinned DESC, \${orderBy}
    \`, [req.params.channelId]);
    res.json({ posts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch forum posts' });
  }
});

app.get('/api/forum-posts/:postId/messages', async (req, res) => {
  try {
    const result = await db.query(\`
      SELECT fpm.*, u.username, u.profile_image
      FROM forum_post_messages fpm
      LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(fpm.user_address)
      WHERE fpm.post_id = $1
      ORDER BY fpm.created_at ASC
    \`, [req.params.postId]);
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch forum messages' });
  }
});

app.post('/api/forum-posts/:postId/messages', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { content, imageUrl } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const result = await db.query(
      'INSERT INTO forum_post_messages (post_id, user_address, content, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.postId, address, content, imageUrl || null]
    );
    await db.query('UPDATE forum_posts SET message_count = message_count + 1, last_message_at = NOW() WHERE id = $1', [req.params.postId]);

    const userRow = await db.query('SELECT username, profile_image FROM users WHERE LOWER(wallet_address)=LOWER($1)', [address]);
    res.json({ ...result.rows[0], username: userRow.rows[0]?.username, profile_image: userRow.rows[0]?.profile_image });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post forum message' });
  }
});


// ═══════════════════════════════════════════════════════════
// CHANNEL / CATEGORY REORDER
// ═══════════════════════════════════════════════════════════

app.patch('/api/groups/:id/channels/reorder', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageChannels');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });

    const { channels } = req.body; // [{id, position, category_id}]
    for (const ch of channels) {
      await db.query('UPDATE channels SET position=$1, category_id=$2 WHERE id=$3 AND group_id=$4',
        [ch.position, ch.category_id || null, ch.id, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder channels' });
  }
});

app.patch('/api/groups/:id/categories/reorder', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const hasPerm = await hasPermission(req.params.id, address, 'manageChannels');
    if (!hasPerm) return res.status(403).json({ error: 'Missing permission' });

    const { categories } = req.body; // [{id, position}]
    for (const cat of categories) {
      await db.query('UPDATE channel_categories SET position=$1 WHERE id=$2 AND group_id=$3',
        [cat.position, cat.id, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});


// ═══════════════════════════════════════════════════════════
// BULK DELETE MESSAGES
// ═══════════════════════════════════════════════════════════

app.post('/api/channels/:channelId/messages/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const address = await resolveAddress(req.user.address);
    const { channelId } = req.params;
    const { messageIds } = req.body;
    if (!messageIds || messageIds.length === 0 || messageIds.length > 100)
      return res.status(400).json({ error: 'Provide 1-100 message IDs' });

    // Need manageMessages perm — find the group from channel
    const chRow = await db.query('SELECT group_id FROM channels WHERE id = $1', [channelId]);
    if (!chRow.rows[0]) return res.status(404).json({ error: 'Channel not found' });

    const hasPerm = await hasPermission(chRow.rows[0].group_id, address, 'manageMessages');
    if (!hasPerm) return res.status(403).json({ error: 'Missing manage messages permission' });

    await db.query('DELETE FROM channel_messages WHERE id = ANY($1) AND channel_id = $2', [messageIds, channelId]);

    io.to('channel_' + channelId).emit('messages_bulk_deleted', { messageIds });
    res.json({ deleted: messageIds.length });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

`;

// Add poll_id column to channel_messages if missing
const addPollColumn = `
// Add poll_id column to channel_messages at startup
(async () => {
  try {
    await db.query('ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS poll_id INTEGER DEFAULT NULL');
  } catch(e) {}
})();
`;

// Find a good spot to add the column migration — after db/pool setup
const poolIdx = lines.findIndex(l => l.includes('new Pool(') || l.includes('createPool('));
if (poolIdx > 0) {
  // Find the end of the pool setup (look for next blank line or statement)
  let afterPoolIdx = poolIdx + 5;
  for (let i = poolIdx + 1; i < poolIdx + 30; i++) {
    if (lines[i] && (lines[i].trim() === '' || lines[i].includes('const ') || lines[i].includes('function ') || lines[i].includes('app.'))) {
      afterPoolIdx = i;
      break;
    }
  }
  lines.splice(afterPoolIdx, 0, addPollColumn);
  // Adjust insertIdx since we added lines
  insertIdx = lines.findIndex(l => l.includes('server.listen(PORT'));
}

// Insert new endpoints before server.listen
lines.splice(insertIdx, 0, newEndpoints);

// Also enhance the GET messages endpoint to include poll data
const getMsgIdx = lines.findIndex(l => l.includes("app.get('/api/channels/:channelId/messages'"));
if (getMsgIdx > 0) {
  // Find the SQL query in this endpoint and add poll join
  for (let i = getMsgIdx; i < getMsgIdx + 50; i++) {
    if (lines[i] && lines[i].includes('ORDER BY') && lines[i].includes('cm.created_at')) {
      // This is the messages query — add poll_id to the select
      break;
    }
  }
}

// Inject automod check into the channel message sending endpoint
const sendMsgIdx = lines.findIndex(l => l.includes("app.post('/api/channels/:channelId/messages'"));
if (sendMsgIdx > 0) {
  // Find the line after const { content } extraction
  for (let i = sendMsgIdx; i < sendMsgIdx + 30; i++) {
    if (lines[i] && (lines[i].includes("const { content") || lines[i].includes("req.body"))) {
      // Insert automod check after content extraction
      const automodCheck = `
    // ── AutoMod Check ──
    try {
      const chRow = await db.query('SELECT group_id FROM channels WHERE id=$1', [channelId]);
      if (chRow.rows[0]) {
        const amRules = await db.query('SELECT * FROM automod_rules WHERE group_id=$1 AND enabled=true', [chRow.rows[0].group_id]);
        for (const rule of amRules.rows) {
          const meta = typeof rule.trigger_metadata === 'string' ? JSON.parse(rule.trigger_metadata) : rule.trigger_metadata;
          if (rule.rule_type === 'blocked_words' && meta.words) {
            const lower = (content || '').toLowerCase();
            const blocked = meta.words.some(w => lower.includes(w.toLowerCase()));
            if (blocked) return res.status(400).json({ error: 'Message blocked by AutoMod: contains blocked word' });
          }
          if (rule.rule_type === 'mention_spam' && meta.max_mentions) {
            const mentionCount = ((content || '').match(/@/g) || []).length;
            if (mentionCount > meta.max_mentions) return res.status(400).json({ error: 'Message blocked by AutoMod: too many mentions' });
          }
          if (rule.rule_type === 'spam_links' && meta.enabled) {
            const hasLink = /https?:\\/\\//.test(content || '');
            if (hasLink) return res.status(400).json({ error: 'Message blocked by AutoMod: links not allowed' });
          }
        }
      }
    } catch(amErr) { console.error('AutoMod check error:', amErr); }
`;
      lines.splice(i + 1, 0, automodCheck);
      break;
    }
  }
}

fs.writeFileSync('/root/server.js', lines.join('\n'));
console.log('Patch applied! Original lines:', code.split('\n').length, '→ New lines:', lines.join('\n').split('\n').length);

import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else "/root/server.js"

with open(filepath, "r") as f:
    code = f.read()

changes = 0

# 1. Add ban check to login endpoint
old_login = """    // Check if user exists
    const userResult = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    const userExists = userResult.rows.length > 0;
    const user = userExists ? transformUser(userResult.rows[0], true) : null;

    // Generate JWT token
    const token = generateToken(addressLower);"""

new_login = """    // Check if wallet is banned
    const banCheck = await db.query('SELECT * FROM banned_wallets WHERE wallet_address = $1', [addressLower]);
    if (banCheck.rows.length > 0) {
      return res.status(403).json({ error: 'This wallet has been permanently banned.', banned: true });
    }

    // Check if user exists
    const userResult = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    const userExists = userResult.rows.length > 0;
    const user = userExists ? transformUser(userResult.rows[0], true) : null;

    // Generate JWT token
    const token = generateToken(addressLower);"""

if old_login in code:
    code = code.replace(old_login, new_login, 1)
    changes += 1
    print("1. Login ban check added")
else:
    print("1. WARN: Login pattern not found")

# 2. Add ban check to register endpoint
old_register = """    // Check if user already exists
    const existing = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }"""

new_register = """    // Check if wallet is banned
    const banCheck = await db.query('SELECT * FROM banned_wallets WHERE wallet_address = $1', [addressLower]);
    if (banCheck.rows.length > 0) {
      return res.status(403).json({ error: 'This wallet has been permanently banned.', banned: true });
    }

    // Check if user already exists
    const existing = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [addressLower]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }"""

if old_register in code:
    code = code.replace(old_register, new_register, 1)
    changes += 1
    print("2. Register ban check added")
else:
    print("2. WARN: Register pattern not found")

# 3. Admin bypass on profile view
old_profile = """    const blocked = await isBlockedBetween(req.userAddress, userRow.wallet_address);
    if (blocked) {
      return res.status(403).json({ error: 'Not authorized to view this profile' });
    }

    // Get follower/following counts"""

new_profile = """    // Admins bypass block restrictions
    const adminCheck = await db.query('SELECT is_admin FROM users WHERE wallet_address = $1', [req.userAddress]);
    const isAdmin = !!adminCheck.rows[0]?.is_admin;

    if (!isAdmin) {
      const blocked = await isBlockedBetween(req.userAddress, userRow.wallet_address);
      if (blocked) {
        return res.status(403).json({ error: 'Not authorized to view this profile' });
      }
    }

    // Get follower/following counts"""

if old_profile in code:
    code = code.replace(old_profile, new_profile, 1)
    changes += 1
    print("3. Profile admin bypass added")
else:
    print("3. WARN: Profile block pattern not found")

# 4. Admin bypass on user posts
old_posts = """    const blocked = await isBlockedBetween(req.userAddress, address);
    if (blocked) {
      return res.status(403).json({ error: 'Not authorized to view posts' });
    }

    const result = await db.query(
      `SELECT p.*, u.username, u.profile_image
       FROM posts p
       JOIN users u ON p.author_address = u.wallet_address
       WHERE p.author_address = $1
       ORDER BY p.created_at DESC`,
      [address]
    );

    res.json({ posts: result.rows });"""

new_posts = """    // Admins bypass block restrictions
    const adminCheck = await db.query('SELECT is_admin FROM users WHERE wallet_address = $1', [req.userAddress]);
    const isViewerAdmin = !!adminCheck.rows[0]?.is_admin;

    if (!isViewerAdmin) {
      const blocked = await isBlockedBetween(req.userAddress, address);
      if (blocked) {
        return res.status(403).json({ error: 'Not authorized to view posts' });
      }
    }

    const result = await db.query(
      `SELECT p.*, u.username, u.profile_image
       FROM posts p
       JOIN users u ON p.author_address = u.wallet_address
       WHERE p.author_address = $1
       ORDER BY p.created_at DESC`,
      [address]
    );

    res.json({ posts: result.rows });"""

if old_posts in code:
    code = code.replace(old_posts, new_posts, 1)
    changes += 1
    print("4. User posts admin bypass added")
else:
    print("4. WARN: User posts block pattern not found")

# 5. Add admin ban+delete routes before server.listen
old_listen = "server.listen(PORT, () => {"

new_routes = """// ============================================================
// ADMIN: BAN & DELETE USER
// ============================================================

// Admin: Delete a user completely and permanently ban their wallet
app.delete('/api/admin/users/:address', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetAddress = req.params.address.toLowerCase();
    const { reason } = req.body || {};

    // Prevent admin from banning themselves
    if (targetAddress === req.userAddress) {
      return res.status(400).json({ error: 'You cannot ban yourself' });
    }

    // Check user exists
    const userCheck = await db.query('SELECT wallet_address, username FROM users WHERE wallet_address = $1', [targetAddress]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = userCheck.rows[0].username;

    // Add to banned_wallets table
    await db.query(
      'INSERT INTO banned_wallets (wallet_address, banned_by, reason) VALUES ($1, $2, $3) ON CONFLICT (wallet_address) DO UPDATE SET banned_by = $2, reason = $3, banned_at = NOW()',
      [targetAddress, req.userAddress, reason || 'Banned by admin']
    );

    // Transfer ownership of groups the user owns, or delete them
    const ownedGroups = await db.query('SELECT id FROM groups WHERE owner_address = $1', [targetAddress]);
    for (const group of ownedGroups.rows) {
      const nextAdmin = await db.query(
        "SELECT member_address FROM group_members WHERE group_id = $1 AND member_address != $2 AND role IN ('admin','owner') LIMIT 1",
        [group.id, targetAddress]
      );
      if (nextAdmin.rows.length > 0) {
        await db.query('UPDATE groups SET owner_address = $1 WHERE id = $2', [nextAdmin.rows[0].member_address, group.id]);
        await db.query("UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND member_address = $2", [group.id, nextAdmin.rows[0].member_address]);
      } else {
        const nextMember = await db.query(
          'SELECT member_address FROM group_members WHERE group_id = $1 AND member_address != $2 LIMIT 1',
          [group.id, targetAddress]
        );
        if (nextMember.rows.length > 0) {
          await db.query('UPDATE groups SET owner_address = $1 WHERE id = $2', [nextMember.rows[0].member_address, group.id]);
          await db.query("UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND member_address = $2", [group.id, nextMember.rows[0].member_address]);
        }
      }
    }

    // Delete the user - CASCADE handles all related data
    await db.query('DELETE FROM users WHERE wallet_address = $1', [targetAddress]);

    // Also resolve any pending reports about this user's content
    await db.query(
      "UPDATE reports SET status = 'removed', admin_notes = 'User banned and deleted by admin', reviewed_by = $1, reviewed_at = NOW() WHERE reporter_address != $2 AND status = 'pending'",
      [req.userAddress, targetAddress]
    ).catch(() => {});

    console.log('Admin ' + req.userAddress + ' banned and deleted user ' + username + ' (' + targetAddress + ')');

    res.json({ success: true, message: 'User ' + username + ' has been permanently banned and all their data has been erased.' });
  } catch (error) {
    console.error('Admin ban+delete user error:', error);
    res.status(500).json({ error: 'Failed to ban and delete user' });
  }
});

// Admin: Check if a wallet is banned
app.get('/api/admin/banned/:address', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM banned_wallets WHERE wallet_address = $1', [req.params.address.toLowerCase()]);
    res.json({ banned: result.rows.length > 0, details: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check ban status' });
  }
});

// Admin: Get all banned wallets
app.get('/api/admin/banned', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT bw.*, u.username as banned_by_username
       FROM banned_wallets bw
       LEFT JOIN users u ON bw.banned_by = u.wallet_address
       ORDER BY bw.banned_at DESC`
    );
    res.json({ banned: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get banned wallets' });
  }
});

// Admin: Unban a wallet (does not restore deleted data)
app.delete('/api/admin/banned/:address', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM banned_wallets WHERE wallet_address = $1', [req.params.address.toLowerCase()]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Wallet not found in ban list' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unban wallet' });
  }
});

server.listen(PORT, () => {"""

if old_listen in code:
    code = code.replace(old_listen, new_routes, 1)
    changes += 1
    print("5. Admin ban+delete routes added")
else:
    print("5. WARN: server.listen pattern not found")

with open(filepath, "w") as f:
    f.write(code)

print(f"\nDone! {changes}/5 changes applied.")

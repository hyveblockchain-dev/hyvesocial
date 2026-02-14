// tmp_patch_permissions.js — adds granular role permission checking to server.js
// Run on remote: node tmp_patch_permissions.js
const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// ── 1. Add the permission helper function ──
// Insert right before the first "// ═══" Discord channels block
const discordBlock = code.indexOf('// ═══════════════ DISCORD-LIKE CHANNELS');
if (discordBlock === -1) {
  console.error('Could not find Discord channels block');
  process.exit(1);
}

const PERM_HELPER = `
// ===================================================================
// ═══════════════ GRANULAR ROLE PERMISSION CHECKING ═════════════════
// ===================================================================

/**
 * Check if a user has a specific permission in a group.
 * Returns true if user is owner, has legacy admin role, or has any custom role
 * with the specified permission enabled.
 * @param {number} groupId
 * @param {string} userAddress
 * @param {string} permission - e.g. 'manageChannels', 'kickMembers', etc.
 * @returns {Promise<boolean>}
 */
async function hasPermission(groupId, userAddress, permission) {
  // 1. Check if owner
  const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
  if (group.rows[0]?.owner_address?.toLowerCase() === userAddress.toLowerCase()) return true;

  // 2. Check legacy admin role
  const member = await db.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2',
    [groupId, userAddress]
  );
  if (!member.rows[0]) return false; // not a member
  if (member.rows[0].role === 'admin' || member.rows[0].role === 'owner') return true;

  // 3. Check custom roles for the permission
  const roles = await db.query(
    \`SELECT gr.permissions FROM group_roles gr
     JOIN member_roles mr ON mr.role_id = gr.id
     WHERE mr.group_id = $1 AND mr.user_address = $2\`,
    [groupId, userAddress]
  );
  for (const row of roles.rows) {
    const perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || {});
    if (perms.administrator) return true; // admin permission grants everything
    if (perms[permission]) return true;
  }
  return false;
}

/**
 * Check if user is a member of the group (any role).
 */
async function isMemberOf(groupId, userAddress) {
  const member = await db.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2',
    [groupId, userAddress]
  );
  return !!member.rows[0];
}

`;

if (!code.includes('async function hasPermission')) {
  code = code.slice(0, discordBlock) + PERM_HELPER + code.slice(discordBlock);
  changes++;
  console.log('✅ Added hasPermission helper function');
} else {
  console.log('⏭  hasPermission already exists, skipping');
}

// ── 2. Update channel create endpoint to use granular permissions ──
const oldChannelCreate = `const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const mRole = member.rows[0]?.role;
    if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create channels' });
    }`;

const newChannelCreate = `const canManage = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canManage) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

if (code.includes(oldChannelCreate)) {
  code = code.replace(oldChannelCreate, newChannelCreate);
  changes++;
  console.log('✅ Updated channel create to use granular permissions');
}

// ── 3. Update channel update endpoint ──
const oldChannelUpdate = `const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const mRole = member.rows[0]?.role;
    if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can edit channels' });
    }`;

const newChannelUpdate = `const canManage = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canManage) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

if (code.includes(oldChannelUpdate)) {
  code = code.replace(oldChannelUpdate, newChannelUpdate);
  changes++;
  console.log('✅ Updated channel update to use granular permissions');
}

// ── 4. Update channel delete endpoint ──
const oldChannelDelete = `const isOwner = group.rows[0]?.owner_address?.toLowerCase() === req.userAddress.toLowerCase();
    const mRole = member.rows[0]?.role;
    if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can delete channels' });
    }`;

const newChannelDelete = `const canManage = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canManage) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

if (code.includes(oldChannelDelete)) {
  code = code.replace(oldChannelDelete, newChannelDelete);
  changes++;
  console.log('✅ Updated channel delete to use granular permissions');
}

// ── 5. Update category create endpoint ──
const oldCatCreate = `if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create categories' });
    }`;

const newCatCreate = `const canManageCh = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canManageCh) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

if (code.includes(oldCatCreate)) {
  code = code.replace(oldCatCreate, newCatCreate);
  changes++;
  console.log('✅ Updated category create to use granular permissions');
}

// ── 6. Update category delete endpoint ──
const oldCatDelete = `if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can delete categories' });
    }`;

const newCatDelete = `const canManageCat = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canManageCat) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

if (code.includes(oldCatDelete)) {
  code = code.replace(oldCatDelete, newCatDelete);
  changes++;
  console.log('✅ Updated category delete to use granular permissions');
}

// ── 7. Update role create endpoint ──
const oldRoleCreate = `if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can create roles' });
    }`;

const newRoleCreate = `const canManageRoles = await hasPermission(groupId, req.userAddress, 'manageRoles');
    if (!canManageRoles) {
      return res.status(403).json({ error: 'You need the Manage Roles permission' });
    }`;

if (code.includes(oldRoleCreate)) {
  code = code.replace(oldRoleCreate, newRoleCreate);
  changes++;
  console.log('✅ Updated role create to use granular permissions');
}

// ── 8. Update role update endpoint ──
const oldRoleUpdate = `if (!isOwner && mRole !== 'admin' && mRole !== 'owner') {
      return res.status(403).json({ error: 'Only admins can edit roles' });
    }`;

const newRoleUpdate = `const canManageRoles = await hasPermission(groupId, req.userAddress, 'manageRoles');
    if (!canManageRoles) {
      return res.status(403).json({ error: 'You need the Manage Roles permission' });
    }`;

if (code.includes(oldRoleUpdate)) {
  code = code.replace(oldRoleUpdate, newRoleUpdate);
  changes++;
  console.log('✅ Updated role update to use granular permissions');
}

// ── 9. Update role assign endpoint ──
const oldRoleAssign = `if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can assign roles' });
    }`;

const newRoleAssign = `const canManageRoles2 = await hasPermission(groupId, req.userAddress, 'manageRoles');
    if (!canManageRoles2) {
      return res.status(403).json({ error: 'You need the Manage Roles permission' });
    }`;

if (code.includes(oldRoleAssign)) {
  code = code.replace(oldRoleAssign, newRoleAssign);
  changes++;
  console.log('✅ Updated role assign to use granular permissions');
}

// ── 10. Update role unassign endpoint ──
const oldRoleUnassign = `if (!isOwner && role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only admins can remove roles' });
    }`;

const newRoleUnassign = `const canManageRoles3 = await hasPermission(groupId, req.userAddress, 'manageRoles');
    if (!canManageRoles3) {
      return res.status(403).json({ error: 'You need the Manage Roles permission' });
    }`;

if (code.includes(oldRoleUnassign)) {
  code = code.replace(oldRoleUnassign, newRoleUnassign);
  changes++;
  console.log('✅ Updated role unassign to use granular permissions');
}

// ── 11. Update message delete to check manageMessages for other people's messages ──
// This is trickier - we need to allow author to delete their own, but require manageMessages for others
const oldMsgDelete = `const isAuthor = msg.rows[0].user_address?.toLowerCase() === req.userAddress.toLowerCase();
    const isAdmin = ['admin', 'owner'].includes(memberCheck.rows[0]?.role);
    if (!isAuthor && !isAdmin && !isGroupOwner) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }`;

const newMsgDelete = `const isAuthor = msg.rows[0].user_address?.toLowerCase() === req.userAddress.toLowerCase();
    if (!isAuthor) {
      const canManageMsgs = await hasPermission(parseInt(channel.rows[0].group_id), req.userAddress, 'manageMessages');
      if (!canManageMsgs) {
        return res.status(403).json({ error: 'You need the Manage Messages permission to delete others\\' messages' });
      }
    }`;

if (code.includes(oldMsgDelete)) {
  code = code.replace(oldMsgDelete, newMsgDelete);
  changes++;
  console.log('✅ Updated message delete to use granular permissions');
}

// ── Write the patched file ──
if (changes > 0) {
  // Backup first
  fs.writeFileSync('/root/server.js.bak_perms', fs.readFileSync('/root/server.js'));
  fs.writeFileSync('/root/server.js', code);
  console.log(`\n✅ Applied ${changes} permission patches. Restart with: pm2 restart hyve-backend`);
} else {
  console.log('\n⚠️  No changes applied — endpoint strings may have already been patched or differ.');
}

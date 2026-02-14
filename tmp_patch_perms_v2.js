// tmp_patch_perms_v2.js — carefully add permission helper and replace auth checks
// This version replaces only the if-block, not the preceding variable declarations
const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// ── Step 1: Add hasPermission helper if not present ──
if (!code.includes('async function hasPermission')) {
  const marker = '// ═══════════════ DISCORD-LIKE CHANNELS';
  const idx = code.indexOf(marker);
  if (idx === -1) { console.error('Cannot find channels marker'); process.exit(1); }
  
  const helper = `
// ===================================================================
// ═══════════════ GRANULAR ROLE PERMISSION CHECKING ═════════════════
// ===================================================================
async function hasPermission(groupId, userAddress, permission) {
  const group = await db.query('SELECT owner_address FROM groups WHERE id = $1', [groupId]);
  if (group.rows[0]?.owner_address?.toLowerCase() === userAddress.toLowerCase()) return true;
  const member = await db.query('SELECT role FROM group_members WHERE group_id = $1 AND (user_address = $2 OR member_address = $2)', [groupId, userAddress]);
  if (!member.rows[0]) return false;
  if (member.rows[0].role === 'admin' || member.rows[0].role === 'owner') return true;
  const roles = await db.query(
    'SELECT gr.permissions FROM group_roles gr JOIN member_roles mr ON mr.role_id = gr.id WHERE mr.group_id = $1 AND mr.user_address = $2',
    [groupId, userAddress]
  );
  for (const row of roles.rows) {
    const perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || {});
    if (perms.administrator) return true;
    if (perms[permission]) return true;
  }
  return false;
}

`;
  code = code.slice(0, idx) + helper + code.slice(idx);
  changes++;
  console.log('✅ Added hasPermission helper');
}

// ── Step 2: Replace auth if-blocks ──
// Strategy: find the error message string, then replace just the if-block line(s)
// Pattern in server: 
//   if (!isOwner && role !== 'admin' && role !== 'owner') {
//     return res.status(403).json({ error: '...' });
//   }

function replaceAuthBlock(errorMsg, permission, newErrorMsg) {
  const idx = code.indexOf(errorMsg);
  if (idx === -1) return false;
  
  // Go backwards from error msg to find the 'if (' line
  let lineStart = idx;
  while (lineStart > 0 && code[lineStart] !== '\n') lineStart--;
  // This is the 'return res.status...' line, go back one more line:
  let ifLineEnd = lineStart;
  lineStart--;
  while (lineStart > 0 && code[lineStart] !== '\n') lineStart--;
  // Now we're at the 'if (!isOwner...' line start
  const ifLineStart = lineStart + 1;
  
  // Find the closing '}' after the error message
  let closeBrace = code.indexOf('}', idx + errorMsg.length);
  // Make sure the next non-whitespace after the return statement is '}'
  const afterReturn = code.indexOf('\n', idx);
  let checkPos = afterReturn + 1;
  while (checkPos < code.length && (code[checkPos] === ' ' || code[checkPos] === '\t')) checkPos++;
  if (code[checkPos] === '}') closeBrace = checkPos;
  const blockEnd = closeBrace + 1;
  
  const newBlock = `const _canDo_${permission} = await hasPermission(groupId, req.userAddress, '${permission}');
    if (!_canDo_${permission}) {
      return res.status(403).json({ error: '${newErrorMsg}' });
    }`;
  
  code = code.slice(0, ifLineStart) + newBlock + code.slice(blockEnd);
  changes++;
  return true;
}

// Channel endpoints
if (replaceAuthBlock('Only admins can create channels', 'manageChannels', 'You need the Manage Channels permission')) {
  console.log('✅ Patched: create channels');
}
if (replaceAuthBlock('Only admins can edit channels', 'manageChannels', 'You need the Manage Channels permission')) {
  console.log('✅ Patched: edit channels');
}
if (replaceAuthBlock('Only admins can delete channels', 'manageChannels', 'You need the Manage Channels permission')) {
  console.log('✅ Patched: delete channels');
}
if (replaceAuthBlock('Only admins can create categories', 'manageChannels', 'You need the Manage Channels permission')) {
  console.log('✅ Patched: create categories');
}
if (replaceAuthBlock('Only admins can delete categories', 'manageChannels', 'You need the Manage Channels permission')) {
  console.log('✅ Patched: delete categories');
}

// Role endpoints
if (replaceAuthBlock('Only admins can create roles', 'manageRoles', 'You need the Manage Roles permission')) {
  console.log('✅ Patched: create roles');
}
if (replaceAuthBlock('Only admins can edit roles', 'manageRoles', 'You need the Manage Roles permission')) {
  console.log('✅ Patched: edit roles');
}
if (replaceAuthBlock('Only admins can assign roles', 'manageRoles', 'You need the Manage Roles permission')) {
  console.log('✅ Patched: assign roles');
}
if (replaceAuthBlock('Only admins can remove roles', 'manageRoles', 'You need the Manage Roles permission')) {
  console.log('✅ Patched: remove roles');
}

// Message delete - special case, need to handle differently
const msgErr = 'Not authorized to delete this message';
const msgIdx = code.indexOf(msgErr);
if (msgIdx !== -1) {
  // Find the if line before this error
  let lineStart = msgIdx;
  while (lineStart > 0 && code[lineStart] !== '\n') lineStart--;
  let ifLineEnd = lineStart;
  lineStart--;
  while (lineStart > 0 && code[lineStart] !== '\n') lineStart--;
  const ifLineStart = lineStart + 1;
  
  let closeBrace = msgIdx;
  while (closeBrace < code.length) {
    closeBrace = code.indexOf('}', closeBrace + 1);
    if (closeBrace !== -1) break;
  }
  const blockEnd = closeBrace + 1;
  
  // Also need to remove the isOwner, isAuthor, role variable declarations that precede the if
  // But let's keep it simple - just replace the if block and adjust the variables usage
  const newBlock = `if (!isAuthor) {
      const canManageMsgs = await hasPermission(groupId, req.userAddress, 'manageMessages');
      if (!canManageMsgs) {
        return res.status(403).json({ error: 'You need the Manage Messages permission' });
      }
    }`;
  
  code = code.slice(0, ifLineStart) + newBlock + code.slice(blockEnd);
  changes++;
  console.log('✅ Patched: message delete');
}

// ── Write ──
if (changes > 0) {
  fs.writeFileSync('/root/server.js.bak_perms2', fs.readFileSync('/root/server.js'));
  fs.writeFileSync('/root/server.js', code);
  console.log('\n✅ Applied ' + changes + ' total patches');
} else {
  console.log('\nNo changes made');
}

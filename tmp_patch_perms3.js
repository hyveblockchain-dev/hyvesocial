const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// Fix message delete to use granular permissions
const errMsg = 'Not authorized to delete this message';
const idx = code.indexOf(errMsg);
if (idx !== -1) {
  // Find 'const isOwner' before this error
  let searchStart = idx - 500;
  if (searchStart < 0) searchStart = 0;
  const chunk = code.slice(searchStart, idx);
  const ownerIdx = chunk.lastIndexOf('const isOwner');
  if (ownerIdx !== -1) {
    const blockStart = searchStart + ownerIdx;
    const errEnd = code.indexOf('}', idx + errMsg.length);
    const blockEnd = errEnd + 1;
    
    const newBlock = `const isAuthor = msg.rows[0].user_address.toLowerCase() === req.userAddress.toLowerCase();
    if (!isAuthor) {
      const canManageMsgs = await hasPermission(groupId, req.userAddress, 'manageMessages');
      if (!canManageMsgs) {
        return res.status(403).json({ error: 'You need the Manage Messages permission to delete others\\' messages' });
      }
    }`;
    
    code = code.slice(0, blockStart) + newBlock + code.slice(blockEnd);
    changes++;
    console.log('✅ Updated message delete to use granular permissions');
  }
} else {
  console.log('⏭  Message delete already patched or not found');
}

// Also patch kick (remove member) and ban endpoints
// Look for kick/remove member
const kickPatterns = [
  'Only admins can remove members',
  'Only admins can kick members',
  'Not authorized to remove this member',
];
kickPatterns.forEach(msg => {
  const i = code.indexOf(msg);
  if (i !== -1) {
    let searchStart = i - 400;
    if (searchStart < 0) searchStart = 0;
    const chunk = code.slice(searchStart, i);
    const ownerIdx = chunk.lastIndexOf('const isOwner');
    if (ownerIdx !== -1) {
      const blockStart = searchStart + ownerIdx;
      const errEnd = code.indexOf('}', i + msg.length);
      const blockEnd = errEnd + 1;
      const newBlock = `const canKick = await hasPermission(groupId, req.userAddress, 'kickMembers');
    if (!canKick) {
      return res.status(403).json({ error: 'You need the Kick Members permission' });
    }`;
      code = code.slice(0, blockStart) + newBlock + code.slice(blockEnd);
      changes++;
      console.log('✅ Updated kick/remove: ' + msg);
    }
  }
});

// Ban endpoint
const banPatterns = [
  'Only admins can ban members',
  'Not authorized to ban',
];
banPatterns.forEach(msg => {
  const i = code.indexOf(msg);
  if (i !== -1) {
    let searchStart = i - 400;
    if (searchStart < 0) searchStart = 0;
    const chunk = code.slice(searchStart, i);
    const ownerIdx = chunk.lastIndexOf('const isOwner');
    if (ownerIdx !== -1) {
      const blockStart = searchStart + ownerIdx;
      const errEnd = code.indexOf('}', i + msg.length);
      const blockEnd = errEnd + 1;
      const newBlock = `const canBan = await hasPermission(groupId, req.userAddress, 'banMembers');
    if (!canBan) {
      return res.status(403).json({ error: 'You need the Ban Members permission' });
    }`;
      code = code.slice(0, blockStart) + newBlock + code.slice(blockEnd);
      changes++;
      console.log('✅ Updated ban: ' + msg);
    }
  }
});

if (changes > 0) {
  fs.writeFileSync('/root/server.js', code);
  console.log('\n✅ Applied ' + changes + ' more patches');
} else {
  console.log('\nNo additional changes');
}

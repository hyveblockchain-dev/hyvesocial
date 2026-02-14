const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// For each channel endpoint, find the old permission block and replace
const targets = [
  'Only admins can create channels',
  'Only admins can edit channels',
  'Only admins can delete channels',
  'Only admins can create categories',
  'Only admins can delete categories',
];

targets.forEach(errorMsg => {
  const idx = code.indexOf(errorMsg);
  if (idx === -1) { console.log('⏭  Not found: ' + errorMsg); return; }

  // Find the beginning of the permission block (look backwards for 'const isOwner')
  let searchStart = idx - 400;
  if (searchStart < 0) searchStart = 0;
  const chunk = code.slice(searchStart, idx + errorMsg.length + 20);
  
  // Find 'const isOwner' in chunk
  const ownerIdx = chunk.lastIndexOf('const isOwner');
  if (ownerIdx === -1) { console.log('⏭  No isOwner near: ' + errorMsg); return; }
  
  const blockStart = searchStart + ownerIdx;
  // Find the closing brace+newline after the error message
  const errEnd = code.indexOf('}', idx + errorMsg.length);
  if (errEnd === -1) return;
  const blockEnd = errEnd + 1;
  
  const oldBlock = code.slice(blockStart, blockEnd);
  
  const newBlock = `const canDo = await hasPermission(groupId, req.userAddress, 'manageChannels');
    if (!canDo) {
      return res.status(403).json({ error: 'You need the Manage Channels permission' });
    }`;

  code = code.slice(0, blockStart) + newBlock + code.slice(blockEnd);
  changes++;
  console.log('✅ Updated: ' + errorMsg);
});

// Also handle message delete if it exists
const msgPattern = "Cannot delete this message";
const msgIdx = code.indexOf(msgPattern);
if (msgIdx !== -1) {
  let searchStart = msgIdx - 500;
  if (searchStart < 0) searchStart = 0;
  const chunk = code.slice(searchStart, msgIdx + msgPattern.length + 20);
  const authorIdx = chunk.lastIndexOf('const isAuthor');
  if (authorIdx !== -1) {
    const blockStart = searchStart + authorIdx;
    const errEnd = code.indexOf('}', msgIdx + msgPattern.length);
    const blockEnd = errEnd + 1;
    const newBlock = `const isAuthor = msg.rows[0].user_address?.toLowerCase() === req.userAddress.toLowerCase();
    if (!isAuthor) {
      const canManageMsgs = await hasPermission(parseInt(channel.rows[0].group_id), req.userAddress, 'manageMessages');
      if (!canManageMsgs) {
        return res.status(403).json({ error: 'You need the Manage Messages permission' });
      }
    }`;
    code = code.slice(0, blockStart) + newBlock + code.slice(blockEnd);
    changes++;
    console.log('✅ Updated message delete');
  }
} else {
  console.log('⏭  Message delete pattern not found');
}

if (changes > 0) {
  fs.writeFileSync('/root/server.js', code);
  console.log('\n✅ Applied ' + changes + ' more patches');
} else {
  console.log('\nNo additional changes');
}

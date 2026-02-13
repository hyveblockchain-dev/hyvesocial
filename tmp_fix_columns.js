const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');

// Fix 1: All admin checks in Discord endpoints that query group_members
// "SELECT role FROM group_members WHERE group_id = $1 AND user_address = $2"
// The original working code uses member_address
code = code.replace(
  /FROM group_members WHERE group_id = \$1 AND user_address = \$2/g,
  'FROM group_members WHERE group_id = $1 AND member_address = $2'
);

// Fix 2: gm.user_address -> gm.member_address (gm is always group_members alias)
code = code.replace(/gm\.user_address/g, 'gm.member_address');

// Fix 3: In the online endpoint, the JS code reads m.user_address from the query result
// Since we changed gm.user_address to gm.member_address in the SQL, the result column is now member_address
// But we need to handle the JS property access too
// The specific line: const entry = onlineUsers.get(m.user_address.toLowerCase());
// We need to change it ONLY for the online endpoint context
// Let's find and replace the specific block
code = code.replace(
  "const entry = onlineUsers.get(m.user_address.toLowerCase());",
  "const entry = onlineUsers.get((m.member_address || m.user_address || '').toLowerCase());"
);

fs.writeFileSync('/root/server.js', code);

// Verify the changes
const after = fs.readFileSync('/root/server.js', 'utf8');
const remaining = (after.match(/group_members.*user_address/g) || []);
console.log('Remaining group_members + user_address references:', remaining.length);
if (remaining.length > 0) {
  remaining.forEach((r, i) => console.log(`  ${i+1}: ${r}`));
}

// Check gm.user_address should be gone
const gmRefs = (after.match(/gm\.user_address/g) || []);
console.log('Remaining gm.user_address references:', gmRefs.length);

console.log('Done! Fixed column name mismatches.');

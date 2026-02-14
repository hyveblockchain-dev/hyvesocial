// Backend patch: Add permissions support to categories and enhance channel permission checks
const fs = require('fs');

const serverPath = '/root/server.js';
let lines = fs.readFileSync(serverPath, 'utf8').split('\n');
console.log('Original line count:', lines.length);

// 1. Update category PATCH to support permissions field
// Find: "if (position !== undefined) { sets.push('position = $' + i++); vals.push(position); }" inside category PATCH
let catPatchFound = false;
for (let idx = 0; idx < lines.length; idx++) {
  if (lines[idx].includes("// ── PATCH /api/groups/:id/categories/:catId")) {
    // Find the position line within this endpoint
    for (let j = idx; j < idx + 30; j++) {
      if (lines[j].includes("if (position !== undefined)") && lines[j].includes("category")) {
        // This might not have 'category' in the line, let's just check context
        break;
      }
      if (lines[j].includes("if (position !== undefined)") && !catPatchFound) {
        // Insert after this line
        lines.splice(j + 1, 0, "    if (req.body.permissions !== undefined) { sets.push('permissions = $' + i++); vals.push(JSON.stringify(req.body.permissions)); }");
        catPatchFound = true;
        console.log('Inserted category permissions support at line', j + 2);
        break;
      }
    }
    break;
  }
}

// 2. Add GET endpoint for channel permission overrides
// Insert before the pin endpoint
let getPinsIdx = -1;
for (let idx = 0; idx < lines.length; idx++) {
  if (lines[idx].includes("// ── POST /api/channels/:channelId/messages/:messageId/pin")) {
    getPinsIdx = idx;
    break;
  }
}

if (getPinsIdx > 0) {
  const newEndpoint = `
// ── GET /api/groups/:id/channels/:channelId/permissions — get channel permission overrides ──
app.get('/api/groups/:id/channels/:channelId/permissions', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const channelId = parseInt(req.params.channelId);
    const channel = await db.query('SELECT permissions, category_id FROM channels WHERE id = $1 AND group_id = $2', [channelId, groupId]);
    if (!channel.rows[0]) return res.status(404).json({ error: 'Channel not found' });
    let categoryPerms = {};
    if (channel.rows[0].category_id) {
      const cat = await db.query('SELECT permissions FROM channel_categories WHERE id = $1', [channel.rows[0].category_id]);
      categoryPerms = cat.rows[0]?.permissions || {};
    }
    res.json({ channelPermissions: channel.rows[0].permissions || {}, categoryPermissions: categoryPerms });
  } catch (error) {
    console.error('Get channel permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// ── GET /api/groups/:id/categories/:catId/permissions — get category permission overrides ──
app.get('/api/groups/:id/categories/:catId/permissions', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const catId = parseInt(req.params.catId);
    const cat = await db.query('SELECT permissions FROM channel_categories WHERE id = $1 AND group_id = $2', [catId, groupId]);
    if (!cat.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json({ permissions: cat.rows[0].permissions || {} });
  } catch (error) {
    console.error('Get category permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});
`.split('\n');

  lines.splice(getPinsIdx, 0, ...newEndpoint);
  console.log('Inserted permission GET endpoints at line', getPinsIdx);
}

// 3. Update the message-sending permission check to use role-based overrides
// Find the existing simple check: if (perms.readOnly && memberRole === 'member')
// Replace with a more comprehensive check
for (let idx = 0; idx < lines.length; idx++) {
  if (lines[idx].includes("perms.readOnly") && lines[idx].includes("memberRole === 'member'")) {
    // Replace this line with enhanced permission checking
    const oldLine = lines[idx];
    const indent = oldLine.match(/^\s*/)[0];
    const replacement = [
      `${indent}// Enhanced permission check using role-based overrides`,
      `${indent}if (perms.readOnly && memberRole === 'member') {`,
      `${indent}  // Check if user has a role override allowing sendMessages`,
      `${indent}  const overrides = perms.overrides || [];`,
      `${indent}  let userAllowed = false;`,
      `${indent}  if (overrides.length > 0) {`,
      `${indent}    // Get user's roles`,
      `${indent}    const userRoles = await db.query('SELECT role_id FROM member_roles WHERE group_id = $1 AND user_address = $2', [groupId, req.userAddress]);`,
      `${indent}    const userRoleIds = userRoles.rows.map(r => String(r.role_id));`,
      `${indent}    for (const ov of overrides) {`,
      `${indent}      if (ov.type === 'member' && ov.id?.toLowerCase() === req.userAddress.toLowerCase()) {`,
      `${indent}        if ((ov.allow || []).includes('sendMessages')) { userAllowed = true; break; }`,
      `${indent}        if ((ov.deny || []).includes('sendMessages')) { userAllowed = false; break; }`,
      `${indent}      }`,
      `${indent}      if (ov.type === 'role' && userRoleIds.includes(String(ov.id))) {`,
      `${indent}        if ((ov.allow || []).includes('sendMessages')) userAllowed = true;`,
      `${indent}        if ((ov.deny || []).includes('sendMessages')) userAllowed = false;`,
      `${indent}      }`,
      `${indent}    }`,
      `${indent}  }`,
      `${indent}  if (!userAllowed) {`,
    ];
    // Replace the old if line
    lines.splice(idx, 1, ...replacement);
    // Find the closing brace of the original if block (next line should be return + })
    // The structure is: if (perms.readOnly...) { return res.status(403)... }
    // It might be on the same line or the next line
    const nextLineIdx = idx + replacement.length;
    if (lines[nextLineIdx] && lines[nextLineIdx].includes("return res.status(403)") && lines[nextLineIdx].includes("read-only")) {
      // This line stays as is, but we need to close our new if block after it
      // Find the closing } of original block
      for (let k = nextLineIdx; k < nextLineIdx + 5; k++) {
        if (lines[k] && lines[k].trim() === '}') {
          lines.splice(k + 1, 0, `${indent}  }`, `${indent}}`);
          console.log('Enhanced message permission check at line', idx);
          break;
        }
        if (lines[k] && lines[k].includes('read-only') && lines[k].includes('}')) {
          // Single line: return res.status(403).json({ error: '...' });  }
          // We need to add closing braces after
          lines.splice(k + 1, 0, `${indent}  }`, `${indent}}`);
          console.log('Enhanced message permission check (inline) at line', idx);
          break;
        }
      }
    }
    break;
  }
}

fs.writeFileSync(serverPath, lines.join('\n'));
console.log('New line count:', lines.join('\n').split('\n').length);
console.log('Done!');

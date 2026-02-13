const fs = require('fs');
let code = fs.readFileSync('/root/server.js', 'utf8');
let changes = 0;

// 1. Update POST /api/posts: extract isPublic from req.body
const old1 = 'const { content, imageUrl, privacy, groupId, group_id, metadata } = req.body;';
const new1 = 'const { content, imageUrl, privacy, groupId, group_id, metadata, isPublic, is_public } = req.body;';
if (code.includes(old1)) { code = code.replace(old1, new1); changes++; console.log('1. Added isPublic to POST /api/posts destructuring'); }
else console.log('1. SKIP - already patched or not found');

// 2. Update INSERT INTO posts to include is_public column
const old2a = 'INSERT INTO posts (author_address, content, image_url, privacy, group_id, moderation_status, metadata)';
const new2a = 'INSERT INTO posts (author_address, content, image_url, privacy, group_id, moderation_status, metadata, is_public)';
if (code.includes(old2a)) { code = code.replace(old2a, new2a); changes++; console.log('2a. Added is_public to INSERT columns'); }
else console.log('2a. SKIP');

const old2b = 'VALUES ($1, $2, $3, $4, $5, $6, $7)';
const new2b = 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
// Only replace the first occurrence (in create post)
if (code.includes(old2b)) { code = code.replace(old2b, new2b); changes++; console.log('2b. Added $8 to VALUES'); }
else console.log('2b. SKIP');

const old2c = "[req.userAddress, content, imageUrl || '', privacy || 0, resolvedGroupId, moderationStatus, metadata ? JSON.stringify(metadata) : '{}']";
const new2c = "[req.userAddress, content, imageUrl || '', privacy || 0, resolvedGroupId, moderationStatus, metadata ? JSON.stringify(metadata) : '{}', !!(isPublic || is_public)]";
if (code.includes(old2c)) { code = code.replace(old2c, new2c); changes++; console.log('2c. Added isPublic to params array'); }
else console.log('2c. SKIP');

// 3. Update GET /api/posts to exclude public posts
const old3 = 'WHERE p.group_id IS NULL\n       ORDER BY p.created_at DESC\n       LIMIT $1 OFFSET $2';
const new3 = 'WHERE p.group_id IS NULL AND (p.is_public IS NULL OR p.is_public = FALSE)\n       ORDER BY p.created_at DESC\n       LIMIT $1 OFFSET $2';
if (code.includes(old3)) { code = code.replace(old3, new3); changes++; console.log('3. Added is_public filter to GET /api/posts'); }
else console.log('3. SKIP');

// 4. Add GET /api/posts/public endpoint
const publicPostsMarker = '// Get recent posts (feed)';
if (!code.includes("app.get('/api/posts/public'")) {
  const publicPostsEndpoint = `// Get public posts
app.get('/api/posts/public', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      \`SELECT p.*, u.username, u.profile_image,
              (SELECT COUNT(*) FROM reactions WHERE post_id = p.id) as reaction_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
       FROM posts p
       JOIN users u ON p.author_address = u.wallet_address
       WHERE p.is_public = TRUE AND p.group_id IS NULL
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2\`,
      [limit, offset]
    );

    const posts = result.rows.map((post) => ({
      ...post,
      created_at: post.created_at ? new Date(post.created_at).toISOString() : null,
      updated_at: post.updated_at ? new Date(post.updated_at).toISOString() : null
    }));
    res.json({ posts });
  } catch (error) {
    console.error('Get public posts error:', error);
    res.status(500).json({ error: 'Failed to get public posts' });
  }
});

`;
  code = code.replace(publicPostsMarker, publicPostsEndpoint + publicPostsMarker);
  changes++;
  console.log('4. Added GET /api/posts/public endpoint');
} else console.log('4. SKIP - endpoint already exists');

// 5. Update POST /api/stories to accept isPublic
const old5 = 'const { media, mediaType, text } = req.body;';
const new5 = 'const { media, mediaType, text, isPublic, is_public } = req.body;';
if (code.includes(old5)) { code = code.replace(old5, new5); changes++; console.log('5. Added isPublic to POST /api/stories destructuring'); }
else console.log('5. SKIP');

// 6. Update INSERT INTO stories
const old6a = 'INSERT INTO stories (user_address, media_url, media_type, text)';
const new6a = 'INSERT INTO stories (user_address, media_url, media_type, text, is_public)';
if (code.includes(old6a)) { code = code.replace(old6a, new6a); changes++; console.log('6a. Added is_public to stories INSERT'); }
else console.log('6a. SKIP');

const old6b = 'VALUES ($1, $2, $3, $4)\n       RETURNING *';
const new6b = 'VALUES ($1, $2, $3, $4, $5)\n       RETURNING *';
if (code.includes(old6b)) { code = code.replace(old6b, new6b); changes++; console.log('6b. Added $5 to stories VALUES'); }
else console.log('6b. SKIP');

const old6c = "[req.userAddress, media, mediaType || 'image', text || null]";
const new6c = "[req.userAddress, media, mediaType || 'image', text || null, !!(isPublic || is_public)]";
if (code.includes(old6c)) { code = code.replace(old6c, new6c); changes++; console.log('6c. Added isPublic to stories params'); }
else console.log('6c. SKIP');

// 7. Update GET /api/stories to exclude public stories
const old7 = 'WHERE s.expires_at > NOW()\n       ORDER BY s.created_at DESC';
const new7 = 'WHERE s.expires_at > NOW() AND (s.is_public IS NULL OR s.is_public = FALSE)\n       ORDER BY s.created_at DESC';
if (code.includes(old7)) { code = code.replace(old7, new7); changes++; console.log('7. Added is_public filter to GET /api/stories'); }
else console.log('7. SKIP');

// 8. Add GET /api/stories/public endpoint
const storiesMarker = '// Get all stories (not expired)';
if (!code.includes("app.get('/api/stories/public'")) {
  const publicStoriesEndpoint = `// Get public stories
app.get('/api/stories/public', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      \`SELECT s.*, u.username, u.profile_image
       FROM stories s
       JOIN users u ON s.user_address = u.wallet_address
       WHERE s.is_public = TRUE AND s.expires_at > NOW()
       ORDER BY s.created_at DESC\`,
      []
    );

    res.json({ stories: result.rows });
  } catch (error) {
    console.error('Get public stories error:', error);
    res.status(500).json({ error: 'Failed to get public stories' });
  }
});

`;
  code = code.replace(storiesMarker, publicStoriesEndpoint + storiesMarker);
  changes++;
  console.log('8. Added GET /api/stories/public endpoint');
} else console.log('8. SKIP - endpoint already exists');

fs.writeFileSync('/root/server.js', code);
console.log(`\nDone! Applied ${changes} changes.`);

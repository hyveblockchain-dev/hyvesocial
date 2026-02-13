const db = require('./db');

async function createTables() {
  // 1. Channel categories
  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_categories (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('1. channel_categories table created');

  // 2. Channels
  await db.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES channel_categories(id) ON DELETE SET NULL,
      name VARCHAR(100) NOT NULL,
      topic TEXT DEFAULT '',
      type VARCHAR(20) DEFAULT 'text',
      position INTEGER DEFAULT 0,
      is_default BOOLEAN DEFAULT FALSE,
      permissions JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('2. channels table created');

  // 3. Channel messages
  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_messages (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      reply_to INTEGER REFERENCES channel_messages(id) ON DELETE SET NULL,
      edited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('3. channel_messages table created');

  // 4. Custom group roles
  await db.query(`
    CREATE TABLE IF NOT EXISTS group_roles (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      color VARCHAR(20) DEFAULT '#ffffff',
      permissions JSONB DEFAULT '{}',
      position INTEGER DEFAULT 0,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('4. group_roles table created');

  // 5. Member-role assignments
  await db.query(`
    CREATE TABLE IF NOT EXISTS member_roles (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      role_id INTEGER NOT NULL REFERENCES group_roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id, user_address, role_id)
    )
  `);
  console.log('5. member_roles table created');

  // 6. Indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_channels_group ON channels(group_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON channel_messages(channel_id, created_at DESC)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_channel_categories_group ON channel_categories(group_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_group_roles_group ON group_roles(group_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_member_roles_group ON member_roles(group_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_member_roles_user ON member_roles(user_address)');
  console.log('6. Indexes created');

  console.log('\nAll tables created successfully!');
  process.exit(0);
}

createTables().catch(e => { console.error(e); process.exit(1); });

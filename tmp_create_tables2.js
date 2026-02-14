const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hyve_social',
    user: process.env.DB_USER || 'hyve_admin',
    password: process.env.DB_PASSWORD,
  });
  await db.connect();

  const queries = [
    `CREATE TABLE IF NOT EXISTS channel_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      user_address VARCHAR(255) NOT NULL,
      emoji VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(message_id, user_address, emoji)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_reactions_message ON channel_reactions(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reactions_channel ON channel_reactions(channel_id)`,

    `CREATE TABLE IF NOT EXISTS channel_read_state (
      channel_id INTEGER NOT NULL,
      user_address VARCHAR(255) NOT NULL,
      last_read_message_id INTEGER DEFAULT 0,
      last_read_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY(channel_id, user_address)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_read_state_user ON channel_read_state(user_address)`,

    `CREATE TABLE IF NOT EXISTS channel_threads (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL,
      parent_message_id INTEGER NOT NULL UNIQUE,
      creator_address VARCHAR(255) NOT NULL,
      name VARCHAR(100) DEFAULT 'Thread',
      message_count INTEGER DEFAULT 0,
      last_message_at TIMESTAMP DEFAULT NOW(),
      archived BOOLEAN DEFAULT FALSE,
      locked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_threads_channel ON channel_threads(channel_id)`,
    `CREATE INDEX IF NOT EXISTS idx_threads_parent ON channel_threads(parent_message_id)`,

    `CREATE TABLE IF NOT EXISTS thread_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL,
      user_address VARCHAR(255) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      image_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_thread_messages ON thread_messages(thread_id)`,

    `CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      user_address VARCHAR(255) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      target_type VARCHAR(50),
      target_id VARCHAR(255),
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_group ON audit_log(group_id, created_at DESC)`,

    `DO $$ BEGIN
      ALTER TABLE group_members ADD COLUMN timeout_until TIMESTAMP DEFAULT NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$`
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      console.log('OK:', q.substring(0, 60));
    } catch(e) {
      console.error('ERR:', q.substring(0, 60), e.message);
    }
  }

  console.log('All tables created!');
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });

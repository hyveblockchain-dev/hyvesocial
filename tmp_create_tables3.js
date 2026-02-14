// Create new DB tables for Discord features batch 2
// Run on server: node tmp_create_tables3.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hyve_social',
  user: process.env.DB_USER || 'hyve_admin',
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Polls
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_polls (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL,
        message_id INTEGER,
        creator_address TEXT NOT NULL,
        question TEXT NOT NULL,
        allow_multiple BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_poll_options (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES channel_polls(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        emoji TEXT,
        position INTEGER DEFAULT 0
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_poll_votes (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES channel_polls(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES channel_poll_options(id) ON DELETE CASCADE,
        user_address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(poll_id, option_id, user_address)
      );
    `);

    // 2. Custom Server Emoji
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_emoji (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        creator_address TEXT NOT NULL,
        animated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Invite Links (real tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_invites (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        creator_address TEXT NOT NULL,
        channel_id INTEGER,
        max_uses INTEGER DEFAULT 0,
        uses INTEGER DEFAULT 0,
        max_age INTEGER DEFAULT 604800,
        temporary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);

    // 4. Scheduled Events
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_events (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        creator_address TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        location TEXT,
        event_type TEXT DEFAULT 'voice',
        channel_id INTEGER,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        image_url TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_event_rsvps (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
        user_address TEXT NOT NULL,
        status TEXT DEFAULT 'interested',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, user_address)
      );
    `);

    // 5. Custom Status
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status TEXT DEFAULT NULL;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status_emoji TEXT DEFAULT NULL;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMP DEFAULT NULL;
    `);

    // 6. AutoMod Rules
    await client.query(`
      CREATE TABLE IF NOT EXISTS automod_rules (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        trigger_metadata JSONB DEFAULT '{}',
        actions JSONB DEFAULT '[]',
        exempt_roles TEXT[] DEFAULT '{}',
        exempt_channels INTEGER[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Welcome Screen / Onboarding
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_welcome_screen (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT FALSE,
        description TEXT,
        welcome_channels JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Forum channels - posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL,
        creator_address TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        tags TEXT[] DEFAULT '{}',
        pinned BOOLEAN DEFAULT FALSE,
        locked BOOLEAN DEFAULT FALSE,
        message_count INTEGER DEFAULT 0,
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_post_messages (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_address TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 9. Channel order column
    await client.query(`
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE channel_categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    `);

    console.log('All tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();

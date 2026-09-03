-- AI Multichannel System - Database Initialization Script v2
-- PostgreSQL 14+ Required
-- Fixed circular dependency between messages and file_storage

-- ============================================
-- Enable UUID Extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Create Enum Types
-- ============================================

DO $$ BEGIN CREATE TYPE channeltype AS ENUM ('web', 'sms', 'voice', 'mobile', 'email'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversationstatus AS ENUM ('active', 'archived', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messagerole AS ENUM ('user', 'assistant', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messagetype AS ENUM ('text', 'audio', 'image', 'video', 'file', 'command'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messagestatus AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE filetype AS ENUM ('audio', 'image', 'video', 'document', 'text', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE storageprovider AS ENUM ('s3', 'local'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- Create Tables (in order to avoid circular dependencies)
-- ============================================

-- 1. Users table (no dependencies)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    hashed_password VARCHAR(255),
    full_name VARCHAR(100),
    avatar_url VARCHAR(500),
    default_ai_model VARCHAR(100) NOT NULL DEFAULT 'mistralai/mistral-7b-instruct',
    preferred_voice_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Conversations table (depends on users)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    channel VARCHAR(20) NOT NULL DEFAULT 'web',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    ai_model VARCHAR(100) NOT NULL DEFAULT 'mistralai/mistral-7b-instruct',
    temperature FLOAT NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 4096,
    system_prompt TEXT,
    context_window JSONB NOT NULL DEFAULT '[]',
    external_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. File storage table (depends on users and conversations)
CREATE TABLE IF NOT EXISTS file_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL DEFAULT 'other',
    mime_type VARCHAR(100),
    file_size_bytes INTEGER NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 's3',
    storage_path VARCHAR(500) NOT NULL,
    cid VARCHAR(100),
    url VARCHAR(500),
    is_public BOOLEAN NOT NULL DEFAULT false,
    access_token VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    conversation_id UUID,
    message_id UUID,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

-- 4. Messages table (depends on users, conversations, and file_storage)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    content TEXT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    message_metadata JSONB NOT NULL DEFAULT '{}',
    ai_model VARCHAR(100),
    tokens_used INTEGER,
    latency_ms FLOAT,
    external_id VARCHAR(255),
    file_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    conversation_id UUID NOT NULL,
    user_id UUID,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES file_storage(id) ON DELETE SET NULL
);

-- 5. Add message_id foreign key to file_storage (now that messages exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_file_storage_message_id'
    ) THEN
        ALTER TABLE file_storage ADD CONSTRAINT fk_file_storage_message_id
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Sessions table (depends on users)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_key VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    device_type VARCHAR(50),
    device_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    country VARCHAR(2),
    city VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    user_id UUID NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS ix_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS ix_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS ix_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS ix_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS ix_file_storage_user_id ON file_storage(user_id);
CREATE INDEX IF NOT EXISTS ix_file_storage_conversation_id ON file_storage(conversation_id);
CREATE INDEX IF NOT EXISTS ix_file_storage_message_id ON file_storage(message_id);
CREATE INDEX IF NOT EXISTS ix_file_storage_cid ON file_storage(cid);
CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_session_key ON sessions(session_key);

-- ============================================
-- Create Triggers for Updated At
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_file_storage_updated_at ON file_storage;
CREATE TRIGGER update_file_storage_updated_at BEFORE UPDATE ON file_storage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Create Views
-- ============================================

CREATE OR REPLACE VIEW recent_conversations AS
SELECT c.*, u.full_name as user_name, u.email as user_email
FROM conversations c
LEFT JOIN users u ON c.user_id = u.id
ORDER BY c.updated_at DESC
LIMIT 100;

CREATE OR REPLACE VIEW conversation_message_counts AS
SELECT 
    conversation_id,
    COUNT(*) as message_count,
    MAX(created_at) as last_message_at
FROM messages
GROUP BY conversation_id;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE users IS 'Stores user accounts with authentication and preference data';
COMMENT ON TABLE conversations IS 'Stores conversation metadata and AI configuration';
COMMENT ON TABLE messages IS 'Stores all messages in conversations with AI responses';
COMMENT ON TABLE file_storage IS 'Stores file metadata for object storage backends';
COMMENT ON TABLE sessions IS 'Stores user authentication sessions';

COMMENT ON COLUMN users.default_ai_model IS 'Default AI model for new conversations';
COMMENT ON COLUMN conversations.context_window IS 'Stores conversation history for context';
COMMENT ON COLUMN file_storage.cid IS 'Optional legacy content identifier';
COMMENT ON COLUMN file_storage.provider IS 'Storage backend: s3 or local';

-- ============================================
-- Grant permissions
-- ============================================

GRANT ALL PRIVILEGES ON DATABASE ai_multichannel TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

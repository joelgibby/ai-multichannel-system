-- AI Multichannel System - Simplified Database Initialization
-- Uses VARCHAR instead of ENUM for compatibility

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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

-- Conversations table
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

-- Messages table
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
    file_id UUID,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- File storage table
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

-- Sessions table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS ix_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS ix_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS ix_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS ix_file_storage_user_id ON file_storage(user_id);
CREATE INDEX IF NOT EXISTS ix_file_storage_conversation_id ON file_storage(conversation_id);
CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions(user_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_file_storage_updated_at BEFORE UPDATE ON file_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views (commented out for now - create after tables exist)
-- CREATE OR REPLACE VIEW recent_conversations AS
-- SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50;

-- CREATE OR REPLACE VIEW conversation_message_counts AS
-- SELECT 
--     conversation_id,
--     COUNT(*) as message_count,
--     MAX(created_at) as last_message_at
-- FROM messages 
-- GROUP BY conversation_id;

-- Insert sample data (optional)
-- INSERT INTO users (id, email, full_name) VALUES ('00000000-0000-0000-0000-000000000001', 'user@example.com', 'Test User') ON CONFLICT DO NOTHING;

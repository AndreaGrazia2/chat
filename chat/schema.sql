-- Crea un nuovo schema dedicato per la chat
CREATE SCHEMA IF NOT EXISTS chat_schema;

-- Imposta il search_path per includere entrambi gli schemi
SET search_path TO chat_schema, workflow_agent, public;

-- Tabella utenti
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella conversazioni
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(50) NOT NULL, -- 'direct', 'channel', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella partecipanti alle conversazioni
CREATE TABLE conversation_participants (
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

-- Tabella messaggi
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    text TEXT,
    message_type VARCHAR(50) DEFAULT 'normal',
    file_data JSONB,
    forwarded_from_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    metadata JSONB,
    reactions JSONB DEFAULT '{}',
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella canali
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella membri dei canali
CREATE TABLE channel_members (
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id, user_id)
);

-- Trigger for updated_at
-- Function to update the modified column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Indexes for better performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);

-- Table for tracking read status of messages
CREATE TABLE message_read_status (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (message_id, user_id)
);

-- Table for user settings
CREATE TABLE user_settings (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    theme VARCHAR(50) DEFAULT 'light',
    notification_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    settings_data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_timestamp
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Aggiungi i trigger per updated_at che mancano
CREATE TRIGGER update_conversations_timestamp
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_channels_timestamp
BEFORE UPDATE ON channels
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Inserisci dati di base
-- Utenti base con avatar online
INSERT INTO users (id, username, display_name, avatar_url, status) VALUES
(1, 'owner', 'Owner', 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff', 'online'),
(2, 'john_doe', 'John Doe', 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', 'online'),
(3, 'jane_smith', 'Jane Smith', 'https://ui-avatars.com/api/?name=Jane+Smith&background=9B59B6&color=fff', 'away'),
(4, 'alex_wilson', 'Alex Wilson', 'https://ui-avatars.com/api/?name=Alex+Wilson&background=E74C3C&color=fff', 'offline');

-- Canali base
INSERT INTO channels (id, name, description, is_private) VALUES
(1, 'general', 'General discussion', false),
(2, 'random', 'Random stuff', false),
(3, 'development', 'Development discussions', false),
(4, 'design', 'Design discussions', false);

-- Conversazioni per i canali
INSERT INTO conversations (id, name, type) VALUES
(1, 'general', 'channel'),
(2, 'random', 'channel'),
(3, 'development', 'channel'),
(4, 'design', 'channel');

-- Conversazioni per i messaggi diretti
INSERT INTO conversations (id, name, type) VALUES
(5, 'DM with John Doe', 'direct'),
(6, 'DM with Jane Smith', 'direct'),
(7, 'DM with Alex Wilson', 'direct');

-- Membri dei canali
INSERT INTO channel_members (channel_id, user_id, role) VALUES
(1, 1, 'admin'), (1, 2, 'member'), (1, 3, 'member'), (1, 4, 'member'),
(2, 1, 'admin'), (2, 2, 'member'), (2, 3, 'member'),
(3, 1, 'admin'), (3, 2, 'member'), (3, 4, 'member'),
(4, 1, 'admin'), (4, 3, 'member'), (4, 4, 'member');

-- Partecipanti alle conversazioni dirette
INSERT INTO conversation_participants (conversation_id, user_id) VALUES
(5, 1), (5, 2),  -- Owner e John Doe
(6, 1), (6, 3),  -- Owner e Jane Smith
(7, 1), (7, 4);  -- Owner e Alex Wilson

-- Alcuni messaggi di base nei canali
INSERT INTO messages (conversation_id, user_id, text, message_type) VALUES
(1, 2, 'Hello everyone! Welcome to the general channel.', 'normal'),
(1, 3, 'Hi John! Thanks for the welcome.', 'normal'),
(1, 4, 'Glad to be here!', 'normal'),
(2, 2, 'This is the random channel. Feel free to post anything interesting!', 'normal'),
(2, 3, 'I found this cool article about AI: https://example.com/ai-article', 'normal');

-- Alcuni messaggi diretti di base
INSERT INTO messages (conversation_id, user_id, text, message_type) VALUES
(5, 1, 'Hi John, how is the project going?', 'normal'),
(5, 2, 'Going well! Almost finished the first milestone.', 'normal'),
(6, 1, 'Jane, do you have the design files?', 'normal'),
(6, 3, 'Yes, I will send them to you shortly.', 'normal'),
(7, 1, 'Alex, meeting at 3pm today?', 'normal'),
(7, 4, 'Confirmed. I will be there.', 'normal');

-- Reset delle sequenze
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('channels_id_seq', (SELECT MAX(id) FROM channels));
SELECT setval('conversations_id_seq', (SELECT MAX(id) FROM conversations));
SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA chat_schema TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA chat_schema TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA chat_schema TO postgres;
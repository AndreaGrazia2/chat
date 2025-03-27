-- schema.sql per il Calendario
-- Creazione del database (eseguire come superuser)
-- CREATE DATABASE calendario_db;

-- Creazione dello schema dedicato
CREATE SCHEMA cal_schema;

-- Imposta lo schema di lavoro
SET search_path TO cal_schema, public;

-- Estensione per gestire UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella per categorie di eventi
CREATE TABLE categories (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per utenti
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    avatar_url VARCHAR(255),
    theme VARCHAR(20) DEFAULT 'light',
    preferred_view VARCHAR(20) DEFAULT 'month',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per gli eventi
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    category_id VARCHAR(20) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    all_day BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    location VARCHAR(255),
    url VARCHAR(255),
    is_public BOOLEAN DEFAULT FALSE,
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Verifica che end_date sia successiva a start_date
    CONSTRAINT event_date_check CHECK (end_date >= start_date)
);

-- Tabella per invitati agli eventi
CREATE TABLE event_attendees (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    response_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id)
);

-- Tabella per le condivisioni di calendari
CREATE TABLE calendar_shares (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) DEFAULT 'read',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, shared_with_id),
    -- Evita che un utente condivida con se stesso
    CONSTRAINT no_self_share CHECK (user_id <> shared_with_id)
);

-- Tabella per i tag degli eventi
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabella di relazione tra eventi e tag (many-to-many)
CREATE TABLE event_tags (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_id)
);

-- Tabella per notifiche/promemoria
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    minutes_before INTEGER NOT NULL,
    notification_type VARCHAR(20) DEFAULT 'email',
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per le preferenze degli utenti
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_day_of_week INTEGER DEFAULT 1, -- 0=Domenica, 1=Lunedì, etc.
    default_view VARCHAR(20) DEFAULT 'month',
    working_hours_start TIME DEFAULT '09:00:00',
    working_hours_end TIME DEFAULT '17:00:00',
    show_weekends BOOLEAN DEFAULT TRUE,
    time_format VARCHAR(10) DEFAULT '24h', -- 12h o 24h
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    default_event_duration INTEGER DEFAULT 60, -- in minuti
    default_reminder INTEGER DEFAULT 30, -- in minuti
    language VARCHAR(10) DEFAULT 'it',
    timezone VARCHAR(50) DEFAULT 'Europe/Rome',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per la sincronizzazione con calendari esterni
CREATE TABLE external_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- google, apple, outlook, etc.
    external_id VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance delle query più comuni
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_category_id ON events(category_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_reminder_time ON reminders(reminder_time);
CREATE INDEX idx_event_attendees_user_id ON event_attendees(user_id);

-- Inserimento delle categorie di default (basate sul codice attuale)
INSERT INTO categories (id, name, color, description) VALUES
    ('work', 'Lavoro', '#4285F4', 'Eventi relativi al lavoro'),
    ('personal', 'Personale', '#EA4335', 'Eventi personali'),
    ('family', 'Famiglia', '#FBBC05', 'Eventi familiari'),
    ('health', 'Salute', '#34A853', 'Eventi relativi alla salute');

-- Funzione per aggiornare automatically il updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare il updated_at su ogni tabella rilevante
CREATE TRIGGER update_user_updated_at BEFORE UPDATE
    ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE
    ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE
    ON categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_event_attendees_updated_at BEFORE UPDATE
    ON event_attendees FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_calendar_shares_updated_at BEFORE UPDATE
    ON calendar_shares FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE
    ON reminders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_external_calendars_updated_at BEFORE UPDATE
    ON external_calendars FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    
-----------------------------------------
-- INSERIMENTO DATI DEMO PER IL TESTING
-----------------------------------------

-- Utenti demo
INSERT INTO users (id, username, email, password_hash, first_name, last_name, theme, preferred_view) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'mario.rossi', 'mario.rossi@example.com', '$2a$10$Vc.UYgOPlU42bVMk0nMOyOv9rPGvSfUkgnUQ5H9G/CbHmsYGJWpEK', 'Mario', 'Rossi', 'light', 'month'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'giulia.bianchi', 'giulia.bianchi@example.com', '$2a$10$cO9mR3NZTjvpOgpCh0/nO.HMZu2GKxooV9TgS8jKmOJIVHw7V7qPi', 'Giulia', 'Bianchi', 'dark', 'week'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'luca.verdi', 'luca.verdi@example.com', '$2a$10$KfwXyEeYOPJJk15cGDLmn.Jq5vRN0c2/FGHoLt3djARUSOHP97IpK', 'Luca', 'Verdi', 'light', 'day'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'chiara.neri', 'chiara.neri@example.com', '$2a$10$hQ2TJ.FXdyYQXRKyDTbHl.h42TVNtXWYTn1HDFD3JRzL1SQZwirBS', 'Chiara', 'Neri', 'dark', 'list');

-- Preferenze utenti
INSERT INTO user_preferences (user_id, first_day_of_week, default_view, working_hours_start, working_hours_end, show_weekends, time_format, language) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 'month', '08:30:00', '17:30:00', true, '24h', 'it'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 1, 'week', '09:00:00', '18:00:00', true, '24h', 'it'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 0, 'day', '08:00:00', '16:00:00', false, '12h', 'en'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 1, 'list', '10:00:00', '19:00:00', true, '24h', 'it');

-- Tag personalizzati
INSERT INTO tags (id, name, color, user_id) VALUES
    ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Importante', '#ff0000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
    ('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'Da fare', '#00ff00', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
    ('f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'Urgente', '#ff6600', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
    ('f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'Ricorda', '#0066ff', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');

-- Eventi per Mario Rossi
INSERT INTO events (id, user_id, title, description, start_date, end_date, category_id, all_day, location) VALUES
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Riunione di team', 'Discussione sul progetto calendario', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '11 hours', 'work', false, 'Sala riunioni A'),
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dentista', 'Controllo annuale', CURRENT_DATE + INTERVAL '3 days' + INTERVAL '14 hours 30 minutes', CURRENT_DATE + INTERVAL '3 days' + INTERVAL '15 hours 30 minutes', 'health', false, 'Studio Dr. Bianchi'),
    ('e3eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Compleanno di Marco', 'Portare il regalo', CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '6 days', 'family', true, 'Casa di Marco'),
    ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380b44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Palestra', 'Allenamento settimanale', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '18 hours', CURRENT_DATE - INTERVAL '2 days' + INTERVAL '19 hours 30 minutes', 'personal', false, 'Fitness Club'),
    ('e5eebc99-9c0b-4ef8-bb6d-6bb9bd380b55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Call con cliente', 'Presentazione del progetto', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '12 hours', 'work', false, 'Virtual Meeting'),
    ('e6eebc99-9c0b-4ef8-bb6d-6bb9bd380b66', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Visita medica', 'Controllo pressione', CURRENT_DATE + INTERVAL '10 days' + INTERVAL '9 hours', CURRENT_DATE + INTERVAL '10 days' + INTERVAL '9 hours 30 minutes', 'health', false, 'Ospedale San Raffaele');

-- Eventi per Giulia Bianchi
INSERT INTO events (id, user_id, title, description, start_date, end_date, category_id, all_day, location) VALUES
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Workshop design', 'Workshop su UI/UX', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '14 hours', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '17 hours', 'work', false, 'Design Hub'),
    ('e8eebc99-9c0b-4ef8-bb6d-6bb9bd380b88', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Cena con amici', 'Ristorante giapponese', CURRENT_DATE + INTERVAL '4 days' + INTERVAL '20 hours', CURRENT_DATE + INTERVAL '4 days' + INTERVAL '22 hours 30 minutes', 'personal', false, 'Sakura Sushi'),
    ('e9eebc99-9c0b-4ef8-bb6d-6bb9bd380b99', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Vacanza', 'Viaggio a Parigi', CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE + INTERVAL '27 days', 'personal', true, 'Parigi'),
    ('e10ebc99-9c0b-4ef8-bb6d-6bb9bd380baa', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Revisione progetto', 'Revisione finale del progetto XYZ', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '12 hours', 'work', false, 'Ufficio principale');

-- Eventi per Luca Verdi
INSERT INTO events (id, user_id, title, description, start_date, end_date, category_id, all_day, location) VALUES
    ('e11ebc99-9c0b-4ef8-bb6d-6bb9bd380bbb', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Colloquio candidato', 'Colloquio per posizione developer', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '2 days' + INTERVAL '12 hours', 'work', false, 'Sala colloqui'),
    ('e12ebc99-9c0b-4ef8-bb6d-6bb9bd380bcc', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Partita di calcetto', 'Campionato aziendale', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '18 hours 30 minutes', CURRENT_DATE + INTERVAL '5 days' + INTERVAL '20 hours', 'personal', false, 'Campo sportivo'),
    ('e13ebc99-9c0b-4ef8-bb6d-6bb9bd380bdd', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Anniversario', 'Cena romantica', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '20 hours', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '23 hours', 'family', false, 'Ristorante La Pergola');

-- Eventi per Chiara Neri
INSERT INTO events (id, user_id, title, description, start_date, end_date, category_id, all_day, location) VALUES
    ('e14ebc99-9c0b-4ef8-bb6d-6bb9bd380bee', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Formazione', 'Corso di aggiornamento', CURRENT_DATE + INTERVAL '3 days' + INTERVAL '9 hours', CURRENT_DATE + INTERVAL '3 days' + INTERVAL '17 hours', 'work', false, 'Centro formazione'),
    ('e15ebc99-9c0b-4ef8-bb6d-6bb9bd380bff', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Shopping', 'Acquisti per la casa', CURRENT_DATE + INTERVAL '6 days' + INTERVAL '15 hours', CURRENT_DATE + INTERVAL '6 days' + INTERVAL '18 hours', 'personal', false, 'Centro commerciale'),
    ('e16ebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Visita nonni', 'Pranzo domenicale', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '12 hours', CURRENT_DATE + INTERVAL '7 days' + INTERVAL '16 hours', 'family', false, 'Casa nonni');

-- Eventi ricorrenti
INSERT INTO events (id, user_id, title, description, start_date, end_date, category_id, is_recurring, recurrence_rule) VALUES
    ('e17ebc99-9c0b-4ef8-bb6d-6bb9bd380c22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Riunione settimanale', 'Aggiornamento stato progetti', CURRENT_DATE + INTERVAL '9 hours', CURRENT_DATE + INTERVAL '10 hours', 'work', true, 'FREQ=WEEKLY;BYDAY=MO;COUNT=12'),
    ('e18ebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Yoga', 'Lezione di yoga', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '18 hours', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '19 hours', 'health', true, 'FREQ=WEEKLY;BYDAY=WE,FR'),
    ('e19ebc99-9c0b-4ef8-bb6d-6bb9bd380c44', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Pulizia casa', 'Pulizia generale', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '10 hours', CURRENT_DATE - INTERVAL '1 day' + INTERVAL '12 hours', 'personal', true, 'FREQ=MONTHLY;BYMONTHDAY=1');

-- Tag per eventi
INSERT INTO event_tags (event_id, tag_id) VALUES
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55'),
    ('e2eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a66'),
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77', 'f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a77'),
    ('e11ebc99-9c0b-4ef8-bb6d-6bb9bd380bbb', 'f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a88');

-- Invitati agli eventi
INSERT INTO event_attendees (event_id, user_id, status, response_date) VALUES
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'accepted', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'pending', NULL),
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'accepted', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'declined', CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- Promemoria
INSERT INTO reminders (id, event_id, user_id, reminder_time, minutes_before, notification_type) VALUES
    ('r1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (SELECT start_date - INTERVAL '30 minutes' FROM events WHERE id = 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'), 30, 'email'),
    ('r2eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (SELECT start_date - INTERVAL '1 day' FROM events WHERE id = 'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'), 1440, 'email'),
    ('r3eebc99-9c0b-4ef8-bb6d-6bb9bd380d33', 'e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', (SELECT start_date - INTERVAL '15 minutes' FROM events WHERE id = 'e7eebc99-9c0b-4ef8-bb6d-6bb9bd380b77'), 15, 'push');

-- Condivisioni di calendari
INSERT INTO calendar_shares (user_id, shared_with_id, permission) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'read'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'write'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'read');

-- Calendari esterni
INSERT INTO external_calendars (id, user_id, name, provider, external_id, sync_enabled, last_synced_at) VALUES
    ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Gmail', 'google', 'primary', true, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Outlook', 'microsoft', 'primary', true, CURRENT_TIMESTAMP - INTERVAL '2 hours');
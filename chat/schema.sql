-- Crea un nuovo schema dedicato per la chat
CREATE SCHEMA IF NOT EXISTS chat_schema;

-- Imposta il search_path per includere entrambi gli schemi
SET search_path TO chat_schema, public;

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

-- Reset delle sequenze
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('channels_id_seq', (SELECT MAX(id) FROM channels));
SELECT setval('conversations_id_seq', (SELECT MAX(id) FROM conversations));
SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA chat_schema TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA chat_schema TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA chat_schema TO postgres;

-- Più utenti per i test con avatar generati online
INSERT INTO users (id, username, display_name, avatar_url, status) VALUES
(1, 'owner', 'Owner', 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff', 'online'),
(2, 'john_doe', 'John Doe', 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', 'online'),
(3, 'jane_smith', 'Jane Smith', 'https://ui-avatars.com/api/?name=Jane+Smith&background=9B59B6&color=fff', 'away'),
(4, 'alex_wilson', 'Alex Wilson', 'https://ui-avatars.com/api/?name=Alex+Wilson&background=E74C3C&color=fff', 'offline'),
(5, 'maria_rodriguez', 'Maria Rodriguez', 'https://ui-avatars.com/api/?name=Maria+Rodriguez&background=F39C12&color=fff', 'busy'),
(6, 'david_chen', 'David Chen', 'https://ui-avatars.com/api/?name=David+Chen&background=3498DB&color=fff', 'online'),
(7, 'file_agent', 'File Analysis', 'https://ui-avatars.com/api/?name=File+Analysis&background=3698D3&color=fff', 'online');

-- Canali di test con diverse caratteristiche
INSERT INTO channels (id, name, description, is_private) VALUES
(1, 'general', 'General discussion for everyone', false),
(2, 'random', 'Random stuff and off-topic conversations', false),
(3, 'development', 'Development discussions and questions', false),
(4, 'design', 'Design discussions and feedback', false),
(5, 'announcements', 'Important announcements for the team', false),
(6, 'private-team', 'Private discussions for core team', true);

-- Conversazioni per i canali
INSERT INTO conversations (id, name, type) VALUES
(1, 'general', 'channel'),
(2, 'random', 'channel'),
(3, 'development', 'channel'),
(4, 'design', 'channel'),
(5, 'announcements', 'channel'),
(6, 'private-team', 'channel');

-- Conversazioni per i messaggi diretti (diverse distribuzioni)
INSERT INTO conversations (id, name, type) VALUES
(7, 'DM with John Doe', 'direct'),
(8, 'DM with Jane Smith', 'direct'),
(9, 'DM with Alex Wilson', 'direct'),
(10, 'DM with Maria Rodriguez', 'direct'),
(11, 'DM with David Chen', 'direct');

-- Membri dei canali
INSERT INTO channel_members (channel_id, user_id, role) VALUES
-- General (tutti)
(1, 1, 'admin'), (1, 2, 'member'), (1, 3, 'member'), (1, 4, 'member'), (1, 5, 'member'), (1, 6, 'member'),
-- Random (tutti tranne David)
(2, 1, 'admin'), (2, 2, 'member'), (2, 3, 'member'), (2, 4, 'member'), (2, 5, 'member'),
-- Development (sviluppatori)
(3, 1, 'admin'), (3, 2, 'member'), (3, 4, 'member'), (3, 6, 'member'),
-- Design (designer)
(4, 1, 'admin'), (4, 3, 'member'), (4, 5, 'member'),
-- Announcements (solo admin)
(5, 1, 'admin'), (5, 2, 'member'), (5, 3, 'member'), (5, 4, 'member'), (5, 5, 'member'), (5, 6, 'member'),
-- Private team (solo alcuni)
(6, 1, 'admin'), (6, 2, 'member'), (6, 3, 'member');

-- Partecipanti alle conversazioni dirette
INSERT INTO conversation_participants (conversation_id, user_id) VALUES
(7, 1), (7, 2),   -- Owner e John Doe
(8, 1), (8, 3),   -- Owner e Jane Smith
(9, 1), (9, 4),   -- Owner e Alex Wilson
(10, 1), (10, 5), -- Owner e Maria Rodriguez
(11, 1), (11, 6); -- Owner e David Chen

-- Inserisci messaggi per ogni canale con varie tipologie
-- Canale General: molti messaggi (15+)
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(1, 1, 'Benvenuti al canale generale! Questo è il posto dove tutti possono parlare liberamente.', 'normal', '2024-03-01 09:00:00'),
(1, 2, 'Grazie per l''invito! Sono felice di essere qui.', 'normal', '2024-03-01 09:05:00'),
(1, 3, 'Ciao a tutti! Mi presento, sono Jane, lavoro nel team di design.', 'normal', '2024-03-01 09:10:00'),
(1, 4, 'Buongiorno a tutti, Alex qui, sviluppatore backend.', 'normal', '2024-03-01 09:15:00'),
(1, 5, 'Salve! Maria dal team marketing.', 'normal', '2024-03-01 09:20:00'),
(1, 6, 'Ciao a tutti, sono David, sviluppatore frontend.', 'normal', '2024-03-01 09:25:00'),
(1, 2, 'Qualcuno ha già pianificato le attività per questa settimana?', 'normal', '2024-03-01 10:00:00'),
(1, 1, 'Sì, ho inviato il piano a tutti via email stamattina.', 'normal', '2024-03-01 10:05:00'),
(1, 5, 'Possiamo discutere anche delle campagne marketing in programma?', 'normal', '2024-03-01 10:30:00'),
(1, 1, 'Certo Maria, forse meglio farlo dopo il meeting giornaliero.', 'normal', '2024-03-01 10:35:00'),
(1, 3, 'A che ora è previsto il meeting oggi?', 'normal', '2024-03-01 11:00:00'),
(1, 1, 'Alle 14:00 come sempre.', 'normal', '2024-03-01 11:05:00'),
(1, 4, 'Ho trovato un bug importante nel sistema di autenticazione, lo sto risolvendo.', 'normal', '2024-03-01 13:00:00'),
(1, 2, 'Posso darti una mano Alex?', 'normal', '2024-03-01 13:05:00'),
(1, 4, 'Grazie John, ti scrivo in privato i dettagli.', 'normal', '2024-03-01 13:10:00'),
(1, 1, 'Ricordo a tutti che domani abbiamo la demo con il cliente principale.', 'normal', '2024-03-01 15:00:00'),
(1, 3, 'I mockup sono pronti, li condividerò oggi pomeriggio.', 'normal', '2024-03-01 15:05:00'),
(1, 6, 'Ottimo Jane! Non vedo l''ora di implementarli.', 'normal', '2024-03-01 15:10:00');

-- Canale Random: alcuni messaggi (5-10)
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(2, 2, 'Qualcuno ha visto l''ultima stagione di quella serie TV di cui tutti parlano?', 'normal', '2024-03-02 10:00:00'),
(2, 3, 'Sì! Il finale è stato incredibile!', 'normal', '2024-03-02 10:05:00'),
(2, 5, 'Non spoilerate! Non l''ho ancora vista...', 'normal', '2024-03-02 10:10:00'),
(2, 1, 'Guardate questo meme divertente: https://example.com/funny-meme', 'normal', '2024-03-02 11:00:00'),
(2, 4, 'Ahaha, molto divertente! 😂', 'normal', '2024-03-02 11:05:00'),
(2, 3, 'Chi partecipa alla festa aziendale di venerdì?', 'normal', '2024-03-03 09:00:00'),
(2, 1, 'Io ci sarò sicuramente!', 'normal', '2024-03-03 09:05:00'),
(2, 5, 'Io purtroppo non posso, ho un altro impegno.', 'normal', '2024-03-03 09:10:00');

-- Canale Development: alcuni messaggi con messaggi di tipo file e risposte
INSERT INTO messages (conversation_id, user_id, text, message_type, file_data, created_at) VALUES
(3, 1, 'Ho caricato la nuova documentazione API.', 'file', '{"name":"API","ext":"pdf","size":"2.4 MB","icon":"fa-file-pdf"}', '2024-03-02 13:00:00'),
(3, 2, 'Grazie, la guarderò appena possibile.', 'normal', NULL, '2024-03-02 13:05:00'),
(3, 6, 'Domande sui nuovi componenti React?', 'normal', NULL, '2024-03-02 14:00:00'),
(3, 4, 'Sì, come gestiamo lo stato globale?', 'normal', NULL, '2024-03-02 14:05:00'),
(3, 6, 'Useremo Redux per lo stato globale e Context API per lo stato di componenti correlati.', 'normal', NULL, '2024-03-02 14:10:00'),
(3, 4, 'Ok, inizierò a implementare seguendo questo approccio.', 'normal', NULL, '2024-03-02 14:15:00'),
(3, 1, 'Ecco il file di configurazione del database.', 'file', '{"name":"DB_Config","ext":"sql","size":"16.2 KB","icon":"fa-file-code"}', '2024-03-03 10:00:00'),
(3, 2, 'Ho trovato un problema nella query di aggregazione.', 'normal', NULL, '2024-03-03 10:30:00');

-- Inserisci messaggi di risposta nel canale Development
INSERT INTO messages (conversation_id, user_id, text, message_type, reply_to_id, created_at) VALUES
(3, 1, 'Puoi spiegare meglio il problema?', 'normal', 33, '2024-03-03 10:35:00');

-- Canale Design: pochi messaggi con risposte
INSERT INTO messages (conversation_id, user_id, text, message_type, file_data, created_at) VALUES
(4, 3, 'Ecco le nuove proposte di UI per la dashboard.', 'file', '{"name":"Dashboard_UI","ext":"png","size":"3.8 MB","icon":"fa-file-image"}', '2024-03-02 15:00:00'),
(4, 1, 'Ottimo lavoro Jane! Mi piace soprattutto la sidebar riprogettata.', 'normal', NULL, '2024-03-02 15:05:00'),
(4, 5, 'Concordo, molto pulita e intuitiva.', 'normal', NULL, '2024-03-02 15:10:00');

-- Inserisci messaggio di risposta nel canale Design
INSERT INTO messages (conversation_id, user_id, text, message_type, reply_to_id, created_at) VALUES
(4, 3, 'Grazie! Ho cercato di seguire i principi di design che abbiamo discusso.', 'normal', 36, '2024-03-02 15:15:00');

-- Messaggi inoltrati e risposte complesse
INSERT INTO messages (conversation_id, user_id, text, message_type, forwarded_from_id, created_at) VALUES
(1, 1, 'Importante: la riunione di domani è stata spostata alle 15:00 invece delle 14:00', 'normal', NULL, '2024-03-03 16:00:00'),
(1, 5, 'Grazie per l''informazione, aggiorno il mio calendario.', 'normal', NULL, '2024-03-03 16:05:00'),
(2, 2, 'La riunione di domani è stata spostata alle 15:00 invece delle 14:00', 'forwarded', 39, '2024-03-03 16:10:00');

-- Canale Announcements: pochi messaggi importanti
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(5, 1, 'Annuncio importante: lanceremo il nuovo prodotto il prossimo mese!', 'normal', '2024-03-01 12:00:00'),
(5, 1, 'Il lavoro di tutti è stato fondamentale per raggiungere questo traguardo.', 'normal', '2024-03-01 12:05:00'),
(5, 1, 'Ci sarà un bonus per tutti nel prossimo stipendio come ringraziamento.', 'normal', '2024-03-03 09:00:00');

-- Canale Private Team: discussioni riservate
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(6, 1, 'Questa è una discussione confidenziale sulla strategia aziendale.', 'normal', '2024-03-02 16:00:00'),
(6, 2, 'Concordo con l''approccio proposto. Dobbiamo focalizzarci sul segmento B2B.', 'normal', '2024-03-02 16:05:00'),
(6, 3, 'Ho preparato alcune analisi di mercato. Le condividerò presto.', 'normal', '2024-03-02 16:10:00');

-- DM con John Doe: molti messaggi (15+)
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(7, 1, 'Ciao John, come sta andando il nuovo progetto?', 'normal', '2024-03-01 11:30:00'),
(7, 2, 'Sta procedendo bene! Abbiamo risolto i problemi iniziali.', 'normal', '2024-03-01 11:35:00'),
(7, 1, 'Ottimo! Hai bisogno di risorse aggiuntive?', 'normal', '2024-03-01 11:40:00'),
(7, 2, 'Per ora no, ma potremmo aver bisogno di un altro sviluppatore la prossima settimana.', 'normal', '2024-03-01 11:45:00'),
(7, 1, 'Ok, teniamolo presente. Comunque oggi in meeting discuteremo del budget.', 'normal', '2024-03-01 11:50:00'),
(7, 2, 'Perfetto, grazie per l''aggiornamento.', 'normal', '2024-03-01 11:55:00'),
(7, 1, 'Mi puoi mandare l''ultimo rapporto di avanzamento?', 'normal', '2024-03-01 14:30:00'),
(7, 2, 'Certo, te lo invio subito.', 'normal', '2024-03-01 14:35:00');

INSERT INTO messages (conversation_id, user_id, text, message_type, file_data, created_at) VALUES
(7, 2, 'Ecco il report settimanale.', 'file', '{"name":"Report_Settimanale","ext":"pdf","size":"1.2 MB","icon":"fa-file-pdf"}', '2024-03-01 14:40:00');

INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(7, 1, 'Grazie! Lo leggerò oggi pomeriggio.', 'normal', '2024-03-01 14:45:00'),
(7, 1, 'Che ne pensi della nuova feature proposta dal team marketing?', 'normal', '2024-03-02 09:30:00'),
(7, 2, 'Interessante, ma richiederà più tempo di quanto stimato.', 'normal', '2024-03-02 09:35:00'),
(7, 1, 'Quanto tempo in più prevedi?', 'normal', '2024-03-02 09:40:00'),
(7, 2, 'Almeno 2 settimane aggiuntive per implementarla correttamente.', 'normal', '2024-03-02 09:45:00'),
(7, 1, 'Capisco. Discutiamone con il team prima di prendere una decisione.', 'normal', '2024-03-02 09:50:00'),
(7, 2, 'Concordo, meglio valutare attentamente.', 'normal', '2024-03-02 09:55:00'),
(7, 1, 'Hai visto le nuove specifiche tecniche?', 'normal', '2024-03-03 08:30:00'),
(7, 2, 'Sì, le sto analizzando. Sembrano promettenti.', 'normal', '2024-03-03 08:35:00');

-- DM con Jane Smith: molti messaggi (15+)
INSERT INTO messages (conversation_id, user_id, text, message_type, file_data, created_at) VALUES
(8, 1, 'Ciao Jane, come procede la nuova interfaccia?', 'normal', NULL, '2024-03-01 10:30:00'),
(8, 3, 'Sta andando bene! Ho quasi completato le schermate principali.', 'normal', NULL, '2024-03-01 10:35:00'),
(8, 1, 'Fantastico! Non vedo l''ora di vederle.', 'normal', NULL, '2024-03-01 10:40:00'),
(8, 3, 'Te le mostrerò nel meeting di oggi.', 'normal', NULL, '2024-03-01 10:45:00'),
(8, 1, 'Perfetto! Ci sono problemi da segnalare?', 'normal', NULL, '2024-03-01 10:50:00'),
(8, 3, 'No, tutto procede secondo i piani.', 'normal', NULL, '2024-03-01 10:55:00'),
(8, 3, 'Ecco i mockup che ho preparato.', 'file', '{"name":"UI_Mockups","ext":"psd","size":"5.7 MB","icon":"fa-file-image"}', '2024-03-01 15:30:00'),
(8, 1, 'Grazie Jane! Sono molto belli!', 'normal', NULL, '2024-03-01 15:35:00'),
(8, 3, 'Grazie! Ci ho lavorato molto.', 'normal', NULL, '2024-03-01 15:40:00'),
(8, 1, 'Si vede. Particolarmente apprezzata la scelta dei colori.', 'normal', NULL, '2024-03-01 15:45:00'),
(8, 3, 'Ho seguito la guida di stile che abbiamo definito.', 'normal', NULL, '2024-03-01 15:50:00'),
(8, 1, 'Hai pensato anche alla versione mobile?', 'normal', NULL, '2024-03-02 11:30:00'),
(8, 3, 'Sì, ho preparato anche quelle. Te le mostro.', 'normal', NULL, '2024-03-02 11:35:00'),
(8, 3, 'Ecco i mockup mobile.', 'file', '{"name":"Mobile_UI","ext":"psd","size":"4.2 MB","icon":"fa-file-image"}', '2024-03-02 11:40:00');

INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(8, 1, 'Ottimo lavoro! Sono molto responsive.', 'normal', NULL, '2024-03-02 11:45:00'),
(8, 3, 'Grazie! Ho pensato all''usabilità su diverse dimensioni di schermo.', 'normal', NULL, '2024-03-02 11:50:00'),
(8, 1, 'Per la prossima versione, pensiamo anche al dark mode?', 'normal', NULL, '2024-03-03 09:30:00'),
(8, 3, 'Assolutamente! Ho già alcune idee in proposito.', 'normal', NULL, '2024-03-03 09:35:00');

-- DM con Alex Wilson: alcuni messaggi (5-10)
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(9, 1, 'Ciao Alex, come procede il debugging?', 'normal', '2024-03-01 13:30:00'),
(9, 4, 'Sto ancora cercando di riprodurre il bug. È abbastanza elusivo.', 'normal', '2024-03-01 13:35:00'),
(9, 1, 'Capisco. Se hai bisogno di aiuto, fammi sapere.', 'normal', '2024-03-01 13:40:00'),
(9, 4, 'Grazie, lo apprezzo. Ti aggiorno appena ho novità.', 'normal', '2024-03-01 13:45:00'),
(9, 4, 'Ho finalmente trovato il problema! Era un errore nel sistema di caching.', 'normal', '2024-03-02 10:30:00'),
(9, 1, 'Ottimo! Quanto ci vorrà per risolverlo?', 'normal', '2024-03-02 10:35:00'),
(9, 4, 'Dovrei riuscire a sistemarlo entro oggi pomeriggio.', 'normal', '2024-03-02 10:40:00'),
(9, 1, 'Perfetto, grazie per il tuo impegno!', 'normal', '2024-03-02 10:45:00');

-- DM con Maria Rodriguez: pochissimi messaggi (2-3)
INSERT INTO messages (conversation_id, user_id, text, message_type, created_at) VALUES
(10, 1, 'Ciao Maria, benvenuta nel team!', 'normal', '2024-03-01 09:30:00'),
(10, 5, 'Grazie mille! Sono entusiasta di iniziare.', 'normal', '2024-03-01 09:35:00'),
(10, 1, 'Se hai bisogno di qualsiasi cosa, non esitare a chiedere.', 'normal', '2024-03-01 09:40:00');

-- DM con David Chen: nessun messaggio (per testare questa casistica)
-- Non inserire messaggi per conversation_id 11

-- Aggiorniamo alcuni messaggi come modificati
UPDATE messages SET edited = TRUE, edited_at = created_at + interval '5 minutes' WHERE id IN (1, 7, 33, 39);

-- Reset delle sequenze per riflettere gli ID corretti
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('channels_id_seq', (SELECT MAX(id) FROM channels));
SELECT setval('conversations_id_seq', (SELECT MAX(id) FROM conversations));
SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));
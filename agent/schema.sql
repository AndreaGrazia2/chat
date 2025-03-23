-- Schema principale per l'agente
CREATE SCHEMA IF NOT EXISTS agent_schema;

-- Tabella per memorizzare le visualizzazioni generate
CREATE TABLE IF NOT EXISTS agent_schema.visualizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,  -- Il contenuto HTML della visualizzazione
    visualization_type VARCHAR(50) NOT NULL,  -- table, bar_chart, line_chart, ecc.
    original_query TEXT,  -- La query SQL che ha generato i dati
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_favorite BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0
);

-- Tabella per tenere traccia delle query eseguite
CREATE TABLE IF NOT EXISTS agent_schema.query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_input TEXT NOT NULL,  -- L'input originale dell'utente
    detected_intent TEXT,  -- L'intento rilevato dal modello
    generated_query TEXT,  -- La query SQL generata
    execution_time_ms INTEGER,  -- Tempo di esecuzione in millisecondi
    result_count INTEGER,  -- Numero di risultati restituiti
    visualization_id UUID REFERENCES agent_schema.visualizations(id),
    success BOOLEAN NOT NULL,  -- Se la query è stata eseguita con successo
    error_message TEXT,  -- Eventuale messaggio di errore
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(100) DEFAULT 'anonymous'  -- ID utente (per future integrazioni di autenticazione)
);

-- Tabella per salvare model prompts riutilizzabili
CREATE TABLE IF NOT EXISTS agent_schema.model_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    prompt_type VARCHAR(50) NOT NULL,  -- 'intent', 'visualization', 'custom'
    model_name VARCHAR(100) NOT NULL,  -- 'google/gemma-3-27b-it:free', ecc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabella per template di visualizzazione predefiniti
CREATE TABLE IF NOT EXISTS agent_schema.visualization_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    html_template TEXT NOT NULL,
    css_template TEXT,
    js_template TEXT,
    visualization_type VARCHAR(50) NOT NULL,  -- 'table', 'bar_chart', ecc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per memorizzare le query frequenti o predefinite
CREATE TABLE IF NOT EXISTS agent_schema.saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_input TEXT NOT NULL,
    sql_query TEXT NOT NULL,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Tabella per memorizzare le configurazioni dell'agente
CREATE TABLE IF NOT EXISTS agent_schema.agent_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string',  -- 'string', 'integer', 'boolean', 'json'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_visualizations_created_at ON agent_schema.visualizations(created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON agent_schema.query_history(created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON agent_schema.query_history(user_id);

-- Funzione per aggiornare il campo updated_at
CREATE OR REPLACE FUNCTION agent_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at automaticamente
CREATE TRIGGER update_visualizations_updated_at
BEFORE UPDATE ON agent_schema.visualizations
FOR EACH ROW EXECUTE FUNCTION agent_schema.update_updated_at_column();

CREATE TRIGGER update_model_prompts_updated_at
BEFORE UPDATE ON agent_schema.model_prompts
FOR EACH ROW EXECUTE FUNCTION agent_schema.update_updated_at_column();

CREATE TRIGGER update_visualization_templates_updated_at
BEFORE UPDATE ON agent_schema.visualization_templates
FOR EACH ROW EXECUTE FUNCTION agent_schema.update_updated_at_column();

CREATE TRIGGER update_saved_queries_updated_at
BEFORE UPDATE ON agent_schema.saved_queries
FOR EACH ROW EXECUTE FUNCTION agent_schema.update_updated_at_column();

-- Inserimenti iniziali per la configurazione
INSERT INTO agent_schema.agent_config (key, value, description, data_type)
VALUES 
    ('default_model', 'google/gemma-3-27b-it:free', 'Modello AI predefinito', 'string'),
    ('max_tokens', '2000', 'Numero massimo di token per risposta', 'integer'),
    ('db_schema_name', 'chat_schema', 'Nome dello schema del database da interrogare', 'string'),
    ('enable_caching', 'true', 'Abilitare la cache delle risposte', 'boolean'),
    ('cache_ttl_minutes', '60', 'Durata della cache in minuti', 'integer'),
    ('default_visualization', 'table', 'Tipo di visualizzazione predefinito', 'string');

-- Inserimento di alcuni template di visualizzazione di base
INSERT INTO agent_schema.visualization_templates (name, description, html_template, visualization_type)
VALUES (
    'Basic Table',
    'Template base per visualizzazione tabellare',
    '<!DOCTYPE html><html><head><title>{{title}}</title><style>body{font-family:sans-serif;margin:20px;background-color:#f5f5f5;}table{width:100%;border-collapse:collapse;}th{background-color:#1d74f5;color:white;padding:10px;}td{padding:8px;border-bottom:1px solid #e0e0e0;}tr:nth-child(even){background-color:#f9f9f9;}</style></head><body><h1>{{title}}</h1><p>{{description}}</p><table><thead><tr>{{#columns}}<th>{{.}}</th>{{/columns}}</tr></thead><tbody>{{#data}}<tr>{{#.}}<td>{{.}}</td>{{/.}}</tr>{{/data}}</tbody></table></body></html>',
    'table'
);

-- View per statistiche di utilizzo
CREATE OR REPLACE VIEW agent_schema.usage_statistics AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total_queries,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_queries,
    SUM(CASE WHEN success THEN 0 ELSE 1 END) AS failed_queries,
    ROUND(AVG(execution_time_ms)) AS avg_execution_time_ms,
    COUNT(DISTINCT user_id) AS unique_users
FROM
    agent_schema.query_history
GROUP BY
    DATE(created_at)
ORDER BY
    date DESC;
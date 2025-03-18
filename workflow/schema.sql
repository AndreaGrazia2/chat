-- Connettiti al database come utente con permessi di amministrazione
CREATE EXTENSION IF NOT EXISTS vector;

-- Verifica che l'estensione sia installata
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Crea uno schema dedicato (opzionale ma consigliato)
CREATE SCHEMA IF NOT EXISTS workflow_agent;

-- Imposta lo schema come parte del percorso di ricerca
SET search_path TO workflow_agent, public;

CREATE TABLE workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    json_definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indice per ricerche rapide per nome
CREATE INDEX idx_workflows_name ON workflows(name);

-- Trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_timestamp
BEFORE UPDATE ON workflows
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    input_data JSONB,
    output_data JSONB,
    execution_path JSONB,
    error_message TEXT
);

-- Indice per trovare rapidamente le esecuzioni di un workflow
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);

-- Indice per trovare rapidamente esecuzioni per stato
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

CREATE TABLE execution_logs (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    input_data JSONB,
    output_data JSONB,
    duration_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    message TEXT
);

-- Indice per trovare rapidamente i log di una specifica esecuzione
CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);

CREATE TABLE document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    collection_name VARCHAR(255) NOT NULL DEFAULT 'default',
    title TEXT,
    content TEXT NOT NULL,
    embedding VECTOR(1536),  -- Per OpenAI embeddings (cambia la dimensione se usi altri modelli)
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crea un indice per ricerca vettoriale (HNSW è solitamente più veloce per embedding di testo)
CREATE INDEX idx_document_embeddings_embedding ON document_embeddings USING hnsw (embedding vector_cosine_ops);

-- Indici per ricerche standard
CREATE INDEX idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_collection ON document_embeddings(collection_name);

-- Aggiungi trigger per updated_at
CREATE TRIGGER update_document_embeddings_timestamp
BEFORE UPDATE ON document_embeddings
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TABLE tool_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tool_type VARCHAR(100) NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indice per nome
CREATE INDEX idx_tool_configurations_name ON tool_configurations(name);

-- Trigger per updated_at
CREATE TRIGGER update_tool_configurations_timestamp
BEFORE UPDATE ON tool_configurations
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

INSERT INTO workflows (name, description, json_definition) VALUES (
    'Simple Q&A Workflow', 
    'Basic workflow that answers questions using an LLM',
    '{
        "nodes": [
            {"id": "node-1", "type": "trigger", "name": "HTTP Trigger", "x": 100, "y": 100, "config": {"endpoint": "/ask"}},
            {"id": "node-2", "type": "llm", "name": "Answer Generator", "x": 300, "y": 100, "config": {"model": "gpt-3.5-turbo", "temperature": 0.7, "prompt": "Answer this question: {question}"}}
        ],
        "connections": [
            {"id": "conn-1-2", "source": "node-1", "target": "node-2"}
        ]
    }'::jsonb
);

INSERT INTO tool_configurations (name, tool_type, description, configuration) VALUES (
    'Weather API',
    'api',
    'Tool for getting weather information',
    '{
        "api_endpoint": "https://api.weatherapi.com/v1/current.json",
        "method": "GET",
        "params": ["q", "key"],
        "headers": {},
        "auth_type": "api_key",
        "auth_config": {
            "param_name": "key",
            "key_value": "YOUR_API_KEY"
        }
    }'::jsonb
);

CREATE OR REPLACE FUNCTION add_document_with_embedding(
    p_document_id VARCHAR(255),
    p_collection_name VARCHAR(255),
    p_title TEXT,
    p_content TEXT,
    p_embedding VECTOR(1536),
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Controlla se il documento esiste già
    SELECT id INTO v_id FROM document_embeddings 
    WHERE document_id = p_document_id AND collection_name = p_collection_name;
    
    -- Se esiste, aggiorna
    IF v_id IS NOT NULL THEN
        UPDATE document_embeddings
        SET title = p_title,
            content = p_content,
            embedding = p_embedding,
            metadata = p_metadata,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_id;
        
        RETURN v_id;
    -- Altrimenti, inserisci
    ELSE
        INSERT INTO document_embeddings (document_id, collection_name, title, content, embedding, metadata)
        VALUES (p_document_id, p_collection_name, p_title, p_content, p_embedding, p_metadata)
        RETURNING id INTO v_id;
        
        RETURN v_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_similar_documents(
    p_query_embedding VECTOR(1536),
    p_collection_name VARCHAR(255) DEFAULT 'default',
    p_limit INTEGER DEFAULT 5,
    p_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
    id INTEGER,
    document_id VARCHAR(255),
    title TEXT,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.document_id,
        e.title,
        e.content,
        1 - (e.embedding <=> p_query_embedding) AS similarity,
        e.metadata
    FROM document_embeddings e
    WHERE e.collection_name = p_collection_name
      AND 1 - (e.embedding <=> p_query_embedding) >= p_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Verifica che tutte le tabelle siano state create
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'workflow_agent' 
ORDER BY table_name;

-- Verifica che le funzioni siano disponibili
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'workflow_agent' 
ORDER BY routine_name;

-- Verifica che i dati di test siano stati inseriti
SELECT id, name FROM workflows;
SELECT id, name FROM tool_configurations;
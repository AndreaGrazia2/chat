import os
import uuid
import json
import re
import datetime
from flask import Flask, request, jsonify, render_template, redirect, url_for, Response, session
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from functools import lru_cache

# Carica le variabili d'ambiente
load_dotenv()

# Inizializza Flask
app = Flask(__name__, template_folder='template', static_folder='static')
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))  # Per le sessioni

# Dizionario per memorizzare i risultati delle visualizzazioni (fallback)
visualizations = {}

# Configura LangChain con OpenRouter
api_key = os.getenv("OPENROUTER_API_KEY")
llm = ChatOpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    model="google/gemma-3-27b-it:free",
    max_tokens=2000
)

# Funzione per connettersi al database
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        cursor_factory=psycopg2.extras.DictCursor
    )
    conn.autocommit = True
    return conn

# Funzione per ottenere lo schema del database
def get_db_schema():
    """Legge dinamicamente lo schema del database e restituisce una descrizione testuale"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query per ottenere tutte le tabelle nello schema chat_schema
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'chat_schema'
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        # Per ogni tabella, ottiene le colonne
        schema_description = []
        for table in tables:
            cursor.execute(f"""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'chat_schema' AND table_name = '{table}'
                ORDER BY ordinal_position
            """)
            columns = [f"{row[0]} ({row[1]})" for row in cursor.fetchall()]
            schema_description.append(f"- {table} ({', '.join(columns)})")
        
        cursor.close()
        conn.close()
        
        return "\n".join(schema_description)
    except Exception as e:
        print(f"Errore nel recupero dello schema: {e}")
        return """
        - users (id, username, display_name, avatar_url, status, created_at, updated_at)
        - conversations (id, name, type, created_at, updated_at)
        - messages (id, conversation_id, user_id, reply_to_id, text, message_type, file_data, forwarded_from_id, metadata, edited, edited_at, created_at)
        - channels (id, name, description, is_private, created_at, updated_at)
        - channel_members (channel_id, user_id, role, joined_at)
        - conversation_participants (conversation_id, user_id, joined_at)
        """

# Ottiene lo schema del database
db_schema = get_db_schema()

# Template per l'analisi dell'intento
intent_template = f"""
Sei un agente AI specializzato nell'analizzare messaggi dell'utente e determinare se è necessario eseguire una query su un database.
Se l'utente sta chiedendo informazioni che potrebbero essere ottenute da un database, identifica l'intento specifico e genera una query SQL appropriata.

Il database ha queste tabelle (schema chat_schema):
{db_schema}

Analizza attentamente: {{user_input}}

Ragiona passo per passo:
1. Determina se l'utente sta chiedendo informazioni che richiedono accesso al database.
2. Se sì, identifica quale tipo di informazione sta cercando.
3. Determina quali tabelle e campi sono necessari per rispondere alla domanda.
4. Genera una query SQL appropriata e sicura.

IMPORTANTE: La tua risposta DEVE essere in formato JSON valido. Non aggiungere alcun testo prima o dopo il JSON. 
Rispondi SOLO con il seguente formato JSON:

{{{{
  "needs_query": true/false,
  "reasoning": "la tua catena di ragionamento passo per passo",
  "query": "la query SQL da eseguire",
  "title": "un titolo descrittivo per la visualizzazione",
  "description": "breve descrizione del risultato",
  "visualization_type": "tipo di visualizzazione consigliata (table, bar_chart, line_chart, ecc.)"
}}}}
"""

intent_prompt = ChatPromptTemplate.from_template(intent_template)
intent_chain = intent_prompt | llm

# Template per la generazione della visualizzazione HTML
visualization_template = """
Sei un esperto di visualizzazione dati. Devi generare un codice HTML professionale per visualizzare i dati forniti.
Utilizza uno stile moderno e pulito, simile all'interfaccia utente che sto sviluppando.

Dati da visualizzare:
- Tipo di visualizzazione: {visualization_type}
- Titolo: {title}
- Descrizione: {description}
- Risultato della query: {query_result}
- Nomi delle colonne: {column_names}

Genera una pagina HTML completa con:
1. HTML semantico e ben strutturato
2. CSS integrato nel file (nessun file esterno)
3. JavaScript per eventuali interazioni
4. Implementa il tipo di visualizzazione richiesto ({visualization_type})
5. Usa un design responsive
6. Assicurati che il codice sia valido e funzionante

Utilizza Chart.js o D3.js solo se necessario per grafici o visualizzazioni complesse.
Usa un design coerente con i colori: 
- Colore primario: #1d74f5
- Sfondo chiaro: #f5f5f5
- Testo scuro: #333333
- Bordi: #e0e0e0

Restituisci SOLO il codice HTML completo con CSS e JavaScript incorporati.
"""

visualization_prompt = ChatPromptTemplate.from_template(visualization_template)
visualization_chain = visualization_prompt | llm

# Funzione per eseguire una query SQL
def execute_query(query):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Imposta lo schema di ricerca
        cursor.execute("SET search_path TO chat_schema")
        
        # Assicurati che la query sia sicura (questa è una verifica base)
        if not query.strip().upper().startswith(("SELECT", "WITH")):
            raise Exception("Solo le query SELECT sono supportate per sicurezza")
        
        print(f"DEBUG - Esecuzione query: {query}")
        
        # Esegui la query
        cursor.execute(query)
        
        # Ottieni i risultati
        if cursor.description:
            results = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            
            # Verifica se abbiamo ottenuto risultati
            if len(results) == 0:
                print("DEBUG - La query non ha restituito risultati")
        else:
            results = [{"affected_rows": cursor.rowcount}]
            column_names = ["affected_rows"]
        
        cursor.close()
        conn.close()
        return results, column_names
    except Exception as e:
        print(f"ERRORE nell'esecuzione della query: {e}")
        
        # Query diagnostica
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Verifica lo schema corrente
            cursor.execute("SELECT current_schema()")
            current_schema = cursor.fetchone()[0]
            print(f"Schema corrente: {current_schema}")
            
            # Verifica l'esistenza delle tabelle
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'chat_schema'
            """)
            tables = [row[0] for row in cursor.fetchall()]
            print(f"Tabelle in chat_schema: {tables}")
            
            # Verifica se l'utente john_doe esiste
            try:
                cursor.execute("SELECT id, username FROM chat_schema.users WHERE username = 'john_doe'")
                user = cursor.fetchone()
                if user:
                    print(f"Utente john_doe trovato: {user}")
                else:
                    print("Utente john_doe non trovato")
            except Exception as user_error:
                print(f"Errore nel verificare l'utente: {user_error}")
            
            cursor.close()
            conn.close()
        except Exception as diag_error:
            print(f"Errore nel diagnosticare: {diag_error}")
        
        return None, None

# Funzioni per la gestione delle visualizzazioni con il database
def save_visualization(viz_id, html, title="", description="", visualization_type="table", original_query=""):
    """Salva una visualizzazione nel database agent_schema"""
    try:
        # Prima verifica che lo schema e la tabella esistano
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica l'esistenza dello schema agent_schema
        cursor.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'agent_schema'")
        if not cursor.fetchone():
            # Crea lo schema agent_schema se non esiste
            cursor.execute("CREATE SCHEMA IF NOT EXISTS agent_schema")
            print("Schema agent_schema creato")
        
        # Verifica l'esistenza della tabella visualizations
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'agent_schema' AND table_name = 'visualizations'
        """)
        
        if not cursor.fetchone():
            # Crea la tabella se non esiste
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_schema.visualizations (
                    id UUID PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    content TEXT NOT NULL,
                    visualization_type VARCHAR(50) NOT NULL,
                    original_query TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_favorite BOOLEAN DEFAULT FALSE,
                    view_count INTEGER DEFAULT 0
                )
            """)
            print("Tabella agent_schema.visualizations creata")
        
        # Ora possiamo inserire la visualizzazione
        cursor.execute("""
            INSERT INTO agent_schema.visualizations 
            (id, title, description, content, visualization_type, original_query) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (viz_id, title, description, html, visualization_type, original_query))
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"Visualizzazione {viz_id} salvata nel database")
        return True
    except Exception as e:
        print(f"Errore nel salvare la visualizzazione nel database: {e}")
        # Fallback alla memoria
        visualizations[viz_id] = html
        return False

def get_visualization(viz_id):
    """Recupera una visualizzazione dal database o dalla memoria"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica lo schema e tabella
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'agent_schema' AND table_name = 'visualizations'
        """)
        
        if cursor.fetchone():
            # Incrementa il conteggio visualizzazioni
            cursor.execute("""
                UPDATE agent_schema.visualizations 
                SET view_count = view_count + 1 
                WHERE id = %s 
                RETURNING content
            """, (viz_id,))
            
            result = cursor.fetchone()
            conn.commit()
            cursor.close()
            conn.close()
            
            if result:
                return result[0]
        else:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Errore nel recuperare la visualizzazione dal database: {e}")
    
    # Fallback alla memoria o None se non trovato
    return visualizations.get(viz_id)

# Funzione per salvare la cronologia delle query
def save_query_history(user_input, intent_data, query, success, error_message="", viz_id=None, execution_time=0, result_count=0):
    """Salva la cronologia delle query nel database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica l'esistenza della tabella
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'agent_schema' AND table_name = 'query_history'
        """)
        
        if not cursor.fetchone():
            # Crea la tabella se non esiste
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_schema.query_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_input TEXT NOT NULL,
                    detected_intent TEXT,
                    generated_query TEXT,
                    execution_time_ms INTEGER,
                    result_count INTEGER,
                    visualization_id UUID,
                    success BOOLEAN NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    user_id VARCHAR(100) DEFAULT 'anonymous'
                )
            """)
            print("Tabella agent_schema.query_history creata")
        
        # Recupera l'id utente dalla sessione o usa default
        user_id = session.get('user_id', 'anonymous')
        
        # Prepara l'intent come stringa JSON
        detected_intent = json.dumps(intent_data) if intent_data else None
        
        # Inserisci la cronologia
        cursor.execute("""
            INSERT INTO agent_schema.query_history 
            (user_input, detected_intent, generated_query, execution_time_ms, result_count, 
             visualization_id, success, error_message, user_id) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_input, 
            detected_intent, 
            query, 
            execution_time, 
            result_count, 
            viz_id, 
            success, 
            error_message, 
            user_id
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Errore nel salvare la cronologia delle query: {e}")
        return False

# Implementazione del caching per l'analisi dell'intento
@lru_cache(maxsize=100)
def analyze_intent_cached(user_input):
    """Versione con cache dell'analisi intento"""
    return intent_chain.invoke({"user_input": user_input})

# Generazione di CSV dai risultati
def generate_csv(data, column_names):
    """Genera un file CSV dai dati"""
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Scrive le intestazioni
    writer.writerow(column_names)
    
    # Scrive i dati
    for row in data:
        if isinstance(row, dict):
            # Se è un dizionario, estrai i valori nell'ordine delle colonne
            writer.writerow([row.get(col, '') for col in column_names])
        else:
            # Se è una lista/tupla
            writer.writerow(row)
    
    return output.getvalue()

# Pagina principale con form per l'input
@app.route('/', methods=['GET'])
def index():
    return render_template('agent.html')

# Endpoint per processare l'input
@app.route('/process', methods=['POST'])
def process():
    user_input = request.form.get('userInput', '')
    start_time = datetime.datetime.now()
    
    if not user_input:
        return jsonify({"error": "Input mancante"}), 400
    
    try:
        # Usa la versione con cache dell'analisi intento
        intent_result = analyze_intent_cached(user_input)
        
        # Estrai il contenuto dalla risposta dell'LLM
        intent_text = None
        if hasattr(intent_result, 'content'):
            intent_text = intent_result.content
        elif isinstance(intent_result, dict) and "text" in intent_result:
            intent_text = intent_result["text"]
        else:
            intent_text = str(intent_result)
        
        print(f"DEBUG - Intent text: {intent_text[:200]}...")
        
        # Cerca di parsare il JSON dalla risposta
        try:
            intent_data = json.loads(intent_text)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{.*\}', intent_text, re.DOTALL)
            if json_match:
                try:
                    intent_data = json.loads(json_match.group(0))
                except:
                    needs_query = "true" in intent_text.lower() and "needs_query" in intent_text.lower()
                    
                    query_match = re.search(r'SELECT.*?;', intent_text, re.DOTALL | re.IGNORECASE)
                    query = query_match.group(0) if query_match else ""
                    
                    title_match = re.search(r'title["\s:]+([^"]+)', intent_text)
                    title = title_match.group(1) if title_match else "Risultato della query"
                    
                    reasoning_match = re.search(r'reasoning["\s:]+([^"]+?)(?:,|\})', intent_text)
                    reasoning = reasoning_match.group(1) if reasoning_match else intent_text
                    
                    intent_data = {
                        "needs_query": needs_query,
                        "reasoning": reasoning,
                        "query": query,
                        "title": title,
                        "description": "Risultati estratti dalla risposta dell'AI",
                        "visualization_type": "table"
                    }
            else:
                intent_data = {
                    "needs_query": False,
                    "reasoning": f"Non sono riuscito a interpretare la risposta dell'AI. Risposta raw: {intent_text[:200]}..."
                }
        
        # Estrai il ragionamento
        reasoning = intent_data.get('reasoning', 'Nessun ragionamento fornito')
        
        # Se non è necessaria una query, restituisci solo il ragionamento e salva nella cronologia
        if not intent_data.get('needs_query', False):
            save_query_history(
                user_input=user_input,
                intent_data=intent_data,
                query="",
                success=True,
                error_message="",
                viz_id=None,
                execution_time=(datetime.datetime.now() - start_time).total_seconds() * 1000,
                result_count=0
            )
            
            return jsonify({
                "reasoning": reasoning,
                "visualization_id": None
            })
        
        # Ottieni la query dall'analisi dell'intento
        query = intent_data.get('query', '')
        results = None
        column_names = None
        
        try:
            # Esegui la query
            results, column_names = execute_query(query)
            
            if not results:
                error_message = """
                Non ho trovato risultati per questa query. Possibili cause:
                1. L'utente specificato non esiste nel database
                2. Non ci sono messaggi per questo utente
                3. La query è corretta ma non ha prodotto risultati
                
                Suggerimento: Prova una query più generale o verifica che l'utente esista nel sistema.
                """
                
                # Salva nella cronologia
                save_query_history(
                    user_input=user_input,
                    intent_data=intent_data,
                    query=query,
                    success=True,
                    error_message="Nessun risultato trovato",
                    viz_id=None,
                    execution_time=(datetime.datetime.now() - start_time).total_seconds() * 1000,
                    result_count=0
                )
                
                return jsonify({
                    "reasoning": reasoning + "\n\n" + error_message,
                    "visualization_id": None
                })
        except Exception as db_error:
            error_msg = f"""
            Errore durante l'esecuzione della query: {str(db_error)}
            
            Query tentata: {query}
            
            Suggerimenti:
            1. Verifica che le tabelle menzionate esistano
            2. Controlla che i nomi delle colonne siano corretti
            3. Assicurati che il database sia accessibile
            """
            
            # Salva nella cronologia
            save_query_history(
                user_input=user_input,
                intent_data=intent_data,
                query=query,
                success=False,
                error_message=str(db_error),
                viz_id=None,
                execution_time=(datetime.datetime.now() - start_time).total_seconds() * 1000,
                result_count=0
            )
            
            return jsonify({
                "reasoning": reasoning + "\n\n" + error_msg,
                "visualization_id": None
            })
        
        # Converti i risultati in formato JSON serializzabile
        serializable_results = []
        for row in results:
            if isinstance(row, dict):
                # Se è un dict (DictCursor)
                serializable_row = {}
                for key, value in row.items():
                    if isinstance(value, (datetime.date, datetime.datetime)):
                        serializable_row[key] = value.isoformat()
                    else:
                        serializable_row[key] = value
                serializable_results.append(serializable_row)
            else:
                # Se è una tupla
                serializable_row = []
                for value in row:
                    if isinstance(value, (datetime.date, datetime.datetime)):
                        serializable_row.append(value.isoformat())
                    else:
                        serializable_row.append(value)
                serializable_results.append(serializable_row)
        
        # Prepara i dati per la visualizzazione
        visualization_payload = {
            "visualization_type": intent_data.get('visualization_type', 'table'),
            "title": intent_data.get('title', 'Risultato della query'),
            "description": intent_data.get('description', ''),
            "query_result": json.dumps(serializable_results),
            "column_names": json.dumps(column_names)
        }
        
        # Invoca l'LLM per generare la visualizzazione
        visualization_result = visualization_chain.invoke(visualization_payload)
        
        # Estrai il contenuto HTML dalla risposta
        visualization_html = None
        if hasattr(visualization_result, 'content'):
            visualization_html = visualization_result.content
        elif isinstance(visualization_result, dict) and "text" in visualization_result:
            visualization_html = visualization_result["text"]
        else:
            visualization_html = str(visualization_result)
        
        # Genera un ID per la visualizzazione
        visualization_id = str(uuid.uuid4())
        
        # Salva la visualizzazione nel database
        save_visualization(
            viz_id=visualization_id,
            html=visualization_html,
            title=intent_data.get('title', 'Risultato della query'),
            description=intent_data.get('description', ''),
            visualization_type=intent_data.get('visualization_type', 'table'),
            original_query=query
        )
        
        # Salva nella cronologia
        save_query_history(
            user_input=user_input,
            intent_data=intent_data,
            query=query,
            success=True,
            error_message="",
            viz_id=visualization_id,
            execution_time=(datetime.datetime.now() - start_time).total_seconds() * 1000,
            result_count=len(serializable_results)
        )
        
        # Restituisci il ragionamento e l'ID della visualizzazione
        return jsonify({
            "reasoning": reasoning,
            "visualization_id": visualization_id
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Errore nell'elaborazione: {e}\n{error_details}")
        
        # Salva l'errore nella cronologia
        try:
            save_query_history(
                user_input=user_input,
                intent_data=None,
                query="",
                success=False,
                error_message=str(e),
                viz_id=None,
                execution_time=(datetime.datetime.now() - start_time).total_seconds() * 1000,
                result_count=0
            )
        except:
            pass
        
        return jsonify({
            "error": "Si è verificato un errore durante l'elaborazione della richiesta.",
            "details": str(e),
            "reasoning": f"Errore: {str(e)}"
        }), 500

# Endpoint per visualizzare i risultati
@app.route('/visualization/<viz_id>')
def visualization(viz_id):
    html_content = get_visualization(viz_id)
    if not html_content:
        return "Visualizzazione non trovata", 404
    
    return html_content

# Route di test
@app.route('/test_query', methods=['GET'])
def test_query():
    # Query di test specifica per john_doe
    test_query = """
    SELECT u.username, m.text, m.created_at
    FROM chat_schema.users u
    JOIN chat_schema.messages m ON u.id = m.user_id
    WHERE u.username = 'john_doe'
    LIMIT 10
    """
    
    try:
        results, column_names = execute_query(test_query)
        
        if results:
            html = "<h2>Risultati Test Query</h2><table border='1'><tr>"
            
            # Intestazioni
            for col in column_names:
                html += f"<th>{col}</th>"
            html += "</tr>"
            
            # Righe di dati
            for row in results:
                html += "<tr>"
                for i, col in enumerate(column_names):
                    value = row[i] if isinstance(row, (list, tuple)) else row[col]
                    html += f"<td>{value}</td>"
                html += "</tr>"
            
            html += "</table>"
            return html
        else:
            return "Nessun risultato trovato. Verifica database e username."
    except Exception as e:
        return f"Errore nell'esecuzione della query di test: {str(e)}"

# Suggerimenti di query
@app.route('/suggest', methods=['POST'])
def suggest_query():
    partial_input = request.json.get('partial', '')
    
    # Prompt per suggerimenti
    suggestion_template = """
    L'utente sta iniziando a digitare una query per il database di chat. 
    Basandoti sul testo parziale, suggerisci 3 possibili completamenti.
    
    Input parziale: {partial}
    
    Rispondi con un array JSON di 3 possibili completamenti.
    """
    
    suggestion_prompt = ChatPromptTemplate.from_template(suggestion_template)
    suggestion_chain = suggestion_prompt | llm
    
    try:
        result = suggestion_chain.invoke({"partial": partial_input})
        # Estrai i suggerimenti
        return jsonify({"suggestions": json.loads(result.content)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Storico delle query (continuazione)
@app.route('/history', methods=['GET'])
def get_history():
    # Recupera l'ID utente dalla sessione o usa un valore predefinito
    user_id = session.get('user_id', 'anonymous')
    limit = request.args.get('limit', 10, type=int)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica l'esistenza della tabella
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'agent_schema' AND table_name = 'query_history'
        """)
        
        if cursor.fetchone():
            cursor.execute("""
                SELECT user_input, generated_query, success, error_message, created_at, visualization_id
                FROM agent_schema.query_history
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """, (user_id, limit))
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    "user_input": row[0],
                    "query": row[1],
                    "success": row[2],
                    "error": row[3],
                    "timestamp": row[4].isoformat() if row[4] else None,
                    "visualization_id": row[5]
                })
            
            cursor.close()
            conn.close()
            return jsonify({"history": history})
        else:
            cursor.close()
            conn.close()
            return jsonify({"history": [], "message": "Tabella cronologia non trovata"})
    except Exception as e:
        print(f"Errore nel recuperare la cronologia: {e}")
        return jsonify({"error": str(e)}), 500

# Esportazione dei risultati
@app.route('/export/<viz_id>', methods=['GET'])
def export_results(viz_id):
    format_type = request.args.get('format', 'csv')
    
    try:
        # Recupera i dati originali della query dal database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT original_query
            FROM agent_schema.visualizations
            WHERE id = %s
        """, (viz_id,))
        
        result = cursor.fetchone()
        if not result or not result[0]:
            return jsonify({"error": "Query originale non trovata"}), 404
        
        original_query = result[0]
        
        # Riesegui la query per ottenere i dati freschi
        results, column_names = execute_query(original_query)
        
        if not results:
            return jsonify({"error": "Nessun risultato trovato"}), 404
        
        if format_type == 'csv':
            # Genera CSV
            output = generate_csv(results, column_names)
            return Response(
                output,
                mimetype="text/csv",
                headers={"Content-disposition": f"attachment; filename=export_{viz_id}.csv"}
            )
        elif format_type == 'json':
            # Converti i risultati in JSON serializzabile
            serializable_results = []
            for row in results:
                if isinstance(row, dict):
                    serializable_row = {}
                    for key, value in row.items():
                        if isinstance(value, (datetime.date, datetime.datetime)):
                            serializable_row[key] = value.isoformat()
                        else:
                            serializable_row[key] = value
                    serializable_results.append(serializable_row)
                else:
                    serializable_row = []
                    for i, col in enumerate(column_names):
                        value = row[i]
                        if isinstance(value, (datetime.date, datetime.datetime)):
                            serializable_row.append(value.isoformat())
                        else:
                            serializable_row.append(value)
                    serializable_results.append(dict(zip(column_names, serializable_row)))
            
            return jsonify({
                "columns": column_names,
                "data": serializable_results
            })
        else:
            return jsonify({"error": "Formato non supportato"}), 400
    except Exception as e:
        print(f"Errore nell'esportazione: {e}")
        return jsonify({"error": str(e)}), 500

# Visualizzazioni salvate
@app.route('/saved', methods=['GET'])
def get_saved_visualizations():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, description, visualization_type, created_at, view_count, is_favorite
            FROM agent_schema.visualizations
            ORDER BY created_at DESC
            LIMIT 20
        """)
        
        visualizations_list = []
        for row in cursor.fetchall():
            visualizations_list.append({
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "type": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "view_count": row[5],
                "is_favorite": row[6]
            })
        
        cursor.close()
        conn.close()
        return jsonify({"visualizations": visualizations_list})
    except Exception as e:
        print(f"Errore nel recuperare le visualizzazioni salvate: {e}")
        return jsonify({"error": str(e)}), 500

# Contrassegna come preferito
@app.route('/visualization/<viz_id>/favorite', methods=['POST'])
def toggle_favorite(viz_id):
    try:
        is_favorite = request.json.get('is_favorite', True)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE agent_schema.visualizations
            SET is_favorite = %s
            WHERE id = %s
            RETURNING id
        """, (is_favorite, viz_id))
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        if result:
            return jsonify({"success": True, "is_favorite": is_favorite})
        else:
            return jsonify({"error": "Visualizzazione non trovata"}), 404
    except Exception as e:
        print(f"Errore nel modificare il preferito: {e}")
        return jsonify({"error": str(e)}), 500

# Eliminazione di una visualizzazione
@app.route('/visualization/<viz_id>', methods=['DELETE'])
def delete_visualization(viz_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM agent_schema.visualizations
            WHERE id = %s
            RETURNING id
        """, (viz_id,))
        
        result = cursor.fetchone()
        conn.commit()
        
        # Elimina anche dalla cronologia
        cursor.execute("""
            UPDATE agent_schema.query_history
            SET visualization_id = NULL
            WHERE visualization_id = %s
        """, (viz_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # Rimuovi dalla memoria cache
        if viz_id in visualizations:
            del visualizations[viz_id]
        
        if result:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Visualizzazione non trovata"}), 404
    except Exception as e:
        print(f"Errore nell'eliminazione: {e}")
        return jsonify({"error": str(e)}), 500

# Pagina delle statistiche
@app.route('/stats', methods=['GET'])
def stats_page():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica l'esistenza della vista
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'agent_schema' AND table_name = 'usage_statistics'
        """)
        
        if not cursor.fetchone():
            # Crea la vista se non esiste
            cursor.execute("""
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
            """)
        
        # Ottieni le statistiche
        cursor.execute("""
            SELECT * FROM agent_schema.usage_statistics
            LIMIT 30
        """)
        
        stats = []
        columns = [desc[0] for desc in cursor.description]
        
        for row in cursor.fetchall():
            stats.append(dict(zip(columns, row)))
        
        # Ottieni i tipi di visualizzazione più usati
        cursor.execute("""
            SELECT visualization_type, COUNT(*) as count
            FROM agent_schema.visualizations
            GROUP BY visualization_type
            ORDER BY count DESC
        """)
        
        viz_types = []
        for row in cursor.fetchall():
            viz_types.append({
                "type": row[0],
                "count": row[1]
            })
        
        cursor.close()
        conn.close()
        
        return render_template(
            'stats.html',  # Assicurati di creare questo template
            stats=stats,
            viz_types=viz_types
        )
    except Exception as e:
        print(f"Errore nel recuperare le statistiche: {e}")
        return jsonify({"error": str(e)}), 500

# Inizializzazione del database
def init_db():
    """Inizializza il database e crea le tabelle necessarie"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Crea lo schema agent_schema
        cursor.execute("CREATE SCHEMA IF NOT EXISTS agent_schema")
        
        # Crea tabella visualizations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_schema.visualizations (
                id UUID PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content TEXT NOT NULL,
                visualization_type VARCHAR(50) NOT NULL,
                original_query TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_favorite BOOLEAN DEFAULT FALSE,
                view_count INTEGER DEFAULT 0
            )
        """)
        
        # Crea tabella query_history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_schema.query_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_input TEXT NOT NULL,
                detected_intent TEXT,
                generated_query TEXT,
                execution_time_ms INTEGER,
                result_count INTEGER,
                visualization_id UUID,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                user_id VARCHAR(100) DEFAULT 'anonymous'
            )
        """)
        
        # Crea tabella model_prompts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_schema.model_prompts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                prompt_template TEXT NOT NULL,
                prompt_type VARCHAR(50) NOT NULL,
                model_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        
        # Crea tabella agent_config
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_schema.agent_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                data_type VARCHAR(20) DEFAULT 'string',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        
        # Inserisci configurazioni di base
        cursor.execute("""
            INSERT INTO agent_schema.agent_config (key, value, description, data_type)
            VALUES 
                ('default_model', 'google/gemma-3-27b-it:free', 'Modello AI predefinito', 'string'),
                ('max_tokens', '2000', 'Numero massimo di token per risposta', 'integer'),
                ('db_schema_name', 'chat_schema', 'Nome dello schema del database da interrogare', 'string'),
                ('enable_caching', 'true', 'Abilitare la cache delle risposte', 'boolean'),
                ('cache_ttl_minutes', '60', 'Durata della cache in minuti', 'integer'),
                ('default_visualization', 'table', 'Tipo di visualizzazione predefinito', 'string')
            ON CONFLICT (key) DO NOTHING
        """)
        
        # Crea vista per statistiche
        cursor.execute("""
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
                date DESC
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        print("Database inizializzato correttamente")
    except Exception as e:
        print(f"Errore nell'inizializzazione del database: {e}")

# Inizializza il database all'avvio dell'applicazione
with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5050)
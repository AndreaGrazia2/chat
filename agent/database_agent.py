import os
import uuid
import json
import re
import datetime
import hashlib
import jinja2
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

# Configura LangChain con OpenRouter
api_key = os.getenv("OPENROUTER_API_KEY")
llm = ChatOpenAI(
	api_key=api_key,
	base_url="https://openrouter.ai/api/v1",
	model="google/gemma-3-27b-it:free",
	max_tokens=2000
)

# URL base per gli asset statici (configurabile tramite variabile d'ambiente)
STATIC_URL = os.getenv("STATIC_URL", "/static/")

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
  "visualization_type": "tipo di visualizzazione consigliata (table, bar_chart, line_chart, pie_chart)"
}}}}
"""

intent_prompt = ChatPromptTemplate.from_template(intent_template)
intent_chain = intent_prompt | llm

# Template per la generazione del template di visualizzazione
visualization_template = """
Sei un esperto di visualizzazione dati. Devi generare un template HTML in formato Jinja2 per visualizzare i dati con lo schema fornito.
Il template sarà utilizzato per renderizzare i dati JSON che corrispondono allo schema.

Schema dei dati: {schema_json}
Tipo di visualizzazione: {visualization_type}
Titolo: {title}
Descrizione: {description}

IMPORTANTE:
1. Il template deve utilizzare la sintassi Jinja2 per iterare sui dati e mostrare le informazioni
2. Il template deve fare riferimento al foglio di stile "{{ static_url }}css/visualizations.css"
3. Il template deve includere lo script "{{ static_url }}js/visualizations.js"
4. Per grafici, utilizza Chart.js v3.x o superiori caricato da CDN
5. Crea un template ottimizzato per il tipo di visualizzazione richiesto ({visualization_type})
6. I dati saranno passati al template con le seguenti variabili:
   - title: titolo della visualizzazione
   - description: descrizione della visualizzazione
   - data: lista di oggetti con i dati
   - columns: lista di nomi delle colonne
   - generation_date: data di generazione
   - table_id: un ID univoco per la tabella
   - needs_pagination: booleano che indica se è necessaria la paginazione

7. Se stai creando una tabella:
   - Assegna alla tabella un ID univoco: id="data-table-{{{{ table_id }}}}"
   - Dopo la tabella aggiungi questo codice:
     {{% if needs_pagination %}}
     <div class="pagination-container" data-table-id="data-table-{{{{ table_id }}}}" data-page-size="10"></div>
     {{% endif %}}

ATTENZIONE: Genera SOLAMENTE il codice HTML grezzo del template Jinja2, senza alcun delimitatore di codice come ```html o ```. 
Il tuo output verrà utilizzato direttamente come template HTML, quindi NON includere assolutamente tag markdown o altri formati di codice.

Se il tipo di visualizzazione è un grafico (bar_chart, line_chart, pie_chart, ecc.), assicurati di includere il codice JavaScript necessario per inizializzare il grafico con Chart.js.
"""

visualization_prompt = ChatPromptTemplate.from_template(visualization_template)
visualization_chain = visualization_prompt | llm

# Funzione per estrarre lo schema dai risultati di una query
def extract_schema_from_results(results, column_names):
	"""Estrae lo schema dai risultati della query"""
	schema = []
	sample_row = results[0] if results else {}
	
	for i, col in enumerate(column_names):
		data_type = "unknown"
		sample_value = None
		
		if results:
			if isinstance(sample_row, dict):
				sample_value = sample_row.get(col)
			else:
				sample_value = sample_row[i]
				
		if sample_value is not None:
			if isinstance(sample_value, (int, float)):
				data_type = "numeric"
			elif isinstance(sample_value, (datetime.date, datetime.datetime)):
				data_type = "datetime"
			elif isinstance(sample_value, bool):
				data_type = "boolean"
			else:
				data_type = "string"
				
		schema.append({
			"name": col,
			"type": data_type,
			"sample": str(sample_value)[:50] if sample_value is not None else None
		})
		
	return schema

def clean_template_html(html_content):
    """Rimuove i delimitatori di codice markdown dal contenuto HTML"""
    if not html_content or not isinstance(html_content, str):
        return html_content
    
    # Rimuovi ```html all'inizio
    if html_content.lstrip().startswith("```html"):
        start_pos = html_content.find("```html") + len("```html")
        html_content = html_content[start_pos:]
    
    # Rimuovi ``` all'inizio (se non c'era html)
    elif html_content.lstrip().startswith("```"):
        start_pos = html_content.find("```") + len("```")
        html_content = html_content[start_pos:]
    
    # Rimuovi ``` alla fine
    if html_content.rstrip().endswith("```"):
        end_pos = html_content.rfind("```")
        html_content = html_content[:end_pos]
    
    return html_content.strip()

# Funzione per generare l'impronta digitale dello schema
def generate_schema_fingerprint(schema, visualization_type):
	"""Genera un'impronta digitale unica per lo schema"""
	# Ordinare le colonne per nome per garantire consistenza
	sorted_schema = sorted(schema, key=lambda x: x["name"])
	# Creare una stringa che rappresenta lo schema
	schema_str = f"{visualization_type}:"
	for col in sorted_schema:
		schema_str += f"{col['name']}({col['type']});"
	
	# Generare un hash SHA-256 e restituirne una versione troncata
	return hashlib.sha256(schema_str.encode()).hexdigest()[:50]

# Funzione per trovare un template compatibile
def find_compatible_template(schema_fingerprint, visualization_type):
	"""Cerca un template compatibile nel database"""
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		cursor.execute("""
			SELECT id, html_template, css_template, js_template
			FROM agent_schema.visualization_templates
			WHERE schema_fingerprint = %s AND visualization_type = %s
			ORDER BY updated_at DESC
			LIMIT 1
		""", (schema_fingerprint, visualization_type))
		
		result = cursor.fetchone()
		cursor.close()
		conn.close()
		
		if result:
			return {
				"id": result[0],
				"html_template": result[1],
				"css_template": result[2],
				"js_template": result[3]
			}
		return None
	except Exception as e:
		print(f"Errore nella ricerca del template compatibile: {e}")
		return None

# Funzione per salvare un nuovo template
def save_template(name, description, html_template, visualization_type, schema_fingerprint, schema_structure):
	"""Salva un nuovo template nel database"""
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		cursor.execute("""
			INSERT INTO agent_schema.visualization_templates
			(name, description, html_template, visualization_type, schema_fingerprint, schema_structure)
			VALUES (%s, %s, %s, %s, %s, %s)
			RETURNING id
		""", (
			name,
			description,
			html_template,
			visualization_type,
			schema_fingerprint,
			json.dumps(schema_structure) if schema_structure else None
		))
		
		template_id = cursor.fetchone()[0]
		conn.commit()
		cursor.close()
		conn.close()
		
		return template_id
	except Exception as e:
		print(f"Errore nel salvare il template: {e}")
		return None

# Funzione per salvare una visualizzazione
def save_visualization(title, description, template_id, data_json, original_query, visualization_type):
	"""Salva una visualizzazione nel database"""
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		# Calcola la data di scadenza in base alle configurazioni
		cursor.execute("SELECT value FROM agent_schema.agent_config WHERE key = 'template_expiration_days'")
		expiration_days = int(cursor.fetchone()[0]) if cursor.rowcount > 0 else 30
		expiration_date = datetime.datetime.now() + datetime.timedelta(days=expiration_days)
		
		cursor.execute("""
			INSERT INTO agent_schema.visualizations
			(title, description, template_id, data_json, original_query, visualization_type, expiration_date)
			VALUES (%s, %s, %s, %s, %s, %s, %s)
			RETURNING id
		""", (
			title,
			description,
			template_id,
			json.dumps(data_json) if isinstance(data_json, (list, dict)) else data_json,
			original_query,
			visualization_type,
			expiration_date
		))
		
		visualization_id = cursor.fetchone()[0]
		conn.commit()
		cursor.close()
		conn.close()
		
		return visualization_id
	except Exception as e:
		print(f"Errore nel salvare la visualizzazione: {e}")
		return None

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
			
			cursor.close()
			conn.close()
		except Exception as diag_error:
			print(f"Errore nel diagnosticare: {diag_error}")
		
		return None, None

# Funzione per salvare la cronologia delle query
def save_query_history(user_input, intent_data, query, success, error_message="", viz_id=None, execution_time=0, result_count=0):
	"""Salva la cronologia delle query nel database"""
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
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

# Funzione per renderizzare un template con dati
def render_template_with_data(template_html, data, title, description, columns):
    """Renderizza un template Jinja2 con i dati forniti"""
    try:
        # Crea l'ambiente Jinja2
        env = jinja2.Environment(
            loader=jinja2.FileSystemLoader("template"),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
        
        # Crea un template dal testo HTML
        template = env.from_string(template_html)
        
        # Prepara i dati per grafici (se necessario)
        labels_json = json.dumps([row[columns[0]] for row in data]) if len(columns) > 0 and len(data) > 0 else '[]'
        values_json = json.dumps([row[columns[1]] for row in data]) if len(columns) > 1 and len(data) > 0 else '[]'
        
        # Genera un ID univoco per la tabella
        table_id = uuid.uuid4().hex[:8]
        
        # Determina se è necessaria la paginazione (più di 10 righe)
        needs_pagination = len(data) > 10
        
        # Renderizza il template con i dati
        rendered_html = template.render(
            title=title,
            description=description,
            data=data,
            columns=columns,
            data_json=json.dumps(data),
            labels_json=labels_json,
            values_json=values_json,
            chart_label=title,
            generation_date=datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            static_url=STATIC_URL,
            table_id=table_id,
            needs_pagination=needs_pagination
        )
        
        return rendered_html
    except Exception as e:
        print(f"Errore nel renderizzare il template: {e}")
        return f"""
        <html>
            <head><title>Errore di rendering</title></head>
            <body>
                <h1>Si è verificato un errore nel rendering del template</h1>
                <p>{str(e)}</p>
            </body>
        </html>
        """

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
				serializable_row = {}
				for i, col in enumerate(column_names):
					value = row[i]
					if isinstance(value, (datetime.date, datetime.datetime)):
						serializable_row[col] = value.isoformat()
					else:
						serializable_row[col] = value
				serializable_results.append(serializable_row)
		
		# Estrai lo schema dai risultati
		schema = extract_schema_from_results(serializable_results, column_names)
		
		# Genera l'impronta digitale dello schema
		visualization_type = intent_data.get('visualization_type', 'table')
		schema_fingerprint = generate_schema_fingerprint(schema, visualization_type)
		
		# Cerca un template compatibile
		template = find_compatible_template(schema_fingerprint, visualization_type)
		template_id = None
		
		if template:
			# Riutilizza il template esistente
			print(f"DEBUG - Trovato template compatibile: {template['id']}")
			template_id = template['id']
			template_html = template['html_template']
		else:
			# Genera un nuovo template tramite LLM
			print(f"DEBUG - Generazione nuovo template per {visualization_type}")
			
			# Prepara i dati per il prompt
			visualization_payload = {
				"schema_json": json.dumps(schema),
				"visualization_type": visualization_type,
				"title": intent_data.get('title', 'Risultato della query'),
				"description": intent_data.get('description', '')
			}

			# Log dei dati passati al modello
			print(f"\nDEBUG - Parametri passati al modello per il template:")
			print(f"Schema JSON: {visualization_payload['schema_json']}")
			print(f"Tipo di visualizzazione: {visualization_payload['visualization_type']}")
			print(f"Titolo: {visualization_payload['title']}")
			print(f"Descrizione: {visualization_payload['description']}\n")

			# Stampa il prompt compilato
			filled_template = visualization_template.format(**visualization_payload)
			print(f"DEBUG - Prompt compilato per il modello:\n{filled_template}\n")

			# Invoca l'LLM per generare il template
			template_result = visualization_chain.invoke(visualization_payload)

			# Stampa la risposta completa del modello
			print(f"DEBUG - Risposta completa del modello per il template:\n{template_result}\n")

			# Estrai il contenuto HTML dalla risposta
			template_html = None
			if hasattr(template_result, 'content'):
				template_html = template_result.content
				print(f"DEBUG - Contenuto del template estratto: {template_html[:600]}...")
			elif isinstance(template_result, dict) and "text" in template_result:
				template_html = template_result["text"]
				print(f"DEBUG - Contenuto del template da dict: {template_html[:600]}...")
			else:
				template_html = str(template_result)
				print(f"DEBUG - Contenuto del template convertito: {template_html[:600]}...")
			
			# Pulisci il template da eventuali delimitatori di codice
			template_html = clean_template_html(template_html)
			
			# Salva il nuovo template
			template_id = save_template(
				name=f"Generated {visualization_type.capitalize()} Template",
				description=f"Template generato automaticamente per {visualization_type}",
				html_template=template_html,
				visualization_type=visualization_type,
				schema_fingerprint=schema_fingerprint,
				schema_structure=schema
			)
		
		# Salva la visualizzazione
		visualization_id = save_visualization(
			title=intent_data.get('title', 'Risultato della query'),
			description=intent_data.get('description', ''),
			template_id=template_id,
			data_json=serializable_results,
			original_query=query,
			visualization_type=visualization_type
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
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		# Incrementa il contatore di visualizzazioni
		cursor.execute("""
			UPDATE agent_schema.visualizations 
			SET view_count = view_count + 1 
			WHERE id = %s
			RETURNING id
		""", (viz_id,))
		
		# Recupera visualizzazione e template associato
		cursor.execute("""
			SELECT v.data_json, v.title, v.description, v.visualization_type,
				   t.html_template
			FROM agent_schema.visualizations v
			JOIN agent_schema.visualization_templates t ON v.template_id = t.id
			WHERE v.id = %s
		""", (viz_id,))
		
		result = cursor.fetchone()
		cursor.close()
		conn.close()
		
		if not result:
			return "Visualizzazione non trovata", 404
		
		# Ottieni i dati
		data_json, title, description, visualization_type, html_template = result

		# Converti JSON in lista di dizionari
		if isinstance(data_json, str):
			data = json.loads(data_json)
		else:
			data = data_json
		
		# Ottieni le colonne dai dati
		columns = list(data[0].keys()) if data and isinstance(data, list) and len(data) > 0 else []
		
		# Renderizza il template con i dati
		rendered_html = render_template_with_data(
			template_html=html_template,
			data=data,
			title=title,
			description=description,
			columns=columns
		)
		
		return rendered_html
	except Exception as e:
		print(f"Errore nel visualizzare: {e}")
		return f"""
		<html>
			<head><title>Errore di visualizzazione</title></head>
			<body>
				<h1>Si è verificato un errore durante la visualizzazione</h1>
				<p>{str(e)}</p>
				<p><a href="/">Torna alla home</a></p>
			</body>
		</html>
		""", 500

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
			# Estrai lo schema dai risultati
			schema = extract_schema_from_results(results, column_names)
			
			# Converti i risultati in formato JSON serializzabile
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
					serializable_row = {}
					for i, col in enumerate(column_names):
						value = row[i]
						if isinstance(value, (datetime.date, datetime.datetime)):
							serializable_row[col] = value.isoformat()
						else:
							serializable_row[col] = value
					serializable_results.append(serializable_row)
			
			# Usa un template base per tabelle
			html_template = """
			<!DOCTYPE html>
			<html lang="it">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>{{ title }}</title>
				<link rel="stylesheet" href="{{ static_url }}css/visualizations.css">
			</head>
			<body>
				<div class="visualization-container">
					<header class="visualization-header">
						<h1>{{ title }}</h1>
						<p class="description">{{ description }}</p>
					</header>
					<div class="visualization-content">
						<table class="data-table">
							<thead>
								<tr>
									{% for column in columns %}
									<th>{{ column }}</th>
									{% endfor %}
								</tr>
							</thead>
							<tbody>
								{% for row in data %}
								<tr>
									{% for column in columns %}
									<td>{{ row[column] }}</td>
									{% endfor %}
								</tr>
								{% endfor %}
							</tbody>
						</table>
					</div>
					<footer class="visualization-footer">
						<p>Generato il {{ generation_date }}</p>
					</footer>
				</div>
				<script src="{{ static_url }}js/visualizations.js"></script>
			</body>
			</html>
			"""
			
			# Renderizza il template con i dati
			rendered_html = render_template_with_data(
				template_html=html_template,
				data=serializable_results,
				title="Test Query Results",
				description="Risultati della query di test per john_doe",
				columns=column_names
			)
			
			return rendered_html
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

# Storico delle query
@app.route('/history', methods=['GET'])
def get_history():
	# Recupera l'ID utente dalla sessione o usa un valore predefinito
	user_id = session.get('user_id', 'anonymous')
	limit = request.args.get('limit', 10, type=int)
	
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
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
			SELECT original_query, data_json
			FROM agent_schema.visualizations
			WHERE id = %s
		""", (viz_id,))
		
		result = cursor.fetchone()
		if not result:
			return jsonify({"error": "Visualizzazione non trovata"}), 404
		
		original_query, data_json = result
		cursor.close()
		conn.close()
		
		# Ottieni i dati
		if isinstance(data_json, str):
			data = json.loads(data_json)
		else:
			data = data_json
		
		if not data or len(data) == 0:
			return jsonify({"error": "Nessun dato trovato"}), 404
		
		# Ottieni le colonne dai dati
		columns = list(data[0].keys()) if isinstance(data[0], dict) else []
		
		if format_type == 'csv':
			# Genera CSV
			output = generate_csv(data, columns)
			return Response(
				output,
				mimetype="text/csv",
				headers={"Content-disposition": f"attachment; filename=export_{viz_id}.csv"}
			)
		elif format_type == 'json':
			# Restituisci il JSON direttamente
			return jsonify({
				"columns": columns,
				"data": data
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
			SELECT v.id, v.title, v.description, v.visualization_type,
				   v.created_at, v.view_count, v.is_favorite,
				   t.name as template_name
			FROM agent_schema.visualizations v
			JOIN agent_schema.visualization_templates t ON v.template_id = t.id
			ORDER BY v.created_at DESC
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
				"is_favorite": row[6],
				"template_name": row[7]
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
		
		# Aggiorna anche la cronologia
		cursor.execute("""
			UPDATE agent_schema.query_history
			SET visualization_id = NULL
			WHERE visualization_id = %s
		""", (viz_id,))
		
		conn.commit()
		cursor.close()
		conn.close()
		
		if result:
			return jsonify({"success": True})
		else:
			return jsonify({"error": "Visualizzazione non trovata"}), 404
	except Exception as e:
		print(f"Errore nell'eliminazione: {e}")
		return jsonify({"error": str(e)}), 500

# Gestione template di visualizzazione
@app.route('/templates', methods=['GET'])
def get_templates():
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		cursor.execute("""
			SELECT t.id, t.name, t.description, t.visualization_type, t.created_at,
				   COUNT(v.id) as usage_count
			FROM agent_schema.visualization_templates t
			LEFT JOIN agent_schema.visualizations v ON t.id = v.template_id
			GROUP BY t.id, t.name, t.description, t.visualization_type, t.created_at
			ORDER BY t.created_at DESC
		""")
		
		templates_list = []
		for row in cursor.fetchall():
			templates_list.append({
				"id": row[0],
				"name": row[1],
				"description": row[2],
				"type": row[3],
				"created_at": row[4].isoformat() if row[4] else None,
				"usage_count": row[5]
			})
		
		cursor.close()
		conn.close()
		return jsonify({"templates": templates_list})
	except Exception as e:
		print(f"Errore nel recuperare i template: {e}")
		return jsonify({"error": str(e)}), 500

# Pagina delle statistiche
@app.route('/stats', methods=['GET'])
def stats_page():
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		# Ottieni le statistiche di utilizzo
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
		
		# Ottieni statistiche di utilizzo dei template
		cursor.execute("SELECT * FROM agent_schema.template_usage_statistics LIMIT 10")
		
		template_stats = []
		template_columns = [desc[0] for desc in cursor.description]
		
		for row in cursor.fetchall():
			template_stats.append(dict(zip(template_columns, row)))
		
		cursor.close()
		conn.close()
		
		return render_template(
			'stats.html',
			stats=stats,
			viz_types=viz_types,
			template_stats=template_stats
		)
	except Exception as e:
		print(f"Errore nel recuperare le statistiche: {e}")
		return jsonify({"error": str(e)}), 500

# Pulisci le visualizzazioni scadute
@app.route('/maintenance/clean_expired', methods=['POST'])
def clean_expired_visualizations():
	if request.headers.get('X-API-Key') != os.getenv("MAINTENANCE_API_KEY"):
		return jsonify({"error": "Unauthorized"}), 401
	
	try:
		conn = get_db_connection()
		cursor = conn.cursor()
		
		cursor.execute("SELECT agent_schema.clean_expired_visualizations()")
		result = cursor.fetchone()[0]
		
		conn.commit()
		cursor.close()
		conn.close()
		
		return jsonify({
			"success": True,
			"deleted_count": result,
			"message": f"Eliminate {result} visualizzazioni scadute"
		})
	except Exception as e:
		print(f"Errore nella pulizia delle visualizzazioni scadute: {e}")
		return jsonify({"error": str(e)}), 500

# Funzione per l'inizializzazione del database
def init_db():
	"""Inizializza il database e crea le tabelle necessarie"""
	print("Inizializzazione del database...")
	# La logica di inizializzazione è stata spostata nel file schema.sql
	print("Inizializzazione completata. Utilizzare lo script schema.sql per creare le tabelle.")

# Inizializza il database all'avvio dell'applicazione (solo messaggio informativo)
with app.app_context():
	init_db()

if __name__ == '__main__':
	app.run(debug=True, port=5050)
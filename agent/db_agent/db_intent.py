# agent/db_agent/db_intent.py
"""
Modulo per l'analisi degli intenti relativi alle query database

Questo modulo si occupa di:
1. Fornire un template di prompt per l'analisi degli intenti database
2. Creare una chain LangChain per elaborare i messaggi
3. Parsare la risposta del modello in un formato strutturato
"""
import json
import re
from langchain.prompts import ChatPromptTemplate

# Template per riconoscere comandi del database
db_intent_template = """
Sei un assistente specializzato nell'analizzare messaggi relativi a query di database.
Analizza il seguente messaggio e determina se contiene una richiesta di informazioni
che richiederebbe una query di database per essere soddisfatta.

Esempi di comandi:
1. "Mostrami gli ultimi 10 messaggi nella chat" → needs_query: true, query: SELECT * FROM chat_schema.messages ORDER BY created_at DESC LIMIT 10
2. "Quanti messaggi ha inviato l'utente john_doe?" → needs_query: true, query: SELECT COUNT(*) FROM chat_schema.messages WHERE user_id IN (SELECT id FROM chat_schema.users WHERE username = 'john_doe')
3. "Quali sono i canali più attivi?" → needs_query: true, query: SELECT c.name, COUNT(m.id) as message_count FROM chat_schema.channels c JOIN chat_schema.conversations conv ON c.name = conv.name JOIN chat_schema.messages m ON conv.id = m.conversation_id GROUP BY c.name ORDER BY message_count DESC
4. "Come stai oggi?" → needs_query: false, reasoning: "Questa è una domanda conversazionale, non richiede accesso al database"
5. "Che tempo fa?" → needs_query: false, reasoning: "Questa è una domanda sul meteo, non richiede accesso al database interno"

Messaggio: {user_input}

Rispondi in formato JSON:
{{
  "needs_query": true/false,
  "reasoning": "Spiegazione del perché è o non è una query database",
  "query": "La query SQL da eseguire se needs_query è true, altrimenti null",
  "title": "Un titolo descrittivo per i risultati",
  "description": "Breve descrizione dei risultati attesi",
  "visualization_type": "table/bar_chart/line_chart/pie_chart"
}}

IMPORTANTE:
- Analizza attentamente la richiesta per determinare se necessita di dati dal database
- Scrivi query SQL valide e sicure, usando solo SELECT per sicurezza
- Suggerisci il tipo di visualizzazione più appropriato per i risultati
- Se non è una richiesta di database, spiega chiaramente perché
"""

def create_db_intent_chain(llm):
    """
    Crea una chain per l'analisi degli intenti database
    
    Args:
        llm: Modello di linguaggio da utilizzare
        
    Returns:
        Chain: Chain LangChain per l'analisi degli intenti
    """
    intent_prompt = ChatPromptTemplate.from_template(db_intent_template)
    return intent_prompt | llm

def parse_intent_response(response):
    """
    Estrae il JSON dalla risposta del modello
    
    Args:
        response: Risposta dal modello di linguaggio
        
    Returns:
        dict: Dati dell'intento analizzato
    """
    # Se la risposta è un oggetto con attributo content
    if hasattr(response, 'content'):
        content = response.content
    else:
        content = str(response)
    
    # Prova a parsare direttamente come JSON
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Cerca di estrarre il JSON dal testo
        json_match = re.search(r'({.*})', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                # Se il JSON non è valido, prova a correggere alcuni errori comuni
                try:
                    # Sostituisci le stringhe 'true' e 'false' con true e false (senza apici)
                    fixed_json = re.sub(r'"(true|false)"', r'\1', json_match.group(1))
                    return json.loads(fixed_json)
                except json.JSONDecodeError:
                    pass
    
    # Se fallisce tutto, estrai manualmente i campi principali con regex
    needs_query = re.search(r'"needs_query":\s*(true|false)', content, re.IGNORECASE)
    query = re.search(r'"query":\s*"([^"]*)"', content)
    reasoning = re.search(r'"reasoning":\s*"([^"]*)"', content)
    
    result = {
        "needs_query": needs_query and needs_query.group(1).lower() == 'true',
        "reasoning": reasoning.group(1) if reasoning else "Estratto con fallback da risposta non-JSON"
    }
    
    if query:
        result["query"] = query.group(1)
    
    return result
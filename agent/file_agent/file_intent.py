"""
Modulo per l'analisi degli intenti relativi all'analisi dei file

Questo modulo si occupa di:
1. Fornire un template di prompt per l'analisi degli intenti di analisi file
2. Creare una chain LangChain per elaborare i messaggi
3. Parsare la risposta del modello in un formato strutturato
"""
import json
import re
from langchain.prompts import ChatPromptTemplate

# Template per riconoscere comandi di analisi file
file_intent_template = """
Sei un assistente specializzato nell'analizzare messaggi relativi all'analisi di documenti.
Analizza il seguente messaggio e determina se contiene una richiesta di analisi
o riassunto di un documento allegato.

Esempi di comandi:
1. "Analizza questo documento" → needs_analysis: true, reasoning: "Richiesta esplicita di analisi del documento"
2. "Puoi riassumere questo file?" → needs_analysis: true, reasoning: "Richiesta di riassunto del documento"
3. "Cosa contiene questo PDF?" → needs_analysis: true, reasoning: "Richiesta di informazioni sul contenuto del documento"
4. "Ti invio questo documento" → needs_analysis: false, reasoning: "Semplice invio senza richiesta di analisi"
5. "Ecco il file che mi hai chiesto" → needs_analysis: false, reasoning: "Semplice invio senza richiesta di analisi"

Messaggio: {user_input}

Rispondi in formato JSON:
{{
  "needs_analysis": true/false,
  "reasoning": "Spiegazione del perché è o non è una richiesta di analisi",
  "analysis_type": "summary/content/topic/null"
}}

IMPORTANTE:
- Analizza attentamente la richiesta per determinare se necessita di analisi del documento
- Se non è una richiesta di analisi, spiega chiaramente perché
- Specifica il tipo di analisi richiesta (riassunto, contenuto, argomento, ecc.)
"""

def create_file_intent_chain(llm):
    """
    Crea una chain per l'analisi degli intenti di analisi file
    
    Args:
        llm: Modello di linguaggio da utilizzare
        
    Returns:
        Chain: Chain LangChain per l'analisi degli intenti
    """
    intent_prompt = ChatPromptTemplate.from_template(file_intent_template)
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
        
        # Fallback: restituisci un dizionario con valori di default
        return {
            "needs_analysis": False,
            "reasoning": "Impossibile determinare l'intento (errore di parsing)",
            "analysis_type": None
        }
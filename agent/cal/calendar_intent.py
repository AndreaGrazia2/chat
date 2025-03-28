"""
Modulo per l'analisi degli intenti relativi al calendario

Questo modulo si occupa di:
1. Fornire un template di prompt per l'analisi degli intenti calendario
2. Creare una chain LangChain per elaborare i messaggi
3. Parsare la risposta del modello in un formato strutturato
"""
import json
import re
from langchain.prompts import ChatPromptTemplate

# Template per riconoscere comandi del calendario
calendar_intent_template = """
Sei un assistente specializzato nell'analizzare messaggi relativi a eventi di calendario.
Analizza il seguente messaggio e determina se contiene una richiesta di creazione, modifica, 
eliminazione o visualizzazione di eventi del calendario.

Anno corrente: {current_year}

Esempi di comandi:
1. "Crea un evento riunione lunedì alle 15:00" → create, titolo="riunione", data=lunedì, ora_inizio=15:00
2. "Sposta l'appuntamento col dentista a giovedì" → update, titolo="appuntamento col dentista", data=giovedì
3. "Cancella la riunione di team di domani" → delete, titolo="riunione di team", data=domani
4. "Quali eventi ho questa settimana?" → view, periodo=questa settimana
5. "Mostra il mio calendario di marzo" → view, periodo=marzo
6. "Aggiungi un appuntamento dal dottore per venerdì alle 10" → create, titolo="appuntamento dal dottore", data=venerdì, ora_inizio=10:00
7. "Crea un promemoria per pagare le bollette domani" → create, titolo="pagare le bollette", data=domani
8. "Posta la riunione di marketing dalle 14:00 alle 15:30" → update, titolo="riunione di marketing", ora_inizio=14:00, ora_fine=15:30
9. "Elimina tutti gli eventi di lunedì" → delete, data=lunedì
10. "Quando è il mio prossimo appuntamento?" → view, period=future, filtro="prossimo appuntamento"

Prestare MOLTA ATTENZIONE ai comandi di SPOSTAMENTO/MODIFICA (update) degli eventi:
- "Sposta evento 14 marzo ore 14 con oggetto 'meeting' al 15 marzo alle 10" 
  → update, titolo="meeting", data_origine=14 marzo, ora_origine=14:00, data=15 marzo, ora_inizio=10:00
- "Cambia l'orario della riunione di domani dalle 9 alle 11" 
  → update, titolo="riunione", data=domani, ora_inizio=11:00
- "Anticipa la visita medica di venerdì alle 8 del mattino" 
  → update, titolo="visita medica", data=venerdì, ora_inizio=08:00
- "Posticipa l'evento test del 20 marzo al 25 marzo" 
  → update, titolo="test", data_origine=20 marzo, data=25 marzo

Messaggio: {user_input}

Rispondi in formato JSON:
{{
  "is_calendar_intent": true/false,
  "action": "create"|"update"|"delete"|"view"|"none",
  "title": "Titolo dell'evento o null",
  "original_title": "Titolo originale dell'evento (se diverso dopo update)",
  "description": "Descrizione dell'evento o null",
  "date": "YYYY-MM-DD o espressione come 'domani', 'lunedì', ecc. o null",
  "original_date": "Data originale dell'evento (per update) o null",
  "start_time": "HH:MM o espressione come 'alle 15', ecc. o null",
  "original_start_time": "Orario originale dell'evento (per update) o null",
  "end_time": "HH:MM o null", 
  "duration_minutes": null o numero di minuti,
  "category": "work"|"personal"|"family"|"health" o null,
  "event_id": "ID dell'evento da modificare/eliminare o null",
  "period": "today"|"tomorrow"|"this_week"|"next_week"|"this_month"|"future" o null,
  "reasoning": "Spiegazione del ragionamento"
}}

IMPORTANTE:
- Se l'anno non è specificato, considera l'anno corrente.
- Valuta attentamente il messaggio per determinare se è veramente un'intenzione calendario
- Cerca di estrarre tutte le informazioni possibili dal messaggio
- Per date non specificate ma necessarie all'azione (es. creazione), usa la data corrente
- Per le modifiche, è FONDAMENTALE separare le informazioni originali da quelle nuove:
  * original_title: il titolo originale dell'evento da modificare
  * original_date: la data originale dell'evento da modificare
  * original_start_time: l'orario originale dell'evento da modificare
- Assegna una categoria appropriata in base al contenuto se non esplicitata
"""

def create_calendar_intent_chain(llm):
    """
    Crea una chain per l'analisi degli intenti calendario
    
    Args:
        llm: Modello di linguaggio da utilizzare
        
    Returns:
        Chain: Chain LangChain per l'analisi degli intenti
    """
    intent_prompt = ChatPromptTemplate.from_template(calendar_intent_template)
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
    is_calendar = re.search(r'"is_calendar_intent":\s*(true|false)', content, re.IGNORECASE)
    action = re.search(r'"action":\s*"(create|update|delete|view|none)"', content, re.IGNORECASE)
    title = re.search(r'"title":\s*"([^"]*)"', content)
    
    result = {
        "is_calendar_intent": is_calendar and is_calendar.group(1).lower() == 'true',
        "action": action.group(1).lower() if action else "none",
        "reasoning": "Estratto con fallback da risposta non-JSON"
    }
    
    if title:
        result["title"] = title.group(1)
    
    return result
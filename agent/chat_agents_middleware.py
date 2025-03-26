"""
Middleware per gli agenti IA - intercetta i messaggi della chat e li invia agli agenti appropriati

Questo modulo:
1. Intercetta i messaggi della chat prima che vengano salvati
2. Analizza i messaggi tramite vari agenti (calendario, e in futuro altri)
3. Esegue azioni se richieste
4. Restituisce risposte generate dagli agenti
"""
import os
import logging
from langchain_openai import ChatOpenAI

# Inizializza il logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Variabile globale per gli agenti (lazy loading)
_calendar_agent = None

def get_calendar_agent():
    """
    Ottiene l'istanza dell'agente calendario (lazy loading)
    
    Returns:
        CalendarAgent: Istanza dell'agente calendario
    """
    global _calendar_agent
    
    if _calendar_agent is None:
        try:
            # Importazione locale per evitare dipendenze circolari
            from calendar_agent import CalendarAgent
            
            # Ottieni la chiave API dall'ambiente
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                logger.error("OPENROUTER_API_KEY non impostata nell'ambiente")
                raise ValueError("API key non configurata")
                
            # Inizializza il modello LLM
            llm = ChatOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                model="google/gemma-3-27b-it:free",
                max_tokens=2000
            )
            
            # Crea l'agente calendario
            _calendar_agent = CalendarAgent(llm)
            logger.info("Agente calendario inizializzato con successo")
            
        except Exception as e:
            logger.error(f"Errore nell'inizializzazione dell'agente calendario: {e}")
            raise
    
    return _calendar_agent

def process_message_through_agents(message_text, user_id=None):
    """
    Elabora un messaggio attraverso tutti gli agenti disponibili
    
    Args:
        message_text: Testo del messaggio da elaborare
        user_id: ID dell'utente (opzionale)
        
    Returns:
        dict: Risultato dell'elaborazione con informazioni sull'agente e risposta
    """
    logger.info(f"Elaborazione messaggio attraverso agenti: '{message_text}'")
    
    # 1. Controlla attraverso l'agente calendario
    try:
        calendar_agent = get_calendar_agent()
        calendar_result = calendar_agent.process_message(message_text, user_id)
        
        if calendar_result.get('is_calendar_intent', False):
            logger.info(f"Intento calendario rilevato: {calendar_result.get('action', 'unknown')}")
            
            # Formatta il risultato
            return {
                'agent_used': 'calendar',
                'action_taken': calendar_result.get('action', 'none'),
                'response': calendar_result.get('response', 'Operazione calendario completata'),
                'success': calendar_result.get('success', False),
                'raw_result': calendar_result
            }
    except Exception as e:
        logger.error(f"Errore durante l'elaborazione con l'agente calendario: {e}")
        return {
            'agent_used': 'calendar',
            'action_taken': 'error',
            'response': f"Mi dispiace, c'è stato un errore con l'agente calendario: {str(e)}",
            'success': False,
            'error': str(e)
        }
    
    # 2. In futuro, qui si possono aggiungere altri agenti
    # Esempio:
    # rag_result = process_through_rag_agent(message_text)
    # if rag_result['action_taken']:
    #     return rag_result
    
    # 3. Nessun agente ha intercettato il messaggio
    logger.info("Nessun agente ha intercettato il messaggio")
    return {
        'agent_used': None,
        'action_taken': None,
        'response': None,
        'success': True
    }

def should_generate_assistant_response(agent_result):
    """
    Determina se deve essere generata una risposta automatica dell'assistente
    
    Args:
        agent_result: Risultato dell'elaborazione dell'agente
        
    Returns:
        bool: True se deve essere generata una risposta
    """
    # Se c'è stata un'azione da parte di un agente e c'è una risposta
    return (
        agent_result.get('agent_used') is not None and
        agent_result.get('action_taken') is not None and
        agent_result.get('response') is not None and
        agent_result.get('success', False)
    )

def get_assistant_response(agent_result):
    """
    Ottiene la risposta dell'assistente in base al risultato dell'agente
    
    Args:
        agent_result: Risultato dell'elaborazione dell'agente
        
    Returns:
        str: Risposta dell'assistente
    """
    if not should_generate_assistant_response(agent_result):
        return None
    
    # Per ora, ritorna semplicemente la risposta dell'agente
    return agent_result.get('response')

# Test diretto del middleware (solo per sviluppo)
if __name__ == "__main__":
    # Test con alcuni messaggi
    test_messages = [
        "Crea un evento riunione per domani alle 15:00",
        "Quali sono gli eventi di questa settimana?",
        "Ciao, come stai oggi?"
    ]
    
    for msg in test_messages:
        print(f"\nElaborazione messaggio: '{msg}'")
        result = process_message_through_agents(msg)
        print(f"Risultato: {result}")
        
        response = get_assistant_response(result)
        if response:
            print(f"Risposta assistente: {response}")
        else:
            print("Nessuna risposta dell'assistente generata")
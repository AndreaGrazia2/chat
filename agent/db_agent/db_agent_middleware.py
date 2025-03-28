# agent/db_agent/db_agent_middleware.py
"""
Middleware per l'agente database - intercetta i messaggi della chat e li invia all'agente appropriato

Questo modulo:
1. Intercetta i messaggi della chat
2. Verifica se sono richieste relative al database
3. Esegue query e genera risposte appropriate
"""
import os
import logging
import re
from langchain_openai import ChatOpenAI

# Inizializza il logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Variabile globale per l'agente (lazy loading)
_db_query_agent = None

def get_db_query_agent():
    """
    Ottiene l'istanza dell'agente database (lazy loading)
    
    Returns:
        DBQueryAgent: Istanza dell'agente database
    """
    global _db_query_agent
    
    if _db_query_agent is None:
        try:
            # Importazione locale per evitare dipendenze circolari
            from agent.db_agent.db_query_agent import DBQueryAgent
            
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
            
            # Crea l'agente database
            _db_query_agent = DBQueryAgent(llm)
            logger.info("DB Query Agent inizializzato con successo")
            
        except Exception as e:
            logger.error(f"Error initializing DB Query Agent: {e}")
            logger.error(f"{str(e)}")
            
            # Fallback a un agente dummy
            logger.warning("Using DummyDBQueryAgent due to initialization error")
            from agent.db_agent.dummy_db_agent import DummyDBQueryAgent
            _db_query_agent = DummyDBQueryAgent()
    
    return _db_query_agent

class DBAgentMiddleware:
    """Middleware per l'integrazione dell'agente database nella chat"""
    
    def __init__(self):
        logger.info("DBAgentMiddleware inizializzato")
        
        # Patterns per riconoscere intenti database comuni
        self.db_intent_patterns = [
            # Pattern per mostrare ultimi messaggi
            r'(?i)mostra(mi)?\s+(?:gli|i|le)?\s*ultimi\s+\d+\s+(?:messaggi|conversazioni)',
            # Pattern per contare messaggi
            r'(?i)quanti\s+messaggi\s+(?:ha\s+inviato|sono\s+stati\s+inviati\s+da)?\s+(?:l\'utente\s+)?(\w+)',
            # Pattern per statistiche
            r'(?i)(?:mostra|visualizza|fammi\s+vedere)\s+(?:le\s+)?statistiche',
            # Pattern per utenti attivi/top
            r'(?i)(?:chi\s+sono\s+)?(?:gli|i)\s+utenti\s+più\s+attivi',
            # Pattern per canali attivi/top
            r'(?i)(?:quali\s+sono\s+)?(?:i|gli)\s+canali\s+più\s+attivi'
        ]
    
    def detect_db_query_intent(self, message_text):
        """
        Verifica se il messaggio contiene un intento database
        
        Args:
            message_text: Testo del messaggio
            
        Returns:
            bool: True se è un intento database
        """
        for pattern in self.db_intent_patterns:
            match = re.search(pattern, message_text)
            if match:
                matched_text = match.group(0)
                print(f"Pattern corrispondente: '{pattern}'")
                print(f"Match trovato: '{matched_text}'")
                logger.info(f"Rilevato intento di query database tramite pattern: '{message_text}'")
                return True
                
        return False
    
    def process_message(self, message_text, message_id=None, user_id=None, conversation_id=None):
        """
        Processa un messaggio e restituisce una risposta se è un intento database
        
        Args:
            message_text: Testo del messaggio
            message_id: ID del messaggio a cui rispondere
            user_id: ID dell'utente
            conversation_id: ID della conversazione
            
        Returns:
            dict: Risultato dell'elaborazione con risposta
        """
        print(f"Rilevato intento di query database: '{message_text}'")
        logger.info(f"Processamento messaggio: '{message_text}'")
            
        # Ottieni o inizializza l'agente database
        db_agent = get_db_query_agent()
            
        # Processa il messaggio con l'agente
        try:
            return db_agent.process_message(message_text, user_id)
        except Exception as e:
            error_msg = f"Non è stato possibile connettersi al database. Riprova più tardi."
            logger.error(f"Errore nell'esecuzione della query: {error_msg}")
            return {
                "type": "db_query_response", 
                "text": f"Si è verificato un errore nell'esecuzione della query: {error_msg}",
                "query_results": {
                    "success": False,
                    "error": error_msg,
                    "description": f"Tentativo di eseguire la query: {message_text}"
                }
            }
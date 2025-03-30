"""
Middleware per l'agente file - intercetta i messaggi della chat con allegati e li invia all'agente appropriato

Questo modulo:
1. Intercetta i messaggi della chat con allegati
2. Verifica se sono richieste di analisi documento
3. Esegue analisi e genera risposte appropriate
"""
import os
import re
import logging
from langchain_openai import ChatOpenAI
from agent.file_agent.file_agent import FileAgent

# Configurazione del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Variabile globale per l'istanza dell'agente file (lazy loading)
_file_agent = None

def get_file_agent():
    """
    Ottiene l'istanza dell'agente file (lazy loading)
    
    Returns:
        FileAgent: Istanza dell'agente file
    """
    global _file_agent
    
    if _file_agent is None:
        # Ottieni il modello di linguaggio
        api_key = os.getenv("OPENROUTER_API_KEY")
        api_base = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
        
        llm = ChatOpenAI(
            openai_api_key=api_key,
            openai_api_base=api_base,
            model_name="anthropic/claude-3-opus:beta",
            temperature=0
        )
        
        # Inizializza l'agente file
        _file_agent = FileAgent(llm)
        
    return _file_agent

class FileAgentMiddleware:
    """Middleware per l'integrazione dell'agente file nella chat"""
    
    def __init__(self):
        """Inizializza il middleware dell'agente file"""
        self.file_intent_patterns = [
            r"analizz[ai] (questo|il) (documento|file)",
            r"fammi un'analisi (del|di questo) (documento|file)",
            r"riassumi (questo|il) (documento|file)",
            r"fammi un riassunto (del|di questo) (documento|file)",
            r"di cosa (parla|tratta) (questo|il) (documento|file)",
            r"dimmi di cosa (parla|tratta|si tratta) (questo|il) (documento|file)",
            r"estrai (le|i) (informazioni|dati|punti) (chiave|principali|importanti) (da|di) questo (documento|file)",
            r"cosa (dice|contiene) (questo|il) (documento|file)"
        ]
    
    def detect_file_analysis_intent(self, message_text):
        """
        Verifica se il messaggio contiene un intento di analisi file
        
        Args:
            message_text: Testo del messaggio
            
        Returns:
            bool: True se è un intento di analisi file
        """
        for pattern in self.file_intent_patterns:
            match = re.search(pattern, message_text.lower())
            if match:
                matched_text = match.group(0)
                logger.info(f"Pattern corrispondente: '{pattern}'")
                logger.info(f"Match trovato: '{matched_text}'")
                logger.info(f"Rilevato intento di analisi file tramite pattern: '{message_text}'")
                return True
        
        # Se non corrisponde a nessun pattern, verifica se contiene parole chiave
        keywords = ["analisi", "analizza", "riassumi", "riassunto", "documento", "file", "estrai", "informazioni"]
        message_lower = message_text.lower()
        
        for keyword in keywords:
            if keyword in message_lower:
                logger.info(f"Parola chiave trovata: '{keyword}'")
                logger.info(f"Possibile intento di analisi file: '{message_text}'")
                return True
        
        return False
    
    def process_message(self, message_text, message_id=None, user_id=None, conversation_id=None, file_data=None):
        """
        Processa un messaggio e restituisce una risposta se è un intento di analisi file
        
        Args:
            message_text: Testo del messaggio
            message_id: ID del messaggio a cui rispondere
            user_id: ID dell'utente
            conversation_id: ID della conversazione
            file_data: Dati del file allegato
            
        Returns:
            dict: Risultato dell'elaborazione con risposta
        """
        logger.info(f"FileAgentMiddleware - Processamento messaggio: '{message_text}'")
        
        # Verifica se c'è un file allegato
        if not file_data:
            logger.info("Nessun file allegato, ignoro il messaggio")
            return None
            
        # Verifica se il messaggio contiene un intento di analisi file
        is_file_intent = self.detect_file_analysis_intent(message_text)
        logger.info(f"Intento di analisi file rilevato: {is_file_intent}")
        
        if not is_file_intent:
            logger.info("Non è un intento di analisi file, ignoro il messaggio")
            return None
            
        # Ottieni o inizializza l'agente file
        file_agent = get_file_agent()
            
        # Processa il messaggio con l'agente
        try:
            logger.info(f"Elaborazione file: {file_data.get('path', 'unknown')}")
            agent_result = file_agent.process_file(
                file_path=file_data.get('path'),
                user_query=message_text,
                user_id=user_id
            )
            
            return {
                'agent_used': 'file',
                'action_taken': 'analyze',
                'response': agent_result.get('response', 'Analisi del file completata'),
                'success': agent_result.get('success', False),
                'raw_result': agent_result
            }
        except Exception as e:
            logger.error(f"Errore durante l'elaborazione con l'agente file: {e}")
            return {
                'agent_used': 'file',
                'action_taken': 'error',
                'response': f"Mi dispiace, c'è stato un errore con l'analisi del file: {str(e)}",
                'success': False,
                'error': str(e)
            }
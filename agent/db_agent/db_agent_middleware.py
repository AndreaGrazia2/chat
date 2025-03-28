"""
Middleware per l'agente di query sul database.
Intercetta i messaggi della chat e li invia all'agente di query.
"""

import logging
import json
import re
import os
from datetime import datetime
from agent.db_agent.db_query_agent import DBQueryAgent
from agent.db_agent.pdf_generator import PDFGenerator

# Configurazione logging
logger = logging.getLogger('db_agent_middleware')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Singleton per l'agente di query
_db_query_agent = None

def get_db_query_agent():
    """
    Ottiene l'istanza dell'agente di query (lazy loading)
    
    Returns:
        DBQueryAgent: Istanza dell'agente di query
    """
    global _db_query_agent
    if _db_query_agent is None:
        _db_query_agent = DBQueryAgent()
    return _db_query_agent

class DBAgentMiddleware:
    """Middleware per l'agente di query sul database"""
    
    def __init__(self):
        """Inizializza il middleware"""
        self.db_agent = get_db_query_agent()
        self.pdf_generator = PDFGenerator()
        logger.info("DBAgentMiddleware inizializzato")
    
    def detect_db_query_intent(self, message_text):
        """
        Rileva se il messaggio contiene un intento di query sul database
        
        Args:
            message_text: Testo del messaggio
            
        Returns:
            bool: True se il messaggio contiene un intento di query, False altrimenti
        """
        # Pattern per rilevare intenti di query
        db_query_patterns = [
            r"(?i)mostra(mi)?\s+(?:i|gli|le|tutti\s+(?:i|gli|le))?\s*(?:messaggi|conversazioni|utenti)",
            r"(?i)(?:cerca|trova(mi)?|elenca(mi)?)\s+(?:i|gli|le|tutti\s+(?:i|gli|le))?\s*(?:messaggi|conversazioni|utenti)",
            r"(?i)quanti\s+(?:messaggi|conversazioni|utenti)",
            r"(?i)chi\s+ha\s+(?:scritto|inviato|mandato)",
            r"(?i)(?:statistiche|report|analisi)\s+(?:dei|delle|sui|sulle|di)\s+(?:messaggi|conversazioni|utenti|chat)",
            r"(?i)(?:genera|crea|produci)\s+(?:un|il|lo|la)?\s*(?:report|pdf|documento|analisi)",
            r"(?i)(?:database|db)\s+query"
        ]
        
        # Verifica se il messaggio corrisponde a uno dei pattern
        for pattern in db_query_patterns:
            if re.search(pattern, message_text):
                logger.info(f"Rilevato intento di query database: '{message_text}'")
                return True
        
        return False
    
    def process_message(self, message_text, user_id=None, conversation_id=None):
        """
        Processa un messaggio e genera una risposta se contiene un intento di query
        
        Args:
            message_text: Testo del messaggio
            user_id: ID dell'utente che ha inviato il messaggio
            conversation_id: ID della conversazione
            
        Returns:
            dict: Risposta dell'agente o None se il messaggio non contiene un intento di query
        """
        try:
            # Verifica se il messaggio contiene un intento di query
            if not self.detect_db_query_intent(message_text):
                return None
            
            logger.info(f"Processamento messaggio: '{message_text}'")
            
            # Esegui la query
            query_results = self.db_agent.process_query(message_text)
            
            # Se la query ha avuto successo, genera un PDF
            if query_results.get('success'):
                # Genera un titolo per il report
                title = f"Report: {message_text}"
                
                # Genera il PDF
                pdf_result = self.pdf_generator.generate_pdf(
                    query_results,
                    title=title,
                    description=query_results.get('description')
                )
                
                if pdf_result.get('success'):
                    # Prepara la risposta con il link al PDF
                    response = {
                        "type": "db_query_response",
                        "text": f"Ecco il report richiesto sui dati della chat.",
                        "file_data": {
                            "name": os.path.splitext(pdf_result['filename'])[0],
                            "ext": "pdf",
                            "size": os.path.getsize(pdf_result['filepath']),
                            "icon": "fa-file-pdf",
                            "url": pdf_result['url']
                        },
                        "query_results": {
                            "count": query_results.get('count', 0),
                            "description": query_results.get('description', '')
                        }
                    }
                    
                    logger.info(f"Risposta generata con PDF: {pdf_result['filepath']}")
                    return response
                else:
                    # Errore nella generazione del PDF
                    logger.error(f"Errore nella generazione del PDF: {pdf_result.get('error')}")
                    return {
                        "type": "db_query_response",
                        "text": f"Ho eseguito la query richiesta, ma si è verificato un errore nella generazione del PDF: {pdf_result.get('error')}",
                        "query_results": query_results
                    }
            else:
                # Errore nell'esecuzione della query
                logger.error(f"Errore nell'esecuzione della query: {query_results.get('error')}")
                return {
                    "type": "db_query_response",
                    "text": f"Si è verificato un errore nell'esecuzione della query: {query_results.get('error')}",
                    "query_results": query_results
                }
                
        except Exception as e:
            logger.error(f"Errore nel processamento del messaggio: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "type": "db_query_response",
                "text": f"Si è verificato un errore durante l'elaborazione della richiesta: {str(e)}"
            }

# Funzione di utilità per test
def test_middleware():
    """Test del middleware"""
    middleware = DBAgentMiddleware()
    
    # Test con un messaggio che contiene un intento di query
    test_message = "Mostrami gli ultimi 5 messaggi inviati da John Doe"
    result = middleware.process_message(test_message)
    
    print(json.dumps(result, indent=2, default=str))
    return result

if __name__ == "__main__":
    # Test del middleware
    test_middleware()
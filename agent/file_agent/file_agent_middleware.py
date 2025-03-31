"""
Middleware per l'agente file - intercetta i messaggi della chat con allegati e li invia all'agente appropriato

Questo modulo:
1. Intercetta i messaggi della chat con allegati
2. Verifica se sono richieste di analisi documento
3. Esegue analisi e genera risposte appropriate
"""
import os
import re
import json
import logging
from langchain_openai import ChatOpenAI
from agent.file_agent.file_agent import FileAgent
from langchain.prompts import ChatPromptTemplate

# Configurazione del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Variabile globale per l'istanza dell'agente file (lazy loading)
_file_agent = None
_file_intent_chain = None

def get_file_query_chain():
    """
    Ottiene la catena per la rilevazione dell'intento di analisi file
    
    Returns:
        Chain: Catena di prompt per determinare l'intento di analisi file
    """
    global _file_intent_chain
    
    if _file_intent_chain is None:
        # Ottieni il modello di linguaggio
        api_key = os.getenv("OPENROUTER_API_KEY")
        api_base = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")
        
        # Inizializza il modello LLM per intenti
        llm = ChatOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            model="google/gemma-3-27b-it:free"
        )        
        
        # Template per verificare se il messaggio contiene una richiesta di analisi documento
        intent_template = """
        Sei un assistente che determina se un messaggio contiene una richiesta di analisi di un documento.

        Messaggio: "{message_text}"

        Il messaggio richiede un'analisi di documento (come riassunto, estrazione di informazioni, comprensione, spiegazione del contenuto, ecc.)?

        Rispondi con:
        {{'is_file_analysis': true/false, 'confidence': 0.0-1.0, 'reason': 'breve spiegazione'}}

        IMPORTANTE: Se il messaggio è solo un semplice invio di file senza richiesta di analisi, la risposta è false.
        """
        
        # Crea il prompt
        intent_prompt = ChatPromptTemplate.from_template(intent_template)
        
        # Crea la catena
        _file_intent_chain = intent_prompt | llm
        
    return _file_intent_chain

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
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            model="google/gemma-3-27b-it:free"
        )  
        
        # Inizializza l'agente file
        _file_agent = FileAgent(llm)
        
    return _file_agent

class FileAgentMiddleware:
    """Middleware per l'integrazione dell'agente file nella chat"""
    
    def __init__(self):
        """Inizializza il middleware dell'agente file"""
        # Manteniamo i pattern originali come fallback
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
        Verifica se il messaggio contiene un intento di analisi file usando il modello di linguaggio
        
        Args:
            message_text: Testo del messaggio
            
        Returns:
            bool: True se è un intento di analisi file
        """
        logger.info(f"Verifica intento analisi file per: '{message_text}'")
        
        # Se il messaggio è vuoto, non è un intento di analisi file
        if not message_text or message_text.strip() == "":
            logger.info("Messaggio vuoto, non è un intento di analisi file")
            return False
        
        try:
            # Prima prova con il modello di linguaggio
            intent_chain = get_file_query_chain()
            response = intent_chain.invoke({"message_text": message_text})
       
            # Estrai il dizionario dalla risposta
            dict_match = re.search(r'({.*})', response.content, re.DOTALL)
            if dict_match:
                try:
                    intent_data = json.loads(dict_match.group(1).replace("'", '"'))
                    is_analysis_intent = intent_data.get('is_file_analysis', False)
                    confidence = intent_data.get('confidence', 0)
                    reason = intent_data.get('reason', 'No reason provided')
                    
                    logger.info(f"Intento analisi file: {is_analysis_intent}, Confidenza: {confidence}, Motivo: {reason}")
                    
                    # Se la confidenza è alta, restituisci il risultato
                    if confidence >= 0.6:
                        return is_analysis_intent
                except Exception as e:
                    logger.error(f"Errore nel parsing del risultato dell'intento: {e}")
                    # Continua con il fallback
            
            # Fallback: usa i pattern originali
            logger.info("Usando i pattern regex come fallback")
            for pattern in self.file_intent_patterns:
                match = re.search(pattern, message_text.lower())
                if match:
                    matched_text = match.group(0)
                    logger.info(f"Pattern corrispondente: '{pattern}'")
                    logger.info(f"Match trovato: '{matched_text}'")
                    return True
            
            # Fallback: controlla parole chiave
            keywords = ["analisi", "analizza", "riassumi", "riassunto", "documento", "file", "estrai", "informazioni"]
            message_lower = message_text.lower()
            
            for keyword in keywords:
                if keyword in message_lower:
                    logger.info(f"Parola chiave trovata: '{keyword}'")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Errore durante la verifica dell'intento di analisi file: {e}")
            
            # Fallback: usa i pattern originali in caso di errore
            logger.info("Errore nel modello, uso dei pattern regex come fallback")
            for pattern in self.file_intent_patterns:
                match = re.search(pattern, message_text.lower())
                if match:
                    return True
            
            # Se anche questo fallisce, verifica le parole chiave
            keywords = ["analisi", "analizza", "riassumi", "riassunto", "documento", "file", "estrai", "informazioni"]
            message_lower = message_text.lower()
            
            for keyword in keywords:
                if keyword in message_lower:
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
            return {
                'agent_used': 'file',
                'action_taken': 'none',
                'response': None,
                'success': False,
                'is_file_intent': False
            }
            
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
                'raw_result': agent_result,
                'is_file_intent': True
            }
        except Exception as e:
            logger.error(f"Errore durante l'elaborazione con l'agente file: {e}")
            return {
                'agent_used': 'file',
                'action_taken': 'error',
                'response': f"Mi dispiace, c'è stato un errore con l'analisi del file: {str(e)}",
                'success': False,
                'error': str(e),
                'is_file_intent': True
            }
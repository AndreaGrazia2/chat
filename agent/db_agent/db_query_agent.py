# agent/db_agent/db_query_agent.py
"""
Agente Database - Gestione delle query al database attraverso comandi in linguaggio naturale

Questo modulo fornisce un agente IA che:
1. Analizza i messaggi degli utenti per rilevare intenti relativi a query database
2. Genera query SQL appropriate
3. Esegue le query sul database
4. Genera risposte naturali per l'utente
"""
import json
import logging
import traceback
import requests
from datetime import datetime

# Configurazione del logger
logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger('db_agent_middleware')

class DBQueryAgent:
    def __init__(self, llm, db_api_base_url=None):
        """
        Inizializza l'agente database
        
        Args:
            llm: Modello di linguaggio (LangChain)
            db_api_base_url: URL base delle API database
        """
        self.llm = llm
        
        # Importa la configurazione
        from common.config import API_BASE_URL
        
        # Se non viene fornito un URL base, usa quello dalla configurazione
        if db_api_base_url is None:
            # Usa l'URL base dalla configurazione con il nuovo prefisso
            self.db_api_base_url = f"{API_BASE_URL}/db_agent"
        else:
            self.db_api_base_url = db_api_base_url
        
        # Import qui per evitare dipendenze circolari
        from agent.db_agent.db_intent import create_db_intent_chain, parse_intent_response
        self.intent_chain = create_db_intent_chain(llm)
        self.parse_intent_response = parse_intent_response
        
        # Utente di default per le richieste
        self.default_user_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    
    def process_message(self, user_input, user_id=None):
        """
        Processa un messaggio dell'utente e determina se è relativo al database
        
        Args:
            user_input: Messaggio dell'utente
            user_id: ID dell'utente (opzionale)
            
        Returns:
            dict: Risultato dell'elaborazione con risposta
        """
        logger.info(f"Elaborazione messaggio: '{user_input}'")
        
        if user_id:
            self.default_user_id = user_id
            logger.info(f"Impostato user_id: {user_id}")
    
        # Emetti un evento al frontend tramite socketio
        from flask_socketio import emit
        emit('modelInference', {'status': 'started', 'userId': user_id or self.default_user_id}, broadcast=True)
    
        # Analizza l'intento
        logger.info("Invocazione della chain di intento DB")
        raw_intent = self.intent_chain.invoke({"user_input": user_input})
        
        intent_data = self.parse_intent_response(raw_intent)
        
        # Log dell'intento rilevato
        logger.info(f"DB intent detected: {json.dumps(intent_data, indent=2)}")
        
        # Se non è un intento database, ritorna subito
        if not intent_data.get('needs_query', False):
            logger.info("Non è un intento database")
            emit('modelInference', {'status': 'completed', 'userId': user_id or self.default_user_id}, broadcast=True)
            return {
                "is_db_intent": False,
                "response": None,
                "reasoning": intent_data.get('reasoning', 'Non è una richiesta relativa al database')
            }
        
        # Processa l'intento database
        query = intent_data.get('query', 'SELECT 1')
        title = intent_data.get('title', 'Risultato query')
        description = intent_data.get('description', '')
        
        logger.info(f"Query generata: {query}")
        
        result = None
        response = None
        pdf_info = None
        
        try:
            # Esegui la query
            result = self._execute_query(query)
            
            # Genera una risposta basata sui risultati
            if result.get('success', False):
                # Genera il PDF con i risultati
                pdf_info = self._generate_pdf_report(result, title, description)
                
                # Crea una risposta testuale
                response = self._format_response(result, pdf_info)
            else:
                error = result.get('error', 'Errore sconosciuto')
                logger.error(f"Errore nell'esecuzione della query: {error}")
                response = f"Si è verificato un errore nell'esecuzione della query: {error}"
        except Exception as e:
            logger.error(f"Errore durante l'elaborazione: {str(e)}")
            logger.error(traceback.format_exc())
            response = f"Si è verificato un errore durante l'elaborazione: {str(e)}"
        
        # Emetti evento di completamento
        emit('modelInference', {'status': 'completed', 'userId': user_id or self.default_user_id}, broadcast=True)
        
        return {
            "is_db_intent": True,
            "success": True,
            "response": response,
            "result": result,
            "intent": intent_data,
            "pdf_info": pdf_info
        }
    
    def _generate_pdf_report(self, query_results, title, description):
        """Genera un report PDF dai risultati della query"""
        try:
            from agent.db_agent.pdf_generator import PDFGenerator
            import json
            
            # Inizializza il generatore PDF
            pdf_generator = PDFGenerator()
            
            # Log dei dati che stiamo passando al generatore PDF
            logger.info(f"Dati per il PDF: {json.dumps(query_results, default=str)[:500]}...")
            
            # Verifica che i dati siano nel formato corretto
            if not query_results.get('results'):
                logger.warning("Nessun risultato trovato nella query")
            
            # Genera il PDF
            pdf_info = pdf_generator.generate_pdf(query_results, title, description)
            
            logger.info(f"PDF generato: {pdf_info.get('filepath')}")
            
            # Aggiungi l'URL per accedere al PDF
            from common.config import API_BASE_URL
            pdf_filename = pdf_info.get('filename')
            # URL corretto per accedere al PDF - modifica il percorso
            pdf_info['url'] = f"{API_BASE_URL}/db_agent/uploads/reports/{pdf_filename}"
            
            return pdf_info
        except Exception as e:
            logger.error(f"Errore nella generazione del PDF: {str(e)}")
            logger.error(traceback.format_exc())
            return None
    
    def _execute_query(self, query):
        """Esegue una query SQL sul database"""
        try:
            # Chiamata API per eseguire la query
            url = f"{self.db_api_base_url}/execute-query"
            
            payload = {
                "query": query,
                "user_id": self.default_user_id
            }
            
            logger.info(f"Invio richiesta POST a {url}")
            response = requests.post(url, json=payload)
            
            if not response.ok:
                logger.error(f"Errore API ({response.status_code}): {response.text}")
                return {
                    "success": False,
                    "error": f"Errore API ({response.status_code}): {response.text}"
                }
                
            result = response.json()
            return {
                "success": True,
                "results": result.get('results', []),
                "columns": result.get('columns', []),
                "query": query
            }
        except Exception as e:
            logger.error(f"Errore nell'esecuzione della query: {str(e)}")
            return {
                "success": False,
                "error": f"Errore nell'esecuzione della query: {str(e)}"
            }
    
    # Sostituisci il metodo _format_response esistente con questa versione che supporta pdf_info
    def _format_response(self, result, pdf_info=None):
        """Formatta la risposta per l'utente"""
        if not result.get('success', False):
            return f"Si è verificato un errore: {result.get('error', 'Errore sconosciuto')}"
        
        # Conta i risultati
        count = len(result.get('results', []))
        
        # Formatta la risposta
        response = f"✅ Ho trovato {count} risultati per la tua query."
        
        # Aggiungi informazioni sul PDF
        if pdf_info and pdf_info.get('url'):
            response += f"\n\nHo generato un report PDF con i risultati della query. Puoi scaricarlo qui: {pdf_info.get('url')}"
        
        return response
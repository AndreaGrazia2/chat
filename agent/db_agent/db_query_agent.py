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
        
        # Se non viene fornito un URL base, usa quello dalla configurazione
        if db_api_base_url is None:
            from common.config import API_BASE_URL
            self.db_api_base_url = f"{API_BASE_URL}/db/api"
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
        visualization_type = intent_data.get('visualization_type', 'table')
        
        logger.info(f"Query generata: {query}")
        
        result = None
        response = None
        
        try:
            # Esegui la query
            result = self._execute_query(query)
            
            # Genera una risposta basata sui risultati
            if result.get('success', False):
                # Crea una visualizzazione
                visualization = self._create_visualization(
                    title=title,
                    description=description,
                    query=query,
                    data=result.get('results', []),
                    visualization_type=visualization_type
                )
                
                # Crea una risposta testuale
                response = self._format_response(result, visualization)
            else:
                # Se c'è stato un errore, restituisci una risposta di errore
                response = f"Si è verificato un errore nell'esecuzione della query: {result.get('error', 'Errore sconosciuto')}"
                logger.error(f"Errore nell'esecuzione della query: {result.get('error')}")
        
        except Exception as e:
            logger.error(f"Errore in db agent: {str(e)}")
            logger.error(traceback.format_exc())

            response = f"Mi dispiace, c'è stato un errore: {str(e)}"
            
            emit('modelInference', {'status': 'completed', 'userId': user_id or self.default_user_id}, broadcast=True)
            
            return {
                "is_db_intent": True,
                "success": False,
                "response": response,
                "error": str(e)
            }
        
        # Emetti evento completed
        emit('modelInference', {'status': 'completed', 'userId': user_id or self.default_user_id}, broadcast=True)
        
        logger.info(f"Operazione completata con successo. Risposta: {response}")

        return {
            "is_db_intent": True,
            "success": True,
            "response": response,
            "result": result,
            "visualization": visualization if 'visualization' in locals() else None,
            "intent": intent_data
        }
    
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
    
    def _create_visualization(self, title, description, query, data, visualization_type='table'):
        """Crea una visualizzazione per i risultati della query"""
        try:
            url = f"{self.db_api_base_url}/visualizations"
            
            payload = {
                "title": title,
                "description": description,
                "query": query,
                "data": data,
                "type": visualization_type,
                "user_id": self.default_user_id
            }
            
            logger.info(f"Creazione visualizzazione di tipo {visualization_type}")
            response = requests.post(url, json=payload)
            
            if not response.ok:
                logger.error(f"Errore creazione visualizzazione ({response.status_code}): {response.text}")
                return None
                
            visualization = response.json()
            logger.info(f"Visualizzazione creata con ID: {visualization.get('id')}")
            
            return visualization
        except Exception as e:
            logger.error(f"Errore nella creazione della visualizzazione: {str(e)}")
            return None
    
    def _format_response(self, result, visualization):
        """Formatta la risposta per l'utente"""
        if not result.get('success', False):
            return f"Si è verificato un errore: {result.get('error', 'Errore sconosciuto')}"
        
        if not visualization:
            return "Ho eseguito la query, ma non è stato possibile creare una visualizzazione dei risultati."
        
        # Recupera i dettagli della visualizzazione
        viz_id = visualization.get('id')
        viz_type = visualization.get('type', 'table')
        viz_url = f"{self.db_api_base_url}/visualizations/{viz_id}"
        
        # Conta i risultati
        count = len(result.get('results', []))
        
        # Formatta la risposta
        response = f"✅ Ho trovato {count} risultati per la tua query."
        
        if viz_id:
            response += f"\n\nHo creato una visualizzazione di tipo {viz_type} che puoi vedere al seguente link: {viz_url}"
        
        return response
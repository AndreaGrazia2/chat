"""
Agente per l'esecuzione di query sul database dei messaggi della chat.
Converte richieste in linguaggio naturale in query SQL e restituisce i risultati.
"""

import logging
import json
import os
import traceback
from datetime import datetime
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from common.config import CHAT_SCHEMA, DATABASE_URL
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Optional

# Configurazione logging
logger = logging.getLogger('db_query_agent')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

class SQLQuery(BaseModel):
    """Modello per la query SQL generata"""
    query: str = Field(description="La query SQL da eseguire")
    description: str = Field(description="Descrizione in linguaggio naturale di ciò che fa la query")
    parameters: Optional[dict] = Field(default=None, description="Parametri per la query SQL")

class DBQueryAgent:
    """Agente per l'esecuzione di query sul database dei messaggi"""
    
    def __init__(self, model_name="google/gemma-3-27b-it:free"):
        """Inizializza l'agente di query"""
        self.model_name = model_name
        self.engine = create_engine(DATABASE_URL)
        self.Session = sessionmaker(bind=self.engine)
        
        # Inizializza il modello LLM
        self.llm = ChatOpenAI(model=model_name)
        
        # Parser per l'output
        self.parser = PydanticOutputParser(pydantic_object=SQLQuery)
        
        # Carica il prompt template
        self.prompt_template = self._create_prompt_template()
        
        logger.info(f"DBQueryAgent inizializzato con modello {model_name}")
    
    def _create_prompt_template(self):
        """Crea il template per il prompt"""
        template = """
        Sei un assistente esperto in SQL che aiuta a generare query per un database di messaggi di chat.
        
        Schema del database (schema: {schema}):
        
        - users: Tabella degli utenti
          - id: ID utente (chiave primaria)
          - username: Nome utente
          - display_name: Nome visualizzato
          - status: Stato dell'utente (online, offline, ecc.)
        
        - messages: Tabella dei messaggi
          - id: ID messaggio (chiave primaria)
          - conversation_id: ID della conversazione (chiave esterna)
          - user_id: ID dell'utente che ha inviato il messaggio (chiave esterna)
          - text: Testo del messaggio
          - message_type: Tipo di messaggio (normal, file, ecc.)
          - file_data: Dati del file (JSON)
          - created_at: Data e ora di creazione
          - edited: Se il messaggio è stato modificato
          - reply_to_id: ID del messaggio a cui si risponde
        
        - conversations: Tabella delle conversazioni
          - id: ID conversazione (chiave primaria)
          - name: Nome della conversazione
          - type: Tipo di conversazione (direct, channel)
          - created_at: Data e ora di creazione
        
        - conversation_participants: Tabella dei partecipanti alle conversazioni
          - conversation_id: ID della conversazione (chiave esterna)
          - user_id: ID dell'utente partecipante (chiave esterna)
          - joined_at: Data e ora di ingresso
        
        Richiesta dell'utente: {user_query}
        
        Genera una query SQL che risponda alla richiesta dell'utente. La query deve essere sicura, efficiente e rispettare lo schema del database.
        
        {format_instructions}
        """
        
        format_instructions = self.parser.get_format_instructions()
        return ChatPromptTemplate.from_template(template).partial(
            schema=CHAT_SCHEMA,
            format_instructions=format_instructions
        )
    
    def generate_sql_query(self, user_query):
        """Genera una query SQL a partire da una richiesta in linguaggio naturale"""
        try:
            logger.info(f"Generazione query SQL per: {user_query}")
            
            # Crea il messaggio per il modello
            messages = self.prompt_template.format_messages(user_query=user_query)
            
            # Ottieni la risposta dal modello
            response = self.llm.invoke(messages)
            
            # Estrai la query SQL dalla risposta
            sql_query = self.parser.parse(response.content)
            
            logger.info(f"Query SQL generata: {sql_query.query}")
            return sql_query
            
        except Exception as e:
            logger.error(f"Errore nella generazione della query SQL: {str(e)}")
            logger.error(traceback.format_exc())
            raise
    
    def execute_query(self, sql_query):
        """Esegue una query SQL e restituisce i risultati"""
        try:
            logger.info(f"Esecuzione query: {sql_query.query}")
            
            # Crea una sessione
            session = self.Session()
            
            try:
                # Esegui la query
                result = session.execute(text(sql_query.query), sql_query.parameters or {})
                
                # Converti i risultati in un formato serializzabile
                columns = result.keys()
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                
                # Chiudi la sessione
                session.close()
                
                logger.info(f"Query eseguita con successo. Risultati: {len(rows)} righe")
                return {
                    "success": True,
                    "query": sql_query.query,
                    "description": sql_query.description,
                    "columns": list(columns),
                    "rows": rows,
                    "count": len(rows)
                }
                
            except Exception as e:
                session.rollback()
                session.close()
                logger.error(f"Errore nell'esecuzione della query: {str(e)}")
                logger.error(traceback.format_exc())
                return {
                    "success": False,
                    "query": sql_query.query,
                    "error": str(e)
                }
                
        except Exception as e:
            logger.error(f"Errore generale nell'esecuzione della query: {str(e)}")
            logger.error(traceback.format_exc())
            raise
    
    def process_query(self, user_query):
        """Processa una query in linguaggio naturale e restituisce i risultati"""
        try:
            # Genera la query SQL
            sql_query = self.generate_sql_query(user_query)
            
            # Esegui la query
            results = self.execute_query(sql_query)
            
            return results
            
        except Exception as e:
            logger.error(f"Errore nel processamento della query: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }

# Funzione di utilità per test
def test_query(query_text):
    """Funzione per testare l'agente con una query di esempio"""
    agent = DBQueryAgent()
    result = agent.process_query(query_text)
    print(json.dumps(result, indent=2, default=str))
    return result

if __name__ == "__main__":
    # Test dell'agente
    test_query("Mostrami gli ultimi 5 messaggi inviati dall'utente John Doe")
"""
Agente file - Gestione dell'analisi dei file attraverso comandi in linguaggio naturale

Questo modulo fornisce un agente IA che:
1. Analizza i file caricati dagli utenti
2. Estrae informazioni rilevanti
3. Genera risposte naturali per l'utente
"""
import os
import logging
import traceback
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate

# Configurazione del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FileAgent:
    def __init__(self, llm):
        """
        Inizializza l'agente file
        
        Args:
            llm: Modello di linguaggio (LangChain)
        """
        self.llm = llm
        self.default_user_id = 7  # ID dell'utente file_agent
        
        # Crea la chain per l'analisi dei documenti
        self.qa_chain = load_qa_chain(
            llm=self.llm,
            chain_type="stuff",
            prompt=PromptTemplate(
                template="""Sei un assistente specializzato nell'analisi di documenti.
                Analizza il seguente documento e rispondi alla domanda dell'utente.
                
                Documento:
                {context}
                
                Domanda dell'utente:
                {question}
                
                La tua risposta deve essere dettagliata, accurata e basata solo sul contenuto del documento.
                Se non puoi rispondere alla domanda basandoti sul documento, dillo chiaramente.
                """,
                input_variables=["context", "question"]
            )
        )
    
    def process_file(self, file_path, user_query, user_id=None):
        """
        Processa un file e risponde alla query dell'utente
        
        Args:
            file_path: Percorso del file da analizzare
            user_query: Query dell'utente sul file
            user_id: ID dell'utente (opzionale)
            
        Returns:
            dict: Risultato dell'elaborazione con risposta
        """
        logger.info(f"Elaborazione file: {file_path}")
        
        if user_id:
            self.default_user_id = user_id
        
        try:
            # Percorso completo del file
            full_path = os.path.join(os.getcwd(), file_path)
            
            # Carica il documento in base all'estensione
            if file_path.endswith('.pdf'):
                loader = PyPDFLoader(full_path)
            else:
                loader = TextLoader(full_path)
                
            documents = loader.load()
            
            # Dividi il documento in chunk
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            chunks = text_splitter.split_documents(documents)
            
            # Analizza il documento e rispondi alla query
            response = self.qa_chain.run(
                input_documents=chunks,
                question=user_query
            )
            
            return {
                'success': True,
                'response': response,
                'file_path': file_path
            }
            
        except Exception as e:
            logger.error(f"Errore durante l'elaborazione del file: {e}")
            logger.error(traceback.format_exc())
            
            return {
                'success': False,
                'response': f"Mi dispiace, c'è stato un errore durante l'analisi del file: {str(e)}",
                'error': str(e)
            }
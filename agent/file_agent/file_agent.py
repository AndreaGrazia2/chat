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
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
# Usiamo le nuove API di LangChain
from langchain_core.prompts import PromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain

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
        
        # Crea il prompt per l'analisi dei documenti
        prompt_template = """Sei un assistente specializzato nell'analisi di documenti.
        Analizza il seguente documento e rispondi alla domanda dell'utente.
        
        Documento:
        {context}
        
        Domanda dell'utente:
        {question}
        
        La tua risposta deve essere dettagliata, accurata e basata solo sul contenuto del documento.
        Se il documento è un foglio di calcolo o un CSV, fornisci statistiche e riassumi le informazioni chiave.
        Se la domanda richiede un riassunto, fornisci una sintesi concisa ma completa, evidenziando i punti principali.
        Se la domanda richiede informazioni specifiche, fornisci dettagli precisi citando il documento.
        Se non puoi rispondere alla domanda basandoti sul documento, dillo chiaramente.
        
        Assicurati che la tua risposta sia ben strutturata e facile da leggere, utilizzando elenchi puntati o numerati quando appropriato.
        """
        
        # Crea il template del prompt
        prompt = PromptTemplate.from_template(prompt_template)
        
        # Crea la chain per l'analisi dei documenti usando la nuova API
        self.qa_chain = create_stuff_documents_chain(llm=self.llm, prompt=prompt)
    
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
            extension = file_path.lower().split('.')[-1] if '.' in file_path else ''
            
            if extension == 'pdf':
                loader = PyPDFLoader(full_path)
            elif extension in ['csv']:
                loader = CSVLoader(full_path)
            elif extension in ['xls', 'xlsx']:
                loader = UnstructuredExcelLoader(full_path)
            else:
                # Default a text loader per altri tipi di file
                loader = TextLoader(full_path)
                
            documents = loader.load()
            
            # Log della dimensione del documento
            logger.info(f"Documento caricato: {len(documents)} pagine/sezioni")
            
            # Dividi il documento in chunk
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            chunks = text_splitter.split_documents(documents)
            
            logger.info(f"Documento diviso in {len(chunks)} chunks")
            
            # Se non c'è una query specifica, genera una domanda standard in base al tipo di file
            if not user_query or user_query.strip() == '':
                if extension == 'pdf':
                    user_query = "Fammi un riassunto dettagliato di questo PDF"
                elif extension in ['csv', 'xls', 'xlsx']:
                    user_query = "Analizza questo foglio di calcolo e fornisci un riepilogo delle informazioni principali"
                else:
                    user_query = "Analizza questo documento e descrivi di cosa tratta"
            
            # Analizza il documento e rispondi alla query usando la nuova API
            logger.info(f"Esecuzione query: {user_query}")
            response = self.qa_chain.invoke({
                "context": chunks,
                "question": user_query
            })
            
            logger.info("Analisi completata con successo")
            
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
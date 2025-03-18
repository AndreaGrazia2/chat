import time
import json
import psycopg2
from langchain_community.embeddings import OpenAIEmbeddings
from ..base import NodeExecutor
from ...config import OPENAI_API_KEY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

class VectorstoreNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo Vectorstore"""
    
    def execute(self, input_data):
        """Esegue ricerca vettoriale"""
        start_time = time.time()
        
        try:
            # Estrai parametri di configurazione
            collection_name = self.config.get('collection', 'default')
            search_type = self.config.get('search_type', 'similarity')
            top_k = int(self.config.get('top_k', 3))
            
            # Ottieni la query o utilizza una chiave specifica
            query_key = self.config.get('query_key', 'question')
            if query_key in input_data:
                query = input_data[query_key]
            else:
                # Se non c'è una chiave specifica, usa la prima stringa trovata
                for key, value in input_data.items():
                    if isinstance(value, str) and len(value) > 5:
                        query = value
                        break
                else:
                    query = json.dumps(input_data)
            
            # Genera l'embedding della query
            embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
            query_embedding = embeddings.embed_query(query)
            
            # Esegui ricerca nel database
            connection = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
            
            # Se utilizziamo MMR, abbiamo bisogno di una logica diversa
            if search_type.lower() == 'mmr':
                # Implementazione base di MMR - per una versione più avanzata,
                # si può utilizzare direttamente LangChain con PGVector
                # Qui per semplicità usiamo un approccio più diretto
                cursor = connection.cursor()
                cursor.execute(
                    "SELECT * FROM search_similar_documents(%s, %s, %s, 0.5)",
                    (query_embedding, collection_name, top_k * 2)  # Recupera più documenti per diversità
                )
                results = cursor.fetchall()
                
                # Implementazione base di MMR
                # (In un'app reale, utilizzare l'implementazione LangChain completa)
                selected = []
                remaining = list(results)
                
                # Seleziona il primo elemento (più simile)
                if remaining:
                    selected.append(remaining.pop(0))
                
                lambda_param = 0.5  # Bilancia tra rilevanza e diversità
                
                # Seleziona gli elementi successivi
                while len(selected) < top_k and remaining:
                    next_idx = -1
                    max_score = -1
                    
                    for i, doc in enumerate(remaining):
                        similarity = doc[4]  # Similarity score dalla query SQL
                        
                        # Calcolo diversità (distanza massima dagli elementi già selezionati)
                        max_similarity_to_selected = max(
                            [s[4] for s in selected], default=0
                        )
                        
                        # Score MMR = λ * sim(q,d) - (1 - λ) * max(sim(d, d_j))
                        mmr_score = lambda_param * similarity - (1 - lambda_param) * max_similarity_to_selected
                        
                        if mmr_score > max_score:
                            max_score = mmr_score
                            next_idx = i
                    
                    if next_idx >= 0:
                        selected.append(remaining.pop(next_idx))
                    else:
                        break
                
                documents = selected
            else:
                # Ricerca standard per similarità
                cursor = connection.cursor()
                cursor.execute(
                    "SELECT * FROM search_similar_documents(%s, %s, %s, 0.5)",
                    (query_embedding, collection_name, top_k)
                )
                documents = cursor.fetchall()
            
            # Trasforma i risultati in un formato più utile
            results = []
            for doc in documents:
                results.append({
                    "id": doc[1],  # document_id
                    "title": doc[2],  # title
                    "content": doc[3],  # content
                    "similarity": doc[4],  # similarity
                    "metadata": doc[5]  # metadata
                })
            
            # Crea output data
            output_data = {
                **input_data,
                "documents": results,
                "query": query
            }
            
            # Chiudi la connessione
            connection.close()
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message=f"Retrieved {len(results)} documents",
                duration_ms=duration_ms
            )
            
        except Exception as e:
            # Log dell'errore
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = f"Error executing Vectorstore node: {str(e)}"
            self.log_execution(
                input_data=input_data,
                output_data=None,
                status="failed",
                message=error_message,
                duration_ms=duration_ms
            )
            raise
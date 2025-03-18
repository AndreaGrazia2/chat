import time
import json
import requests
from langchain.prompts import PromptTemplate
from ..base import NodeExecutor
from ...config import OPENROUTER_API_KEY, OPENROUTER_API_URL, OPENROUTER_MODEL

class LLMNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo LLM"""
    
    def execute(self, input_data):
        """Esegue un nodo LLM usando OpenRouter API"""
        start_time = time.time()
        
        try:
            # Verifica che l'API key sia configurata
            if not OPENROUTER_API_KEY:
                raise ValueError("OpenRouter API key non configurata")
            
            # Ottieni la configurazione del modello
            model_name = self.config.get('model', OPENROUTER_MODEL)
            temperature = float(self.config.get('temperature', 0.7))
            prompt_template = self.config.get('prompt', '{input}')
            system_prompt = self.config.get('system_prompt', "You are a helpful assistant in a workflow application.")
            
            # Prepara il prompt con i dati di input
            prompt = PromptTemplate.from_template(prompt_template)
            
            # Crea variabili da utilizzare nel template
            variables = {**input_data}
            
            # Formatta il prompt
            formatted_prompt = prompt.format(**variables)
            
            # Prepara il payload per OpenRouter
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": formatted_prompt}
                ],
                "temperature": temperature
            }
            
            # Invia la richiesta a OpenRouter
            response = requests.post(
                OPENROUTER_API_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30
            )
            
            # Verifica la risposta
            response.raise_for_status()
            response_data = response.json()
            
            # Estrai il testo della risposta
            result = response_data['choices'][0]['message']['content']
            
            # Crea output data
            output_data = {**input_data, "llm_response": result}
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message=f"LLM query executed successfully using model: {model_name}",
                duration_ms=duration_ms
            )
            
        except Exception as e:
            # Log dell'errore
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = f"Error executing LLM node: {str(e)}"
            self.log_execution(
                input_data=input_data,
                output_data=None,
                status="failed",
                message=error_message,
                duration_ms=duration_ms
            )
            raise
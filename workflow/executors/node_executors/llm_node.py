import time
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage
from ..base import NodeExecutor
from ...config import OPENAI_API_KEY

class LLMNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo LLM"""
    
    def execute(self, input_data):
        """Esegue un nodo LLM"""
        start_time = time.time()
        
        try:
            # Ottieni la configurazione del modello
            model_name = self.config.get('model', 'gpt-3.5-turbo')
            temperature = float(self.config.get('temperature', 0.7))
            prompt_template = self.config.get('prompt', '{input}')
            
            # Prepara il prompt con i dati di input
            prompt = PromptTemplate.from_template(prompt_template)
            
            # Crea variabili da utilizzare nel template
            # Fondi input_data con eventuali variabili aggiuntive
            variables = {**input_data}
            
            # Gestisci modelli di chat vs modelli di completamento
            if model_name.startswith(('gpt-3.5-turbo', 'gpt-4')):
                llm = ChatOpenAI(
                    model_name=model_name,
                    temperature=temperature,
                    openai_api_key=OPENAI_API_KEY
                )
                # Prepara il messaggio
                formatted_prompt = prompt.format(**variables)
                messages = [HumanMessage(content=formatted_prompt)]
                response = llm.invoke(messages)
                result = response.content
            else:
                llm = OpenAI(
                    model_name=model_name,
                    temperature=temperature,
                    openai_api_key=OPENAI_API_KEY
                )
                formatted_prompt = prompt.format(**variables)
                result = llm.invoke(formatted_prompt)
            
            # Crea output data
            output_data = {**input_data, "llm_response": result}
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message="LLM node executed successfully",
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
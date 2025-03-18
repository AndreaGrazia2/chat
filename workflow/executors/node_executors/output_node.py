# executors/node_executors/output_node.py
import time
from ..base import NodeExecutor

class OutputNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo Output"""
    
    def execute(self, input_data):
        """Formatta l'output finale"""
        start_time = time.time()
        
        try:
            # Ottieni il template di output dalla configurazione
            output_template = self.config.get('template', {})
            
            # Se il template è vuoto, usa l'input come output
            if not output_template:
                output_data = input_data
            else:
                # Altrimenti applica il template
                output_data = {}
                
                for key, template in output_template.items():
                    if isinstance(template, str):
                        # Sostituisci {placeholder} con valori dall'input
                        value = template
                        for input_key, input_value in input_data.items():
                            if isinstance(input_value, (str, int, float, bool)):
                                placeholder = f"{{{input_key}}}"
                                if placeholder in value:
                                    value = value.replace(placeholder, str(input_value))
                        output_data[key] = value
                    else:
                        # Per valori non-stringa, copia semplicemente
                        output_data[key] = template
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message="Output node executed successfully",
                duration_ms=duration_ms
            )
            
        except Exception as e:
            # Log dell'errore
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = f"Error executing Output node: {str(e)}"
            self.log_execution(
                input_data=input_data,
                output_data=None,
                status="failed",
                message=error_message,
                duration_ms=duration_ms
            )
            raise
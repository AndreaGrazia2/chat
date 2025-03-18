# executors/node_executors/condition_node.py
import time
from ..base import NodeExecutor

class ConditionNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo Condition"""
    
    def execute(self, input_data):
        """Valuta una condizione"""
        start_time = time.time()
        
        try:
            # Ottieni la condizione dalla configurazione
            condition_expr = self.config.get('condition', 'True')
            
            # Valuta la condizione nel contesto dei dati di input
            # Nota: questo è un approccio semplice ma in produzione
            # dovresti utilizzare un metodo più sicuro per valutare le espressioni
            condition_result = eval(condition_expr, {"__builtins__": {}}, input_data)
            
            # Aggiungi il risultato della condizione ai dati di output
            output_data = {
                **input_data,
                "condition_result": bool(condition_result)
            }
            
            # Log dell'esecuzione
            duration_ms = int((time.time() - start_time) * 1000)
            return self.log_execution(
                input_data=input_data,
                output_data=output_data,
                status="completed",
                message=f"Condition evaluated to: {condition_result}",
                duration_ms=duration_ms
            )
            
        except Exception as e:
            # Log dell'errore
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = f"Error executing Condition node: {str(e)}"
            self.log_execution(
                input_data=input_data,
                output_data=None,
                status="failed",
                message=error_message,
                duration_ms=duration_ms
            )
            raise
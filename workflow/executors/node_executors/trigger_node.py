import time
from ..base import NodeExecutor

class TriggerNodeExecutor(NodeExecutor):
    """Executor per nodi di tipo Trigger"""
    
    def execute(self, input_data):
        """
        Esegue un nodo di trigger.
        I nodi trigger solitamente passano semplicemente i dati al nodo successivo.
        """
        start_time = time.time()
        
        # Log dell'esecuzione
        duration_ms = int((time.time() - start_time) * 1000)
        return self.log_execution(
            input_data=input_data,
            output_data=input_data,
            status="completed",
            message="Trigger node executed successfully",
            duration_ms=duration_ms
        )
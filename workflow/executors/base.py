class NodeExecutor:
    """Classe base per tutti gli executor di nodi"""
    
    def __init__(self, workflow_execution, node_config):
        self.workflow_execution = workflow_execution
        self.node_config = node_config
        self.node_id = node_config['id']
        self.node_type = node_config['type']
        self.node_name = node_config.get('name', self.node_type.title())
        self.config = node_config.get('config', {})
    
    def execute(self, input_data):
        """
        Metodo principale per eseguire il nodo.
        Deve essere implementato dalle sottoclassi.
        """
        raise NotImplementedError("Deve essere implementato dalle sottoclassi")
    
    def log_execution(self, input_data, output_data, status="completed", 
                     message=None, duration_ms=None):
        """Log dell'esecuzione del nodo"""
        self.workflow_execution.log_node_execution(
            self.node_id, input_data, output_data, status, message, duration_ms
        )
        return output_data
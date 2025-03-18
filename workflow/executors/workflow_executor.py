import time
from importlib import import_module
from ..models.workflow import Workflow, WorkflowExecution
from .node_executors.trigger_node import TriggerNodeExecutor
from .node_executors.llm_node import LLMNodeExecutor
from .node_executors.vectorstore_node import VectorstoreNodeExecutor
from .node_executors.condition_node import ConditionNodeExecutor
from .node_executors.tool_node import ToolNodeExecutor
from .node_executors.output_node import OutputNodeExecutor

class WorkflowExecutor:
    """Classe principale per l'esecuzione di un workflow"""
    
    # Mappa di tipi di nodi agli executor corrispondenti
    NODE_EXECUTOR_MAP = {
        'trigger': TriggerNodeExecutor,
        'llm': LLMNodeExecutor,
        'vectorstore': VectorstoreNodeExecutor,
        'condition': ConditionNodeExecutor,
        'tool': ToolNodeExecutor,
        'output': OutputNodeExecutor
    }
    
    def __init__(self, workflow_id=None, workflow_def=None):
        """
        Inizializza un executor di workflow
        
        Args:
            workflow_id: ID del workflow nel database (opzionale)
            workflow_def: Definizione completa del workflow (opzionale)
        
        Note:
            Deve essere fornito almeno uno tra workflow_id e workflow_def
        """
        if workflow_id:
            # Carica il workflow dal database
            self.workflow = Workflow.get_by_id(workflow_id)
            if not self.workflow:
                raise ValueError(f"Workflow with ID {workflow_id} not found")
            self.workflow_def = self.workflow.json_definition
            self.workflow_id = workflow_id
        elif workflow_def:
            # Usa la definizione fornita
            self.workflow_def = workflow_def
            self.workflow = None
            self.workflow_id = None
        else:
            raise ValueError("Either workflow_id or workflow_def must be provided")
    
    def execute(self, input_data):
        """
        Esegue l'intero workflow
        
        Args:
            input_data: Dati di input per il workflow
            
        Returns:
            Il risultato dell'esecuzione del workflow
        """
        start_time = time.time()
        
        try:
            # Crea una nuova esecuzione
            execution = WorkflowExecution.create(
                workflow_id=self.workflow_id,
                input_data=input_data
            )
            
            # Preparazione dei nodi
            nodes = {node['id']: node for node in self.workflow_def['nodes']}
            connections = self.workflow_def['connections']
            
            # Trova il nodo iniziale (trigger)
            trigger_nodes = [n for n in self.workflow_def['nodes'] if n['type'] == 'trigger']
            if not trigger_nodes:
                raise ValueError("No trigger node found in workflow")
            
            start_node = trigger_nodes[0]
            
            # Esegui il workflow a partire dal nodo trigger
            result = self._process_node(start_node, nodes, connections, input_data, execution)
            
            # Completa l'esecuzione con successo
            execution.complete(result)
            
            return result
            
        except Exception as e:
            execution.fail(str(e))
            raise
    
    def _process_node(self, node, all_nodes, connections, data, execution):
        """
        Elabora un singolo nodo del workflow e passa al successivo
        
        Args:
            node: Definizione del nodo corrente
            all_nodes: Mappa di tutti i nodi (id -> node)
            connections: Lista di connessioni tra nodi
            data: Dati di input per questo nodo
            execution: Istanza WorkflowExecution per tracciamento
            
        Returns:
            Risultato dell'elaborazione del nodo (e dei suoi successivi)
        """
        # Ottieni l'executor appropriato per questo tipo di nodo
        node_type = node['type']
        executor_class = self.NODE_EXECUTOR_MAP.get(node_type)
        
        if not executor_class:
            raise ValueError(f"No executor found for node type: {node_type}")
        
        # Crea l'executor e esegui il nodo
        executor = executor_class(execution, node)
        node_result = executor.execute(data)
        
        # Trova il nodo successivo in base al tipo di nodo corrente
        if node_type == 'condition':
            # Per i nodi condizionali, determina quale percorso seguire
            condition_result = node_result.get('condition_result', False)
            next_node_id = self._get_conditional_next_node(
                node['id'], connections, condition_result
            )
        else:
            # Per tutti gli altri nodi, segui il percorso lineare
            next_node_id = self._get_next_node(node['id'], connections)
        
        # Se c'è un nodo successivo, processalo
        if next_node_id:
            next_node = all_nodes.get(next_node_id)
            if next_node:
                return self._process_node(next_node, all_nodes, connections, node_result, execution)
        
        # Altrimenti restituisci il risultato di questo nodo
        return node_result
    
    def _get_next_node(self, node_id, connections):
        """Trova l'ID del prossimo nodo in base alle connessioni"""
        for conn in connections:
            if conn['source'] == node_id:
                return conn['target']
        return None
    
    def _get_conditional_next_node(self, node_id, connections, condition_result):
        """Trova l'ID del prossimo nodo in base al risultato condizionale"""
        for conn in connections:
            if conn['source'] == node_id:
                condition = conn.get('condition', 'true').lower()
                if (condition == 'true' and condition_result) or \
                   (condition == 'false' and not condition_result):
                    return conn['target']
        return None
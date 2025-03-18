import json
from datetime import datetime
from ..db.connection import get_db_cursor

class Workflow:
    """Modello per rappresentare un workflow"""
    
    def __init__(self, id=None, name=None, description=None, json_definition=None, 
                 is_active=True, created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.description = description
        self.json_definition = json_definition
        self.is_active = is_active
        self.created_at = created_at
        self.updated_at = updated_at
    
    @classmethod
    def get_by_id(cls, workflow_id):
        """Recupera un workflow dal database per ID"""
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM workflows WHERE id = %s",
                (workflow_id,)
            )
            result = cursor.fetchone()
            
            if result:
                return cls.from_db_record(result)
            return None
    
    @classmethod
    def from_db_record(cls, record):
        """Crea un'istanza di Workflow da un record DB"""
        return cls(
            id=record['id'],
            name=record['name'],
            description=record['description'],
            json_definition=record['json_definition'],
            is_active=record['is_active'],
            created_at=record['created_at'],
            updated_at=record['updated_at']
        )
    
    def save(self):
        """Salva il workflow nel database"""
        with get_db_cursor(commit=True) as cursor:
            if self.id:
                # Update
                cursor.execute(
                    """
                    UPDATE workflows
                    SET name = %s, description = %s, json_definition = %s, is_active = %s
                    WHERE id = %s
                    RETURNING id
                    """,
                    (self.name, self.description, json.dumps(self.json_definition), 
                     self.is_active, self.id)
                )
            else:
                # Insert
                cursor.execute(
                    """
                    INSERT INTO workflows (name, description, json_definition, is_active)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (self.name, self.description, json.dumps(self.json_definition), self.is_active)
                )
            
            result = cursor.fetchone()
            if result:
                self.id = result['id']
            return self.id

class WorkflowExecution:
    """Modello per rappresentare l'esecuzione di un workflow"""
    
    def __init__(self, id=None, workflow_id=None, status="running", 
                 started_at=None, completed_at=None, input_data=None, 
                 output_data=None, execution_path=None, error_message=None):
        self.id = id
        self.workflow_id = workflow_id
        self.status = status
        self.started_at = started_at or datetime.now()
        self.completed_at = completed_at
        self.input_data = input_data or {}
        self.output_data = output_data or {}
        self.execution_path = execution_path or []
        self.error_message = error_message
    
    @classmethod
    def create(cls, workflow_id, input_data):
        """Crea una nuova esecuzione nel database"""
        execution = cls(workflow_id=workflow_id, input_data=input_data)
        execution.save()
        return execution
    
    def save(self):
        """Salva l'esecuzione nel database"""
        with get_db_cursor(commit=True) as cursor:
            if self.id:
                # Update
                cursor.execute(
                    """
                    UPDATE workflow_executions
                    SET status = %s, completed_at = %s, output_data = %s, 
                        execution_path = %s, error_message = %s
                    WHERE id = %s
                    RETURNING id
                    """,
                    (self.status, self.completed_at, json.dumps(self.output_data),
                     json.dumps(self.execution_path), self.error_message, self.id)
                )
            else:
                # Insert
                cursor.execute(
                    """
                    INSERT INTO workflow_executions 
                    (workflow_id, status, input_data)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (self.workflow_id, self.status, json.dumps(self.input_data))
                )
            
            result = cursor.fetchone()
            if result:
                self.id = result['id']
            return self.id
    
    def complete(self, output_data):
        """Completa un'esecuzione con successo"""
        self.status = "completed"
        self.completed_at = datetime.now()
        self.output_data = output_data
        self.save()
    
    def fail(self, error_message):
        """Segna un'esecuzione come fallita"""
        self.status = "failed"
        self.completed_at = datetime.now()
        self.error_message = error_message
        self.save()
    
    def log_node_execution(self, node_id, input_data=None, output_data=None, 
                          status="completed", message=None, duration_ms=None):
        """Registra l'esecuzione di un nodo"""
        with get_db_cursor(commit=True) as cursor:
            cursor.execute(
                """
                INSERT INTO execution_logs
                (execution_id, node_id, input_data, output_data, status, message, duration_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (self.id, node_id, json.dumps(input_data or {}), 
                 json.dumps(output_data or {}), status, message, duration_ms)
            )
        
        # Aggiorna anche il percorso di esecuzione
        self.execution_path.append({
            "node_id": node_id,
            "timestamp": datetime.now().isoformat(),
            "status": status
        })
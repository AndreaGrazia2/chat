from flask import Blueprint, request, jsonify, render_template
from ..models.workflow import Workflow, WorkflowExecution
from ..executors.workflow_executor import WorkflowExecutor

# Crea un Blueprint per il workflow
workflow_bp = Blueprint('workflow', __name__, 
                      template_folder='templates',
                      static_folder='static',
                      static_url_path='/workflow/static')

@workflow_bp.route('/')
def index():
    """Renderizza la pagina principale del workflow"""
    return render_template('workflow.html')

@workflow_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve i file statici del workflow"""
    return send_from_directory('workflow/static', filename)

# API routes per il workflow
@workflow_bp.route('/api/workflows')
def get_workflows():
    """API per ottenere i workflow disponibili"""
    from ..db.connection import get_db_cursor
    
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, name, description, is_active, created_at, updated_at FROM workflows")
        workflows = cursor.fetchall()
    
    return jsonify([dict(w) for w in workflows])

@workflow_bp.route('/api/workflows/<int:workflow_id>')
def get_workflow(workflow_id):
    """API per ottenere un workflow specifico"""
    workflow = Workflow.get_by_id(workflow_id)
    
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404
    
    return jsonify({
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "json_definition": workflow.json_definition,
        "is_active": workflow.is_active,
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None
    })

@workflow_bp.route('/api/workflows', methods=['POST'])
def create_workflow():
    """API per creare un nuovo workflow"""
    data = request.json
    
    # Validazione base
    if not data.get('name'):
        return jsonify({"error": "Workflow name is required"}), 400
    
    if not data.get('json_definition'):
        return jsonify({"error": "Workflow definition is required"}), 400
    
    # Crea il workflow
    workflow = Workflow(
        name=data['name'],
        description=data.get('description', ''),
        json_definition=data['json_definition'],
        is_active=data.get('is_active', True)
    )
    
    # Salva nel database
    workflow_id = workflow.save()
    
    return jsonify({
        "id": workflow_id,
        "message": "Workflow created successfully"
    })

@workflow_bp.route('/api/workflows/<int:workflow_id>', methods=['PUT'])
def update_workflow(workflow_id):
    """API per aggiornare un workflow esistente"""
    data = request.json
    
    # Ottieni il workflow esistente
    workflow = Workflow.get_by_id(workflow_id)
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404
    
    # Aggiorna i campi
    if 'name' in data:
        workflow.name = data['name']
    
    if 'description' in data:
        workflow.description = data['description']
    
    if 'json_definition' in data:
        workflow.json_definition = data['json_definition']
    
    if 'is_active' in data:
        workflow.is_active = data['is_active']
    
    # Salva le modifiche
    workflow.save()
    
    return jsonify({
        "message": "Workflow updated successfully"
    })

@workflow_bp.route('/api/workflows/<int:workflow_id>', methods=['DELETE'])
def delete_workflow(workflow_id):
    """API per eliminare un workflow"""
    from ..db.connection import get_db_cursor
    
    with get_db_cursor(commit=True) as cursor:
        # Verifica che il workflow esista
        cursor.execute("SELECT id FROM workflows WHERE id = %s", (workflow_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Workflow not found"}), 404
        
        # Elimina il workflow
        cursor.execute("DELETE FROM workflows WHERE id = %s", (workflow_id,))
    
    return jsonify({
        "message": "Workflow deleted successfully"
    })

@workflow_bp.route('/api/workflows/<int:workflow_id>/execute', methods=['POST'])
def execute_workflow(workflow_id):
    """API per eseguire un workflow specifico"""
    input_data = request.json
    
    try:
        # Crea l'executor per questo workflow
        executor = WorkflowExecutor(workflow_id=workflow_id)
        
        # Esegui il workflow
        result = executor.execute(input_data)
        
        return jsonify({
            "success": True,
            "result": result
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@workflow_bp.route('/api/executions/<int:execution_id>')
def get_execution(execution_id):
    """API per ottenere i dettagli di una specifica esecuzione"""
    from ..db.connection import get_db_cursor
    
    with get_db_cursor() as cursor:
        # Ottieni l'esecuzione
        cursor.execute("""
            SELECT * FROM workflow_executions 
            WHERE id = %s
        """, (execution_id,))
        
        execution = cursor.fetchone()
        if not execution:
            return jsonify({"error": "Execution not found"}), 404
        
        # Ottieni i log di questa esecuzione
        cursor.execute("""
            SELECT * FROM execution_logs 
            WHERE execution_id = %s
            ORDER BY timestamp
        """, (execution_id,))
        
        logs = cursor.fetchall()
    
    # Converte il risultato in un formato appropriato
    result = dict(execution)
    result['logs'] = [dict(log) for log in logs]
    
    # Formatta le date
    for date_field in ['started_at', 'completed_at']:
        if result[date_field]:
            result[date_field] = result[date_field].isoformat()
    
    for log in result['logs']:
        if log['timestamp']:
            log['timestamp'] = log['timestamp'].isoformat()
    
    return jsonify(result)
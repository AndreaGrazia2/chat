from flask import Blueprint, request, jsonify, render_template, send_from_directory
from workflow.models.workflow import Workflow, WorkflowExecution
from workflow.executors.workflow_executor import WorkflowExecutor
import json
import time

# Create Blueprint for workflow
workflow_bp = Blueprint('workflow', __name__, 
                        template_folder='../templates',
                        static_folder='../static',
                        static_url_path='/static')

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
            "result": result,
            "execution_id": executor.execution.id
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@workflow_bp.route('/api/executions/<int:execution_id>', methods=['GET'])
def get_execution(execution_id):
    """API per ottenere i dettagli di un'esecuzione specifica"""
    from ..models.workflow import WorkflowExecution
    
    try:
        # Ottieni l'esecuzione dal database
        execution = WorkflowExecution.get_by_id(execution_id)
        
        if not execution:
            return jsonify({"error": f"Execution with ID {execution_id} not found"}), 404
        
        # Formatta la risposta
        response = {
            "id": execution.id,
            "workflow_id": execution.workflow_id,
            "status": execution.status,
            "started_at": execution.started_at.isoformat() if execution.started_at else None,
            "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
            "input_data": execution.input_data,
            "output_data": execution.output_data,
            "execution_path": execution.execution_path,
            "error_message": execution.error_message,
            "logs": []  # Aggiungeremo i log se disponibili
        }
        
        # Ottieni i log dell'esecuzione se disponibili
        try:
            logs = execution.get_logs()
            if logs:
                response["logs"] = logs
        except Exception as log_error:
            print(f"Error fetching logs: {str(log_error)}")
        
        return jsonify(response)
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in get_execution: {str(e)}\n{error_traceback}")
        return jsonify({
            "error": f"Failed to fetch execution details: {str(e)}",
            "function": "get_execution",
            "route": f"/workflow/api/executions/{execution_id}"
        }), 500

@workflow_bp.route('/api/executions')
def get_executions():
    """API per ottenere tutte le esecuzioni dei workflow, con paginazione"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        workflow_id = request.args.get('workflow_id')
        
        from ..db.connection import get_db_cursor
        
        with get_db_cursor() as cursor:
            # Costruisci la query di base
            query = """
                SELECT id, workflow_id, status, started_at, completed_at, 
                       COALESCE(error_message, '') as error_message
                FROM workflow_executions
            """
            
            params = []
            count_query = "SELECT COUNT(*) as count FROM workflow_executions"
            
            # Filtra per workflow_id se richiesto
            if workflow_id:
                query += " WHERE workflow_id = %s"
                count_query += " WHERE workflow_id = %s"
                params.append(int(workflow_id))
            
            # Aggiungi ordinamento e paginazione
            query += " ORDER BY started_at DESC LIMIT %s OFFSET %s"
            params.extend([per_page, (page - 1) * per_page])
            
            # Esegui la query principale
            cursor.execute(query, params)
            executions = cursor.fetchall()
            
            # Conta il totale di record per la paginazione
            count_params = [int(workflow_id)] if workflow_id else []
            cursor.execute(count_query, count_params)
            result = cursor.fetchone()
            total_count = result['count']  # Use the column name instead of index
        
        # Formatta le date
        for execution in executions:
            for date_field in ['started_at', 'completed_at']:
                if execution[date_field]:
                    execution[date_field] = execution[date_field].isoformat()
        
        return jsonify({
            "executions": [dict(e) for e in executions],
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "pages": (total_count + per_page - 1) // per_page
        })
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Errore nella funzione get_executions: {str(e)}\n{error_traceback}")
        return jsonify({
            "error": f"Si è verificato un errore nel recupero delle esecuzioni: {str(e)}",
            "function": "get_executions",
            "route": "/api/executions"
        }), 500

@workflow_bp.route('/api/executions/<int:execution_id>/logs/stream')
def stream_execution_logs(execution_id):
    """API per ottenere i log di esecuzione in streaming (polling)"""
    last_log_id = request.args.get('last_id', 0)
    try:
        last_log_id = int(last_log_id)
    except ValueError:
        last_log_id = 0
    
    from ..db.connection import get_db_cursor
    
    with get_db_cursor() as cursor:
        # Verifica che l'esecuzione esista
        cursor.execute("SELECT id, status FROM workflow_executions WHERE id = %s", (execution_id,))
        execution = cursor.fetchone()
        
        if not execution:
            return jsonify({"error": "Execution not found"}), 404
        
        # Ottieni i nuovi log dall'ultimo ID
        cursor.execute("""
            SELECT * FROM execution_logs 
            WHERE execution_id = %s AND id > %s
            ORDER BY id
        """, (execution_id, last_log_id))
        
        logs = cursor.fetchall()
    
    # Formatta i log
    formatted_logs = []
    for log in logs:
        log_dict = dict(log)
        if log_dict['timestamp']:
            log_dict['timestamp'] = log_dict['timestamp'].isoformat()
        formatted_logs.append(log_dict)
    
    return jsonify({
        "logs": formatted_logs,
        "execution_status": execution['status'],
        "is_completed": execution['status'] in ['completed', 'failed']
    })

# Rotte per la visualizzazione UI
@workflow_bp.route('/editor', strict_slashes=False)
def editor():
    """Pagina dell'editor di workflow"""
    return render_template('workflow.html')

@workflow_bp.route('/monitor', strict_slashes=False)
def monitor():
    """Pagina di monitoraggio delle esecuzioni"""
    try:
        return render_template('workflow_monitor.html')
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Errore nella route /monitor: {str(e)}\n{error_traceback}")
        return jsonify({
            "error": f"Si è verificato un errore nel caricamento della pagina di monitoraggio: {str(e)}",
            "function": "monitor",
            "route": "/workflow/monitor"
        }), 500

@workflow_bp.route('/executions/<int:execution_id>/view', strict_slashes=False)
@workflow_bp.route('/executions/<int:execution_id>', methods=['GET'])
def view_execution_page(execution_id):
    """Pagina per visualizzare i dettagli di un'esecuzione"""
    # Make sure execution_id is passed as a string to the template
    return render_template('workflow_execution.html', execution_id=str(execution_id))
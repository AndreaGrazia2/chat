from flask import Blueprint, render_template, jsonify, request, send_from_directory
from common.config import SECRET_KEY

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
    # Implementazione futura: recuperare i workflow da un database
    return jsonify([])

@workflow_bp.route('/api/workflows/<workflow_id>/execute', methods=['POST'])
def execute_workflow(workflow_id):
    """API per eseguire un workflow specifico"""
    # Implementazione futura: eseguire il workflow
    return jsonify({"success": True, "message": "Workflow eseguito con successo"})
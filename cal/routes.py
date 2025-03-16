from flask import Blueprint, render_template, jsonify, request, send_from_directory
from common.config import SECRET_KEY

# Crea un Blueprint per il calendario
calendar_bp = Blueprint('calendar', __name__, 
                      template_folder='templates',
                      static_folder='static',
                      static_url_path='/cal/static')

@calendar_bp.route('/')
def index():
    """Renderizza la pagina principale del calendario"""
    return render_template('calendar.html')

@calendar_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve i file statici del calendario"""
    return send_from_directory('cal/static', filename)

# API routes per il calendario
@calendar_bp.route('/api/events')
def get_events():
    """API per ottenere gli eventi del calendario"""
    # Implementazione futura: recuperare gli eventi da un database
    # Per ora restituiamo un array vuoto
    return jsonify([])

@calendar_bp.route('/api/events', methods=['POST'])
def create_event():
    """API per creare un nuovo evento"""
    event_data = request.json
    # Implementazione futura: salvare l'evento in un database
    return jsonify({"success": True, "message": "Evento creato con successo"})

@calendar_bp.route('/api/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    """API per aggiornare un evento esistente"""
    event_data = request.json
    # Implementazione futura: aggiornare l'evento nel database
    return jsonify({"success": True, "message": "Evento aggiornato con successo"})

@calendar_bp.route('/api/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    """API per eliminare un evento"""
    # Implementazione futura: eliminare l'evento dal database
    return jsonify({"success": True, "message": "Evento eliminato con successo"})
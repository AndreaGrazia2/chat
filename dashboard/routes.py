from flask import Blueprint, render_template, send_from_directory, jsonify
from chat.models import Message

# Crea un Blueprint per la dashboard
dashboard_bp = Blueprint('dashboard', __name__, 
                        template_folder='templates',
                        static_folder='static',
                        static_url_path='/dashboard/static')

@dashboard_bp.route('/')
def index():
    """Renderizza la pagina principale della dashboard"""
    return render_template('dashboard.html')

@dashboard_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve i file statici della dashboard"""
    return send_from_directory('dashboard/static', filename)

# Funzioni di utilità specifiche per la dashboard
def get_dashboard_data():
    """Recupera i dati per la dashboard"""
    try:
        # Import the database connection from common module
        from common.db.connection import get_engine
        from sqlalchemy import text
        
        # Get the engine with the chat schema
        engine = get_engine(schema='chat_schema')
        
        # Execute direct SQL query to count messages
        with engine.connect() as connection:
            result = connection.execute(text("SELECT COUNT(*) FROM chat_schema.messages"))
            messages_count = result.scalar()
        
        return {
            'users_count': 0,  # Implementazione futura
            'messages_count': messages_count,
            'active_channels': 0  # Implementazione futura
        }
    except Exception as e:
        print(f"Error counting messages: {str(e)}")
        return {
            'users_count': 0,
            'messages_count': 0,
            'active_channels': 0,
            'error': str(e)
        }

# API routes per la dashboard
@dashboard_bp.route('/api/stats')
def get_stats():
    """API per ottenere le statistiche della dashboard"""
    try:
        data = get_dashboard_data()
        print("Dashboard data:", data)  # Debug print
        return jsonify(data)
    except Exception as e:
        print("Error getting dashboard stats:", str(e))  # Debug print
        return jsonify({"error": str(e)}), 500
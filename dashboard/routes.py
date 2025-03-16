from flask import Blueprint, render_template, send_from_directory

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
    # Implementazione futura
    return {
        'users_count': 0,
        'messages_count': 0,
        'active_channels': 0
    }

# API routes per la dashboard
@dashboard_bp.route('/api/dashboard/stats')
def get_stats():
    """API per ottenere le statistiche della dashboard"""
    return get_dashboard_data()
import gevent.monkey
gevent.monkey.patch_all()

import os
import sys
from flask import Flask, request, jsonify, redirect, Blueprint
from flask_socketio import SocketIO
from dotenv import load_dotenv

# Imposta un limite di ricorsione sicura
sys.setrecursionlimit(1000)

# Verifica che gevent-websocket sia installato
try:
    import geventwebsocket
    print("gevent-websocket è installato correttamente")
except ImportError:
    print("ERRORE: gevent-websocket non è installato!")

# Carica le variabili d'ambiente
load_dotenv()

# Importa i blueprint
from chat.routes import chat_bp
from cal.routes import calendar_bp
from dashboard.routes import dashboard_bp

# Importa i gestori di eventi Socket.IO
from chat.handlers import register_handlers

# Crea l'applicazione Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')

# Create a blueprint for common static files
common_static = Blueprint('common_static', __name__, 
                         static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'common/static'),
                         static_url_path='/common')

# Register the common static blueprint
app.register_blueprint(common_static)

# Add common templates to Jinja search path
app.jinja_loader.searchpath.append(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'common/templates')
)


# Configura Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*",
                    async_mode='gevent', ping_timeout=60, ping_interval=25)

# Registra i blueprint
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(calendar_bp, url_prefix='/cal')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')

# Registra i gestori di eventi Socket.IO
register_handlers(socketio)

# Gestore eccezioni per Flask
@app.errorhandler(Exception)
def handle_exception(e):
    """Gestisce tutte le eccezioni non catturate"""
    # Registra l'errore
    print(f"Errore non gestito: {str(e)}")
    # Se è una richiesta API, restituisce un errore JSON
    if request.path.startswith('/api/'):
        return jsonify({"error": "Internal server error", "message": str(e)}), 500
    # Altrimenti reindirizza alla pagina principale della chat
    return redirect('/chat/')

# Gestore errori per Socket.IO
@socketio.on_error()
def error_handler(e):
    """Gestisce le eccezioni durante le operazioni Socket.IO"""
    print(f"Socket.IO error: {str(e)}")

# Rotta principale che reindirizza alla chat
@app.route('/')
def index():
    """Reindirizza alla pagina principale della chat"""
    return redirect('/chat/')

# Add this after your Flask app initialization
@app.errorhandler(404)
def page_not_found(e):
    # Get the requested URL
    requested_url = request.url
    
    # Log the 404 error with just the file path and referrer
    print(f"404 Not Found: {requested_url}")
    if request.referrer:
        print(f"Referrer: {request.referrer}")
    
    # Return the standard 404 response
    return f"404 Not Found: {requested_url}", 404

# Avvio dell'applicazione
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    # In modalità sviluppo, usa il server integrato di Flask
    if os.getenv('FLASK_ENV') == 'development':
        print(f"Avvio del server di sviluppo su http://0.0.0.0:{port}")
        socketio.run(app, host='0.0.0.0', port=port, debug=True, use_reloader=False)
    else:
        # In produzione, il server sarà gestito da Gunicorn
        # Questo codice non verrà eseguito quando si usa Gunicorn
        print(f"Avvio del server in modalità produzione su http://0.0.0.0:{port}")
        socketio.run(app, host='0.0.0.0', port=port, debug=False)
import gevent.monkey
gevent.monkey.patch_all()

import os
import sys
from flask import Flask, request, jsonify, redirect, Blueprint
from flask_socketio import SocketIO

# Imposta un limite di ricorsione sicura
sys.setrecursionlimit(1000)

# Importa la configurazione centralizzata
from common.config import SECRET_KEY, DEBUG, PORT, FLASK_ENV, log_config_info

# Verifica che gevent-websocket sia installato
try:
    import geventwebsocket
    print("gevent-websocket è installato correttamente")
except ImportError:
    print("ERRORE: gevent-websocket non è installato!")

# Importa i blueprint
from chat.routes import chat_bp
from cal.routes import calendar_bp
from dashboard.routes import dashboard_bp

# Importa i gestori di eventi Socket.IO
from chat.handlers import register_handlers

# Crea l'applicazione Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY

# Crea un blueprint per i file statici comuni
common_static = Blueprint('common_static', __name__, 
                         static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'common/static'),
                         static_url_path='/common')

# Registra il blueprint degli elementi statici comuni
app.register_blueprint(common_static)

# Inizializza gli schemi del database
import logging
logger = logging.getLogger(__name__)
logger.info("L'inizializzazione automatica del database è disabilitata")


# Aggiungi i template comuni al percorso di ricerca di Jinja
app.jinja_loader.searchpath.append(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'common/templates')
)

# Configura Socket.IO con le impostazioni per una migliore stabilità
socketio = SocketIO(app, cors_allowed_origins="*",
                    async_mode='gevent', 
                    ping_timeout=60, 
                    ping_interval=25)

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

# Gestore per le pagine non trovate (404)
@app.errorhandler(404)
def page_not_found(e):
    # Ottieni l'URL richiesto
    requested_url = request.url
    
    # Registra l'errore 404 con il percorso del file e il referrer
    print(f"404 Not Found: {requested_url}")
    if request.referrer:
        print(f"Referrer: {request.referrer}")
    
    # Restituisci la risposta 404 standard
    return f"404 Not Found: {requested_url}", 404

# Funzione per creare l'applicazione Flask (per Gunicorn)
def create_app():
    """Restituisce l'applicazione Flask configurata per Gunicorn"""
    # Registra informazioni di configurazione
    log_config_info()
    return app

# Avvio dell'applicazione
if __name__ == '__main__':
    # Registra informazioni di configurazione
    log_config_info()
    
    # In modalità sviluppo, usa il server integrato di Flask
    if FLASK_ENV == 'development':
        print(f"Avvio del server di sviluppo su http://0.0.0.0:{PORT}")
        socketio.run(app, host='0.0.0.0', port=PORT, debug=DEBUG, use_reloader=False)
    else:
        # In produzione, il server sarà gestito da Gunicorn
        # Questo codice non verrà eseguito quando si usa Gunicorn
        print(f"Avvio del server in modalità produzione su http://0.0.0.0:{PORT}")
        socketio.run(app, host='0.0.0.0', port=PORT, debug=False)
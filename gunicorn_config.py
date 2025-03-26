import os
import gevent.monkey
gevent.monkey.patch_all()  # Esegui il monkey patching PRIMA dell'importazione di altri moduli

# Configurazione per il server Gunicorn
port = int(os.environ.get("PORT", 10000))
bind = f"0.0.0.0:{port}"

workers = 4
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
timeout = 120
keepalive = 5
loglevel = "info"  # Modifica a "debug" solo per la risoluzione dei problemi

# Imposta l'applicazione per Gunicorn
wsgi_app = "app:create_app()"
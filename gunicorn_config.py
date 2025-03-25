import os
import gevent.monkey
gevent.monkey.patch_all()  # Esegui il monkey patching PRIMA dell'importazione di altri moduli

# Configurazione per il server Gunicorn
bind = "0.0.0.0:" + os.getenv("PORT", "10000")
workers = 1
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
timeout = 120
keepalive = 5
loglevel = "info"  # Modifica a "debug" solo per la risoluzione dei problemi

# Imposta l'applicazione per Gunicorn
wsgi_app = "app:create_app()"
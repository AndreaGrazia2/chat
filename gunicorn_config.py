import os
import gevent.monkey
gevent.monkey.patch_all()  # Esegui il monkey patching PRIMA dell'importazione di altri moduli

# Configurazione per il server Gunicorn
port = int(os.environ.get("PORT", 10000))
bind = f"0.0.0.0:{port}"

# Ridotto a 1 worker per evitare problemi con Socket.IO
workers = 1
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"  # Worker specifico per WebSocket
timeout = 120
keepalive = 5
loglevel = "debug"  # Temporaneamente impostato a debug per vedere più dettagli

# Imposta l'applicazione per Gunicorn
wsgi_app = "wsgi:app"  # Torniamo a usare l'app standard
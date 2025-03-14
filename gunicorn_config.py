import os
import gevent.monkey
gevent.monkey.patch_all()  # Esegui il monkey patching PRIMA dell'importazione di altri moduli

bind = "0.0.0.0:" + os.getenv("PORT", "5000")
workers = 1
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
timeout = 120
keepalive = 5
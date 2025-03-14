#!/bin/bash

# Attiva l'ambiente virtuale se esiste
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Imposta le variabili d'ambiente
export FLASK_ENV=production
export PORT=5000

# Avvia Gunicorn con la configurazione
exec gunicorn -c gunicorn_config.py app:app
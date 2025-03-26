#!/bin/bash

# Attiva l'ambiente virtuale se esiste
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Imposta le variabili d'ambiente per sviluppo locale
export FLASK_ENV=development
export DEBUG=true
export PORT=5000

# Determina se utilizzare app.py direttamente (sviluppo) o Gunicorn (produzione)
if [ "$FLASK_ENV" = "development" ]; then
    echo "Avvio in modalità sviluppo con Flask..."
    python app.py
else
    echo "Avvio in modalità produzione con Gunicorn..."
    exec gunicorn -c gunicorn_config.py wsgi:app
fi
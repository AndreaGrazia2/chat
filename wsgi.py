"""
Punto di ingresso WSGI per l'applicazione su Render.
Questo file viene eseguito da Gunicorn quando l'app viene avviata su Render.
"""
import gevent.monkey
gevent.monkey.patch_all()

import os
import sys
from dotenv import load_dotenv

# Assicurati che i path siano corretti indipendentemente da dove viene eseguito
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# Carica le variabili d'ambiente se esiste un file .env
if os.path.exists(os.path.join(BASE_DIR, '.env')):
    load_dotenv(os.path.join(BASE_DIR, '.env'))

# Verifica il corretto caricamento delle variabili d'ambiente
print(f"ENV: {os.getenv('FLASK_ENV', 'Not set')}")
print(f"DEBUG: {os.getenv('DEBUG', 'False')}")
print(f"Database host: {os.getenv('DB_HOST', 'Not set')}")

# Dopo il caricamento delle variabili d'ambiente
print(f"DATABASE_URL: {'***PRESENTE***' if os.getenv('DATABASE_URL') else 'NON IMPOSTATO'}")
if os.getenv('DATABASE_URL'):
    # Mostra solo i primi 20 caratteri per sicurezza
    print(f"DATABASE_URL inizia con: {os.getenv('DATABASE_URL')[:20]}...")
print(f"DB_HOST: {os.getenv('DB_HOST', 'Non impostato')}")
print(f"DB_PORT: {os.getenv('DB_PORT', 'Non impostato')}")
print(f"DB_NAME: {os.getenv('DB_NAME', 'Non impostato')}")
# Importa la funzione per creare l'app
from app import create_app

# Crea l'applicazione Flask
application = create_app()

# Definisci app come alias di application (convenzione WSGI standard)
app = application

if __name__ == "__main__":
    print("Questo file non dovrebbe essere eseguito direttamente.")
    print("Usare 'gunicorn wsgi:app' per avviare l'app con Gunicorn.")
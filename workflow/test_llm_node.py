import os
import sys
import time
import json
import requests
from dotenv import load_dotenv
from pathlib import Path

# Carica variabili d'ambiente dalla root
root_dir = Path(__file__).parent.parent
load_dotenv(os.path.join(root_dir, '.env'))

# Ottieni la configurazione direttamente dall'ambiente
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-3-27b-it:free")

# Verifica che l'API key sia impostata
if not OPENROUTER_API_KEY:
    print("Errore: OPENROUTER_API_KEY non configurata nel file .env")
    sys.exit(1)

print(f"Usando API key: {OPENROUTER_API_KEY[:5]}... (nascosta per sicurezza)")
print(f"Usando modello: {OPENROUTER_MODEL}")

# Funzione di test semplificata
def test_openrouter_api():
    start_time = time.time()
    
    try:
        # Prepara il payload per OpenRouter
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": "Sei un assistente esperto in Python."},
                {"role": "user", "content": "Quali sono i vantaggi di usare list comprehension in Python? Rispondi brevemente."}
            ],
            "temperature": 0.7
        }
        
        print("Invio richiesta a OpenRouter...")
        # Invia la richiesta a OpenRouter
        response = requests.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )
        
        # Verifica la risposta
        response.raise_for_status()
        response_data = response.json()
        
        # Estrai il testo della risposta
        result = response_data['choices'][0]['message']['content']
        
        duration_ms = int((time.time() - start_time) * 1000)
        print(f"\nRisposta ricevuta in {duration_ms}ms:")
        print("-" * 50)
        print(result)
        print("-" * 50)
        print("\nTest completato con successo!")
        
    except Exception as e:
        print(f"\nErrore durante il test: {str(e)}")

# Esegui il test
if __name__ == "__main__":
    test_openrouter_api()
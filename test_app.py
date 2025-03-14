import pytest
import sys
import os
import json
from datetime import datetime

# Aggiungi la directory principale al path per importare app.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Importa l'app Flask e le altre funzioni/variabili necessarie
from app import app, users, channels, messages, get_llm_response

@pytest.fixture
def client():
    """Crea un client di test per l'app Flask"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    """Verifica che la route principale restituisca la pagina HTML"""
    response = client.get('/')
    assert response.status_code == 200

def test_get_users(client):
    """Verifica che l'API /api/users restituisca la lista degli utenti"""
    response = client.get('/api/users')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]['name'] == 'You'  # Il primo utente dovrebbe essere "You"

def test_get_channels(client):
    """Verifica che l'API /api/channels restituisca la lista dei canali"""
    response = client.get('/api/channels')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    # Verifica che esista almeno un canale chiamato "general"
    assert any(channel['name'] == 'general' for channel in data)

def test_get_channel_messages(client):
    """Verifica che l'API /api/messages/channel/<channel_name> funzioni"""
    # Test con un canale esistente
    response = client.get('/api/messages/channel/general')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    
    # Test con un canale inesistente
    response = client.get('/api/messages/channel/nonexistent')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == []

def test_get_dm_messages(client):
    """Verifica che l'API /api/messages/dm/<user_id> funzioni"""
    # Test con un utente esistente
    response = client.get('/api/messages/dm/2')  # Assumiamo che l'utente con ID 2 esista
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)

def test_llm_response():
    """Verifica che la funzione get_llm_response restituisca una risposta"""
    # Se non c'è una API key configurata, dovrebbe restituire un messaggio di errore
    response = get_llm_response("Test message")
    assert isinstance(response, str)
    assert len(response) > 0

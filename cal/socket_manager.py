"""
Gestione delle connessioni Socket.IO per il calendario
"""
import logging
from flask import request
from flask_socketio import join_room, leave_room

# Configura il logging
logger = logging.getLogger(__name__)

def register_calendar_handlers(socketio):
    """
    Registra i gestori di eventi Socket.IO per il calendario
    """
    @socketio.on('connect')
    def handle_connect():
        logger.info(f"Nuovo client connesso: {request.sid}")
    
    @socketio.on('calendar_join_room')
    def handle_join_room(company_id):
        """Gestisce un client che si unisce a una room specifica"""
        if company_id:
            room = f"company-{company_id}"
            join_room(room)
            logger.info(f"Client {request.sid} si è unito alla room: {room}")
    
    logger.info("Socket.IO handlers del calendario registrati")

"""
Miglioramento della funzione emit_calendar_update in socket_manager.py
per garantire una corretta serializzazione dei dati e un formato uniforme
"""

def emit_calendar_update(action, data, company_id=None):
    """
    Emette un evento di aggiornamento del calendario
    
    Args:
        action: Tipo di azione ('create', 'update', 'delete')
        data: Dati dell'evento modificato
        company_id: ID dell'azienda (per filtro multi-aziendale, opzionale)
    """
    # Importa socketio dal modulo principale per evitare dipendenze circolari
    from app import socketio
    import json
    
    # Assicurati che i dati siano serializzabili
    if hasattr(data, 'to_dict'):
        # Se l'oggetto ha un metodo to_dict, usalo
        event_data_dict = data.to_dict()
    elif isinstance(data, dict):
        # Se è già un dizionario, usalo direttamente
        event_data_dict = data
    else:
        # Altrimenti, converti in stringa l'ID
        event_data_dict = {'id': str(data)}
        
    # Assicurati che l'ID sia sempre una stringa
    if 'id' in event_data_dict and not isinstance(event_data_dict['id'], str):
        event_data_dict['id'] = str(event_data_dict['id'])
    
    # Log dettagliato dei dati che stiamo emettendo
    logger.info(f"Emissione evento calendario {action} con dati: {json.dumps(event_data_dict, default=str)}")
    
    event_data = {
        'type': 'calendar_update',
        'action': action,
        'data': event_data_dict
    }
    
    # Se è specificato un company_id, emetti solo alla room dell'azienda
    if company_id:
        logger.info(f"Emissione evento calendario a company-{company_id}: {action}")
        socketio.emit('calendarEvent', event_data, room=f"company-{company_id}")
    else:
        # Altrimenti emetti a tutti
        logger.info(f"Emissione evento calendario globale: {action}")
        socketio.emit('calendarEvent', event_data)
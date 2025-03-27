"""
Gestione delle connessioni Socket.IO per il calendario
"""
import logging
from flask import request
from flask_socketio import join_room, leave_room

# Configura il logging
logger = logging.getLogger(__name__)

# Riferimento globale all'oggetto socketio
_socketio = None

def register_calendar_handlers(socketio):
    """
    Registra i gestori di eventi Socket.IO per il calendario
    """
    global _socketio
    # Salva il riferimento a socketio per uso futuro
    _socketio = socketio
    
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

def emit_calendar_update(action, data, company_id=None):
    """
    Emette un evento di aggiornamento del calendario
    """
    # Usa la variabile globale invece di importare da app
    global _socketio
    import json
    
    if _socketio is None:
        logger.error("Socket.IO non inizializzato. Impossibile emettere eventi.")
        return False
    
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
    
    try:
        # IMPORTANTE: Aggiungiamo una traccia del socketio
        logger.info(f"Socket ID: {id(_socketio)}, Socket clients: {len(_socketio.server.eio.sockets) if hasattr(_socketio, 'server') and hasattr(_socketio.server, 'eio') else 'unknown'}")
        
        # Se è specificato un company_id, emetti solo alla room dell'azienda
        if company_id:
            logger.info(f"Emissione evento calendario a company-{company_id}: {action}")
            _socketio.emit('calendarEvent', event_data, room=f"company-{company_id}")
        else:
            # Altrimenti emetti a tutti
            logger.info(f"Emissione evento calendario globale: {action}")
            _socketio.emit('calendarEvent', event_data)
            
        logger.info("Evento emesso con successo")
        return True
    except Exception as e:
        logger.error(f"Errore durante l'emissione dell'evento: {str(e)}")
        return False
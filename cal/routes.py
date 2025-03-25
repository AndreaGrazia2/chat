from datetime import datetime, timedelta
import uuid
import logging
from flask import Blueprint, render_template, jsonify, request, send_from_directory, current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_, or_, func
from dateutil import parser
from contextlib import contextmanager

from .database import SessionLocal
from .models import Event, User, Category
from common.db.connection import get_db_session

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Context manager per ottenere una sessione del database
@contextmanager
def get_db():
    """Context manager per ottenere una sessione del database"""
    with get_db_session(SessionLocal) as db:
        yield db

# Crea un Blueprint per il calendario
calendar_bp = Blueprint('calendar', __name__, 
                      template_folder='templates',
                      static_folder='static',
                      static_url_path='/cal/static')

@calendar_bp.route('/')
def index():
    """Renderizza la pagina principale del calendario"""
    return render_template('calendar.html')

@calendar_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve i file statici del calendario"""
    return send_from_directory('cal/static', filename)

# API routes per il calendario
@calendar_bp.route('/api/events')
def get_events():
    """API per ottenere gli eventi del calendario
    
    Parametri:
    - start: Data di inizio (formato ISO)
    - end: Data di fine (formato ISO)
    - user_id: ID dell'utente (opzionale, default a un ID di test)
    """
    try:
        # Ottieni i parametri dalla query
        start_str = request.args.get('start', None)
        end_str = request.args.get('end', None)
        user_id_str = request.args.get('user_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')  # ID utente demo
        
        # Converte le stringhe in date
        start_date = parser.parse(start_str) if start_str else (datetime.now() - timedelta(days=30))
        end_date = parser.parse(end_str) if end_str else (datetime.now() + timedelta(days=60))
        user_id = uuid.UUID(user_id_str)
        
        # Usa il context manager per la sessione
        with get_db() as db:
            # Query per gli eventi dell'utente nel periodo specificato
            events = db.query(Event).filter(
                and_(
                    Event.user_id == user_id,
                    or_(
                        and_(Event.start_date >= start_date, Event.start_date <= end_date),
                        and_(Event.end_date >= start_date, Event.end_date <= end_date),
                        and_(Event.start_date <= start_date, Event.end_date >= end_date)
                    )
                )
            ).all()
            
            # Converte gli eventi in dizionari
            events_list = [
                {
                    "id": str(event.id),
                    "titolo": event.title,
                    "descrizione": event.description,
                    "dataInizio": event.start_date.isoformat(),
                    "dataFine": event.end_date.isoformat(),
                    "categoria": event.category_id,
                    "location": event.location,
                    "creato": event.created_at.isoformat() if event.created_at else None,
                    "modificato": event.updated_at.isoformat() if event.updated_at else None
                } for event in events
            ]
        
        return jsonify(events_list)
    
    except Exception as e:
        logger.error(f"Errore durante il recupero degli eventi: {str(e)}")
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/api/events', methods=['POST'])
def create_event():
    """API per creare un nuovo evento"""
    try:
        # Ottieni i dati dalla richiesta
        event_data = request.json
        user_id_str = event_data.get('user_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')  # ID utente demo
        
        # Converte le stringhe di data in oggetti datetime
        start_date = parser.parse(event_data.get('dataInizio'))
        end_date = parser.parse(event_data.get('dataFine'))
        
        # Usa il context manager per la sessione
        with get_db() as db:
            # Crea un nuovo evento nel database
            new_event = Event(
                user_id=uuid.UUID(user_id_str),
                title=event_data.get('titolo'),
                description=event_data.get('descrizione', ''),
                start_date=start_date,
                end_date=end_date,
                category_id=event_data.get('categoria', 'personal'),
                location=event_data.get('location', ''),
                all_day=event_data.get('allDay', False),
                is_recurring=event_data.get('isRecurring', False),
                recurrence_rule=event_data.get('recurrenceRule', None),
                is_public=event_data.get('isPublic', False),
                color=event_data.get('color', None)
            )
            
            db.add(new_event)
            db.flush()  # Per ottenere l'ID generato prima del commit
            
            # Prepara la risposta
            response = {
                "success": True,
                "message": "Evento creato con successo",
                "id": str(new_event.id),
                "evento": {
                    "id": str(new_event.id),
                    "titolo": new_event.title,
                    "descrizione": new_event.description,
                    "dataInizio": new_event.start_date.isoformat(),
                    "dataFine": new_event.end_date.isoformat(),
                    "categoria": new_event.category_id,
                    "location": new_event.location,
                    "creato": new_event.created_at.isoformat() if new_event.created_at else None
                }
            }
        
        return jsonify(response)
    
    except SQLAlchemyError as e:
        logger.error(f"Errore nel database durante la creazione dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore nel database: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"Errore durante la creazione dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore: {str(e)}"}), 500

@calendar_bp.route('/api/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    """API per aggiornare un evento esistente"""
    try:
        # Ottieni i dati dalla richiesta
        event_data = request.json
        
        # Usa il context manager per la sessione
        with get_db() as db:
            # Trova l'evento nel database
            event = db.query(Event).filter(Event.id == uuid.UUID(event_id)).first()
            
            if not event:
                return jsonify({"success": False, "message": "Evento non trovato"}), 404
            
            # Aggiorna i campi dell'evento
            if 'titolo' in event_data:
                event.title = event_data['titolo']
            if 'descrizione' in event_data:
                event.description = event_data['descrizione']
            if 'dataInizio' in event_data:
                event.start_date = parser.parse(event_data['dataInizio'])
            if 'dataFine' in event_data:
                event.end_date = parser.parse(event_data['dataFine'])
            if 'categoria' in event_data:
                event.category_id = event_data['categoria']
            if 'location' in event_data:
                event.location = event_data['location']
            if 'allDay' in event_data:
                event.all_day = event_data['allDay']
            if 'isRecurring' in event_data:
                event.is_recurring = event_data['isRecurring']
            if 'recurrenceRule' in event_data:
                event.recurrence_rule = event_data['recurrenceRule']
            if 'isPublic' in event_data:
                event.is_public = event_data['isPublic']
            if 'color' in event_data:
                event.color = event_data['color']
            
            # Prepara la risposta
            response = {
                "success": True,
                "message": "Evento aggiornato con successo",
                "id": str(event.id),
                "evento": {
                    "id": str(event.id),
                    "titolo": event.title,
                    "descrizione": event.description,
                    "dataInizio": event.start_date.isoformat(),
                    "dataFine": event.end_date.isoformat(),
                    "categoria": event.category_id,
                    "location": event.location,
                    "modificato": event.updated_at.isoformat() if event.updated_at else None
                }
            }
        
        return jsonify(response)
    
    except SQLAlchemyError as e:
        logger.error(f"Errore nel database durante l'aggiornamento dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore nel database: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'aggiornamento dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore: {str(e)}"}), 500

@calendar_bp.route('/api/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    """API per eliminare un evento"""
    try:
        # Usa il context manager per la sessione
        with get_db() as db:
            # Trova l'evento nel database
            event = db.query(Event).filter(Event.id == uuid.UUID(event_id)).first()
            
            if not event:
                return jsonify({"success": False, "message": "Evento non trovato"}), 404
            
            # Elimina l'evento
            db.delete(event)
        
        return jsonify({"success": True, "message": "Evento eliminato con successo"})
    
    except SQLAlchemyError as e:
        logger.error(f"Errore nel database durante l'eliminazione dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore nel database: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'eliminazione dell'evento: {str(e)}")
        return jsonify({"success": False, "message": f"Errore: {str(e)}"}), 500

@calendar_bp.route('/api/categories')
def get_categories():
    """API per ottenere le categorie di eventi"""
    try:
        # Usa il context manager per la sessione
        with get_db() as db:
            # Query per tutte le categorie
            categories = db.query(Category).all()
            
            # Converte le categorie in dizionari
            categories_list = [
                {
                    "id": category.id,
                    "nome": category.name,
                    "colore": category.color,
                    "icona": category.icon,
                    "descrizione": category.description
                } for category in categories
            ]
        
        return jsonify(categories_list)
    
    except Exception as e:
        logger.error(f"Errore durante il recupero delle categorie: {str(e)}")
        return jsonify({"error": str(e)}), 500
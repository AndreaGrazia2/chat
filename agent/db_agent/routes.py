from flask import Blueprint, request, jsonify, send_from_directory
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import logging
import os
from chat.database import get_db

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crea un Blueprint per le API dell'agente DB
db_agent_bp = Blueprint('db_agent', __name__)

@db_agent_bp.route('/execute-query', methods=['POST'])
def execute_query():
    """Endpoint per eseguire query SQL sul database"""
    try:
        # Ottieni la query dalla richiesta
        data = request.json
        query = data.get('query')
        user_id = data.get('user_id', 1)
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Query non specificata'
            }), 400
        
        # Log della query per debug
        logger.info(f"Esecuzione query: {query}")
        
        # Esegui la query
        # Importa direttamente l'engine e crea una sessione
        from common.db.connection import get_engine
        from sqlalchemy.orm import sessionmaker
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        db = Session()
        
        try:
            # Esegui la query raw
            result = db.execute(text(query))
            
            # Ottieni i nomi delle colonne
            columns = result.keys()
            
            # Converti i risultati in una lista di dizionari
            results = [dict(zip(columns, row)) for row in result.fetchall()]
            
            # Converti i tipi di dati non serializzabili
            for row in results:
                for key, value in row.items():
                    # Converti datetime in ISO format
                    if hasattr(value, 'isoformat'):
                        row[key] = value.isoformat()
                    # Converti UUID in stringa
                    elif hasattr(value, 'hex'):
                        row[key] = str(value)
            
            return jsonify({
                'success': True,
                'columns': list(columns),
                'results': results,
                'count': len(results)
            })
        finally:
            # Chiudi la sessione
            db.close()
    
    except SQLAlchemyError as e:
        logger.error(f"Errore SQL: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Errore SQL: {str(e)}"
        }), 500
    except Exception as e:
        logger.error(f"Errore nell'esecuzione della query: {str(e)}")
        return jsonify({
            'success': False,
            'error': f"Errore nell'esecuzione della query: {str(e)}"
        }), 500

# Endpoint per servire i report PDF generati
@db_agent_bp.route('/uploads/reports/<filename>')
def serve_report(filename):
    """Serve i report PDF generati"""
    from flask import current_app, send_from_directory
    
    # Percorso corretto per i report PDF
    reports_dir = os.path.join(current_app.root_path, 'uploads', 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    
    logger.info(f"Richiesta di download del file: {filename} dalla directory: {reports_dir}")
    
    # Assicurati che as_attachment sia True e aggiungi mimetype
    return send_from_directory(
        reports_dir, 
        filename, 
        as_attachment=True,
        mimetype='application/pdf'
    )
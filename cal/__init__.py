from flask import Flask

def create_calendar_blueprint():
    """
    Crea e configura il blueprint del calendario.
    """
    from .routes import calendar_bp
    return calendar_bp

def init_app(app):
    """
    Inizializza il modulo calendario con l'app Flask.
    """
    calendar_bp = create_calendar_blueprint()
    app.register_blueprint(calendar_bp, url_prefix="/cal")
    
    # Inizializza il database se necessario
    # Nota: in produzione, il database verrà inizializzato con uno script separato
    if app.config.get('INIT_DB_ON_START', False):
        from .init_db import init_db
        init_db()
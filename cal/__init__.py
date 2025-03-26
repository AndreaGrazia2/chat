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
   

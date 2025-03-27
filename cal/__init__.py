from flask import Flask

def create_calendar_blueprint():
    """
    Crea e configura il blueprint del calendario.
    """
    from .routes import calendar_bp
    return calendar_bp

def init_app(app, socketio=None):
    """
    Inizializza il modulo calendario con l'app Flask.
    """
    if socketio:
        from .socket_manager import register_calendar_handlers
        register_calendar_handlers(socketio)
from flask import Blueprint, render_template, jsonify, request, send_from_directory
from common.config import SECRET_KEY
from chat.models import users, channels, messages, generate_dm_messages

# Crea un Blueprint per la chat
chat_bp = Blueprint('chat', __name__, 
                    template_folder='templates',
                    static_folder='static',
                    static_url_path='/chat/static')

@chat_bp.route('/')
def index():
    """Renderizza la pagina principale della chat"""
    return render_template('chat.html')

@chat_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve i file statici della chat"""
    return send_from_directory('chat/static', filename)

# API routes per la chat
@chat_bp.route('/api/users')
def get_users():
    """API per ottenere la lista degli utenti"""
    return jsonify(users)

@chat_bp.route('/api/channels')
def get_channels():
    """API per ottenere la lista dei canali"""
    return jsonify(channels)

@chat_bp.route('/api/messages/channel/<channel_name>')
def get_channel_messages(channel_name):
    """API per ottenere i messaggi di un canale"""
    return jsonify(messages["channels"].get(channel_name, []))

@chat_bp.route('/api/messages/dm/<user_id>')
def get_dm_messages(user_id):
    """API per ottenere i messaggi diretti con un utente"""
    dm_messages = generate_dm_messages(user_id)
    return jsonify(dm_messages)
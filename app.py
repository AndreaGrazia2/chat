import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory data store (replace with a database in production)
users = [
    {"id": 1, "name": "You", "avatar": "https://i.pravatar.cc/150?img=1", "status": "online"},
    {"id": 2, "name": "John Doe", "avatar": "https://i.pravatar.cc/150?img=2", "status": "online"},
    {"id": 3, "name": "Jane Smith", "avatar": "https://i.pravatar.cc/150?img=3", "status": "away"},
    {"id": 4, "name": "Mike Johnson", "avatar": "https://i.pravatar.cc/150?img=4", "status": "busy"},
    {"id": 5, "name": "Emma Davis", "avatar": "https://i.pravatar.cc/150?img=5", "status": "offline"},
]

channels = [
    {"id": 1, "name": "general"},
    {"id": 2, "name": "random"},
    {"id": 3, "name": "announcements"},
    {"id": 4, "name": "development"}
]

# Store messages by channel and direct messages
messages = {
    "channels": {},
    "directMessages": {}
}

# Initialize empty message arrays for each channel
for channel in channels:
    messages["channels"][channel["name"]] = []

@app.route('/')
def index():
    return send_from_directory('.', 'chat.html')

@app.route('/api/users')
def get_users():
    return jsonify(users)

@app.route('/api/channels')
def get_channels():
    return jsonify(channels)

@app.route('/api/messages/channel/<channel_name>')
def get_channel_messages(channel_name):
    return jsonify(messages["channels"].get(channel_name, []))

@app.route('/api/messages/dm/<user_id>')
def get_dm_messages(user_id):
    dm_key = f"dm:{user_id}"
    return jsonify(messages["directMessages"].get(dm_key, []))

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('initialData', {'users': users, 'channels': channels})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('joinChannel')
def handle_join_channel(channel_name):
    room = f"channel:{channel_name}"
    join_room(room)
    # Send channel history
    emit('messageHistory', messages["channels"].get(channel_name, []))

@socketio.on('joinDirectMessage')
def handle_join_dm(user_id):
    dm_key = f"dm:{user_id}"
    join_room(dm_key)
    # Send DM history
    emit('messageHistory', messages["directMessages"].get(dm_key, []))

@socketio.on('channelMessage')
def handle_channel_message(data):
    channel_name = data.get('channelName')
    message_data = data.get('message')
    
    if not channel_name or not message_data:
        return
    
    # Create new message with server timestamp
    new_message = {
        "id": int(datetime.now().timestamp() * 1000),  # Use timestamp as ID
        **message_data,
        "timestamp": datetime.now().isoformat()
    }
    
    # Store the message
    if channel_name not in messages["channels"]:
        messages["channels"][channel_name] = []
    
    messages["channels"][channel_name].append(new_message)
    
    # Broadcast to channel
    room = f"channel:{channel_name}"
    emit('newMessage', new_message, room=room)

@socketio.on('directMessage')
def handle_direct_message(data):
    user_id = data.get('userId')
    message_data = data.get('message')
    
    if not user_id or not message_data:
        return
    
    dm_key = f"dm:{user_id}"
    
    # Create new message with server timestamp
    new_message = {
        "id": int(datetime.now().timestamp() * 1000),  # Use timestamp as ID
        **message_data,
        "timestamp": datetime.now().isoformat()
    }
    
    # Store the message
    if dm_key not in messages["directMessages"]:
        messages["directMessages"][dm_key] = []
    
    messages["directMessages"][dm_key].append(new_message)
    
    # Send to recipient
    emit('newMessage', new_message, room=dm_key)

@socketio.on('typing')
def handle_typing(data):
    channel_name = data.get('channelName')
    user_id = data.get('userId')
    is_typing = data.get('isTyping')
    
    if channel_name:
        room = f"channel:{channel_name}"
        emit('userTyping', {'userId': user_id, 'isTyping': is_typing}, room=room, include_self=False)
    elif user_id:
        room = f"dm:{user_id}"
        emit('userTyping', {'userId': user_id, 'isTyping': is_typing}, room=room, include_self=False)

@socketio.on('statusChange')
def handle_status_change(data):
    user_id = data.get('userId')
    status = data.get('status')
    
    if not user_id or not status:
        return
    
    # Update user status
    for user in users:
        if user["id"] == user_id:
            user["status"] = status
            emit('userStatusUpdate', {'userId': user_id, 'status': status}, broadcast=True)
            break

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
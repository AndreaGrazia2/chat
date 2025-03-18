from flask import Flask
from routes.workflow_routes import workflow_bp
from config import SECRET_KEY, DEBUG

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = SECRET_KEY
    
    # Registra i blueprints
    app.register_blueprint(workflow_bp, url_prefix='/workflow')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=DEBUG, host='0.0.0.0', port=5000)
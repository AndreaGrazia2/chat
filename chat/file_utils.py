import os
from pathlib import Path
import magic
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

# Tipi di file consentiti
ALLOWED_EXTENSIONS = {
    'pdf', 'txt', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'csv', 'md', 'xls', 'xlsx'
}

# Dimensione massima del file (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes

def init_upload_dir():
    """Inizializza la directory per gli upload se non esiste"""
    upload_dir = Path(current_app.root_path) / 'uploads' / 'documents'
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir

def allowed_file(filename):
    """Verifica se il file ha un'estensione consentita"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_file_type(file_path):
    """Verifica il tipo di file usando magic numbers"""
    mime = magic.Magic(mime=True)
    file_type = mime.from_file(file_path)
    
    # Verifica che il tipo MIME sia consentito
    allowed_mimes = {
        'application/pdf', 'text/plain', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'text/csv', 'text/markdown',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    
    return file_type in allowed_mimes

def save_uploaded_file(file):
    """Salva il file caricato e restituisce i metadati"""
    if file and allowed_file(file.filename):
        # Genera un nome di file sicuro e unico
        original_filename = secure_filename(file.filename)
        filename_parts = original_filename.rsplit('.', 1)
        base_name = filename_parts[0]
        extension = filename_parts[1] if len(filename_parts) > 1 else ''
        
        # Genera un UUID per il nome del file
        unique_filename = f"{uuid.uuid4().hex}.{extension}" if extension else f"{uuid.uuid4().hex}"
        
        # Percorso completo del file
        upload_dir = init_upload_dir()
        file_path = upload_dir / unique_filename
        
        # Salva il file
        file.save(file_path)
        
        # Verifica il tipo di file usando magic numbers
        if not allowed_file_type(file_path):
            # Se il tipo di file non è consentito, elimina il file e restituisci None
            os.remove(file_path)
            return None
        
        # Calcola la dimensione del file in formato leggibile
        size_bytes = os.path.getsize(file_path)
        if size_bytes > MAX_FILE_SIZE:
            # Se il file è troppo grande, eliminalo e restituisci None
            os.remove(file_path)
            return None
            
        # Formatta la dimensione in modo leggibile
        if size_bytes < 1024:
            size_str = f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            size_str = f"{size_bytes / 1024:.1f} KB"
        else:
            size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
        
        # Determina l'icona in base all'estensione
        icon_map = {
            'pdf': 'fa-file-pdf',
            'txt': 'fa-file-alt',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'jpg': 'fa-file-image',
            'jpeg': 'fa-file-image',
            'png': 'fa-file-image',
            'csv': 'fa-file-csv',
            'md': 'fa-file-alt',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel'
        }
        
        icon = icon_map.get(extension.lower(), 'fa-file')
        
        # Crea i metadati del file
        file_data = {
            'name': base_name,
            'ext': extension,
            'size': size_str,
            'icon': icon,
            'path': str(file_path.relative_to(current_app.root_path)),
            'url': f"/chat/uploads/documents/{unique_filename}"  # Modifica qui: aggiungi 'documents/'
        }
        
        return file_data
    
    return None
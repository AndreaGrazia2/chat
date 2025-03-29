/**
 * fileUpload.js - Gestione dell'upload dei file
 */

import { showNotification } from './utils.js';

// Funzione per caricare un file con indicatore di progresso
// Aggiungiamo una funzione per validare il file in modo più completo
function validateFile(file) {
    // Verifica dimensione massima (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Il file è troppo grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). La dimensione massima è 10MB.`
        };
    }
    
    // Verifica estensione consentita
    const allowedExtensions = ['pdf', 'txt', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'csv', 'md', 'xls', 'xlsx'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
        return {
            valid: false,
            error: `Tipo di file non supportato. Estensioni consentite: ${allowedExtensions.join(', ')}`
        };
    }
    
    return { valid: true };
}

// Modifichiamo la funzione uploadFile per usare la nuova validazione
async function uploadFile(file, progressCallback) {
    try {
        // Valida il file
        const validation = validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Crea FormData per l'upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Crea una richiesta XMLHttpRequest per monitorare il progresso
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Aggiungiamo una proprietà per poter annullare l'upload
            const uploadController = {
                xhr: xhr,
                abort: function() {
                    xhr.abort();
                }
            };
            
            // Salviamo il controller nell'oggetto window per accedervi globalmente
            window.currentUpload = uploadController;
            
            // Gestisci l'evento di progresso
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && progressCallback) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    progressCallback(percentComplete);
                }
            });
            
            // Gestisci il completamento
            xhr.addEventListener('load', () => {
                // Rimuovi il riferimento all'upload corrente
                window.currentUpload = null;
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response.fileData);
                    } catch (e) {
                        reject(new Error('Risposta del server non valida'));
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || 'Errore durante l\'upload del file'));
                    } catch (e) {
                        reject(new Error(`Errore durante l'upload del file (${xhr.status})`));
                    }
                }
            });
            
            // Gestisci gli errori
            xhr.addEventListener('error', () => {
                window.currentUpload = null;
                reject(new Error('Errore di rete durante l\'upload'));
            });
            
            xhr.addEventListener('abort', () => {
                window.currentUpload = null;
                reject(new Error('Upload annullato'));
            });
            
            // Apri e invia la richiesta
            xhr.open('POST', '/chat/api/upload');
            xhr.send(formData);
        });
    } catch (error) {
        console.error('Errore upload file:', error);
        throw error;
    }
}

// Funzione per gestire la selezione del file tramite input con progresso
function handleFileSelect(event, callback) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Mostra anteprima del file
    showFilePreview(file);
    
    // Crea e mostra l'indicatore di progresso
    const progressObj = createProgressBar();
    
    uploadFile(file, (progress) => {
        updateProgressBar(progressObj, progress);
    })
        .then(fileData => {
            // Rimuovi l'indicatore di progresso
            removeProgressBar(progressObj);
            // Rimuovi l'anteprima
            removeFilePreview();
            
            if (callback && typeof callback === 'function') {
                callback(fileData);
            }
        })
        .catch(error => {
            // Rimuovi l'indicatore di progresso
            removeProgressBar(progressObj);
            // Rimuovi l'anteprima
            removeFilePreview();
            
            showNotification(error.message, 'error');
        });
}

// Funzione per creare l'indicatore di progresso
function createProgressBar() {
    // Crea il contenitore principale
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress-container';
    
    // Crea la barra di progresso
    const progressBar = document.createElement('div');
    progressBar.className = 'upload-progress';
    progressBar.style.width = '0%';
    
    // Crea il pulsante di annullamento
    const cancelButton = document.createElement('button');
    cancelButton.className = 'upload-cancel';
    cancelButton.innerHTML = '<i class="fas fa-times"></i>';
    cancelButton.title = 'Annulla upload';
    cancelButton.addEventListener('click', () => {
        if (window.currentUpload) {
            window.currentUpload.abort();
        }
    });
    
    // Aggiungi gli elementi al contenitore
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(cancelButton);
    
    // Aggiungi il contenitore alla UI
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer) {
        messageInputContainer.appendChild(progressContainer);
    }
    
    return { container: progressContainer, bar: progressBar };
}

// Aggiorniamo la funzione updateProgressBar
function updateProgressBar(progressObj, progress) {
    if (progressObj && progressObj.bar) {
        progressObj.bar.style.width = `${progress}%`;
    }
}

// Aggiorniamo la funzione removeProgressBar
function removeProgressBar(progressObj) {
    if (progressObj && progressObj.container && progressObj.container.parentNode) {
        progressObj.container.parentNode.removeChild(progressObj.container);
    }
}

// Funzione per inizializzare il drag and drop
function initDragAndDrop(dropZoneElement, callback) {
    if (!dropZoneElement) return;
    
    // Previeni il comportamento predefinito per questi eventi
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Verifica se esiste una conversazione attiva
    if (!window.currentConversationId) {
        window.currentConversationId = 'general';
        window.isChannel = true;
        console.log('Using default channel: general');
    }

    // Tieni traccia degli eventi di drag enter/leave per evitare flickering
    let dragCounter = 0;
    
    // Gestisci dragenter
    dropZoneElement.addEventListener('dragenter', (e) => {
        preventDefaults(e);
        dragCounter++;
        dropZoneElement.classList.add('drag-active');
    }, false);
    
    // Gestisci dragleave
    dropZoneElement.addEventListener('dragleave', (e) => {
        preventDefaults(e);
        dragCounter--;
        if (dragCounter === 0) {
            dropZoneElement.classList.remove('drag-active');
        }
    }, false);
    
    // Gestisci drop
    dropZoneElement.addEventListener('drop', (e) => {
        preventDefaults(e);
        dragCounter = 0;
        dropZoneElement.classList.remove('drag-active');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0]; // Per ora gestiamo un solo file alla volta
            
            // Prova a ottenere l'ID della conversazione attiva dall'UI
            const activeConversation = document.querySelector('.conversation.active');
            if (activeConversation && activeConversation.dataset.conversationId) {
                window.currentConversationId = activeConversation.dataset.conversationId;
                window.isChannel = activeConversation.classList.contains('channel-conversation');
                console.log('Recovered conversation ID from drag and drop:', window.currentConversationId);
            } else {
                showNotification('Seleziona prima una conversazione', 'error');
                return;
            }
            
            // Mostra anteprima del file
            showFilePreview(file);
            
            // Crea e mostra l'indicatore di progresso
            const progressObj = createProgressBar();
            
            uploadFile(file, (progress) => {
                updateProgressBar(progressObj, progress);
            })
                .then(fileData => {
                    // Rimuovi l'indicatore di progresso
                    removeProgressBar(progressObj);
                    // Rimuovi l'anteprima
                    removeFilePreview();
                    
                    if (callback && typeof callback === 'function') {
                        callback(fileData);
                    }
                })
                .catch(error => {
                    // Rimuovi l'indicatore di progresso
                    removeProgressBar(progressObj);
                    // Rimuovi l'anteprima
                    removeFilePreview();
                    
                    showNotification(error.message, 'error');
                });
        }
    }, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// Funzione per mostrare un'anteprima del file
function showFilePreview(file) {
    // Rimuovi eventuali anteprime esistenti
    removeFilePreview();
    
    // Crea il contenitore dell'anteprima
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container';
    
    // Contenuto dell'anteprima in base al tipo di file
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png'].includes(extension)) {
        // Per le immagini, mostra un'anteprima
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'file-preview-image';
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else {
        // Per gli altri file, mostra un'icona
        const iconMap = {
            'pdf': 'fa-file-pdf',
            'txt': 'fa-file-alt',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'csv': 'fa-file-csv',
            'md': 'fa-file-alt',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel'
        };
        
        const icon = document.createElement('i');
        icon.className = `fas ${iconMap[extension] || 'fa-file'} file-preview-icon`;
        previewContainer.appendChild(icon);
    }
    
    // Aggiungi informazioni sul file
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-preview-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-preview-name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-preview-size';
    fileSize.textContent = formatFileSize(file.size);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    previewContainer.appendChild(fileInfo);
    
    // Aggiungi il pulsante di chiusura
    const closeButton = document.createElement('button');
    closeButton.className = 'file-preview-close';
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.addEventListener('click', () => {
        removeFilePreview();
        // Annulla l'upload se in corso
        if (window.currentUpload) {
            window.currentUpload.abort();
        }
    });
    previewContainer.appendChild(closeButton);
    
    // Aggiungi l'anteprima alla UI
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer) {
        messageInputContainer.appendChild(previewContainer);
    }
}

// Funzione per rimuovere l'anteprima del file
function removeFilePreview() {
    const previewContainer = document.querySelector('.file-preview-container');
    if (previewContainer && previewContainer.parentNode) {
        previewContainer.parentNode.removeChild(previewContainer);
    }
}

// Funzione per formattare la dimensione del file
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Esporta le funzioni
export { 
    uploadFile, 
    handleFileSelect, 
    initDragAndDrop,
    createProgressBar,
    updateProgressBar,
    removeProgressBar,
    showFilePreview,
    removeFilePreview,
    validateFile
};
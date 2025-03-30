/**
 * fileUpload.js - Gestione dell'upload dei file
 */

import { showNotification } from './utils.js';

// Funzione per caricare un file con indicatore di progresso
// Aggiungiamo una funzione per validare il file in modo più completo
// Replace the validateFile function in fileUpload.js

function validateFile(file) {
    console.log('Validating file:', file.name, file.type, file.size);
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Il file è troppo grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). La dimensione massima è 10MB.`
        };
    }
    
    // Check file extension
    const allowedExtensions = ['pdf', 'txt', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'csv', 'md', 'xls', 'xlsx'];
    let fileExtension = '';
    
    // Extract extension from filename
    if (file.name.includes('.')) {
        fileExtension = file.name.split('.').pop().toLowerCase();
    } else if (file.type) {
        // Try to derive extension from MIME type if no extension in filename
        const mimeMap = {
            'application/pdf': 'pdf',
            'text/plain': 'txt',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'text/csv': 'csv',
            'text/markdown': 'md',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
        };
        fileExtension = mimeMap[file.type] || '';
    }
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        return {
            valid: false,
            error: `Tipo di file non supportato. Estensioni consentite: ${allowedExtensions.join(', ')}`
        };
    }
    
    // Additional check based on MIME type
    const allowedMimeTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'text/csv',
        'text/markdown',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    // Only perform MIME check if we have a type (some browsers might not provide reliable MIME info)
    if (file.type && !allowedMimeTypes.includes(file.type)) {
        console.warn('File MIME type check failed:', file.type);
        // This is just a warning, not an error, as MIME types can be unreliable
    }
    
    console.log('File validation successful');
    return { valid: true };
}

async function uploadFile(file, progressCallback) {
    try {
        console.log('Starting file upload:', file.name);
        
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            console.error('File validation failed:', validation.error);
            throw new Error(validation.error);
        }
        
        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Create XMLHttpRequest to monitor progress
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Add property to cancel the upload
            const uploadController = {
                xhr: xhr,
                abort: function() {
                    console.log('Upload aborted by user');
                    xhr.abort();
                }
            };
            
            // Save controller in window object for global access
            window.currentUpload = uploadController;
            
            // Handle progress event
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && progressCallback) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    console.log(`Upload progress: ${Math.round(percentComplete)}%`);
                    progressCallback(percentComplete);
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                // Remove reference to current upload
                window.currentUpload = null;
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        console.log('Upload completed successfully');
                        const response = JSON.parse(xhr.responseText);
                        resolve(response.fileData);
                    } catch (e) {
                        console.error('Error parsing server response:', e);
                        reject(new Error('Risposta del server non valida'));
                    }
                } else {
                    try {
                        console.error('Server returned error:', xhr.status, xhr.statusText);
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `Errore durante l'upload del file (${xhr.status})`));
                    } catch (e) {
                        reject(new Error(`Errore durante l'upload del file (${xhr.status})`));
                    }
                }
            });
            
            // Handle network errors
            xhr.addEventListener('error', () => {
                console.error('Network error during upload');
                window.currentUpload = null;
                reject(new Error('Errore di rete durante l\'upload'));
            });
            
            // Handle abort
            xhr.addEventListener('abort', () => {
                console.log('Upload aborted');
                window.currentUpload = null;
                reject(new Error('Upload annullato'));
            });
            
            // Open and send request with timeout
            xhr.timeout = 30000; // 30 seconds timeout
            xhr.ontimeout = function() {
                console.error('Upload timed out');
                window.currentUpload = null;
                reject(new Error('Upload timed out after 30 seconds'));
            };
            
            console.log('Sending upload request to server');
            xhr.open('POST', '/chat/api/upload');
            xhr.send(formData);
        });
    } catch (error) {
        console.error('Error in uploadFile:', error);
        throw error;
    }
}

function createFilePreviewWithMessage(file, confirmCallback) {
    // Rimuovi eventuali preview esistenti
    removeFilePreviewWithMessage();
    
    // Crea l'overlay per il modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    // Crea il dialog modale
    const modalDialog = document.createElement('div');
    modalDialog.className = 'file-upload-modal';
    
    // Intestazione del modale con pulsante di chiusura
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h3>Invia file</h3>
        <button class="modal-close-btn"><i class="fas fa-times"></i></button>
    `;
    
    // Contenuto del modale
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Anteprima del file
    const filePreview = document.createElement('div');
    filePreview.className = 'modal-file-preview';
    
    // Determina il tipo di anteprima in base al tipo di file
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png'].includes(extension)) {
        // Anteprima per immagini
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'file-preview-image';
            filePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else {
        // Icona per altri tipi di file
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
        
        const iconContainer = document.createElement('div');
        iconContainer.className = 'file-icon-container';
        
        const fileIcon = document.createElement('i');
        fileIcon.className = `fas ${iconMap[extension] || 'fa-file'} file-preview-icon`;
        iconContainer.appendChild(fileIcon);
        filePreview.appendChild(iconContainer);
    }
    
    // Informazioni file
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatFileSize(file.size)}</div>
    `;
    
    // Campo messaggio
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-input-container';
    messageContainer.innerHTML = `
        <textarea id="file-message-input" class="file-message-input" 
                  placeholder="Aggiungi un messaggio (opzionale)" rows="3"></textarea>
    `;
    
    // Pulsanti azione
    const actionButtons = document.createElement('div');
    actionButtons.className = 'modal-actions';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'modal-cancel-btn';
    cancelButton.innerHTML = 'Annulla';
    
    const sendButton = document.createElement('button');
    sendButton.className = 'modal-send-btn';
    sendButton.innerHTML = 'Invia File';
    
    actionButtons.appendChild(cancelButton);
    actionButtons.appendChild(sendButton);
    
    // Assembla tutti gli elementi
    modalContent.appendChild(filePreview);
    modalContent.appendChild(fileInfo);
    modalContent.appendChild(messageContainer);
    
    modalDialog.appendChild(modalHeader);
    modalDialog.appendChild(modalContent);
    modalDialog.appendChild(actionButtons);
    
    modalOverlay.appendChild(modalDialog);
    
    // Aggiungi al body (non al container dell'input)
    document.body.appendChild(modalOverlay);
    
    // Funzione per chiudere il modale
    const closeModal = () => {
        modalOverlay.classList.add('closing');
        setTimeout(() => {
            if (modalOverlay.parentNode) {
                modalOverlay.parentNode.removeChild(modalOverlay);
            }
        }, 300);
    };
    
    // Aggiungi event listener
    modalHeader.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    
    sendButton.addEventListener('click', () => {
        if (confirmCallback) {
            // Recupera il messaggio personalizzato
            const messageInput = modalContent.querySelector('.file-message-input');
            const message = messageInput.value.trim() || `File: ${file.name}`;
            
            // Chiudi il modale
            closeModal();
            
            // Esegui il callback
            confirmCallback({
                file: file,
                message: message
            });
        }
    });
    
    // Aggiungi l'animazione di apertura
    setTimeout(() => {
        modalOverlay.classList.add('active');
    }, 10);
    
    // Focus sul campo di input del messaggio
    setTimeout(() => {
        modalContent.querySelector('.file-message-input').focus();
    }, 300);
}

function removeFilePreviewWithMessage() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.add('closing');
        setTimeout(() => {
            if (modalOverlay.parentNode) {
                modalOverlay.parentNode.removeChild(modalOverlay);
            }
        }, 300);
    }
}

// Funzione per gestire la selezione del file tramite input con progresso
function handleFileSelect(event, callback) {
    const file = event.target.files[0];
    if (!file) {
        console.log('Nessun file selezionato');
        return;
    }
    
    console.log('File selezionato:', file.name, file.type, file.size);
    
    // Verifica il contesto della conversazione attuale
    console.log('Contesto conversazione:', {
        currentConversationId: window.currentConversationId, 
        isChannel: window.isChannel
    });
    
    // Validazione file
    const validation = validateFile(file);
    if (!validation.valid) {
        showNotification(validation.error, true);
        return;
    }
    
    // Crea l'interfaccia di anteprima con messaggio personalizzabile
    createFilePreviewWithMessage(file, (uploadData) => {
        // Quando l'utente conferma, inizia l'upload
        // Crea e mostra indicatore di progresso
        const progressObj = createProgressBar();
        
        uploadFile(file, (progress) => {
            updateProgressBar(progressObj, progress);
            console.log(`Progresso upload: ${Math.round(progress)}%`);
            
            // Aggiornamento dell'indicatore di progresso nel preview
            const filePreview = document.querySelector('.file-preview-with-message');
            if (filePreview) {
                const progressInfo = filePreview.querySelector('.upload-progress-text') || 
                                     document.createElement('div');
                if (!progressInfo.classList.contains('upload-progress-text')) {
                    progressInfo.className = 'upload-progress-text';
                    filePreview.appendChild(progressInfo);
                }
                progressInfo.textContent = `Caricamento: ${Math.round(progress)}%`;
            }
        })
        .then(fileData => {
            // Rimuovi indicatore di progresso
            removeProgressBar(progressObj);
            
            // Rimuovi anteprima
            removeFilePreviewWithMessage();
            
            console.log('Upload completato, dati file:', fileData);
            
            if (callback && typeof callback === 'function') {
                console.log('Esecuzione callback con i dati del file e il messaggio personalizzato');
                // Aggiungi il messaggio personalizzato ai dati del file
                fileData.customMessage = uploadData.message;
                callback(fileData);
            } else {
                console.error('Callback non disponibile o non è una funzione!');
            }
        })
        .catch(error => {
            console.error('Errore durante upload:', error);
            
            // Rimuovi indicatore di progresso
            removeProgressBar(progressObj);
            
            // Rimuovi anteprima
            removeFilePreviewWithMessage();
            
            showNotification('Errore upload: ' + error.message, 'error');
        });
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
    
    // Create drop overlay element if it doesn't exist already
    if (!dropZoneElement.querySelector('.drop-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'drop-overlay';
        overlay.innerHTML = `
            <div class="drop-message">
                <i class="fas fa-cloud-upload-alt"></i>
                <div>Drop your file here</div>
            </div>
        `;
        dropZoneElement.appendChild(overlay);
    }
    
    // Prevent default behavior for these events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Track drag enter/leave events to avoid flickering
    let dragCounter = 0;
    
    // Handle dragenter
    dropZoneElement.addEventListener('dragenter', (e) => {
        preventDefaults(e);
        dragCounter++;
        console.log('Drag enter detected, adding drag-active class');
        dropZoneElement.classList.add('drag-active');
    }, false);
    
    // Handle dragover - keep the drag-active class during dragover
    dropZoneElement.addEventListener('dragover', (e) => {
        preventDefaults(e);
        if (!dropZoneElement.classList.contains('drag-active')) {
            console.log('Ensuring drag-active class is present during dragover');
            dropZoneElement.classList.add('drag-active');
        }
    }, false);
    
    // Handle dragleave
    dropZoneElement.addEventListener('dragleave', (e) => {
        preventDefaults(e);
        dragCounter--;
        if (dragCounter === 0) {
            console.log('Drag leave detected, removing drag-active class');
            dropZoneElement.classList.remove('drag-active');
        }
    }, false);
    
    // Handle drop
    dropZoneElement.addEventListener('drop', (e) => {
        console.log('File drop detected');
        preventDefaults(e);
        dragCounter = 0;
        dropZoneElement.classList.remove('drag-active');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0]; // Only handle one file at a time
            console.log('File dropped:', file.name, file.type, file.size);
            
            // NUOVA LOGICA: accetta il file senza controlli stretti sul contesto
            // Al momento del drag & drop ci deve essere per forza una conversazione attiva
            
            // Validazione file
            const validation = validateFile(file);
            if (!validation.valid) {
                showNotification(validation.error, true);
                return;
            }
            
            // Crea l'interfaccia di anteprima con messaggio personalizzabile
            createFilePreviewWithMessage(file, (uploadData) => {
                // Quando l'utente conferma, inizia l'upload
                // Crea e mostra indicatore di progresso
                const progressObj = createProgressBar();
                
                uploadFile(file, (progress) => {
                    updateProgressBar(progressObj, progress);
                    
                    // Aggiornamento dell'indicatore di progresso nel preview
                    const filePreview = document.querySelector('.file-preview-with-message');
                    if (filePreview) {
                        const progressInfo = filePreview.querySelector('.upload-progress-text') || 
                                            document.createElement('div');
                        if (!progressInfo.classList.contains('upload-progress-text')) {
                            progressInfo.className = 'upload-progress-text';
                            filePreview.appendChild(progressInfo);
                        }
                        progressInfo.textContent = `Caricamento: ${Math.round(progress)}%`;
                    }
                })
                .then(fileData => {
                    // Rimuovi indicatore di progresso
                    removeProgressBar(progressObj);
                    
                    // Rimuovi anteprima
                    removeFilePreviewWithMessage();
                    
                    // Aggiungi il messaggio personalizzato ai dati del file
                    fileData.customMessage = uploadData.message;
                    
                    if (callback && typeof callback === 'function') {
                        callback(fileData);
                    }
                })
                .catch(error => {
                    console.error('Errore durante upload:', error);
                    
                    // Rimuovi indicatore di progresso
                    removeProgressBar(progressObj);
                    
                    // Rimuovi anteprima
                    removeFilePreviewWithMessage();
                    
                    showNotification('Errore upload: ' + error.message, 'error');
                });
            });
        }
    }, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// Funzione per mostrare un'anteprima del file
// Replace showFilePreview and removeFilePreview functions in fileUpload.js

function showFilePreview(file) {
    console.log('Showing file preview for:', file.name);
    
    // Remove any existing previews
    removeFilePreview();
    
    // Create the preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container';
    
    // Content based on file type
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png'].includes(extension)) {
        // For images, show a thumbnail preview
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'file-preview-image';
            previewContainer.appendChild(img);
            
            // Add animation to highlight the preview
            img.style.opacity = '0';
            setTimeout(() => {
                img.style.transition = 'opacity 0.3s ease';
                img.style.opacity = '1';
            }, 10);
        };
        reader.readAsDataURL(file);
    } else {
        // For other files, show an appropriate icon
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
    
    // Add file information
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
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'file-preview-close';
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.addEventListener('click', () => {
        removeFilePreview();
        // Cancel upload if in progress
        if (window.currentUpload) {
            window.currentUpload.abort();
        }
    });
    previewContainer.appendChild(closeButton);
    
    // Add the preview to the UI with animation
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer) {
        previewContainer.style.opacity = '0';
        previewContainer.style.transform = 'translateY(10px)';
        messageInputContainer.appendChild(previewContainer);
        
        // Trigger animation
        setTimeout(() => {
            previewContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            previewContainer.style.opacity = '1';
            previewContainer.style.transform = 'translateY(0)';
        }, 10);
    }
}

function removeFilePreview() {
    console.log('Removing file preview');
    const previewContainer = document.querySelector('.file-preview-container');
    if (previewContainer && previewContainer.parentNode) {
        // Animate out
        previewContainer.style.opacity = '0';
        previewContainer.style.transform = 'translateY(10px)';
        
        // Remove after animation
        setTimeout(() => {
            if (previewContainer.parentNode) {
                previewContainer.parentNode.removeChild(previewContainer);
            }
        }, 300);
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
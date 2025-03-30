import { sendChannelMessage } from './socket.js'
import { updateUnreadBadge}  from './uiNavigation.js';
import { showNotification}  from './utils.js';
import { scrollToBottom } from './coreScroll.js';
import { sendDirectMessage } from './socket.js'
import { handleFileSelect, initDragAndDrop } from './fileUpload.js';
import { createMessageElement } from './messageRenderer.js';

function sendMessage() {
    // Interrompi lo stato di digitazione quando si invia un messaggio
    stopTyping();

    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text) {
        // Rimuovi il messaggio "empty-messages" se esiste
        const emptyMessages = document.querySelector('.empty-messages, .empty-conversation');
        if (emptyMessages) {
            emptyMessages.remove();
        }
        
        // Crea oggetto messaggio con ID temporaneo
        const tempId = "temp-" + Date.now();

        const userObj = users[0];

        const newMessage = {
            id: tempId,
            user: userObj,                   // Usa l'oggetto utente standardizzato
            text: text,
            timestamp: new Date(),
            isOwn: true,
            type: 'normal',
            replyTo: replyingTo,
            status: 'sending' // Nuovo stato per tracciare l'invio
        };
        
        // Aggiungi immediatamente ai messaggi visualizzati
        displayedMessages.push(newMessage);
        
        // Salva posizione di scroll attuale
        const chatContainer = document.getElementById('chatMessages');
        const currentScrollTop = chatContainer.scrollTop;
        const currentScrollHeight = chatContainer.scrollHeight;
        const clientHeight = chatContainer.clientHeight;
        
        // Calcola se siamo "quasi" in fondo (entro 150px - circa 2 messaggi)
        const isNearBottom = (currentScrollHeight - clientHeight - currentScrollTop) <= 150;
        
        // Crea e aggiungi l'elemento al DOM
        const messageEl = createMessageElement(newMessage);
        chatContainer.appendChild(messageEl);
        
        // Scorri in basso se l'utente era vicino al fondo
        if (isNearBottom) {
            scrollToBottom();
        } else {
            // Altrimenti incrementa contatore messaggi non letti
            unreadMessages++;
            updateUnreadBadge();
            
            // Forza la visualizzazione del pulsante scrollBottom
            const scrollBtn = document.getElementById('scrollBottomBtn');
            scrollBtn.classList.add('visible');
        }
        
        // Prepara dati per il server
        const messageData = {
            text: text,
            type: 'normal',
            replyTo: replyingTo,
            tempId: tempId, // Invia l'ID temporaneo per il riconoscimento
            requestInference: true // Flag per richiedere l'inferenza del modello
        };
        
        // Se è un messaggio diretto E l'utente è John Doe (ID 2), mostra l'indicatore di digitazione
        //if (isDirectMessage && currentUser && currentUser.id === 2) {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            //typingText.textContent = `${currentUser.displayName} is typing...`;
            typingText.textContent = `Agent is typing...`;
            typingIndicator.style.display = 'flex';
            typingIndicator.dataset.startTime = Date.now(); // Aggiungi timestamp
        //}
        console.log(currentUser);
        
        // Invia al server (se connesso)
        if (currentlyConnected) {
            try {
                if (isDirectMessage && currentUser) {
                    sendDirectMessage(currentUser.id, messageData);
                } else {
                    sendChannelMessage(currentChannel, messageData);
                }
            } catch (error) {
                console.error("Errore nell'invio del messaggio:", error);
                showNotification("Errore nell'invio del messaggio", true);
                
                // Nascondi l'indicatore se c'è un errore
                document.getElementById('typingIndicator').style.display = 'none';
            }
        }
        
        // Cancella input
        input.value = '';
        
        // Reset stato risposta
        if (replyingTo) {
            document.querySelector('.reply-preview')?.remove();
            replyingTo = null;
        }
    }
}

/**
 * Gestisce gli eventi di digitazione dell'utente
 * Invia notifiche "typing" ad altri utenti con debounce
 */
function setupTypingEvents() {
    console.log("setupTypingEvents è stata chiamata!");

    const input = document.getElementById('messageInput');
    
    // Quando l'utente inizia a digitare
    input.addEventListener('input', function() {
        // Se non stiamo già segnalando che stiamo digitando
        console.log("Event listener 'input' triggato, isTyping:", isTyping);
        if (!isTyping) {
            isTyping = true;
            // AGGIUNTO: Imposta la flag di digitazione locale a true
            window.isLocalTyping = true;
            
            // Emetti evento solo se siamo connessi e abbiamo una conversazione attiva
            if (currentlyConnected && socket) {
                if (isDirectMessage && currentUser) {
                    socket.emit('userStartTyping', {
                        userId: currentUser.id,
                        isDirect: true
                    });
                } else if (currentChannel) {
                    socket.emit('userStartTyping', {
                        channelName: currentChannel,
                        isDirect: false,
                        // Invia comunque l'user ID corrente
                        userId: 1
                    });
                }
            }
        }
        
        // Resetta il timeout se esiste
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Imposta un nuovo timeout
        typingTimeout = setTimeout(function() {
            // Quando il timeout scade, l'utente non sta più digitando
            isTyping = false;
            // AGGIUNTO: Resetta la flag di digitazione locale
            window.isLocalTyping = false;
            
            // Emetti evento di fine digitazione
            if (currentlyConnected && socket) {
                if (isDirectMessage && currentUser) {
                    socket.emit('userStopTyping', {
                        userId: currentUser.id,
                        isDirect: true
                    });
                } else if (currentChannel) {
                    socket.emit('userStopTyping', {
                        channelName: currentChannel,
                        isDirect: false
                    });
                }
            }
        }, typingDebounceTime);
    });
    
    // Quando viene inviato un messaggio, interrompiamo subito lo stato di digitazione
    document.getElementById('sendButton').addEventListener('click', stopTyping);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            stopTyping();
        }
    });
}

/**
 * Interrompe lo stato di digitazione
 */
function stopTyping() {
    // Pulisci il timeout esistente
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Solo se stavamo già digitando, inviamo l'evento di stop
    if (isTyping) {
        isTyping = false;
        // AGGIUNTO: Resetta la flag di digitazione locale
        window.isLocalTyping = false;
        
        if (currentlyConnected && socket) {
            if (isDirectMessage && currentUser) {
                socket.emit('userStopTyping', {
                    userId: currentUser.id,
                    isDirect: true
                });
            } else if (currentChannel) {
                socket.emit('userStopTyping', {
                    channelName: currentChannel,
                    isDirect: false
                });
            }
        }
    }
    
    // Nascondi direttamente l'indicatore di digitazione locale
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
        delete typingIndicator.dataset.startTime;
    }
}

// Funzione per inviare un messaggio con file allegato
function sendFileMessage(fileData) {
    console.log('Invio messaggio con file:', fileData);
    
    if (!window.currentConversationId) {
        showNotification('Seleziona prima una conversazione', 'error');
        return;
    }
    
    // Creiamo un ID temporaneo per il messaggio
    const tempId = 'temp-' + Date.now();
    
    // Aggiungiamo immediatamente un messaggio temporaneo all'interfaccia
    const tempMessage = {
        id: tempId,
        user: {
            id: 1, // ID utente corrente
            username: 'me',
            displayName: 'Me',
            avatarUrl: document.querySelector('.user-avatar img')?.src || ''
        },
        text: `File inviato: ${fileData.name}.${fileData.ext}`,
        timestamp: new Date().toISOString(),
        type: 'file',
        fileData: fileData,
        isOwn: true,
        status: 'sending'
    };
    
    // Verifica che displayedMessages sia un array
    if (!Array.isArray(window.displayedMessages)) {
        window.displayedMessages = [];
    }
    
    // Aggiungi il messaggio all'array di messaggi visualizzati
    window.displayedMessages.push(tempMessage);
    
    // Trova il container dei messaggi
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) {
        console.error('Container dei messaggi non trovato!');
        return;
    }
    
    // Rimuovi messaggio "empty-messages" se presente
    const emptyMessages = chatContainer.querySelector('.empty-messages, .empty-conversation');
    if (emptyMessages) {
        emptyMessages.remove();
    }
    
    // Crea l'elemento messaggio e aggiungilo alla chat
    const messageEl = createMessageElement(tempMessage);
    chatContainer.appendChild(messageEl);
    
    // Scrolla automaticamente in basso
    scrollToBottom();
    
    // Prepara i dati per il messaggio da inviare
    const messageData = {
        text: `File inviato: ${fileData.name}.${fileData.ext}`,
        type: 'file',
        fileData: fileData,
        tempId: tempId
    };
    
    // Invia messaggio tramite Socket.IO
    console.log('Invio messaggio con file al server:', messageData);
    try {
        if (window.isChannel) {
            console.log('Invio messaggio al canale:', window.currentConversationId);
            window.socket.emit('channelMessage', {
                channelName: window.currentConversationId,
                message: messageData
            });
        } else {
            console.log('Invio messaggio diretto all\'utente:', window.currentConversationId);
            window.socket.emit('directMessage', {
                userId: parseInt(window.currentConversationId),
                message: messageData
            });
        }
        console.log('Messaggio inviato con successo');
    } catch (error) {
        console.error('Errore nell\'invio del messaggio:', error);
        showNotification('Errore nell\'invio del file: ' + error.message, 'error');
    }
}

// Inizializza il pulsante di upload file e il drag and drop
function initFileUpload() {
    // Crea l'elemento input file nascosto
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.style.display = 'none';
    fileInput.accept = '.pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.csv,.md,.xls,.xlsx';
    document.body.appendChild(fileInput);
    
    // Trova il pulsante di upload esistente
    const uploadButton = document.getElementById('fileUploadBtn');
    
    if (uploadButton) {
        // Gestisci il click sul pulsante
        uploadButton.addEventListener('click', () => {
            // Verifica se c'è una conversazione attiva
            if (!window.currentConversationId) {
                showNotification('Seleziona prima una conversazione', 'error');
                return;
            }
            
            fileInput.click();
        });
    }
    
    // Gestisci la selezione del file
    fileInput.addEventListener('change', (event) => {
        handleFileSelect(event, (fileData) => {
            sendFileMessage(fileData);
        });
    });
    
    // Inizializza il drag and drop sulla textarea del messaggio
    const messageInput = document.querySelector('#messageInput');
    if (messageInput) {
        initDragAndDrop(messageInput.parentElement, (fileData) => {
            sendFileMessage(fileData);
        });
    }
}

// Esporta le funzioni
export { sendMessage, initFileUpload, sendFileMessage, setupTypingEvents };
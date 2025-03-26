import { updateUnreadBadge}  from './uiNavigation.js';
import { scrollToBottom } from './coreScroll.js';
import { createMessageElement } from './messageRenderer.js';
import { showLoader, hideLoader, formatTime, formatDate, linkifyText, showNotification  } from './utils.js';

/**
 * socket.js - Gestione Socket.IO e comunicazione tempo reale
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

function initializeSocketIO() {
	socket = io({
		debug: false,
		autoConnect: true,
		reconnection: true,
		forceNew: true
	});

	setupSocketIOEvents();
	return socket;
}

function setupSocketIOEvents() {
    // Eventi di connessione
    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);

    // Eventi per i messaggi
    socket.on('messageHistory', handleMessageHistory);
    socket.on('newMessage', handleNewMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('modelInference', handleModelInference);
    socket.on('userStatusUpdate', handleUserStatusUpdate);
    
    // Aggiunti nuovi eventi per gestire le features mancanti
    socket.on('messageDeleted', handleMessageDeleted); 
    socket.on('messageEdited', handleMessageEdited);
}

function handleSocketConnect() {
    console.log('Connesso al server Socket.IO');
    currentlyConnected = true;

    // Aggiungi un gestore di timeout globale per tutte le operazioni Socket.IO
    socket.io.on("error", (error) => {
        console.error("Socket.IO connection error:", error);
        hideLoader(); // Nascondi sempre il loader in caso di errore di connessione
    });

    // Entra nel canale default
    joinChannel('general');
}

function handleSocketDisconnect() {
	console.log('Disconnesso dal server Socket.IO');
	currentlyConnected = false;
	showNotification('Connessione al server persa', true);
}

// Funzione migliorata per gestire la cronologia dei messaggi
function handleMessageHistory(history) {
    console.log(`Ricevuti ${history.length} messaggi storici`);
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];

    // Aggiungi l'indicatore di inizio conversazione SOLO se non ne esiste già uno
    if (!document.querySelector('.start-of-conversation')) {
        const startConversationIndicator = document.createElement('div');
        startConversationIndicator.className = 'date-divider start-of-conversation';
        startConversationIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
        chatContainer.appendChild(startConversationIndicator);
    }

    if (history && history.length > 0) {
        // Ordina i messaggi per timestamp
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Processa e visualizza i messaggi
        let lastDate = null;
        const fragment = document.createDocumentFragment();

        history.forEach(message => {
            // Converti la stringa timestamp in oggetto Date se necessario
            if (typeof message.timestamp === 'string') {
                message.timestamp = new Date(message.timestamp);
            }
            
            // Assicurati che i campi fileData e replyTo siano correttamente inizializzati
            if (message.fileData && typeof message.fileData === 'string') {
                try {
                    message.fileData = JSON.parse(message.fileData);
                } catch (e) {
                    console.error(`Errore nel parsing di fileData per il messaggio ${message.id}:`, e);
                    message.fileData = null;
                }
            }
 
           
            // Gestisci i messaggi replyTo
            if (message.replyTo && typeof message.replyTo === 'object') {
                // Se è un oggetto vuoto, impostiamo a null
                if (Object.keys(message.replyTo).length === 0) {
                    message.replyTo = null;
                }
            }

            // Aggiungi separatore di data se necessario
            const messageDate = message.timestamp.toDateString();
            if (messageDate !== lastDate) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.innerHTML = `<span>${formatDate(message.timestamp)}</span>`;
                fragment.appendChild(divider);
                lastDate = messageDate;
            }

            // Crea e aggiungi l'elemento del messaggio
            const messageEl = createMessageElement(message);
            fragment.appendChild(messageEl);

            // Aggiungi all'array dei messaggi visualizzati
            displayedMessages.push(message);
        });

        chatContainer.appendChild(fragment);
    } else {
        // Aggiungi un messaggio se non ci sono messaggi nella cronologia
        const emptyElement = document.createElement('div');
        emptyElement.className = 'empty-messages';
        emptyElement.textContent = 'Nessun messaggio. Inizia la conversazione!';
        chatContainer.appendChild(emptyElement);
    }

    // Nascondi il loader - assicurati che venga sempre nascosto
    hideLoader();

    // Scorri in fondo
    scrollToBottom(false);

    // Reset del contatore messaggi non letti
    unreadMessages = 0;
    updateUnreadBadge();
}

// Funzione per gestire nuovi messaggi
function handleNewMessage(message) {
    console.log('Nuovo messaggio ricevuto:', message);

    // Converti timestamp in oggetto Date se necessario
    if (typeof message.timestamp === 'string') {
        message.timestamp = new Date(message.timestamp);
    }

    // Verifica se questo messaggio è un duplicato
    let isDuplicate = false;
    
    // Controlla se c'è un ID temporaneo associato a questo messaggio
    const tempId = message.tempId;
    let replacedTempMessage = false;
    
    // Se c'è un tempId, cerca messaggi con quell'ID
    if (tempId && typeof tempId === 'string' && tempId.startsWith('temp-')) {
        const tempMessageIndex = displayedMessages.findIndex(m => m.id === tempId);
        if (tempMessageIndex !== -1) {
            console.log(`Sostituendo il messaggio temporaneo ${tempId} con l'ID permanente ${message.id}`);
            
            // Trova l'elemento DOM con l'ID temporaneo
            const tempEl = document.querySelector(`.message-container[data-message-id="${tempId}"]`);
            if (tempEl) {
                // Aggiorna l'ID nell'attributo data-message-id
                tempEl.dataset.messageId = message.id;
                
                // Aggiorna anche gli attributi dei pulsanti all'interno del messaggio
                const buttons = tempEl.querySelectorAll('[data-message-id]');
                buttons.forEach(button => {
                    button.dataset.messageId = message.id;
                });
                
                // Cambia icona da orologio a spunta
                const statusIcon = tempEl.parentElement.querySelector('.timestamp i');
                if (statusIcon) {
                    statusIcon.className = 'fas fa-check';
                    statusIcon.style.opacity = '1';
                }
                
                // Rimuovi la classe sending-message per attivare le azioni
                tempEl.classList.remove('sending-message');
                
                // Sostituisci la sezione delle azioni se è in stato 'sending'
                const actionsContainer = tempEl.querySelector('.message-actions.sending');
                if (actionsContainer) {
                    const newActions = document.createElement('div');
                    newActions.className = 'message-actions';
                    newActions.innerHTML = `
                        <button class="reply-button" data-message-id="${message.id}">↩️ Reply</button>
                        <button class="menu-button" data-message-id="${message.id}">⋮</button>
                    `;
                    actionsContainer.replaceWith(newActions);
                }
                
                // Aggiorna l'oggetto del messaggio nell'array displayedMessages
                // con il nuovo ID permanente e stato 'sent'
                const tempMessage = displayedMessages[tempMessageIndex];
                tempMessage.id = message.id;
                tempMessage.status = 'sent';
                
                // Marca come già gestito
                replacedTempMessage = true;
                isDuplicate = true;
            }
        }
    }
    
    // Se non abbiamo già gestito come sostituzione di un messaggio temporaneo,
    // esegui il controllo duplicati standard
    if (!replacedTempMessage) {
        // Verifica se il messaggio esiste già in displayedMessages (controllo per ID)
        const existingMessage = displayedMessages.find(m => m.id === message.id);
        if (existingMessage) {
            isDuplicate = true;
            console.log('Messaggio duplicato rilevato per ID:', message.id);
        } else if (message.isOwn || (message.user && message.user.displayName === "You")) {
            // Se è un messaggio nostro o con nome utente "You", controlla se è un duplicato
            const recentMessages = displayedMessages.filter(m => {
                // Verifica il testo del messaggio
                const textMatch = m.text === message.text;
                
                // Verifica se il messaggio è recente (inviato negli ultimi 5 secondi)
                const isRecent = new Date() - new Date(m.timestamp) < 5000;
                
                // Controlla se è di proprietà dell'utente
                const isOwnMessage = m.isOwn;
                
                return isOwnMessage && textMatch && isRecent;
            });
            
            if (recentMessages.length > 0) {
                // È un duplicato, aggiorniamo solo lo stato
                isDuplicate = true;
                const existingMsg = recentMessages[0];
                
                // Controlla se l'ID esistente è temporaneo
                if (typeof existingMsg.id === 'string' && existingMsg.id.startsWith('temp-')) {
                    const oldId = existingMsg.id;
                    
                    // Aggiorna l'ID nell'oggetto messaggio
                    existingMsg.id = message.id;
                    existingMsg.status = 'sent';
                    
                    // Aggiorna l'ID nell'elemento DOM
                    const existingEl = document.querySelector(`.message-container[data-message-id="${oldId}"]`);
                    if (existingEl) {
                        // Aggiorna l'attributo data-message-id
                        existingEl.dataset.messageId = message.id;
                        
                        // Aggiorna anche gli attributi dei pulsanti all'interno del messaggio
                        const buttons = existingEl.querySelectorAll('[data-message-id]');
                        buttons.forEach(button => {
                            button.dataset.messageId = message.id;
                        });
                        
                        // Cambiamo icona da orologio a spunta
                        const statusIcon = existingEl.parentElement.querySelector('.timestamp i');
                        if (statusIcon) {
                            statusIcon.className = 'fas fa-check';
                            statusIcon.style.opacity = '1';
                        }
                        
                        // Rimuovi la classe sending-message e aggiungi le azioni se necessario
                        existingEl.classList.remove('sending-message');
                        
                        // Sostituisci la sezione delle azioni se è in stato 'sending'
                        const actionsContainer = existingEl.querySelector('.message-actions.sending');
                        if (actionsContainer) {
                            const newActions = document.createElement('div');
                            newActions.className = 'message-actions';
                            newActions.innerHTML = `
                                <button class="reply-button" data-message-id="${message.id}">↩️ Reply</button>
                                <button class="menu-button" data-message-id="${message.id}">⋮</button>
                            `;
                            actionsContainer.replaceWith(newActions);
                        }
                        
                        console.log(`Aggiornato ID del messaggio da ${oldId} a ${message.id}`);
                    }
                } else {
                    // Se non è temporaneo, aggiorna solo lo stato
                    const existingEl = document.querySelector(`.message-container[data-message-id="${existingMsg.id}"]`);
                    if (existingEl) {
                        // Cambiamo icona da orologio a spunta
                        const statusIcon = existingEl.parentElement.querySelector('.timestamp i');
                        if (statusIcon) {
                            statusIcon.className = 'fas fa-check';
                            statusIcon.style.opacity = '1';
                        }
                        existingMsg.status = 'sent';
                    }
                }
            }
        }
    }
    
    // Se è un duplicato, interrompiamo qui l'esecuzione
    if (isDuplicate) {
        return;
    }
    
    // Salva posizione di scroll attuale
    const chatContainer = document.getElementById('chatMessages');
    const currentScrollTop = chatContainer.scrollTop;
    const currentScrollHeight = chatContainer.scrollHeight;
    const clientHeight = chatContainer.clientHeight;
    
    // Calcola se siamo vicini al fondo (entro 50px invece di 2px)
    const isNearBottom = (currentScrollHeight - clientHeight - currentScrollTop) <= 50;
    
    // Assicurati che fileData e replyTo siano correttamente inizializzati
    if (message.fileData && typeof message.fileData === 'string') {
        try {
            message.fileData = JSON.parse(message.fileData);
        } catch (e) {
            console.error(`Errore nel parsing di fileData per il messaggio ${message.id}:`, e);
            message.fileData = null;
        }
    }
    
    // Gestisci i messaggi replyTo
    if (message.replyTo && typeof message.replyTo === 'object') {
        // Se è un oggetto vuoto, impostiamo a null
        if (Object.keys(message.replyTo).length === 0) {
            message.replyTo = null;
        }
    }
    
    // Rimuovi il messaggio "empty-messages" se esiste
    const emptyMessages = document.querySelector('.empty-messages, .empty-conversation');
    if (emptyMessages) {
        emptyMessages.remove();
    }
    
    // Aggiungi ai messaggi
    messages.push(message);
    displayedMessages.push(message);

    // Aggiungi separatori di data se necessario
    const lastMessage = displayedMessages[displayedMessages.length - 2];
    if (lastMessage) {
        const lastDate = new Date(lastMessage.timestamp).toDateString();
        const newDate = message.timestamp.toDateString();
        if (newDate !== lastDate) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${formatDate(message.timestamp)}</span>`;
            chatContainer.appendChild(divider);
        }
    }

    // Crea e aggiungi elemento messaggio
    const messageEl = createMessageElement(message);
    chatContainer.appendChild(messageEl);
    
    // Aggiorna variabili globali
    if (!isNearBottom) {
        unreadMessages++;
        updateUnreadBadge();
        
        // Forza la visualizzazione del pulsante scrollBottom
        const scrollBtn = document.getElementById('scrollBottomBtn');
        scrollBtn.classList.add('visible');
    } else {
        // Se siamo vicini al fondo, scorriamo giù
        setTimeout(() => {
            scrollToBottom(true);
        }, 100);
    }
    
    // Nascondi l'indicatore di digitazione quando arriva un messaggio
    // Aggiungiamo questa logica per gestire sia messaggi di canale che diretti
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        // Se il messaggio è da un altro utente (non nostro), nascondiamo l'indicatore
        if (!message.isOwn) {
            typingIndicator.style.display = 'none';
            delete typingIndicator.dataset.startTime;
        }
    }
}

function handleMessageDeleted(data) {
    console.log('Message deletion event received:', data);
    const messageId = data.messageId;
    
    // Trova il messaggio nel DOM
    const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageEl) {
        console.log(`Message element with ID ${messageId} not found in DOM`);
        return;
    }
    
    // Trova il message-row (elemento padre che contiene tutto)
    const messageRow = messageEl.closest('.message-row');
    if (!messageRow) {
        console.log(`Message row for message ID ${messageId} not found`);
        return;
    }
    
    // Rimuovi dagli array
    const messageIndex = displayedMessages.findIndex(m => m.id == messageId);
    if (messageIndex !== -1) {
        displayedMessages.splice(messageIndex, 1);
    }
    
    const globalIndex = messages.findIndex(m => m.id == messageId);
    if (globalIndex !== -1) {
        messages.splice(globalIndex, 1);
    }
    
    // Applica transizioni e rimuovi
    messageRow.style.opacity = '0';
    messageRow.style.height = '0';
    messageRow.style.overflow = 'hidden';
    messageRow.style.marginBottom = '0';
    messageRow.style.padding = '0';
    
    setTimeout(() => {
        // Rimuovi l'elemento completo
        messageRow.remove();
        
        // Verifica e pulisci eventuali separatori data orfani
        const dateDividers = document.querySelectorAll('.date-divider');
        
        for (let i = 0; i < dateDividers.length; i++) {
            const divider = dateDividers[i];
            let nextEl = divider.nextElementSibling;
            
            // Se l'elemento successivo è un altro separatore o non esiste, rimuovi questo separatore
            if (!nextEl || nextEl.classList.contains('date-divider')) {
                divider.remove();
            }
        }
    }, 300);
}

function handleMessageEdited(data) {
    console.log('Message edit event received:', data);
    const messageId = data.messageId;
    const newText = data.newText;
    const editedAt = data.editedAt;
    
    // Trova il messaggio nell'array
    const message = displayedMessages.find(m => m.id == messageId);
    if (!message) {
        console.log(`Message with ID ${messageId} not found in displayed messages`);
        return;
    }
    
    // Aggiorna l'oggetto messaggio
    message.text = newText;
    message.edited = true;
    message.editedAt = editedAt;
    
    // Trova l'elemento nel DOM
    const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageEl) {
        console.log(`Message element with ID ${messageId} not found in DOM`);
        return;
    }
    
    // Aggiorna il testo del messaggio con i link processati
    const textEl = messageEl.querySelector('.message-text');
    if (textEl) {
        textEl.innerHTML = linkifyText(newText);
    }
    
    // Aggiungi indicatore "edited" al timestamp se non c'è già
    const timestamp = messageEl.parentElement.querySelector('.timestamp');
    if (timestamp && !timestamp.textContent.includes('(edited)')) {
        const timeString = formatTime(new Date(message.timestamp));
        const isOwn = message.isOwn;
        
        timestamp.innerHTML = `${timeString} (edited) `;
        if (isOwn) {
            timestamp.innerHTML += '<i class="fas fa-check"></i>';
        }
    }
}

function handleUserTyping(data) {
	const userId = data.userId;
	const isTyping = data.isTyping;

	// Find the user
	const user = users.find(u => u.id == userId);
	if (user) {
		// Show/hide typing indicator
		// You can implement this UI element
	}
}

function handleModelInference(data) {
    console.log('Model inference event:', data);
    const typingIndicator = document.getElementById('typingIndicator');
    const typingText = document.getElementById('typingText');

    if (data.status === 'started') {
        // Trova il nome dell'utente con gestione più robusta degli ID
        let userName = 'Someone';
        if (data.userId) {
            // Cerca prima nell'array users
            const user = users.find(u => u.id == data.userId);
            if (user) {
                userName = user.displayName;
            } else {
                // Fallback per altri utenti che potrebbero non essere nell'array principale
                console.log(`Utente con ID ${data.userId} non trovato nell'array users`);
            }
        }

        // Mostra l'indicatore di typing
        typingText.textContent = `${userName} is typing...`;
        typingIndicator.style.display = 'flex';
        
        // Aggiungi un timestamp all'indicatore per il controllo timeout
        typingIndicator.dataset.startTime = Date.now();

        // Assicurati che sia visibile se l'utente è al fondo della chat
        const chatContainer = document.getElementById('chatMessages');
        const isAtBottom = (chatContainer.scrollHeight - chatContainer.clientHeight) <= (chatContainer.scrollTop + 20);
        if (isAtBottom) {
            requestAnimationFrame(() => {
                scrollToBottom();
            });
        }
    } else if (data.status === 'completed') {
        // Nascondi l'indicatore di typing quando l'inferenza è completata
        typingIndicator.style.display = 'none';
        delete typingIndicator.dataset.startTime;
        console.log('Typing indicator hidden after model inference completed');
    }
}

function handleUserStatusUpdate(data) {
	const userId = data.userId;
	const status = data.status;

	// Update user status in the users array
	const user = users.find(u => u.id == userId);
	if (user) {
		user.status = status;
		// Update UI if needed
	}
}

function joinChannel(channelName) {
    if (currentlyConnected) {
        showLoader(); // Mostra il loader quando si inizia a caricare
        
        // Imposta un timeout di sicurezza
        setTimeout(() => {
            // Se dopo 5 secondi il loader è ancora visibile, forzalo a nascondersi
            const loader = document.getElementById('messagesLoader');
            if (loader && loader.classList.contains('active')) {
                console.warn(`Timeout nel caricamento dei messaggi per il canale: ${channelName}`);
                hideLoader();
                
                // Mostra un messaggio di errore nella chat
                const chatContainer = document.getElementById('chatMessages');
                if (chatContainer.children.length === 0) {
                    const errorElement = document.createElement('div');
                    errorElement.className = 'empty-messages';
                    errorElement.textContent = `Errore nel caricamento dei messaggi per ${channelName}. Riprova più tardi.`;
                    chatContainer.appendChild(errorElement);
                }
            }
        }, 5000);
        
        socket.emit('joinChannel', channelName);
    }
}

function joinDirectMessage(userId) {
	if (currentlyConnected && userId) {
		socket.emit('joinDirectMessage', userId);
	}
}

function sendChannelMessage(channelName, messageData) {
    if (currentlyConnected) {
        try {
            console.log(`Inviando messaggio al canale ${channelName}:`, messageData);
            socket.emit('channelMessage', {
                channelName: channelName,
                message: messageData
            });
            
            // Aggiungi timeout di sicurezza per verificare se il messaggio è stato ricevuto
            setTimeout(() => {
                const sentMessages = displayedMessages.filter(m => 
                    m.isOwn && m.text === messageData.text && m.status !== 'sending'
                );
                
                if (sentMessages.length === 0) {
                    console.warn(`Possibile problema nell'invio del messaggio al canale ${channelName}:`, messageData);
                }
            }, 3000);
        } catch (error) {
            console.error(`Errore nell'invio del messaggio al canale ${channelName}:`, error);
            showNotification(`Errore nell'invio del messaggio: ${error.message}`, true);
        }
    } else {
        console.warn("Socket non connesso. Impossibile inviare il messaggio.");
        showNotification("Non connesso al server. Messaggio non inviato.", true);
    }
}

function sendDirectMessage(userId, messageData) {
	if (currentlyConnected) {
		socket.emit('directMessage', {
			userId: userId,
			message: messageData
		});
	}
}

function setupTypingTimeoutChecker() {
    // Controlla ogni 10 secondi se l'indicatore di typing è bloccato
    setInterval(() => {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator && typingIndicator.style.display === 'flex' && typingIndicator.dataset.startTime) {
            const startTime = parseInt(typingIndicator.dataset.startTime);
            const now = Date.now();
            
            // Se l'indicatore è visibile da più di 45 secondi, nascondilo
            if (now - startTime > 45000) {
                console.log('Typing indicator timeout - hiding it after 45 seconds');
                typingIndicator.style.display = 'none';
                delete typingIndicator.dataset.startTime;
            }
        }
    }, 10000);
}

// Export functions
export {
    initializeSocketIO,
    setupSocketIOEvents,
    handleSocketConnect,
    handleSocketDisconnect,
    handleMessageHistory,
    handleNewMessage,
    handleUserTyping,
    handleModelInference,
    joinChannel,
    sendDirectMessage,
    joinDirectMessage,
    sendChannelMessage,
    setupTypingTimeoutChecker
};
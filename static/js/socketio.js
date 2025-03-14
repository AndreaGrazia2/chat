/**
 * socketio.js - Gestione Socket.IO e comunicazione tempo reale
 * 
 * Gestisce:
 * - Connessione al server Socket.IO
 * - Eventi per i canali e messaggi diretti
 * - Invio e ricezione messaggi in tempo reale
 */

// Importa socket.io-client per i test
let io;
if (typeof window !== 'undefined' && window.io) {
	// Nel browser, usa la variabile globale io
	io = window.io;
} else if (typeof require !== 'undefined') {
	// In Node.js (per i test), importa socket.io-client
	io = require('socket.io-client');
}

// Variabili globali per Socket.IO
let socket;
let currentlyConnected = false;

/**
 * Inizializza la connessione Socket.IO
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

/**
 * Configura tutti gli eventi Socket.IO
 */
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
}

/**
 * Gestisce l'evento di connessione
 */
function handleSocketConnect() {
	console.log('Connesso al server Socket.IO');
	currentlyConnected = true;

	// Entra nel canale default
	joinChannel('general');
}

/**
 * Gestisce l'evento di disconnessione
 */
function handleSocketDisconnect() {
	console.log('Disconnesso dal server Socket.IO');
	currentlyConnected = false;
	showNotification('Connessione al server persa', true);
}

/**
 * Gestisce la ricezione della cronologia messaggi
 * @param {Array} history - Array di messaggi
 */
function handleMessageHistory(history) {
    console.log(`Ricevuti ${history.length} messaggi storici`);
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];

    if (history && history.length > 0) {
        // Sort messages by timestamp
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Process and display messages
        let lastDate = null;
        const fragment = document.createDocumentFragment();

        history.forEach(message => {
            // Convert timestamp string to Date object if needed
            if (typeof message.timestamp === 'string') {
                message.timestamp = new Date(message.timestamp);
            }
            
            // Assicurati che il messaggio replyTo sia valido
            if (message.replyTo && typeof message.replyTo === 'object') {
                // Se è un'oggetto vuoto, impostiamo a null
                if (Object.keys(message.replyTo).length === 0) {
                    message.replyTo = null;
                }
            }

            // Add date divider if needed
            const messageDate = message.timestamp.toDateString();
            if (messageDate !== lastDate) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.innerHTML = `<span>${formatDate(message.timestamp)}</span>`;
                fragment.appendChild(divider);
                lastDate = messageDate;
            }

            // Create and add message element
            const messageEl = createMessageElement(message);
            fragment.appendChild(messageEl);

            // Add to displayed messages array
            displayedMessages.push(message);
        });

        chatContainer.appendChild(fragment);
    }

    // Hide loader
    hideLoader();

    // Scroll to bottom
    scrollToBottom(false);

    // Reset unread count
    unreadMessages = 0;
    updateUnreadBadge();
}

/**
 * Gestisce la ricezione di un nuovo messaggio
 * @param {Object} message - Oggetto messaggio
 */
/**
 * Gestisce la ricezione di un nuovo messaggio
 * @param {Object} message - Oggetto messaggio
 */
/**
 * Gestisce la ricezione di un nuovo messaggio
 * @param {Object} message - Oggetto messaggio
 */
/**
 * Gestisce la ricezione di un nuovo messaggio
 * @param {Object} message - Oggetto messaggio
 */
function handleNewMessage(message) {
    console.log('Nuovo messaggio ricevuto:', message);

    // Se è un messaggio nostro che abbiamo già mostrato, non mostrarlo di nuovo
    if (message.isOwn || (message.user && message.user.name === "You")) {
        // Troviamo se abbiamo già questo messaggio o uno molto simile
        const recentMessages = displayedMessages.filter(m => {
            return m.isOwn && 
                   m.text === message.text && 
                   (new Date() - new Date(m.timestamp) < 5000); // 5 secondi
        });
        
        if (recentMessages.length > 0) {
            // Aggiorniamo solo lo stato
            const existingMsg = recentMessages[0];
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
            return; // Ignora messaggio duplicato
        }
    }

    // Converti timestamp se necessario
    if (typeof message.timestamp === 'string') {
        message.timestamp = new Date(message.timestamp);
    }
    
    // Salva posizione di scroll attuale
    const chatContainer = document.getElementById('chatMessages');
    const currentScrollTop = chatContainer.scrollTop;
    const currentScrollHeight = chatContainer.scrollHeight;
    const clientHeight = chatContainer.clientHeight;
    
    // Calcola rigorosamente se siamo in fondo (entro 2px)
    const isExactlyAtBottom = (currentScrollHeight - clientHeight - currentScrollTop) <= 2;
    
    // BLOCCO TOTALE di gestione scroll automatica
    // Sovrascriviamo temporaneamente scrollToBottom per impedire scrolling automatico
    const originalScrollToBottom = window.scrollToBottom;
    window.scrollToBottom = function() {
        console.log("Scrolling automatico bloccato");
        return false;
    };
    
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
    if (!isExactlyAtBottom) {
        unreadMessages++;
        const badge = document.getElementById('newMessagesBadge');
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
        badge.style.display = 'flex';
        
        // Forza la visualizzazione del pulsante scrollBottom
        const scrollBtn = document.getElementById('scrollBottomBtn');
        scrollBtn.classList.add('visible');
    }
    
    // Ripristina la posizione di scroll esatta
    chatContainer.scrollTop = currentScrollTop;
    
    // Ripristina la funzione originale dopo breve tempo
    setTimeout(() => {
        window.scrollToBottom = originalScrollToBottom;
        
        // Se eravamo esattamente in fondo, ora possiamo scrollare
        if (isExactlyAtBottom) {
            originalScrollToBottom(true);
        }
        
        // Nascondi l'indicatore di digitazione
        if (!message.isOwn) {
            document.getElementById('typingIndicator').style.display = 'none';
        }
    }, 300);
}

/**
 * Gestisce l'evento di digitazione
 * @param {Object} data - Dati dell'evento
 */
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

/**
 * Gestisce l'inferenza del modello AI
 * @param {Object} data - Dati dell'evento
 */
function handleModelInference(data) {
	console.log('Model inference event:', data);
	const typingIndicator = document.getElementById('typingIndicator');
	const typingText = document.getElementById('typingText');

	if (data.status === 'started') {
		// Trova il nome dell'utente
		let userName = 'Someone';
		if (data.userId) {
			const user = users.find(u => u.id == data.userId);
			if (user) {
				userName = user.name;
			}
		}

		// Mostra l'indicatore di typing
		typingText.textContent = `${userName} is typing...`;
		typingIndicator.style.display = 'flex';

		// Assicurati che sia visibile se l'utente è al fondo della chat
		const chatContainer = document.getElementById('chatMessages');
		const isAtBottom = (chatContainer.scrollHeight - chatContainer.clientHeight) <= (chatContainer.scrollTop + 20);
		if (isAtBottom) {
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	} else if (data.status === 'completed') {
		// Nascondi l'indicatore di typing
		typingIndicator.style.display = 'none';
	}
}

/**
 * Gestisce l'aggiornamento dello stato utente
 * @param {Object} data - Dati dell'evento
 */
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

/**
 * Si unisce a un canale
 * @param {string} channelName - Nome del canale
 */
function joinChannel(channelName) {
	if (currentlyConnected) {
		socket.emit('joinChannel', channelName);
	}
}

/**
 * Si unisce a una conversazione diretta
 * @param {number} userId - ID dell'utente
 */
function joinDirectMessage(userId) {
	if (currentlyConnected && userId) {
		socket.emit('joinDirectMessage', userId);
	}
}

/**
 * Invia un messaggio al canale
 * @param {string} channelName - Nome del canale
 * @param {Object} messageData - Dati del messaggio
 */
function sendChannelMessage(channelName, messageData) {
	if (currentlyConnected) {
		socket.emit('channelMessage', {
			channelName: channelName,
			message: messageData
		});
	}
}

/**
 * Invia un messaggio diretto
 * @param {number} userId - ID dell'utente
 * @param {Object} messageData - Dati del messaggio
 */
function sendDirectMessage(userId, messageData) {
	if (currentlyConnected) {
		socket.emit('directMessage', {
			userId: userId,
			message: messageData
		});
	}
}

/**
 * Emette evento di digitazione
 * @param {number} userId - ID dell'utente (per DM)
 * @param {string} channelName - Nome del canale (per canali)
 * @param {boolean} isTyping - Se l'utente sta digitando
 */
function sendTypingEvent(userId, channelName, isTyping) {
	if (currentlyConnected) {
		if (channelName) {
			socket.emit('typing', {
				channelName: channelName,
				isTyping: isTyping
			});
		} else if (userId) {
			socket.emit('typing', {
				userId: userId,
				isTyping: isTyping
			});
		}
	}
}

/**
 * Debug di Socket.IO
 */
function debugSocketIO() {
	console.log("=== Socket.IO Debug ===");
	console.log("Connected:", socket.connected);
	console.log("Current channel:", currentChannel);
	console.log("Is direct message:", isDirectMessage);
	console.log("Current user:", currentUser);
	console.log("Displayed messages:", displayedMessages.length);
	console.log("========================");
}

// Esporta le funzioni per i test
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		initializeSocket: initializeSocketIO,
		sendMessage: function (text) {
			if (socket) {
				socket.emit('channelMessage', {
					channelName: 'general',
					message: {
						text: text,
						replyTo: null
					}
				});
			}
		},
		editMessage: function (messageId, newText) {
			if (socket) {
				socket.emit('editMessage', {
					id: messageId,
					text: newText,
					channel: 'general',
					isDirectMessage: false
				});
			}
		},
		deleteMessage: function (messageId) {
			if (socket) {
				socket.emit('deleteMessage', {
					id: messageId,
					channel: 'general',
					isDirectMessage: false
				});
			}
		},
		reconnectSocket: function () {
			if (socket && !socket.connected) {
				socket.connect();
				console.log('Attempting to reconnect...');
			} else {
				console.log('Socket already connected');
			}
		},
		joinChannel: function (channelName) {
			if (socket) {
				socket.emit('joinChannel', channelName);
			}
		},
		leaveChannel: function (channelName) {
			if (socket) {
				socket.emit('leaveChannel', channelName);
			}
		}
	};
}
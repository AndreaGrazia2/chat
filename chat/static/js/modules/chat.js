import { sendChannelMessage } from './socket.js'
import { updateUnreadBadge}  from './uiNavigation.js';
import { showNotification}  from './utils.js';

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text) {
        // Crea oggetto messaggio con ID temporaneo
        const tempId = "temp-" + Date.now();

        const userObj = {
            id: users[0].id,
            displayName: users[0].name,      // Standardizza name -> displayName
            avatarUrl: users[0].avatar,      // Standardizza avatar -> avatarUrl
            status: users[0].status
        };

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
        
        // Se è un messaggio diretto, mostra subito l'indicatore di digitazione
        if (isDirectMessage && currentUser) {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            typingText.textContent = `${currentUser.name} is typing...`;
            typingIndicator.style.display = 'flex';
            typingIndicator.dataset.startTime = Date.now(); // Aggiungi timestamp
        }
        
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

function getUserIdByName(name) {
    // Cerca prima nelle variabili globali se disponibili
    if (typeof users !== 'undefined') {
        const user = users.find(u => u.name === name);
        if (user) return user.id;
    }
    
    // Altrimenti, usa una mappatura hardcoded
    const userMap = {
        'John Doe': 2,
        'Jane Smith': 3,
        'Mike Johnson': 4,
        'Emma Davis': 5
    };
    
    return userMap[name] || null;
}

// Funzione per aggiungere un reaction a un messaggio
function addReaction(messageId, emoji) {
    if (!messageId || !emoji) return;
    
    console.log(`Adding reaction ${emoji} to message ${messageId}`);
    
    if (currentlyConnected) {
        socket.emit('addReaction', {
            messageId: messageId,
            emoji: emoji
        });
    }
}

// Funzione per rimuovere un reaction da un messaggio
function removeReaction(messageId, emoji) {
    if (!messageId || !emoji) return;
    
    console.log(`Removing reaction ${emoji} from message ${messageId}`);
    
    if (currentlyConnected) {
        socket.emit('removeReaction', {
            messageId: messageId,
            emoji: emoji
        });
    }
}

// Gestore per l'evento di aggiornamento delle reaction a un messaggio
function handleMessageReactionUpdate(data) {
    console.log('Reaction update received:', data);
    
    // Trova il messaggio nell'array
    const message = displayedMessages.find(m => m.id == data.messageId);
    if (!message) {
        console.log(`Message with ID ${data.messageId} not found`);
        return;
    }
    
    // Aggiorna le reactions nel messaggio
    message.reactions = data.reactions;
    
    // Aggiorna la visualizzazione delle reactions nel DOM
    const messageEl = document.querySelector(`.message-container[data-message-id="${data.messageId}"]`);
    if (!messageEl) {
        console.log(`Message element with ID ${data.messageId} not found in DOM`);
        return;
    }
    
    // Trova il container delle reactions o creane uno nuovo
    let reactionsContainer = messageEl.querySelector('.message-reactions');
    if (reactionsContainer) {
        reactionsContainer.remove();
    }
    
    // Se ci sono reactions, crea un nuovo container
    if (data.reactions && Object.keys(data.reactions).length > 0) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        
        for (const [emoji, users] of Object.entries(data.reactions)) {
            if (Array.isArray(users) && users.length > 0) {
                const reactionEl = document.createElement('span');
                reactionEl.className = 'reaction';
                if (users.includes('1')) { // Assume user ID 1 is current user
                    reactionEl.classList.add('user-reacted');
                }
                reactionEl.dataset.emoji = emoji;
                reactionEl.dataset.users = users.join(',');
                reactionEl.title = `${users.length} reaction${users.length > 1 ? 's' : ''}`;
                reactionEl.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
                
                // Aggiungi evento click per toggle reaction
                reactionEl.addEventListener('click', function() {
                    if (users.includes('1')) {
                        removeReaction(data.messageId, emoji);
                    } else {
                        addReaction(data.messageId, emoji);
                    }
                });
                
                reactionsContainer.appendChild(reactionEl);
            }
        }
        
        // Inserisci il container delle reactions nel messaggio
        const messageBubble = messageEl.querySelector('.message-bubble');
        const messageText = messageEl.querySelector('.message-text');
        messageBubble.insertBefore(reactionsContainer, messageText.nextSibling);
    }
}

// Inizializza il pannello delle reaction
function initReactionPanel() {
    // Crea un pannello per selezionare le emoji per le reactions
    const reactionPanel = document.createElement('div');
    reactionPanel.className = 'reaction-panel';
    reactionPanel.style.display = 'none';
    
    // Aggiungi le emoji più comuni
    const commonEmojis = ['👍', '❤️', '😊', '😂', '🎉', '👏', '🔥', '✅', '❓', '👎'];
    
    commonEmojis.forEach(emoji => {
        const emojiButton = document.createElement('span');
        emojiButton.className = 'emoji-button';
        emojiButton.textContent = emoji;
        emojiButton.addEventListener('click', function() {
            const messageId = reactionPanel.dataset.messageId;
            addReaction(messageId, emoji);
            reactionPanel.style.display = 'none';
        });
        
        reactionPanel.appendChild(emojiButton);
    });
    
    document.body.appendChild(reactionPanel);
    
    // Funzione per mostrare il pannello delle reaction
    window.showReactionPanel = function(messageId, x, y) {
        reactionPanel.dataset.messageId = messageId;
        reactionPanel.style.left = `${x}px`;
        reactionPanel.style.top = `${y}px`;
        reactionPanel.style.display = 'flex';
    };
    
    // Nascondi il pannello quando si clicca altrove
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.reaction-panel') && !e.target.closest('.add-reaction-button')) {
            reactionPanel.style.display = 'none';
        }
    });
}

// Aggiungi opzione per reactions nel menu contestuale dei messaggi
function extendContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        // Aggiungi voce di menu per le reactions dopo "Reply"
        const replyItem = contextMenu.querySelector('[data-action="reply"]');
        if (replyItem) {
            const reactionItem = document.createElement('div');
            reactionItem.className = 'menu-item';
            reactionItem.dataset.action = 'react';
            reactionItem.textContent = 'Add reaction';
            
            // Inserisci dopo "Reply"
            replyItem.parentNode.insertBefore(reactionItem, replyItem.nextSibling);
        }
        
        // Aggiorna handler degli eventi del menu contestuale
        contextMenu.addEventListener('click', function(e) {
            if (e.target.dataset.action === 'react') {
                const messageId = this.dataset.messageId;
                const rect = e.target.getBoundingClientRect();
                showReactionPanel(messageId, rect.right, rect.top);
            }
        });
    }
}

// Inizializza tutto ciò che riguarda le reactions
function initReactions() {
    // Crea il pannello delle reactions
    initReactionPanel();
    
    // Estendi il menu contestuale
    extendContextMenu();
    
    // Aggiungi eventi a reactions esistenti
    document.addEventListener('click', function(e) {
        if (e.target.closest('.reaction')) {
            const reactionEl = e.target.closest('.reaction');
            const messageEl = reactionEl.closest('.message-container');
            if (messageEl) {
                const messageId = messageEl.dataset.messageId;
                const emoji = reactionEl.dataset.emoji;
                const users = reactionEl.dataset.users.split(',');
                
                if (users.includes('1')) { // Assume user ID 1 is current user
                    removeReaction(messageId, emoji);
                } else {
                    addReaction(messageId, emoji);
                }
            }
        }
    });
    
    // Registra l'handler per l'evento di aggiornamento delle reaction
    socket.on('messageReactionUpdate', handleMessageReactionUpdate);
}

export {
    sendMessage,
    handleMessageReactionUpdate
};

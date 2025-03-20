/**
 * chat.js - Gestione messaggi e conversazioni
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

function createMessageElement(message) {
    // All'inizio della funzione createMessageElement, aggiungi:
    //console.log("Oggetto messaggio:", JSON.stringify(message.user, null, 2));

    console.log("DEBUG - Oggetto messaggio completo:", message);
    console.log("DEBUG - Proprietà user:", message.user);

    // Crea prima la riga che conterrà il messaggio e il timestamp
    const messageRow = document.createElement('div');
    messageRow.className = 'message-row';
    
    // Crea il contenitore del messaggio
    const messageEl = document.createElement('div');
    messageEl.className = 'message-container';
    messageEl.dataset.messageId = message.id;
    
    if (message.isOwn) {
        messageEl.classList.add('own-message');
    }
    
    // Assicura che il timestamp sia un oggetto Date
    if (typeof message.timestamp === 'string') {
        message.timestamp = new Date(message.timestamp);
    }
    
    // Gestisce citazione/risposta
    let quotedHtml = '';
    if (message.replyTo) {
        // Visualizzazione diversa in base al tipo di messaggio
        let quoteIcon = '';
        const replyToMessage = message.replyTo;
        
        if (replyToMessage.type === 'file') {
            quoteIcon = `<i class="fas fa-file"></i>`;
        } else if (replyToMessage.type === 'forwarded') {
            quoteIcon = `<i class="fas fa-share"></i>`;
        }
        
        quotedHtml = `
            <div class="quoted-message">
                <div class="quoted-user">${quoteIcon} ${replyToMessage.user.displayName}</div>
                <div class="quoted-text">${replyToMessage.text}</div>
            </div>
        `;
    }
    
    // Gestisce visualizzazione messaggio inoltrato
    let forwardedHtml = '';
    if (message.type === 'forwarded' && message.forwardedFrom) {
        forwardedHtml = `
            <div class="forwarded-header">
                <i class="fas fa-share"></i> Forwarded from ${message.forwardedFrom.displayName}
            </div>
        `;
    }
    
    // Gestisce visualizzazione allegato file
    let fileHtml = '';
    if (message.type === 'file' && message.fileData) {
        const file = message.fileData;
        fileHtml = `
            <div class="file-attachment">
                <div class="file-icon">
                    <i class="fas ${file.icon}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}.${file.ext}</div>
                    <div class="file-size">${file.size}</div>
                </div>
                <div class="file-download">
                    <i class="fas fa-download"></i>
                </div>
            </div>
        `;
    }
    
     // Aggiungi spunte per messaggi propri con stato
    let statusIndicator = '';
    if (message.isOwn) {
        if (message.status === 'sending') {
            statusIndicator = '<i class="fas fa-clock" style="opacity: 0.5;"></i>';
        } else {
            statusIndicator = '<i class="fas fa-check"></i>';
        }
    }   
    // Elabora testo per convertire URL in link
    const processedText = linkifyText(message.text);
    
    // Costruisci l'HTML del messaggio
    messageEl.innerHTML = `
        <div class="avatar">
            <img src="${message.user.avatarUrl}" alt="${message.user.displayName}">
        </div>
        <div class="message-content">
            <div class="message-header">
                <div class="user-name">${message.user.displayName}</div>
            </div>
            <div class="message-bubble ${message.type === 'forwarded' ? 'forwarded-message' : ''}">
                ${forwardedHtml}
                ${quotedHtml}
                <div class="message-text">${processedText}</div>
                ${fileHtml}
            </div>
            <div class="message-actions">
                <button class="reply-button" data-message-id="${message.id}">↩️ Reply</button>
                <button class="menu-button" data-message-id="${message.id}">⋮</button>
            </div>
        </div>
    `;
    
    // Crea il timestamp separato
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.innerHTML = `${formatTime(message.timestamp)} ${statusIndicator}`;
    
    // Assembla la riga completa
    messageRow.appendChild(messageEl);
    messageRow.appendChild(timestamp);
    
    return messageRow;
}

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
            tempId: tempId // Invia l'ID temporaneo per il riconoscimento
        };
        
        // Se è un messaggio diretto, mostra subito l'indicatore di digitazione
        if (isDirectMessage && currentUser) {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            typingText.textContent = `${currentUser.name} is typing...`;
            typingIndicator.style.display = 'flex';
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

function handleReply(messageId) {
    const message = displayedMessages.find(m => m.id == messageId);
    if (!message) return;
    
    replyingTo = message;
    
    // Rimuovi eventuale preview risposta esistente
    const existingPreview = document.querySelector('.reply-preview');
    if (existingPreview) existingPreview.remove();
    
    // Crea icona in base al tipo di messaggio
    let typeIcon = '';
    if (message.type === 'file') {
        typeIcon = '<i class="fas fa-file"></i>';
    } else if (message.type === 'forwarded') {
        typeIcon = '<i class="fas fa-share"></i>';
    }
    
    // Crea e inserisci preview risposta
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.innerHTML = `
        <div class="reply-text">${typeIcon} Replying to ${message.user.name}: "${message.text.substring(0, 30)}${message.text.length > 30 ? '...' : ''}"</div>
        <button class="cancel-reply">✕</button>
    `;
    
    const inputArea = document.querySelector('.input-area');
    inputArea.insertBefore(replyPreview, document.querySelector('.message-input-container'));
    
    // Allega evento cancel al nuovo pulsante
    const cancelBtn = replyPreview.querySelector('.cancel-reply');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelReply);
    }
    
    // Focus sul campo input
    document.getElementById('messageInput').focus();
}

function cancelReply() {
    replyingTo = null;
    const replyPreview = document.querySelector('.reply-preview');
    if (replyPreview) {
        replyPreview.remove();
    }
}

function forwardMessage(messageId) {
    const message = displayedMessages.find(m => m.id == messageId);
    if (!message || !currentlyConnected) return;
    
    // Crea dati messaggio inoltrato
    const forwardData = {
        text: message.text,
        type: 'forwarded',
        forwardedFrom: message.user
    };
    
    try {
        // Emetti messaggio al server in base al tipo di chat
        if (isDirectMessage && currentUser) {
            sendDirectMessage(currentUser.id, forwardData);
        } else {
            sendChannelMessage(currentChannel, forwardData);
        }
        
        // Mostra notifica
        showNotification('Messaggio inoltrato');
    } catch (error) {
        console.error("Errore nell'inoltro del messaggio:", error);
        showNotification("Errore nell'inoltro del messaggio", true);
    }
}

function copyMessageText(messageId) {
    const message = displayedMessages.find(m => m.id == messageId);
    if (message) {
        navigator.clipboard.writeText(message.text).then(() => {
            showNotification('Copied to clipboard');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            showNotification('Failed to copy text', true);
        });
    }
}

function editMessage(messageId) {
    const message = displayedMessages.find(m => m.id == messageId);
    if (!message || !message.isOwn) return;
    
    // Trova l'elemento messaggio
    const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    // Ottieni l'elemento testo messaggio
    const textEl = messageEl.querySelector('.message-text');
    if (!textEl) return;
    
    // Verifica se stiamo già modificando
    if (textEl.querySelector('.edit-input')) return;
    
    // Mostra indicatore modifica
    const editIndicator = document.getElementById('editIndicator');
    editIndicator.classList.add('active');
    
    // Estrai testo originale (senza markup HTML)
    let originalText = message.text;
    
    // Assicura lock modifica
    historyScrollLock = true;
    lastHistoryLockTime = Date.now();
    
    // Salva posizione scroll corrente
    const chatContainer = document.getElementById('chatMessages');
    const scrollTop = chatContainer.scrollTop;
    
    // Sostituisci con input modificabile
    const editArea = document.createElement('div');
    editArea.className = 'edit-area';
    editArea.innerHTML = `
        <textarea class="edit-input" style="width: 100%; min-height: 40px; padding: 4px; border: 1px solid var(--primary); border-radius: 4px; resize: vertical; background: var(--bg-main); color: var(--text-color);">${originalText}</textarea>
        <div class="edit-actions" style="display: flex; margin-top: 6px; gap: 8px;">
            <button class="save-edit" style="background: var(--primary); color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">Save</button>
            <button class="cancel-edit" style="background: none; border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 4px; cursor: pointer; color: var(--text-color);">Cancel</button>
        </div>
    `;
    
    // Cancella elemento testo e aggiungi area modifica
    textEl.innerHTML = '';
    textEl.appendChild(editArea);
    
    // Memorizza operazione di modifica corrente per evitare conflitti
    pendingEditOperation = {
        messageId: messageId,
        originalText: originalText
    };
    
    // Mantieni posizione scroll
    requestAnimationFrame(() => {
        chatContainer.scrollTop = scrollTop;
        
        // Focus sulla textarea
        const textarea = editArea.querySelector('.edit-input');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    
    // Aggiungi event listener per salvataggio e annullamento
    const saveBtn = editArea.querySelector('.save-edit');
    const cancelBtn = editArea.querySelector('.cancel-edit');
    
    const finishEditing = () => {
        editIndicator.classList.remove('active');
        pendingEditOperation = null;
        historyScrollLock = false;
    };
    
    saveBtn.addEventListener('click', function() {
        const textarea = editArea.querySelector('.edit-input');
        const newText = textarea.value.trim();
        
        if (newText) {
            // Salva posizione scroll corrente
            const currentScrollTop = chatContainer.scrollTop;
            
            // Aggiorna oggetto messaggio
            message.text = newText;
            message.edited = true;
            
            // Elabora link nel nuovo testo
            const processedText = linkifyText(newText);
            
            // Aggiorna DOM
            textEl.innerHTML = processedText;
            
            // Aggiungi indicatore modifica
            const timestamp = messageEl.parentElement.querySelector('.timestamp');
            if (!timestamp.textContent.includes('(edited)')) {
                timestamp.innerHTML = `${formatTime(message.timestamp)} (edited) `;
                if (message.isOwn) {
                    timestamp.innerHTML += '<i class="fas fa-check"></i>';
                }
            }
            
            // Mantieni posizione scroll
            requestAnimationFrame(() => {
                chatContainer.scrollTop = currentScrollTop;
            });
            
            // Mostra notifica
            showNotification('Message edited');
            
            // Nascondi indicatore modifica
            finishEditing();
        }
    });
    
    cancelBtn.addEventListener('click', function() {
        // Salva posizione scroll corrente
        const currentScrollTop = chatContainer.scrollTop;
        textEl.innerHTML = linkifyText(originalText);
        
        // Mantieni posizione scroll
        requestAnimationFrame(() => {
            chatContainer.scrollTop = currentScrollTop;
        });
        
        // Nascondi indicatore modifica
        finishEditing();
    });
}

function deleteMessage(messageId) {
    const messageIndex = displayedMessages.findIndex(m => m.id == messageId);
    if (messageIndex === -1) return;
    
    const message = displayedMessages[messageIndex];
    if (!message.isOwn) return;
    
    // Chiedi conferma
    showConfirmDialog("Are you sure you want to delete this message?", function() {
        // Salva posizione scroll corrente
        const chatContainer = document.getElementById('chatMessages');
        const scrollTop = chatContainer.scrollTop;
        const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 20;
        
        // Memorizza altezza elemento prima di modificarlo
        const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
        if (!messageEl) return;
        
        const originalHeight = messageEl.offsetHeight;
        
        // Rimuovi dagli array
        displayedMessages.splice(messageIndex, 1);
        const globalIndex = messages.findIndex(m => m.id == messageId);
        
        if (globalIndex !== -1) {
            messages.splice(globalIndex, 1);
        }
        
        // Applica transizioni
        messageEl.style.opacity = '0';
        messageEl.style.height = '0';
        messageEl.style.overflow = 'hidden';
        messageEl.style.marginBottom = '0';
        messageEl.style.padding = '0';
        
        setTimeout(() => {
            // Rimuovi l'elemento
            messageEl.remove();
            
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
            
            // Mantieni posizione scroll
            requestAnimationFrame(() => {
                if (isAtBottom) {
                    scrollToBottom(false);
                } else {
                    // Aggiusta posizione scroll per tenere conto del contenuto rimosso
                    chatContainer.scrollTop = Math.max(0, scrollTop - originalHeight);
                }
            });
            
            showNotification('Message deleted');
        }, 300);
    });
}

function loadChannelMessages(channelName, scrollToBottom = true) {
    currentConversationId = channelName;
    isChannel = true;
    
    // Resetta lo stato dei messaggi
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    oldestMessageId = null;
    hasMoreMessages = true;
    isLoadingMessages = false;
    
    // Aggiorna l'intestazione della chat
    document.getElementById('currentChannel').textContent = channelName;
    document.querySelector('.chat-title-hash').style.display = 'inline';
    
    // Mostra un loader
    showLoader();
    console.log(`Loading messages for channel: ${channelName}`);
    
    // Carica i messaggi dal server
    fetch(`/chat/api/messages/channel/${channelName}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            console.log(`Received ${messages.length} messages for channel ${channelName}`);
            
            // IMPORTANTE: Nascondi il loader qui, senza condizioni
            hideLoader();
            
            if (messages.length > 0) {
                // Trova il messaggio con ID più piccolo (il più vecchio)
                const oldestMsg = messages.reduce((prev, curr) => 
                    (prev.id < curr.id) ? prev : curr
                );
                oldestMessageId = oldestMsg.id;
                console.log("Set oldestMessageId to:", oldestMessageId);
                
                // Aggiungi indicatore di inizio conversazione
                const startConversationIndicator = document.createElement('div');
                startConversationIndicator.className = 'date-divider start-of-conversation';
                startConversationIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
                chatMessages.appendChild(startConversationIndicator);
                
                // Renderizza i messaggi
                renderMessages(messages);
                
                // Scorri fino in fondo se richiesto
                if (scrollToBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                console.log(`No messages found for channel ${channelName}`);
                // Mostra un messaggio se non ci sono messaggi
                const emptyElement = document.createElement('div');
                emptyElement.className = 'empty-messages';
                emptyElement.textContent = 'No messages yet. Start the conversation!';
                chatMessages.appendChild(emptyElement);
            }
        })
        .catch(error => {
            console.error('Error loading channel messages:', error);
            
            // IMPORTANTE: Nascondi il loader anche in caso di errore
            hideLoader();
            
            // Mostra un messaggio di errore
            const errorElement = document.createElement('div');
            errorElement.className = 'empty-messages error-message';
            errorElement.textContent = `Error loading messages: ${error.message}`;
            chatMessages.appendChild(errorElement);
            
            showNotification('Error loading channel messages: ' + error.message, true);
        });
}

function loadDirectMessages(userId, userName, scrollToBottom = true) {
    currentConversationId = userId;
    isChannel = false;
    
    // Resetta lo stato dei messaggi
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    oldestMessageId = null;
    hasMoreMessages = true;
    isLoadingMessages = false;
    
    // Aggiorna l'intestazione della chat
    document.getElementById('currentChannel').textContent = userName;
    document.querySelector('.chat-title-hash').style.display = 'none';
    
    // Mostra un loader
    showLoader();
    
    // Carica i messaggi dal server
    fetch(`/chat/api/messages/dm/${userId}`)
        .then(response => response.json())
        .then(messages => {
            hideLoader();
            
            if (messages.length > 0) {
                // Trova il messaggio con ID più piccolo (il più vecchio)
                const oldestMsg = messages.reduce((prev, curr) => 
                    (prev.id < curr.id) ? prev : curr
                );
                oldestMessageId = oldestMsg.id;
                console.log("Set oldestMessageId to:", oldestMessageId);
                
                // Aggiungi indicatore di inizio conversazione
                const startConversationIndicator = document.createElement('div');
                startConversationIndicator.className = 'date-divider start-of-conversation';
                startConversationIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
                chatMessages.appendChild(startConversationIndicator);
                
                // Renderizza i messaggi
                renderMessages(messages);
                
                // Scorri fino in fondo se richiesto
                if (scrollToBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                // Mostra un messaggio se non ci sono messaggi
                const emptyElement = document.createElement('div');
                emptyElement.className = 'empty-messages';
                emptyElement.textContent = 'No messages yet. Start the conversation!';
                chatMessages.appendChild(emptyElement);
            }
        })
        .catch(error => {
            console.error('Error loading direct messages:', error);
            hideLoader();
            
            // Mostra un messaggio di errore
            showNotification('Error loading direct messages: ' + error.message, true);
        });
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) return;
    
    console.log("Rendering messages:", messages.length);
    
    // Ordina cronologicamente (dal più vecchio al più nuovo)
    messages.sort((a, b) => new Date(a.timestamp || a.created_at) - new Date(b.timestamp || b.created_at));
    
    const chatMessages = document.querySelector('.chat-messages');
    let lastDate = null;
    const fragment = document.createDocumentFragment();
    
    // Per tenere traccia dei messaggi visualizzati se esiste la variabile globale
    if (typeof displayedMessages !== 'undefined' && !Array.isArray(displayedMessages)) {
        displayedMessages = [];
    }
    
    // Crea un set di ID di messaggi già visualizzati per un controllo rapido
    const displayedMessageIds = new Set();
    if (Array.isArray(displayedMessages)) {
        displayedMessages.forEach(msg => {
            if (msg && msg.id) {
                displayedMessageIds.add(msg.id);
            }
        });
    }
    
    messages.forEach(message => {
        // Normalizza il timestamp
        message.timestamp = message.timestamp || message.created_at || new Date();
        
        // Salta i messaggi duplicati
        if (message.id && displayedMessageIds.has(message.id)) {
            console.log('Skipping duplicate message in renderMessages:', message.id);
            return;
        }
        
        // Converti timestamp se necessario
        if (typeof message.timestamp === 'string') {
            message.timestamp = new Date(message.timestamp);
        }
        
        // Aggiungi separatore data se necessario
        const messageDate = message.timestamp.toDateString();
        if (messageDate !== lastDate) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${formatDate(message.timestamp)}</span>`;
            fragment.appendChild(divider);
            lastDate = messageDate;
        }
        
        // Crea elemento messaggio
        const messageEl = createMessageElement(message);
        fragment.appendChild(messageEl);
        
        // Aggiungi alla lista dei messaggi visualizzati
        if (Array.isArray(displayedMessages)) {
            displayedMessages.push(message);
            displayedMessageIds.add(message.id);
        }
    });
    
    // Aggiungi tutti i messaggi al container
    chatMessages.appendChild(fragment);
}

function loadInitialData() {
    console.log('Reloading initial data...');
    
    // Ricarica utenti
    fetch('/chat/api/users')
        .then(response => response.json())
        .then(users => {
            console.log('Users loaded:', users.length);
            renderUsersList(users);
        })
        .catch(error => {
            console.error('Error loading users:', error);
        });
    
    // Ricarica canali
    fetch('/chat/api/channels')
        .then(response => response.json())
        .then(channels => {
            console.log('Channels loaded:', channels.length);
            renderChannelsList(channels);
        })
        .catch(error => {
            console.error('Error loading channels:', error);
        });
}

function refreshCurrentConversation() {
    // Verifica se siamo in un canale o in una DM
    const activeChannel = document.querySelector('.channel-item.active');
    const activeUser = document.querySelector('.user-item.active');
    
    if (activeChannel) {
        // Siamo in un canale
        const channelName = activeChannel.textContent.trim().replace('#', '');
        loadChannelMessages(channelName);
        console.log('Refreshed channel:', channelName);
    } else if (activeUser) {
        // Siamo in una DM
        const userName = activeUser.textContent.trim();
        const userId = getUserIdByName(userName);
        if (userId) {
            loadDirectMessages(userId, userName);
            console.log('Refreshed DM with user:', userName, 'ID:', userId);
        }
    } else {
        console.log('No active conversation to refresh');
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


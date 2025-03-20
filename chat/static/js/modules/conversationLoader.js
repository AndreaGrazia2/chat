import { showNotification}  from './utils.js';

/**
 * conversationLoader.js - Functions for loading conversations and messages
 */

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
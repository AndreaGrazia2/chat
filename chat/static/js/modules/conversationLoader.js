import { showNotification}  from './utils.js';
import { showLoader, hideLoader } from './utils.js';

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
            
            // NON aggiungere automaticamente l'indicatore di inizio conversazione qui
            // Sarà gestito correttamente quando si raggiunge l'inizio effettivo
            
            if (messages.length > 0) {
                // Trova il messaggio con ID più piccolo (il più vecchio)
                const oldestMsg = messages.reduce((prev, curr) => 
                    (prev.id < curr.id) ? prev : curr
                );
                oldestMessageId = oldestMsg.id;
                console.log("Set oldestMessageId to:", oldestMessageId);
                
                // Renderizza i messaggi
                renderMessages(messages);
                
                // Scorri fino in fondo se richiesto
                if (scrollToBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                console.log(`No messages found for channel ${channelName}`);
                // Non ci sono messaggi, questo è effettivamente l'inizio della conversazione
                if (!document.querySelector('.start-of-conversation')) {
                    const startConversationIndicator = document.createElement('div');
                    startConversationIndicator.className = 'date-divider start-of-conversation';
                    startConversationIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
                    chatMessages.appendChild(startConversationIndicator);
                }
                
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
                
                // NON aggiungere automaticamente l'indicatore di inizio conversazione qui
                // Renderizza i messaggi
                renderMessages(messages);
                
                // Scorri fino in fondo se richiesto
                if (scrollToBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                // Non ci sono messaggi, questo è effettivamente l'inizio della conversazione
                if (!document.querySelector('.start-of-conversation')) {
                    const startConversationIndicator = document.createElement('div');
                    startConversationIndicator.className = 'date-divider start-of-conversation';
                    startConversationIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
                    chatMessages.appendChild(startConversationIndicator);
                }
                
                // Mostra un messaggio se non ci sono messaggi
                const emptyElement = document.createElement('div');
                emptyElement.className = 'date-divider empty-conversation';
                emptyElement.innerHTML = '<span>No messages yet. Start the conversation!</span>';
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

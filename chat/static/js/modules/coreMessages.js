import { toggleSearchPanel } from './uiSearch.js';
import { updateUnreadBadge}  from './uiNavigation.js';
import { showNotification}  from './utils.js';
import { debug, formatDate, showLoader, hideLoader } from './utils.js';
import { createMessageElement } from './messageRenderer.js';

const batchSize = 15;

/**
 * coreMessages.js - Message loading and management
 * 
 * Contains functions for loading, displaying, and managing messages.
 */

function loadOlderMessages() {
    if (!currentConversationId || isLoadingMessages || !hasMoreMessages) {
        console.log("Cannot load older messages:", {
            currentConversationId,
            isLoadingMessages,
            hasMoreMessages
        });
        return;
    }
    
    console.log("Loading older messages for:", currentConversationId, "isChannel:", isChannel);
    
    isLoadingMessages = true;
    
    // Aggiungi un loader all'inizio dei messaggi
    const loaderElement = document.createElement('div');
    loaderElement.className = 'messages-loader';
    loaderElement.innerHTML = '<div class="loader-spinner"></div>';
    
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages.firstChild) {
        chatMessages.insertBefore(loaderElement, chatMessages.firstChild);
    } else {
        chatMessages.appendChild(loaderElement);
    }
    
    // Salva l'altezza dello scroll corrente
    const scrollHeight = chatMessages.scrollHeight;
    
    // Costruisci l'URL in base al tipo di conversazione
    // In coreMessages.js, modifichiamo la costruzione dell'URL:
    //FIXME: problemi con il backend (boh!)
   
    let url;
    if (isChannel) {
        url = `/chat/api/messages/channel/${currentConversationId}?limit=20`;
        if (oldestMessageId) {
            url += `&before_id=${oldestMessageId}`;
        }
    } else {
        url = `/chat/api/messages/dm/${currentConversationId}?limit=20`;
        if (oldestMessageId) {
            url += `&before_id=${oldestMessageId}`;
        }
    }
    
    console.log("Fetching older messages from URL:", url);
    
    // Richiedi i messaggi più vecchi
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            // Rimuovi il loader
            loaderElement.remove();
            
            console.log("Received older messages:", messages.length);
            
            if (messages.length === 0) {
                hasMoreMessages = false;
                
                // Mostra l'indicatore "Inizio della conversazione" solo se non esiste già
                if (!document.querySelector('.start-of-conversation')) {
                    const noMoreElement = document.createElement('div');
                    noMoreElement.className = 'date-divider start-of-conversation';
                    noMoreElement.innerHTML = '<span>Inizio della conversazione</span>';
                    
                    if (chatMessages.firstChild) {
                        chatMessages.insertBefore(noMoreElement, chatMessages.firstChild);
                    } else {
                        chatMessages.appendChild(noMoreElement);
                    }
                }
            } else {
                // Aggiorna l'ID del messaggio più vecchio
                if (messages.length > 0) {
                    // Trova il messaggio con ID più piccolo (il più vecchio)
                    const oldestMsg = messages.reduce((prev, curr) => 
                        (prev.id < curr.id) ? prev : curr
                    );
                    oldestMessageId = oldestMsg.id;
                    console.log("Updated oldestMessageId to:", oldestMessageId);
                }
                
                // Prepara i messaggi (dal più vecchio al più nuovo)
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // Tieni traccia delle date per i separatori
                let lastDate = null;
                let fragment = document.createDocumentFragment();
                
                // Renderizza i messaggi, evitando duplicati
                messages.forEach(message => {
                    // Verifica se il messaggio è già presente
                    const isDuplicate = displayedMessages.some(m => m.id === message.id);
                    if (isDuplicate) {
                        console.log("Skipping duplicate message:", message.id);
                        return;
                    }
                    
                    // Aggiungi separatore data se necessario
                    const messageDate = new Date(message.timestamp).toDateString();
                    if (messageDate !== lastDate) {
                        const divider = document.createElement('div');
                        divider.className = 'date-divider';
                        divider.innerHTML = `<span>${formatDate(new Date(message.timestamp))}</span>`;
                        fragment.appendChild(divider);
                        lastDate = messageDate;
                    }
                    
                    // Crea elemento messaggio
                    const messageEl = createMessageElement(message);
                    fragment.appendChild(messageEl);
                    
                    // Aggiungi ai messaggi visualizzati (all'inizio)
                    if (typeof displayedMessages !== 'undefined') {
                        displayedMessages.unshift(message);
                    }
                });
                
                // Inserisci all'inizio della chat
                if (chatMessages.firstChild) {
                    chatMessages.insertBefore(fragment, chatMessages.firstChild);
                } else {
                    chatMessages.appendChild(fragment);
                }
                
                // Mantieni la posizione di scorrimento
                const newScrollHeight = chatMessages.scrollHeight;
                chatMessages.scrollTop = newScrollHeight - scrollHeight;
            }
            
            isLoadingMessages = false;
        })
        .catch(error => {
            console.error('Error loading older messages:', error);
            loaderElement.remove();
            isLoadingMessages = false;
            
            // Mostra un messaggio di errore
            showNotification('Error loading older messages: ' + error.message, true);
        });
}

function loadInitialMessages(count) {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];
    
    // Mostra loader
    showLoader();
    
    // In attesa che i messaggi arrivino dal server
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'empty-messages';
    loadingIndicator.textContent = 'Loading messages...';
    chatContainer.appendChild(loadingIndicator);
    
    // Nascondi loader dopo un po' se non ci sono messaggi
    setTimeout(() => {
        hideLoader();
        
        // Mostra messaggio se ancora nessun messaggio è arrivato
        if (displayedMessages.length === 0 && chatContainer.children.length === 1) {
            loadingIndicator.textContent = 'No messages yet. Start the conversation!';
        }
    }, 1000);
}

function loadMoreMessages() {
    // Modifica la condizione per permettere il caricamento anche quando messages è vuoto
    if (loadingMore) {
        return;
    }
    
    // Imposta flag di caricamento e aggiorna stato
    loadingMore = true;
    historyScrollLock = true;
    lastHistoryLockTime = Date.now();
    
    debug("Starting to load more messages", {
        messagesLoaded,
        totalMessages: messages.length
    });
    
    // Mostra loader
    showLoader();
    
    // Disabilita temporaneamente scrolling smooth
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.style.scrollBehavior = 'auto';
    
    // Verifica se siamo connessi a socket.io
    if (currentlyConnected && socket) {
        // Richiedi messaggi precedenti al server
        const oldestMessageId = displayedMessages.length > 0 ? 
            displayedMessages[0].id : null;
        
        // Emetti evento per richiedere messaggi precedenti
        socket.emit('load_previous_messages', {
            conversationId: currentConversationId,
            isChannel: isChannel,
            beforeId: oldestMessageId,
            limit: batchSize
        });
        
        debug("Requested previous messages via socket.io", {
            conversationId: currentConversationId,
            beforeId: oldestMessageId
        });
        
        // Imposta un timeout nel caso il server non risponda
        setTimeout(() => {
            if (loadingMore) {
                // Se siamo ancora in caricamento dopo 5 secondi, mostra messaggio
                showStartOfConversation();
                
                // Resetta stato
                finishLoadingMore();
            }
        }, 5000);
    } else {
        // Non siamo connessi, mostra subito il messaggio di inizio conversazione
        setTimeout(() => {
            showStartOfConversation();
            finishLoadingMore();
        }, 800);
    }
}

function resetMessages() {
    // Reset ricerca se aperta
    if (searchOpen) {
        toggleSearchPanel();
    }
    
    // Assicura che il lock history sia rilasciato
    historyScrollLock = false;
    messagesLoaded = 0;
    displayedMessages = [];
    unreadMessages = 0;
    updateUnreadBadge();
    loadInitialMessages(batchSize);
    
    debug("Messages reset for new channel/user");
}

function finishLoadingMore() {
    // Ripristina scrolling smooth
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.style.scrollBehavior = 'smooth';
    hideLoader();
    loadingMore = false;
    
    // Rilascia lock dopo un ritardo
    setTimeout(() => {
        historyScrollLock = false;
    }, 100);
}

function showStartOfConversation() {
    // Verifica se esiste già un indicatore di inizio conversazione
    const chatContainer = document.getElementById('chatMessages');
    if (!document.querySelector('.start-of-conversation')) {
        const allLoadedIndicator = document.createElement('div');
        allLoadedIndicator.className = 'date-divider start-of-conversation';
        allLoadedIndicator.innerHTML = `<span>Inizio della conversazione</span>`;
        chatContainer.prepend(allLoadedIndicator);
        
        // Scorri un po' verso il basso per mostrare il messaggio
        chatContainer.scrollTop = 20;
        
        debug("Added start of conversation indicator");
    }
}

// Export functions
export { 
    loadOlderMessages, 
    loadInitialMessages, 
    loadMoreMessages, 
    resetMessages, 
    finishLoadingMore, 
    showStartOfConversation 
};
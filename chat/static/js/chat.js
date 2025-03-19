// Sostituisci la funzione di scroll esistente con questa
// Cerca la funzione che gestisce lo scroll verso l'alto e genera messaggi

// Vecchio codice (da rimuovere):
/*
chatMessages.addEventListener('scroll', function() {
    if (chatMessages.scrollTop === 0) {
        // Genera messaggi di test
        generateOlderMessages();
    }
});

function generateOlderMessages() {
    // Codice che genera messaggi di test
    // ...
}
*/

// Demo data generation
// Aggiungi questo codice per gestire il bottone Generate Demo Data
document.addEventListener('DOMContentLoaded', function() {
    const generateDemoButton = document.getElementById('generateDemoData');
    if (generateDemoButton) {
        generateDemoButton.addEventListener('click', function() {
            console.log('Generating demo data...');
            
            // Mostra un indicatore di caricamento
            showNotification('Generating Data', 'Creating demo users, channels and messages...', 'info');
            
            // Invia la richiesta al backend
            fetch('/chat/api/demo/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Success', data.message, 'success');
                    
                    // Ricarica i dati
                    loadInitialData();
                } else {
                    showNotification('Error', data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error generating demo data:', error);
                showNotification('Error', 'Failed to generate demo data', 'error');
            });
        });
    } else {
        console.warn('Generate Demo Data button not found');
    }
    
    // Funzione per ricaricare i dati iniziali
    function loadInitialData() {
        // Ricarica utenti e canali
        fetch('/chat/api/users')
            .then(response => response.json())
            .then(users => {
                // Aggiorna la lista degli utenti
                renderUsersList(users);
            });
            
        fetch('/chat/api/channels')
            .then(response => response.json())
            .then(channels => {
                // Aggiorna la lista dei canali
                renderChannelsList(channels);
            });
    }
});

// Helper function to show notifications
function showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
        <button class="notification-close">&times;</button>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
}

// Aggiungi queste variabili all'inizio del file o dove gestisci lo stato
let currentConversationId = null;
let isChannel = false;
let isLoadingMessages = false;
let oldestMessageId = null;
let hasMoreMessages = true;

// Aggiungi questa funzione per gestire lo scroll e caricare più messaggi
function setupScrollPagination() {
    const chatMessages = document.querySelector('.chat-messages');
    
    chatMessages.addEventListener('scroll', function() {
        // Se siamo vicini alla parte superiore e non stiamo già caricando messaggi
        if (chatMessages.scrollTop < 100 && !isLoadingMessages && hasMoreMessages) {
            loadOlderMessages();
        }
    });
}

// Funzione per caricare messaggi più vecchi
function loadOlderMessages() {
    if (!currentConversationId || isLoadingMessages || !hasMoreMessages) return;
    
    console.log("Loading older messages for:", currentConversationId, "isChannel:", isChannel);
    
    isLoadingMessages = true;
    
    // Aggiungi un loader all'inizio dei messaggi
    const loaderElement = document.createElement('div');
    loaderElement.className = 'messages-loader';
    loaderElement.innerHTML = '<div class="loader-spinner"></div>';
    
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.prepend(loaderElement);
    
    // Salva l'altezza dello scroll corrente
    const scrollHeight = chatMessages.scrollHeight;
    
    // Costruisci l'URL in base al tipo di conversazione
    let url;
    if (isChannel) {
        const channelName = currentConversationId;
        url = `/chat/api/messages/channel/${channelName}?before_id=${oldestMessageId || ''}&limit=20`;
    } else {
        const userId = currentConversationId;
        url = `/chat/api/messages/dm/${userId}?before_id=${oldestMessageId || ''}&limit=20`;
    }
    
    console.log("Fetching from URL:", url);
    
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
            
            console.log("Received messages:", messages.length);
            
            if (messages.length === 0) {
                hasMoreMessages = false;
                
                // Mostra un messaggio "Non ci sono più messaggi"
                const noMoreElement = document.createElement('div');
                noMoreElement.className = 'messages-loader';
                noMoreElement.textContent = 'No more messages';
                chatMessages.prepend(noMoreElement);
                
                // Rimuovi il messaggio dopo 3 secondi
                setTimeout(() => {
                    noMoreElement.remove();
                }, 3000);
            } else {
                // Aggiorna l'ID del messaggio più vecchio
                oldestMessageId = messages[messages.length - 1].id;
                
                // Renderizza i messaggi
                messages.forEach(message => {
                    renderMessage(message, true); // true indica che è un messaggio vecchio
                });
                
                // Mantieni la posizione di scorrimento
                chatMessages.scrollTop = chatMessages.scrollHeight - scrollHeight;
            }
            
            isLoadingMessages = false;
        })
        .catch(error => {
            console.error('Error loading older messages:', error);
            loaderElement.remove();
            isLoadingMessages = false;
            
            // Mostra un messaggio di errore
            showNotification('Error', 'Failed to load older messages', 'error');
        });
}

// Modifica le funzioni che gestiscono il caricamento iniziale dei messaggi

// Quando si entra in un canale
function handleJoinChannel(channelName) {
    // Reset delle variabili di paginazione
    currentConversationId = channelName;
    isChannel = true;
    isLoadingMessages = false;
    oldestMessageId = null;
    hasMoreMessages = true;
    
    // Resto del codice esistente...
}

// Quando si entra in una DM
function handleJoinDM(userId) {
    // Reset delle variabili di paginazione
    currentConversationId = userId;
    isChannel = false;
    isLoadingMessages = false;
    oldestMessageId = null;
    hasMoreMessages = true;
    
    // Resto del codice esistente...
}

// Modifica la funzione che renderizza i messaggi
function renderMessage(message, prepend = false) {
    // Aggiorna l'ID del messaggio più vecchio se necessario
    if (oldestMessageId === null || message.id < oldestMessageId) {
        oldestMessageId = message.id;
    }
    
    // Resto del codice per renderizzare il messaggio...
    
    // Aggiungi il messaggio all'inizio o alla fine in base al parametro prepend
    const chatMessages = document.querySelector('.chat-messages');
    if (prepend) {
        chatMessages.prepend(messageElement);
    } else {
        chatMessages.appendChild(messageElement);
        // Scorri in fondo solo per i nuovi messaggi
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Assicurati di chiamare setupScrollPagination() all'inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    setupScrollPagination();
    // Resto del codice di inizializzazione...
});


// Modifica la funzione che gestisce il caricamento dei messaggi del canale
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
    document.querySelector('.chat-header-title').textContent = '#' + channelName;
    document.querySelector('.chat-header-subtitle').textContent = 'Channel';
    
    // Mostra un loader
    const loaderElement = document.createElement('div');
    loaderElement.className = 'messages-loader';
    loaderElement.innerHTML = '<div class="loader-spinner"></div>';
    chatMessages.appendChild(loaderElement);
    
    // Carica i messaggi dal server
    fetch(`/chat/api/messages/channel/${channelName}`)
        .then(response => response.json())
        .then(messages => {
            // Rimuovi il loader
            loaderElement.remove();
            
            if (messages.length > 0) {
                // Aggiorna l'ID del messaggio più vecchio
                oldestMessageId = messages[messages.length - 1].id;
                
                // Renderizza i messaggi
                messages.forEach(message => {
                    renderMessage(message);
                });
                
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
            console.error('Error loading channel messages:', error);
            loaderElement.remove();
            
            // Mostra un messaggio di errore
            const errorElement = document.createElement('div');
            errorElement.className = 'error-messages';
            errorElement.textContent = 'Error loading messages. Please try again.';
            chatMessages.appendChild(errorElement);
        });
}

// Modifica la funzione che gestisce il caricamento dei messaggi diretti
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
    document.querySelector('.chat-header-title').textContent = userName;
    document.querySelector('.chat-header-subtitle').textContent = 'Direct Message';
    
    // Mostra un loader
    const loaderElement = document.createElement('div');
    loaderElement.className = 'messages-loader';
    loaderElement.innerHTML = '<div class="loader-spinner"></div>';
    chatMessages.appendChild(loaderElement);
    
    // Carica i messaggi dal server
    fetch(`/chat/api/messages/dm/${userId}`)
        .then(response => response.json())
        .then(messages => {
            // Rimuovi il loader
            loaderElement.remove();
            
            if (messages.length > 0) {
                // Aggiorna l'ID del messaggio più vecchio
                oldestMessageId = messages[messages.length - 1].id;
                
                // Renderizza i messaggi
                messages.forEach(message => {
                    renderMessage(message);
                });
                
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
            loaderElement.remove();
            
            // Mostra un messaggio di errore
            const errorElement = document.createElement('div');
            errorElement.className = 'error-messages';
            errorElement.textContent = 'Error loading messages. Please try again.';
            chatMessages.appendChild(errorElement);
        });
}
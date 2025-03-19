// Modifica a /chat/static/js/chat.js
// e funzioni con il resto del codice

// Aggiungi queste variabili all'inizio del file o dove gestisci lo stato
let isChannel = false;

// caricano messaggi per un canale
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

//caricano messaggi per DM
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

// Funzione per renderizzare un array di messaggi
function renderMessages(messages) {
    if (!messages || messages.length === 0) return;
    
    // Ordina cronologicamente (dal più vecchio al più nuovo)
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const chatMessages = document.querySelector('.chat-messages');
    let lastDate = null;
    const fragment = document.createDocumentFragment();
    
    // Per tenere traccia dei messaggi visualizzati se esiste la variabile globale
    if (typeof displayedMessages !== 'undefined') {
        displayedMessages = [];
    }
    
    messages.forEach(message => {
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
        
        // Aggiungi ai messaggi visualizzati
        if (typeof displayedMessages !== 'undefined') {
            displayedMessages.push(message);
        }
    });
    
    chatMessages.appendChild(fragment);
}

// Assicurati che questa funzione sia chiamata all'avvio
document.addEventListener('DOMContentLoaded', function() {
    const generateDemoButton = document.getElementById('generateDemoData');
    if (generateDemoButton) {
        generateDemoButton.addEventListener('click', function() {
            console.log('Generating demo data...');
            
            // Mostra un indicatore di caricamento
            showNotification('Generating demo data...', false);
            
            // Disabilita il pulsante durante la generazione
            generateDemoButton.disabled = true;
            generateDemoButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            
            // Invia la richiesta al backend
            fetch('/chat/api/demo/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                // Riabilita il pulsante
                generateDemoButton.disabled = false;
                generateDemoButton.innerHTML = '<i class="fas fa-database"></i> Generate Demo Data';
                
                if (data.success) {
                    showNotification('Demo data generated successfully', false);
                    console.log('Demo data generated:', data);
                    
                    // Ricarica completamente i dati
                    loadInitialData();
                    
                    // Aggiorna anche i messaggi nella conversazione corrente
                    refreshCurrentConversation();
                } else {
                    showNotification('Error: ' + (data.message || 'Failed to generate demo data'), true);
                    console.error('Error generating demo data:', data.message);
                }
            })
            .catch(error => {
                // Riabilita il pulsante
                generateDemoButton.disabled = false;
                generateDemoButton.innerHTML = '<i class="fas fa-database"></i> Generate Demo Data';
                
                console.error('Error generating demo data:', error);
                showNotification('Error: ' + error.message, true);
            });
        });
    }

    console.log("Scroll pagination setup complete");
    
    // Aggiungi gestori eventi per i canali
    document.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', function() {
            const channelName = this.textContent.trim();
            setActiveChannel(this, channelName);
            
            // Aggiunto: carica messaggi quando si clicca su un canale
            console.log("Loading messages for channel:", channelName);
            loadChannelMessages(channelName);
            
            if (currentlyConnected) {
                joinChannel(channelName);
            }
        });
    });
    
    // Aggiungi gestori eventi per gli utenti
    document.querySelectorAll('.user-item').forEach(item => {
        item.addEventListener('click', function() {
            const userName = this.textContent.trim();
            setActiveUser(this, userName);
            
            // Trova l'ID dell'utente
            const userId = getUserIdByName(userName);
            if (userId) {
                console.log("Loading messages for user:", userName, "ID:", userId);
                loadDirectMessages(userId, userName);
                
                if (currentlyConnected) {
                    joinDirectMessage(userId);
                }
            }
        });
    });
});

// Funzione helper per trovare l'ID dell'utente dal nome
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

// Funzione per ricaricare i dati iniziali
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

// Renderizza la lista degli utenti
function renderUsersList(users) {
    const directMessagesList = document.querySelector('.direct-messages-list');
    
    // Mantieni il titolo della sezione
    const listTitle = directMessagesList.querySelector('.list-title');
    
    // Pulisci la lista, mantenendo il titolo
    directMessagesList.innerHTML = '';
    directMessagesList.appendChild(listTitle);
    
    // Aggiungi gli utenti (escludi l'utente corrente con ID 1)
    users.filter(user => user.id !== 1).forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.id = `user-${user.username}`;
        
        // Determina la classe dello stato
        let statusClass = 'status-offline';
        if (user.status === 'online') statusClass = 'status-online';
        if (user.status === 'away') statusClass = 'status-away';
        if (user.status === 'busy') statusClass = 'status-busy';
        
        userItem.innerHTML = `
            <div class="user-status ${statusClass}"></div>
            ${user.displayName}
        `;
        
        userItem.addEventListener('click', function() {
            const userName = user.displayName;
            setActiveUser(this, userName);
            
            // Carica i messaggi diretti per questo utente
            loadDirectMessages(user.id, userName);
            
            if (typeof currentlyConnected !== 'undefined' && currentlyConnected) {
                joinDirectMessage(user.id);
            }
        });
        
        directMessagesList.appendChild(userItem);
    });
}

// Renderizza la lista dei canali
function renderChannelsList(channels) {
    const channelsList = document.querySelector('.channels-list');
    
    // Mantieni il titolo della sezione
    const listTitle = channelsList.querySelector('.list-title');
    
    // Pulisci la lista, mantenendo il titolo
    channelsList.innerHTML = '';
    channelsList.appendChild(listTitle);
    
    // Aggiungi i canali
    channels.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.id = `channel-${channel.name}`;
        
        channelItem.innerHTML = `
            <span class="channel-hash">#</span>
            ${channel.name}
        `;
        
        channelItem.addEventListener('click', function() {
            const channelName = channel.name;
            setActiveChannel(this, channelName);
            
            // Carica i messaggi del canale
            loadChannelMessages(channelName);
            
            if (typeof currentlyConnected !== 'undefined' && currentlyConnected) {
                joinChannel(channelName);
            }
        });
        
        channelsList.appendChild(channelItem);
    });
    
    // Imposta di default il canale "general" come attivo se esiste
    const generalChannel = document.getElementById('channel-general');
    if (generalChannel) {
        generalChannel.classList.add('active');
    }
}

// Aggiorna la conversazione corrente
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
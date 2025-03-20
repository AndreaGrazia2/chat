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


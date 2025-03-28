import { sendChannelMessage } from './socket.js'
import { updateUnreadBadge}  from './uiNavigation.js';
import { showNotification}  from './utils.js';
import { scrollToBottom } from './coreScroll.js';
import { sendDirectMessage } from './socket.js'
import { createMessageElement } from './messageRenderer.js';

function sendMessage() {
    // Interrompi lo stato di digitazione quando si invia un messaggio
    stopTyping();

    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text) {
        // Rimuovi il messaggio "empty-messages" se esiste
        const emptyMessages = document.querySelector('.empty-messages, .empty-conversation');
        if (emptyMessages) {
            emptyMessages.remove();
        }
        
        // Crea oggetto messaggio con ID temporaneo
        const tempId = "temp-" + Date.now();

        const userObj = users[0];

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
        
        // Se è un messaggio diretto E l'utente è John Doe (ID 2), mostra l'indicatore di digitazione
        //if (isDirectMessage && currentUser && currentUser.id === 2) {
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            //typingText.textContent = `${currentUser.displayName} is typing...`;
            typingText.textContent = `Agent is typing...`;
            typingIndicator.style.display = 'flex';
            typingIndicator.dataset.startTime = Date.now(); // Aggiungi timestamp
        //}
        console.log(currentUser);
        
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

/**
 * Gestisce gli eventi di digitazione dell'utente
 * Invia notifiche "typing" ad altri utenti con debounce
 */
function setupTypingEvents() {
    console.log("setupTypingEvents è stata chiamata!");

    const input = document.getElementById('messageInput');
    
    // Quando l'utente inizia a digitare
    input.addEventListener('input', function() {
        // Se non stiamo già segnalando che stiamo digitando
        console.log("Event listener 'input' triggato, isTyping:", isTyping);
        if (!isTyping) {
            isTyping = true;
            
            // Emetti evento solo se siamo connessi e abbiamo una conversazione attiva
            if (currentlyConnected && socket) {
                if (isDirectMessage && currentUser) {
                    socket.emit('userStartTyping', {  // CORRETTO: userStartTyping
                        userId: currentUser.id,
                        isDirect: true
                    });
                } else if (currentChannel) {
                    socket.emit('userStartTyping', {  // CORRETTO: userStartTyping
                        channelName: currentChannel,
                        isDirect: false,
                        // Invia comunque l'user ID corrente
                        userId: 1
                    });
                }
            }
        }
        
        // Resetta il timeout se esiste
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Imposta un nuovo timeout
        typingTimeout = setTimeout(function() {
            // Quando il timeout scade, l'utente non sta più digitando
            isTyping = false;
            
            // Emetti evento di fine digitazione
            if (currentlyConnected && socket) {
                if (isDirectMessage && currentUser) {
                    socket.emit('userStopTyping', {
                        userId: currentUser.id,
                        isDirect: true
                    });
                } else if (currentChannel) {
                    socket.emit('userStopTyping', {
                        channelName: currentChannel,
                        isDirect: false
                    });
                }
            }
        }, typingDebounceTime);
    });
    
    // Quando viene inviato un messaggio, interrompiamo subito lo stato di digitazione
    document.getElementById('sendButton').addEventListener('click', stopTyping);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            stopTyping();
        }
    });
}

/**
 * Interrompe lo stato di digitazione
 */
function stopTyping() {
    // Pulisci il timeout esistente
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Solo se stavamo già digitando, inviamo l'evento di stop
    if (isTyping) {
        isTyping = false;
        
        if (currentlyConnected && socket) {
            if (isDirectMessage && currentUser) {
                socket.emit('userStopTyping', {
                    userId: currentUser.id,
                    isDirect: true
                });
            } else if (currentChannel) {
                socket.emit('userStopTyping', {
                    channelName: currentChannel,
                    isDirect: false
                });
            }
        }
    }
    
    // Nascondi direttamente l'indicatore di digitazione locale
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
        delete typingIndicator.dataset.startTime;
    }
}

// Export functions
export {
    sendMessage,
    setupTypingEvents,
    stopTyping
};
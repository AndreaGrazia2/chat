/**
 * messageActions.js - Actions that can be performed on messages
 */

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
        <div class="reply-text">${typeIcon} Replying to ${message.user.displayName || message.user.name}: "${message.text.substring(0, 30)}${message.text.length > 30 ? '...' : ''}"</div>
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
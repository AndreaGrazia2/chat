/**
 * core.js - Funzionalità principali e inizializzazione
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

function initializeApp() {
    // Setup del failsafe per history lock
    setupHistoryLockFailsafe();
    
    // Inizializza messaggi vuoti invece di generarli
    messages = [];
    
    // Aggiorna le info dell'header
    updateChatHeaderInfo();
    
    // Inizializza i pulsanti di cancellazione ricerca
    initializeSearchClearButtons();
    
    // Aggiungi event listener per lo scroll
    setupScrollHandlers();
    
    // Altri event listeners
    setupEventListeners();
    
    // Inizializza Socket.IO
    initializeSocketIO();
    
    debug("Chat initialization complete");
}

function setupHistoryLockFailsafe() {
    setInterval(() => {
        if (historyScrollLock || loadingMore) {
            const lockTime = Date.now() - lastHistoryLockTime;
            if (lockTime > 3000) {
                debug("Forced release of history/loading locks after timeout", {
                    lockTime
                });
                historyScrollLock = false;
                loadingMore = false;
                hideLoader();
            }
        }
    }, 1000);
}

function setupEventListeners() {
    // Navigation
    document.getElementById('nextSearchResult').addEventListener('click', nextSearchResult);
    document.getElementById('prevSearchResult').addEventListener('click', prevSearchResult);
    
    // Tema e sidebar
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('mobileSidebarToggle').addEventListener('click', toggleSidebar);
    
    // Button scorrimento
    document.getElementById('scrollBottomBtn').addEventListener('click', function() {
        scrollToBottom();
    });
    
    // Ricerca
    document.getElementById('searchBtn').addEventListener('click', toggleSearchPanel);
    document.getElementById('closeSearchPanel').addEventListener('click', toggleSearchPanel);
    document.getElementById('searchPanelInput').addEventListener('input', function(e) {
        searchMessages(e.target.value);
    });
    
    // Canali
    document.getElementById('channel-general').addEventListener('click', function() {
        setActiveChannel(this, 'general');
    });
    document.getElementById('channel-random').addEventListener('click', function() {
        setActiveChannel(this, 'random');
    });
    document.getElementById('channel-announcements').addEventListener('click', function() {
        setActiveChannel(this, 'announcements');
    });
    document.getElementById('channel-development').addEventListener('click', function() {
        setActiveChannel(this, 'development');
    });
    
    // Utenti
    document.getElementById('user-john').addEventListener('click', function() {
        setActiveUser(this, 'John Doe');
    });
    document.getElementById('user-jane').addEventListener('click', function() {
        setActiveUser(this, 'Jane Smith');
    });
    document.getElementById('user-mike').addEventListener('click', function() {
        setActiveUser(this, 'Mike Johnson');
    });
    document.getElementById('user-emma').addEventListener('click', function() {
        setActiveUser(this, 'Emma Davis');
    });
    
    // Invio messaggi
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    // Nasconde menu contestuale quando si clicca altrove
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#contextMenu') && !e.target.classList.contains('menu-button')) {
            document.getElementById('contextMenu').style.display = 'none';
        }
    });
    
    // Menu contestuale
    document.getElementById('contextMenu').addEventListener('click', function(e) {
        const action = e.target.dataset.action;
        const messageId = this.dataset.messageId;
        switch (action) {
            case 'reply':
                handleReply(messageId);
                break;
            case 'copy':
                copyMessageText(messageId);
                break;
            case 'forward':
                forwardMessage(messageId);
                break;
            case 'edit':
                editMessage(messageId);
                break;
            case 'delete':
                deleteMessage(messageId);
                break;
        }
        this.style.display = 'none';
    });
    
    // Event delegation per azioni messaggi
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.addEventListener('click', function(e) {
        // Pulsante risposta
        if (e.target.classList.contains('reply-button')) {
            const messageId = e.target.dataset.messageId;
            handleReply(messageId);
        }
        
        // Pulsante menu
        if (e.target.classList.contains('menu-button')) {
            const messageId = e.target.dataset.messageId;
            const rect = e.target.getBoundingClientRect();
            showContextMenu(rect.right, rect.top, messageId);
            e.stopPropagation();
        }
        
        // Pulsante download file
        if (e.target.classList.contains('fa-download') || e.target.closest('.file-download')) {
            showNotification('Download started');
            e.stopPropagation();
        }
        
        // Click su link - previene navigazione e mostra notifica
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            e.preventDefault();
            const url = e.target.href || e.target.closest('a').href;
            if (url) {
                showNotification(`Would navigate to: ${url}`);
            }
        }
    });
    
    // Ricerca sidebar
    document.getElementById('sidebarSearch').addEventListener('input', function(e) {
        filterSidebarItems(e.target.value);
    });
    
    // Scorciatoie da tastiera
    document.addEventListener('keydown', function(e) {
        // Escape per chiudere ricerca
        if (e.key === 'Escape' && searchOpen) {
            toggleSearchPanel();
        }
        
        // Ctrl+F per aprire ricerca
        if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!searchOpen) {
                toggleSearchPanel();
            }
        }
        
        // Solo se la ricerca è aperta
        if (searchOpen) {
            // F3 o Enter per prossimo risultato
            if (e.key === 'F3' || (e.key === 'Enter' && e.target.id === 'searchPanelInput')) {
                e.preventDefault();
                nextSearchResult();
            }
            
            // Shift+F3 o Shift+Enter per risultato precedente
            if ((e.key === 'F3' && e.shiftKey) || (e.key === 'Enter' && e.shiftKey && e.target.id === 'searchPanelInput')) {
                e.preventDefault();
                prevSearchResult();
            }
            
            // Tasti freccia per navigazione
            if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                nextSearchResult();
            }
            if (e.key === 'ArrowUp' && e.altKey) {
                e.preventDefault();
                prevSearchResult();
            }
        }
    });
    
    // Gestore ridimensionamento finestra
    window.addEventListener('resize', function() {
        if (!historyScrollLock) {
            const chatContainer = document.getElementById('chatMessages');
            const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= lastScrollPosition + 20;
            if (isAtBottom) {
                scrollToBottom(false);
            }
        }
    });
}

function setupScrollHandlers() {
    const chatContainer = document.getElementById('chatMessages');
    let lastScrollHandleTime = 0;
    
    chatContainer.addEventListener('scroll', function() {
        const now = Date.now();
        if (now - lastScrollHandleTime > 30) {
            lastScrollHandleTime = now;
            handleScroll();
        }
    }, { passive: true });
}

function handleScroll() {
    if (historyScrollLock) {
        debug("Scroll handler skipped due to history lock");
        return;
    }
    
    const chatContainer = document.getElementById('chatMessages');
    const scrollHeight = chatContainer.scrollHeight;
    const scrollTop = chatContainer.scrollTop;
    const clientHeight = chatContainer.clientHeight;
    
    // Verifica se siamo in cima
    const isAtTop = scrollTop <= 5;
    if (isAtTop && !isLoadingMessages && hasMoreMessages && currentConversationId) {
        loadOlderMessages();
    }
    const isAtBottom = scrollHeight - clientHeight <= scrollTop + 50;
    
    // Pull-to-refresh
    if (isAtTop && lastScrollPosition > scrollTop) {
        const now = Date.now();
        pullAttempts++;
        debug("Pull attempt detected", pullAttempts);
        
        if (!loadingMore && messagesLoaded < messages.length) {
            const timeSinceLastLoad = now - lastPullToRefreshTime;
            if (timeSinceLastLoad >= 1000) {
                debug("Pull-to-refresh triggered, loading more messages...");
                lastPullToRefreshTime = now;
                pullAttempts = 0;
                loadMoreMessages();
            }
        } else {
            debug("Pull-to-refresh not triggered", {
                loadingMore,
                messagesLoaded,
                totalMessages: messages.length,
                allMessagesLoaded: messagesLoaded >= messages.length
            });
        }
    }
    
    // Salva l'ultima posizione
    lastScrollPosition = scrollTop;
    
    // Gestisci il pulsante di scroll
    toggleScrollBottomButton(!isAtBottom);
}

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
    let url;
    if (isChannel) {
        url = `/chat/api/messages/channel/${currentConversationId}?before_id=${oldestMessageId || ''}&limit=20`;
    } else {
        url = `/chat/api/messages/dm/${currentConversationId}?before_id=${oldestMessageId || ''}&limit=20`;
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
                
                // Mostra un messaggio "Inizio della conversazione"
                const noMoreElement = document.createElement('div');
                noMoreElement.className = 'date-divider start-of-conversation';
                noMoreElement.innerHTML = '<span>Inizio della conversazione</span>';
                
                if (chatMessages.firstChild) {
                    chatMessages.insertBefore(noMoreElement, chatMessages.firstChild);
                } else {
                    chatMessages.appendChild(noMoreElement);
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
        // Resto del codice rimane invariato...
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
    
    // Funzione per mostrare l'indicatore di inizio conversazione
    function showStartOfConversation() {
        // Verifica se esiste già un indicatore di inizio conversazione
        if (!document.querySelector('.start-of-conversation')) {
            const allLoadedIndicator = document.createElement('div');
            allLoadedIndicator.className = 'date-divider start-of-conversation';
            allLoadedIndicator.innerHTML = `<span>Start of conversation</span>`;
            chatContainer.prepend(allLoadedIndicator);
            
            // Scorri un po' verso il basso per mostrare il messaggio
            chatContainer.scrollTop = 20;
            
            debug("Added start of conversation indicator");
        }
    }
    
    // Funzione per completare il caricamento
    function finishLoadingMore() {
        // Ripristina scrolling smooth
        chatContainer.style.scrollBehavior = 'smooth';
        hideLoader();
        loadingMore = false;
        
        // Rilascia lock dopo un ritardo
        setTimeout(() => {
            historyScrollLock = false;
        }, 100);
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
        if (!document.querySelector('.start-of-conversation')) {
            const allLoadedIndicator = document.createElement('div');
            allLoadedIndicator.className = 'date-divider start-of-conversation';
            allLoadedIndicator.innerHTML = `<span>Start of conversation</span>`;
            chatContainer.prepend(allLoadedIndicator);
            
            // Scorri un po' verso il basso per mostrare il messaggio
            chatContainer.scrollTop = 20;
            
            debug("Added start of conversation indicator");
        }
    }


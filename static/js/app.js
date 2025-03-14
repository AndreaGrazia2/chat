/**
 * app.js - Funzionalità principali dell'applicazione chat
 * 
 * Gestisce:
 * - Inizializzazione dell'applicazione
 * - Gestione interfaccia utente
 * - Gestione messaggi e conversazioni
 * - Gestione eventi UI
 */

// Variabili globali
let darkMode = true;
let sidebarVisible = false;
let currentChannel = 'general';
let isDirectMessage = false;
let currentUser = null;
let messages = [];
let displayedMessages = [];
let messagesLoaded = 0;
let totalMessages = 500;
let loadingMore = false;
const batchSize = 15;
let replyingTo = null;
let pendingEditOperation = null;
let lastScrollPosition = 0;
let unreadMessages = 0;
let searchResults = [];
let currentSearchIndex = -1;
let lastMessageId = 0;
let searchOpen = false;
let historyScrollLock = false;
let lastHistoryLockTime = 0;
let pullAttempts = 0;
let lastPullToRefreshTime = 0;

// Dati utenti
const users = [{
    id: 1,
    name: 'You',
    avatar: 'https://i.pravatar.cc/150?img=1',
    status: 'online'
},
{
    id: 2,
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=2',
    status: 'online'
},
{
    id: 3,
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=3',
    status: 'away'
},
{
    id: 4,
    name: 'Mike Johnson',
    avatar: 'https://i.pravatar.cc/150?img=4',
    status: 'busy'
},
{
    id: 5,
    name: 'Emma Davis',
    avatar: 'https://i.pravatar.cc/150?img=5',
    status: 'offline'
}];

// Testi di esempio per messaggi
const messageTexts = [
    'Hey there!',
    'How are you doing today?',
    'Did you check out the new feature?',
    'I think we need to discuss this further in the meeting.',
    'Let me know when you are available for a quick call.',
    // ... altri testi (omessi per brevità)
];

// Tipi di file per allegati
const fileTypes = [{
    ext: 'pdf',
    icon: 'fa-file-pdf',
    name: 'Presentation',
    size: '2.4 MB'
},
// ... altri tipi di file (omessi per brevità)
];

/**
 * Inizializzazione dell'applicazione
 */
function initializeApp() {
    // Setup del failsafe per history lock
    setupHistoryLockFailsafe();
    
    // Genera messaggi di esempio
    generateMockMessages();
    
    // Carica i messaggi iniziali
    loadInitialMessages(batchSize);
    
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

/**
 * Configura la sicurezza per i lock di cronologia
 */
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

/**
 * Configura i gestori di eventi
 */
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

/**
 * Configura i gestori di eventi scroll
 */
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

/**
 * Gestisce lo scroll della chat
 */
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
    const isAtBottom = scrollHeight - clientHeight <= scrollTop + 20;
    
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

/**
 * Cambia tra i temi chiaro e scuro
 */
function toggleTheme() {
    darkMode = !darkMode;
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    document.querySelector('.theme-toggle').textContent = darkMode ? '☀️' : '🌙';
}

/**
 * Mostra/nascondi la sidebar su mobile
 */
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    document.querySelector('.sidebar').classList.toggle('show', sidebarVisible);
}

/**
 * Imposta il canale attivo
 * @param {HTMLElement} el - Elemento del canale
 * @param {string} channel - Nome del canale
 */
function setActiveChannel(el, channel) {
    // Aggiorna stato attivo
    document.querySelectorAll('.channel-item.active, .user-item.active').forEach(item => {
        item.classList.remove('active');
    });
    el.classList.add('active');
    
    // Aggiorna canale corrente
    currentChannel = channel;
    isDirectMessage = false;
    currentUser = null;
    document.getElementById('currentChannel').textContent = channel;
    document.querySelector('.chat-title-hash').style.display = 'inline';
    
    // Aggiorna info header
    updateChatHeaderInfo();
    
    // Chiudi sidebar su mobile
    if (window.innerWidth <= 768) {
        sidebarVisible = false;
        document.querySelector('.sidebar').classList.remove('show');
    }
    
    // Mostra loader durante il caricamento dei messaggi
    showLoader();
    
    // Reset dello stato dei messaggi
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];
    messagesLoaded = 0;
    unreadMessages = 0;
    updateUnreadBadge();
    
    // Cancella risposte in sospeso
    if (replyingTo) {
        document.querySelector('.reply-preview')?.remove();
        replyingTo = null;
    }
    
    // Entra nel canale via socket.io
    if (currentlyConnected) {
        joinChannel(channel);
    }
}

/**
 * Imposta l'utente attivo per messaggi diretti
 * @param {HTMLElement} el - Elemento utente
 * @param {string} userName - Nome dell'utente
 */
function setActiveUser(el, userName) {
    // Aggiorna stato attivo
    document.querySelectorAll('.channel-item.active, .user-item.active').forEach(item => {
        item.classList.remove('active');
    });
    el.classList.add('active');
    
    // Aggiorna utente corrente
    currentUser = users.find(user => user.name === userName);
    isDirectMessage = true;
    currentChannel = userName;
    document.getElementById('currentChannel').textContent = userName;
    document.querySelector('.chat-title-hash').style.display = 'none';
    
    // Aggiorna info header
    updateChatHeaderInfo();
    
    // Chiudi sidebar su mobile
    if (window.innerWidth <= 768) {
        sidebarVisible = false;
        document.querySelector('.sidebar').classList.remove('show');
    }
    
    // Mostra loader durante il caricamento dei messaggi
    showLoader();
    
    // Reset dello stato dei messaggi
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];
    messagesLoaded = 0;
    unreadMessages = 0;
    updateUnreadBadge();
    
    // Cancella risposte in sospeso
    if (replyingTo) {
        document.querySelector('.reply-preview')?.remove();
        replyingTo = null;
    }
    
    // Entra nella conversazione diretta via socket.io
    if (currentlyConnected && currentUser) {
        joinDirectMessage(currentUser.id);
    }
}

/**
 * Aggiorna le informazioni dell'header della chat
 */
function updateChatHeaderInfo() {
    const avatarEl = document.getElementById('currentUserAvatar');
    const statusEl = document.getElementById('currentStatus');
    
    if (isDirectMessage && currentUser) {
        avatarEl.src = currentUser.avatar;
        statusEl.textContent = `${currentUser.status} • Last seen recently`;
    } else {
        // Usa un avatar di default per i canali
        avatarEl.src = 'https://i.pravatar.cc/150?img=7';
        // Genera statistiche casuali per il canale
        const members = Math.floor(Math.random() * 100) + 5;
        const online = Math.floor(Math.random() * 20) + 1;
        statusEl.textContent = `${members} members, ${online} online`;
    }
}

/**
 * Filtra gli elementi della sidebar in base alla ricerca
 * @param {string} query - Testo di ricerca
 */
function filterSidebarItems(query) {
    query = query.toLowerCase();
    
    // Filtra canali
    document.querySelectorAll('.channel-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
    
    // Filtra utenti
    document.querySelectorAll('.user-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
    
    // Mostra/nascondi titoli sezioni in base agli elementi visibili
    document.querySelectorAll('.channels-list, .direct-messages-list').forEach(section => {
        const items = section.querySelectorAll('.channel-item, .user-item');
        const title = section.querySelector('.list-title');
        let hasVisibleItems = false;
        
        items.forEach(item => {
            if (item.style.display !== 'none') {
                hasVisibleItems = true;
            }
        });
        
        title.style.display = hasVisibleItems ? 'block' : 'none';
    });
}

/**
 * Mostra/nasconde il pannello di ricerca
 */
function toggleSearchPanel() {
    const searchPanel = document.getElementById('searchPanel');
    const searchResultsPanel = document.getElementById('searchResultsPanel');
    
    if (searchPanel.classList.contains('active')) {
        // Chiudi ricerca
        searchPanel.classList.remove('active');
        searchResultsPanel.classList.remove('active');
        document.getElementById('searchPanelInput').value = '';
        clearSearchResults();
        searchOpen = false;
    } else {
        // Apri ricerca
        searchPanel.classList.add('active');
        document.getElementById('searchPanelInput').focus();
        searchOpen = true;
    }
}

/**
 * Cerca nei messaggi
 * @param {string} query - Testo di ricerca
 */
function searchMessages(query) {
    // Reset risultati precedenti
    clearSearchResults();
    
    if (!query || query.trim() === '') {
        document.getElementById('searchResultsPanel').classList.remove('active');
        updateSearchCounter();
        return;
    }
    
    query = query.toLowerCase();
    searchResults = [];
    
    // Raccoglie risultati direttamente dal DOM nell'ordine visivo
    const allMessageElements = document.querySelectorAll('.message-container');
    
    allMessageElements.forEach((messageEl) => {
        const messageId = parseInt(messageEl.dataset.messageId);
        const messageText = messageEl.querySelector('.message-text')?.textContent;
        const messageObj = displayedMessages.find(m => m.id === messageId);
        
        if (messageText && messageText.toLowerCase().includes(query) && messageObj) {
            searchResults.push({
                messageId: messageId,
                message: messageObj,
                match: messageText,
                domElement: messageEl
            });
        }
    });
    
    // Aggiorna UI
    updateSearchCounter();
    updateSearchResultsPanel(query);
    
    // Se ci sono risultati, seleziona automaticamente il primo
    if (searchResults.length > 0) {
        currentSearchIndex = 0;
        highlightAndScrollToMessage(searchResults[0].messageId);
        updateSearchCounter();
    }
}

/**
 * Aggiorna il pannello dei risultati di ricerca
 * @param {string} query - Testo di ricerca
 */
function updateSearchResultsPanel(query) {
    const resultsPanel = document.getElementById('searchResultsPanel');
    const resultsList = document.getElementById('searchResultsList');
    
    resultsPanel.classList.add('active');
    resultsList.innerHTML = '';
    
    if (searchResults.length > 0) {
        // Crea elementi per i risultati
        searchResults.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.dataset.messageId = result.messageId;
            resultItem.dataset.index = index;
            
            // Evidenzia la corrispondenza
            const highlightedText = result.match.replace(
                new RegExp(`(${query})`, 'gi'),
                '<span class="search-result-match">$1</span>'
            );
            
            resultItem.innerHTML = `
                <div class="search-result-header">
                    <div class="search-result-name">${result.message.user.name}</div>
                    <div class="search-result-date">${formatTime(result.message.timestamp)}</div>
                </div>
                <div class="search-result-text">${highlightedText}</div>
            `;
            
            // Gestore click per navigare al messaggio
            resultItem.addEventListener('click', () => {
                currentSearchIndex = index;
                highlightAndScrollToMessage(result.messageId);
                resultsPanel.classList.remove('active');
                updateSearchCounter();
            });
            
            resultsList.appendChild(resultItem);
        });
    } else {
        resultsList.innerHTML = '<div class="search-empty">No messages found matching your search.</div>';
    }
}

/**
 * Cancella i risultati di ricerca
 */
function clearSearchResults() {
    searchResults = [];
    currentSearchIndex = -1;
    
    // Aggiorna il contatore
    updateSearchCounter();
    
    // Cancella la lista risultati
    document.getElementById('searchResultsList').innerHTML = '';
    
    // Rimuove gli highlight esistenti
    document.querySelectorAll('.message-highlight').forEach(el => {
        el.classList.remove('message-highlight');
    });
}

/**
 * Naviga al risultato di ricerca precedente
 */
function prevSearchResult() {
    if (searchResults.length === 0) return;
    
    if (currentSearchIndex > 0) {
        currentSearchIndex--;
        highlightAndScrollToMessage(searchResults[currentSearchIndex].messageId);
        updateSearchCounter();
    }
}

/**
 * Naviga al risultato di ricerca successivo
 */
function nextSearchResult() {
    if (searchResults.length === 0) return;
    
    if (currentSearchIndex < searchResults.length - 1) {
        currentSearchIndex++;
        highlightAndScrollToMessage(searchResults[currentSearchIndex].messageId);
        updateSearchCounter();
    }
}

/**
 * Aggiorna il contatore dei risultati di ricerca
 */
function updateSearchCounter() {
    const counter = document.getElementById('searchCounter');
    const prevButton = document.getElementById('prevSearchResult');
    const nextButton = document.getElementById('nextSearchResult');
    
    if (searchResults.length === 0) {
        counter.textContent = '0 of 0';
        prevButton.disabled = true;
        nextButton.disabled = true;
    } else {
        counter.textContent = `${currentSearchIndex + 1} of ${searchResults.length}`;
        prevButton.disabled = currentSearchIndex <= 0;
        nextButton.disabled = currentSearchIndex >= searchResults.length - 1;
    }
}

/**
 * Evidenzia e scorre al messaggio
 * @param {number} messageId - ID del messaggio
 */
function highlightAndScrollToMessage(messageId) {
    // Rimuovi eventuali highlight esistenti
    document.querySelectorAll('.message-highlight').forEach(el => {
        el.classList.remove('message-highlight');
    });
    
    // Trova il messaggio nel DOM
    const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
    if (!messageEl) {
        console.error(`Messaggio con ID ${messageId} non trovato`);
        return;
    }
    
    // Trova il contenitore padre (message-row)
    const messageRow = messageEl.closest('.message-row');
    
    // Aggiungi la classe highlight
    messageEl.classList.add('message-highlight');
    
    // Blocca temporaneamente altri controlli di scroll
    historyScrollLock = true;
    lastHistoryLockTime = Date.now();
    
    // Trova il container di chat
    const chatContainer = document.getElementById('chatMessages');
    
    // Calcola la posizione ottimale per centrare il messaggio
    const elementToScroll = messageRow || messageEl;
    const elementRect = elementToScroll.getBoundingClientRect();
    const containerRect = chatContainer.getBoundingClientRect();
    
    // Calcola la posizione di scroll per centrare il messaggio
    const scrollTop = chatContainer.scrollTop + (elementRect.top - containerRect.top) -
        (containerRect.height / 2) + (elementRect.height / 2);
    
    // Applica lo scroll in modo diretto
    chatContainer.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
    });
    
    // Rilascia i controlli dopo un tempo adeguato
    setTimeout(() => {
        historyScrollLock = false;
    }, 1000);
}

/**
 * Mostra il menu contestuale
 * @param {number} x - Posizione X
 * @param {number} y - Posizione Y
 * @param {number} messageId - ID del messaggio
 */
function showContextMenu(x, y, messageId) {
    const message = displayedMessages.find(m => m.id == messageId);
    if (!message) return;
    
    const contextMenu = document.getElementById('contextMenu');
    
    // Configurazione del menu in base alla proprietà del messaggio
    const editItem = contextMenu.querySelector('[data-action="edit"]');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    
    if (message.isOwn) {
        // Mostra opzioni di modifica e cancellazione solo per i propri messaggi
        editItem.style.display = 'block';
        deleteItem.style.display = 'block';
    } else {
        // Nascondi opzioni di modifica e cancellazione per i messaggi altrui
        editItem.style.display = 'none';
        deleteItem.style.display = 'none';
    }
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.dataset.messageId = messageId;
    
    // Assicura che il menu rimanga nel viewport
    setTimeout(() => {
        const menuRect = contextMenu.getBoundingClientRect();
        
        if (menuRect.right > window.innerWidth) {
            contextMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
        }
        
        if (menuRect.bottom > window.innerHeight) {
            contextMenu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
        }
    }, 0);
}

/**
 * Genera messaggi di esempio
 */
function generateMockMessages() {
    messages = [];
    const now = new Date();
    
    for (let i = 0; i < totalMessages; i++) {
        const userId = Math.floor(Math.random() * users.length);
        let messageText = messageTexts[Math.floor(Math.random() * messageTexts.length)];
        
        // Assicura che alcuni messaggi abbiano link (specialmente nel primo batch)
        if (i > totalMessages - 20 && i % 4 === 0) {
            messageText = 'Check out this useful resource: <span class="link-example">https://xbe.at/tools</span> - it helps with productivity!';
        }
        
        // Timestamp progressivamente più indietro nel tempo per test migliori
        const timestamp = new Date(now.getTime() - (totalMessages - i) * 60000);
        const messageId = i + 1;
        
        // Crea casualmente messaggi di tipo speciale (inoltrati, allegati)
        const random = Math.random();
        let messageType = 'normal';
        let fileData = null;
        let forwardedFrom = null;
        
        // ~10% probabilità di messaggio inoltrato
        if (random < 0.1) {
            messageType = 'forwarded';
            const forwardUserId = Math.floor(Math.random() * users.length);
            forwardedFrom = users[forwardUserId];
        }
        // ~10% probabilità di allegato file
        else if (random < 0.2) {
            messageType = 'file';
            fileData = fileTypes[Math.floor(Math.random() * fileTypes.length)];
        }
        
        messages.push({
            id: messageId,
            user: users[userId],
            text: messageText,
            timestamp: timestamp,
            isOwn: userId === 0,
            type: messageType,
            fileData: fileData,
            forwardedFrom: forwardedFrom
        });
        
        lastMessageId = messageId;
    }
}

/**
 * Carica messaggi iniziali
 * @param {number} count - Numero di messaggi da caricare
 */
function loadInitialMessages(count) {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.innerHTML = '';
    displayedMessages = [];
    
    // Mostra loader
    showLoader();
    
    // Ottieni i messaggi più recenti
    const startIndex = Math.max(messages.length - count, 0);
    const batch = messages.slice(startIndex);
    
    // Ordina cronologicamente
    batch.sort((a, b) => a.timestamp - b.timestamp);
    
    // Tiene traccia delle date per i separatori
    let lastDate = null;
    
    // Crea fragment per migliori performance
    const fragment = document.createDocumentFragment();
    
    batch.forEach(message => {
        const messageDate = new Date(message.timestamp).toDateString();
        
        // Aggiungi separatore data se necessario
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
        
        // Traccia messaggi visualizzati
        displayedMessages.push(message);
    });
    
    // Appendi tutto in una volta per migliori performance
    chatContainer.appendChild(fragment);
    
    // Imposta numero iniziale di messaggi caricati
    messagesLoaded = batch.length;
    
    // Nascondi loader
    setTimeout(() => {
        hideLoader();
        
        // Scorri in fondo
        scrollToBottom(false);
        
        // Reset conteggio non letti
        unreadMessages = 0;
        updateUnreadBadge();
    }, 300);
}

/**
 * Carica altri messaggi (per scroll verso l'alto)
 */
function loadMoreMessages() {
    if (loadingMore || messagesLoaded >= messages.length) {
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
    
    // Determina quali messaggi caricare
    const startIndex = Math.max(messages.length - messagesLoaded - batchSize, 0);
    const endIndex = messages.length - messagesLoaded;
    const batch = messages.slice(startIndex, endIndex);
    
    debug("Batch ready to load", {
        startIndex,
        endIndex,
        batchSize: batch.length
    });
    
    // Esegue con ritardo visibile per mostrare il loader
    setTimeout(() => {
        try {
            // Ordina messaggi cronologicamente
            batch.sort((a, b) => a.timestamp - b.timestamp);
            
            // Crea fragment per tutti i nuovi contenuti
            const fragment = document.createDocumentFragment();
            
            // Ottieni la data del primo messaggio esistente per verifica separatore
            let lastDate = displayedMessages.length > 0 ?
                new Date(displayedMessages[0].timestamp).toDateString() :
                null;
            
            // Aggiungi un indicatore discreto per l'inizio della conversazione
            if (startIndex === 0) {
                const allLoadedIndicator = document.createElement('div');
                allLoadedIndicator.className = 'date-divider start-of-conversation';
                allLoadedIndicator.innerHTML = `<span>Beginning of conversation</span>`;
                fragment.appendChild(allLoadedIndicator);
            }
            
            // Aggiungi messaggi al fragment, raggruppati per data
            batch.forEach(message => {
                const messageDate = new Date(message.timestamp).toDateString();
                
                // Aggiungi separatore data se necessario
                if (messageDate !== lastDate) {
                    const divider = document.createElement('div');
                    divider.className = 'date-divider';
                    divider.innerHTML = `<span>${formatDate(message.timestamp)}</span>`;
                    fragment.appendChild(divider);
                    lastDate = messageDate;
                }
                
                // Crea e aggiungi elemento messaggio
                const messageEl = createMessageElement(message);
                fragment.appendChild(messageEl);
                
                // Aggiungi ai messaggi visualizzati (all'inizio)
                displayedMessages.unshift(message);
            });
            
            // Inserisci nuovo contenuto in cima
            if (chatContainer.firstChild) {
                chatContainer.insertBefore(fragment, chatContainer.firstChild);
            } else {
                chatContainer.appendChild(fragment);
            }
            
            // Incrementa conteggio caricati
            messagesLoaded += batch.length;
            
            // Scorri immediatamente in cima
            chatContainer.scrollTop = 0;
            
            debug("Successfully loaded more messages and scrolled to top", {
                newTotalLoaded: messagesLoaded,
                addedMessages: batch.length
            });
        } catch (error) {
            console.error("Error during loadMoreMessages:", error);
        } finally {
            // Assicurati di resettare flag di stato e UI
            setTimeout(() => {
                // Ripristina scrolling smooth
                chatContainer.style.scrollBehavior = 'smooth';
                hideLoader();
                loadingMore = false;
                
                // Rilascia lock dopo un ritardo
                setTimeout(() => {
                    historyScrollLock = false;
                }, 100);
            }, 50);
        }
    }, 800);
}

/**
 * Crea elemento DOM per un messaggio
 * @param {Object} message - Oggetto messaggio
 * @returns {HTMLElement} - Elemento DOM del messaggio
 */
function createMessageElement(message) {
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
                <div class="quoted-user">${quoteIcon} ${replyToMessage.user.name}</div>
                <div class="quoted-text">${replyToMessage.text}</div>
            </div>
        `;
    }
    
    // Gestisce visualizzazione messaggio inoltrato
    let forwardedHtml = '';
    if (message.type === 'forwarded' && message.forwardedFrom) {
        forwardedHtml = `
            <div class="forwarded-header">
                <i class="fas fa-share"></i> Forwarded from ${message.forwardedFrom.name}
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
    
    // Aggiungi spunte per messaggi propri
    const statusIndicator = message.isOwn ? '<i class="fas fa-check"></i>' : '';
    
    // Elabora testo per convertire URL in link
    const processedText = linkifyText(message.text);
    
    // Costruisci l'HTML del messaggio
    messageEl.innerHTML = `
        <div class="avatar">
            <img src="${message.user.avatar}" alt="${message.user.name}">
        </div>
        <div class="message-content">
            <div class="message-header">
                <div class="user-name">${message.user.name}</div>
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

/**
 * Abilita/disabilita visualizzazione del pulsante "scorri in basso"
 * @param {boolean} show - Se mostrare il pulsante
 */
function toggleScrollBottomButton(show) {
    const btn = document.getElementById('scrollBottomBtn');
    
    if (show) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
        // Reset conteggio non letti quando si scorre in basso
        unreadMessages = 0;
        updateUnreadBadge();
    }
}

/**
 * Aggiorna il badge per messaggi non letti
 */
function updateUnreadBadge() {
    const badge = document.getElementById('newMessagesBadge');
    
    if (unreadMessages > 0) {
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Scorri verso il fondo della chat
 * @param {boolean} smooth - Se usare animazione fluida
 */
function scrollToBottom(smooth = true) {
    if (historyScrollLock) {
        debug("Scroll to bottom prevented due to history lock");
        return;
    }
    
    const chatContainer = document.getElementById('chatMessages');
    
    // Forza un reflow del DOM per assicurare che scrollHeight sia aggiornato
    // eslint-disable-next-line no-unused-expressions
    chatContainer.scrollHeight;
    
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
    
    debug("Scrolled to bottom", { smooth });
}

/**
 * Reset messaggi quando si cambia canale/utente
 */
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

/**
 * Invia un messaggio
 */
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text && currentlyConnected) {
        // Crea oggetto messaggio
        const messageData = {
            text: text,
            type: 'normal',
            replyTo: replyingTo
        };
        
        try {
            // Emetti messaggio al server in base al tipo di chat
            if (isDirectMessage && currentUser) {
                console.log("Invio messaggio diretto a:", currentUser.id);
                sendDirectMessage(currentUser.id, messageData);
            } else {
                console.log("Invio messaggio al canale:", currentChannel);
                sendChannelMessage(currentChannel, messageData);
            }
            
            // Cancella input
            input.value = '';
            
            // Reset stato risposta
            if (replyingTo) {
                document.querySelector('.reply-preview')?.remove();
                replyingTo = null;
            }
        } catch (error) {
            console.error("Errore nell'invio del messaggio:", error);
            showNotification("Errore nell'invio del messaggio", true);
        }
    }
}

/**
 * Gestisce risposta a un messaggio
 * @param {number} messageId - ID del messaggio
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

/**
 * Cancella risposta
 */
function cancelReply() {
    replyingTo = null;
    const replyPreview = document.querySelector('.reply-preview');
    if (replyPreview) {
        replyPreview.remove();
    }
}

/**
 * Inoltra un messaggio
 * @param {number} messageId - ID del messaggio
 */
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

/**
 * Copia il testo di un messaggio negli appunti
 * @param {number} messageId - ID del messaggio
 */
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

/**
 * Modifica un messaggio
 * @param {number} messageId - ID del messaggio
 */
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

/**
 * Cancella un messaggio
 * @param {number} messageId - ID del messaggio
 */
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

/**
 * Inizializza i pulsanti di cancellazione ricerca
 */
function initializeSearchClearButtons() {
    // Pulsante cancellazione ricerca sidebar
    const sidebarSearch = document.getElementById('sidebarSearch');
    const sidebarClear = document.getElementById('sidebarSearchClear');
    
    if (sidebarSearch && sidebarClear) {
        // Mostra/nascondi pulsante cancellazione in base al contenuto input
        sidebarSearch.addEventListener('input', function() {
            sidebarClear.classList.toggle('visible', this.value.length > 0);
        });
        
        // Cancella input quando si clicca il pulsante
        sidebarClear.addEventListener('click', function() {
            sidebarSearch.value = '';
            sidebarClear.classList.remove('visible');
            // Trigger evento input per aggiornare elementi filtrati
            sidebarSearch.dispatchEvent(new Event('input'));
            sidebarSearch.focus();
        });
    }
    
    // Pulsante cancellazione pannello ricerca
    const searchPanelInput = document.getElementById('searchPanelInput');
    const searchPanelClear = document.getElementById('searchPanelClear');
    
    if (searchPanelInput && searchPanelClear) {
        // Mostra/nascondi pulsante cancellazione in base al contenuto input
        searchPanelInput.addEventListener('input', function() {
            searchPanelClear.classList.toggle('visible', this.value.length > 0);
        });
        
        // Cancella input quando si clicca il pulsante
        searchPanelClear.addEventListener('click', function() {
            searchPanelInput.value = '';
            searchPanelClear.classList.remove('visible');
            // Trigger evento input per aggiornare risultati ricerca
            searchPanelInput.dispatchEvent(new Event('input'));
            searchPanelInput.focus();
        });
    }
    
    debug("Search clear buttons initialized");
}

// Inizializza l'app quando il DOM è caricato
document.addEventListener('DOMContentLoaded', initializeApp);
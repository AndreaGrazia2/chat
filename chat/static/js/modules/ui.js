import { scrollToBottom } from './coreScroll.js';
import { showNotification }  from './utils.js';
import { joinDirectMessage } from './socket.js'
/**
 * ui.js - Gestione interfaccia utente
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

function toggleTheme() {
    darkMode = !darkMode;
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    document.querySelector('.theme-toggle').textContent = darkMode ? '☀️' : '🌙';
}

function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    document.querySelector('.sidebar').classList.toggle('show', sidebarVisible);
}

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
    currentConversationId = channel;
    isChannel = true;    
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
    currentConversationId = currentUser.id;
    isChannel = false;    
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

function prevSearchResult() {
    if (searchResults.length === 0) return;
    
    if (currentSearchIndex > 0) {
        currentSearchIndex--;
        highlightAndScrollToMessage(searchResults[currentSearchIndex].messageId);
        updateSearchCounter();
    }
}

function nextSearchResult() {
    if (searchResults.length === 0) return;
    
    if (currentSearchIndex < searchResults.length - 1) {
        currentSearchIndex++;
        highlightAndScrollToMessage(searchResults[currentSearchIndex].messageId);
        updateSearchCounter();
    }
}

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

function updateUnreadBadge() {
    const badge = document.getElementById('newMessagesBadge');
    
    if (unreadMessages > 0) {
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

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

// Export functions
export {
    toggleTheme,
    toggleSidebar,
    toggleSearchPanel,
    showNotification,
    updateChatHeaderInfo,
    renderChannelsList,
    renderUsersList,
    searchMessages,
    clearSearchResults,
    nextSearchResult,
    prevSearchResult,
    initializeSearchClearButtons,
    filterSidebarItems,
    updateUnreadBadge,
    scrollToBottom,
    setActiveChannel,
    setActiveUser
};

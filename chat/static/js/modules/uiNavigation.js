/**
 * uiNavigation.js - Gestione navigazione canali e utenti
 */
import { showLoader } from './utils.js';
import { joinDirectMessage, joinChannel } from './socket.js';

let sidebarVisible = false;

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
        document.querySelector('.sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
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
    currentUser = users.find(user => user.displayName === userName);
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
        document.querySelector('.sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
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
        avatarEl.src = currentUser.avatarUrl;
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

function updateUnreadBadge() {
    const badge = document.getElementById('newMessagesBadge');
    
    if (unreadMessages > 0) {
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');
    
    // Toggle visibility
    if (sidebar.classList.contains('active')) {
        // Chiudi sidebar
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        sidebarVisible = false;
    } else {
        // Apri sidebar
        sidebar.classList.add('active');
        overlay.classList.add('active');
        sidebarVisible = true;
    }
    
    console.log('Sidebar toggled, visible:', sidebarVisible);
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

export {
    setActiveChannel,
    setActiveUser,
    updateChatHeaderInfo,
    filterSidebarItems,
    updateUnreadBadge,
    toggleSidebar,
    renderUsersList,
    renderChannelsList,
};
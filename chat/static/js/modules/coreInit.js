import { setActiveChannel, setActiveUser, updateChatHeaderInfo, toggleSidebar }  from './uiNavigation.js';
import { deleteMessage }  from './messageActions.js';
import { initializeSearchClearButtons, toggleSearchPanel, nextSearchResult, prevSearchResult } from './uiSearch.js';
import { toggleTheme } from './uiTheme.js';
import { showNotification}  from './utils.js';
import { searchMessages } from './uiSearch.js';
import { filterSidebarItems } from './uiNavigation.js';
import { setupTypingTimeoutChecker } from './socket.js';
import { setupScrollHandlers, scrollToBottom } from './coreScroll.js';
import { debug, hideLoader } from './utils.js';
import { initializeSocketIO } from './socket.js';
import { handleReply, forwardMessage, copyMessageText, editMessage } from './messageActions.js';
import { sendMessage } from './chat.js';
/**
 * coreInit.js - Initialization functions
 * 
 * Contains the main initialization functions for the chat application.
 */

// Funzione di verifica per ID temporanei
function isTemporaryId(messageId) {
    return typeof messageId === 'string' && messageId.startsWith('temp-');
}

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

    setupTypingTimeoutChecker();
    
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

function showContextMenu(x, y, messageId) {
    // Non mostrare il menu contestuale per messaggi con ID temporaneo
    if (isTemporaryId(messageId)) {
        console.log(`Non è possibile mostrare il menu contestuale per un messaggio temporaneo: ${messageId}`);
        return;
    }
    
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
        
        // Verifica se il messaggio ha un ID temporaneo
        if (isTemporaryId(messageId)) {
            console.log(`Non è possibile eseguire l'azione ${action} su un messaggio temporaneo`);
            showNotification('Impossibile eseguire questa azione su un messaggio in fase di invio', true);
            this.style.display = 'none';
            return;
        }
        
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
            
            // Verifica se è un ID temporaneo
            if (isTemporaryId(messageId)) {
                console.log(`Non è possibile rispondere a un messaggio temporaneo: ${messageId}`);
                showNotification('Impossibile rispondere a un messaggio in fase di invio', true);
                return;
            }
            
            handleReply(messageId);
        }
        
        // Pulsante menu
        if (e.target.classList.contains('menu-button')) {
            const messageId = e.target.dataset.messageId;
            
            // Verifica se è un ID temporaneo
            if (isTemporaryId(messageId)) {
                console.log(`Non è possibile mostrare il menu per un messaggio temporaneo: ${messageId}`);
                showNotification('Impossibile eseguire azioni su un messaggio in fase di invio', true);
                return;
            }
            
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

// Export functions
export { 
    initializeApp, 
    setupHistoryLockFailsafe, 
    setupEventListeners
};
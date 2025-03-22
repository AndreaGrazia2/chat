// Correzione per globals.js
// La variabile 'messages' è dichiarata due volte. Modifica così:

/**
 * globals.js - Variabili globali condivise
 */

// Flag di debug
const DEBUG = true;

// Variabili globali principali
let darkMode = true;
let sidebarVisible = false;
let currentChannel = 'general';
let isDirectMessage = false;
let currentUser = null;
let messages = [];  // Assicurati che questa sia dichiarata UNA SOLA volta
let displayedMessages = [];
let messagesLoaded = 0;
let loadingMore = false;
let historyScrollLock = false;  // Aggiunto per risolvere l'errore in core.js
let lastHistoryLockTime = 0;
let replyingTo = null;
let lastScrollPosition = 0;
let unreadMessages = 0;
let searchOpen = false;
let pullAttempts = 0;
let lastPullToRefreshTime = 0;
let isLoadingMessages = false;
let hasMoreMessages = true;
let currentConversationId = null;
let oldestMessageId = null;
let isChannel = false;

// Dati utenti - Assicurati che siano disponibili ovunque
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

// Altre variabili globali che potrebbero mancare
let currentlyConnected = false;
let socket = null;
const batchSize = 15;

// Export variables
export {
    DEBUG,
    darkMode,
    sidebarVisible,
    currentChannel,
    isDirectMessage,
    currentUser,
    messages,
    displayedMessages,
    messagesLoaded,
    loadingMore,
    historyScrollLock,
    lastHistoryLockTime,
    replyingTo,
    lastScrollPosition,
    unreadMessages,
    searchOpen,
    pullAttempts,
    lastPullToRefreshTime,
    isLoadingMessages,
    hasMoreMessages,
    currentConversationId,
    oldestMessageId,
    isChannel,
    users,
    socket,                // Added socket to exports
    currentlyConnected,    // Added currentlyConnected
    batchSize,             // Added batchSize
};
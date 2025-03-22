/**
 * app.js - File bridge per rendere disponibili le funzioni dei moduli
 */

// Importa le funzioni dai moduli
import { initializeApp } from './modules/coreInit.js';

// Variabili globali principali
window.darkMode = true;
window.currentChannel = 'general';
window.isDirectMessage = false;
window.currentUser = null;
window.messages = [];
window.displayedMessages = [];
window.loadingMore = 0;
window.loadingMore = false;
window.historyScrollLock = false;
window.lastHistoryLockTime = 0;
window.replyingTo = null;
window.lastScrollPosition = 0;
window.unreadMessages = 0;
window.searchOpen = false;
window.isLoadingMessages = false;
window.hasMoreMessages = true;
window.currentConversationId = null;
window.oldestMessageId = null;
window.isChannel = false;
window.currentlyConnected = false;
window.socket = null;
window.messagesLoaded = null;

// Dati utenti - Assicurati che siano disponibili ovunque
window.users = [{
    id: 1,
    displayName: 'You',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    status: 'online'
},
{
    id: 2,
    displayName: 'John Doe',
    avatarUrl: 'https://i.pravatar.cc/150?img=2',
    status: 'online'
},
{
    id: 3,
    displayName: 'Jane Smith',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    status: 'away'
},
{
    id: 4,
    displayName: 'Mike Johnson',
    avatarUrl: 'https://i.pravatar.cc/150?img=4',
    status: 'busy'
},
{
    id: 5,
    displayName: 'Emma Davis',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    status: 'offline'
}];

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

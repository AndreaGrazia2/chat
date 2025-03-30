//TODO: Aggiungere inferenza per agent per RAG sul DB ( codice_civile nello schema public )

/**
 * app.js - File bridge per rendere disponibili le funzioni dei moduli
 */

// Importa le funzioni dai moduli
import { initializeApp } from './modules/coreInit.js';

// Importa la funzione di inizializzazione dell'upload
import { initFileUpload } from './modules/chat.js';

// Variabili globali principali
window.darkMode = true;
window.currentChannel = 'general';
window.isDirectMessage = false;
window.currentUser = null;
window.messages = [];
window.displayedMessages = [];
window.loadingMore = false;
window.historyScrollLock = false;
window.lastHistoryLockTime = 0;
window.replyingTo = null;
window.lastScrollPosition = 0;
window.unreadMessages = 0;
window.searchOpen = false;
window.isLoadingMessages = false;
window.hasMoreMessages = true;
window.currentConversationId = 'general';
window.oldestMessageId = null;
window.isChannel = false;
window.currentlyConnected = false;
window.socket = null;
window.messagesLoaded = null;
// Gestione typing
window.typingTimeout = null;
window.isTyping = false;
window.typingDebounceTime = 1000; // 1 secondo di debounce
window.isLocalTyping = false; 

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
    displayName: 'DB Agent', // Aggiunto DB Agent con ID 3
    avatarUrl: 'https://ui-avatars.com/api/?name=DB+Agent&background=9B59B6&color=fff',
    status: 'online'
},
{
    id: 4,
    displayName: 'Jane Smith',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    status: 'away'
},
{
    id: 5,
    displayName: 'Mike Johnson',
    avatarUrl: 'https://i.pravatar.cc/150?img=4',
    status: 'busy'
},
{
    id: 6,
    displayName: 'Emma Davis',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    status: 'offline'
}];

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initFileUpload();
    // Elementi sidebar
    const sidebar = document.querySelector('.sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const overlay = document.getElementById('overlay');
    
    // Funzione per aprire la sidebar
    function openSidebar() {
        console.log('Opening sidebar');
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
    
    // Funzione per chiudere la sidebar
    function closeSidebar() {
        console.log('Closing sidebar');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
    
    // Event listeners
    mobileSidebarToggle.addEventListener('click', openSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
    
    // Chiudi la sidebar quando la finestra viene ridimensionata oltre 768px
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
    
    // Debug - verifica che gli elementi esistano
    console.log({
        sidebar: !!sidebar,
        closeSidebarBtn: !!closeSidebarBtn,
        mobileSidebarToggle: !!mobileSidebarToggle,
        overlay: !!overlay
    });
});
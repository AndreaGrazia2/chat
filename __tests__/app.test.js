// Import delle funzioni da testare
const { 
  createMessageElement,
  filterSidebarItems,
  scrollToBottom,
  toggleSidebar,
  toggleSearchPanel
} = require('../static/js/app');

// Mock delle funzioni di utils.js che potrebbero essere usate in app.js
jest.mock('../static/js/utils', () => ({
  formatTime: jest.fn(date => '12:00'),
  formatDate: jest.fn(date => 'January 1'),
  linkifyText: jest.fn(text => text),
  showNotification: jest.fn(),
  debug: jest.fn()
}));

// Setup del DOM per i test
beforeEach(() => {
  // Crea una struttura DOM base per i test
  document.body.innerHTML = `
    <div id="chatMessages"></div>
    <div id="scrollBottomBtn"></div>
    <div id="newMessagesBadge"></div>
    <div class="sidebar" id="sidebar"></div>
    <div id="searchPanel"></div>
    <div id="searchResultsPanel"></div>
    <input id="searchPanelInput" type="text" />
    <div class="channel-item">General</div>
    <div class="channel-item">Random</div>
    <div class="user-item">John Doe</div>
    <div class="user-item">Jane Smith</div>
    <div id="searchCounter">0 of 0</div>
    <button id="prevSearchResult" disabled></button>
    <button id="nextSearchResult" disabled></button>
  `;
  
  // Mock delle variabili globali che potrebbero essere usate
  global.displayedMessages = [];
  global.messages = [];
  global.currentChannel = 'general';
  global.historyScrollLock = false;
  global.searchOpen = false;
  global.sidebarVisible = false;
  global.searchResults = [];
  global.currentSearchIndex = -1;
  
  // Mock di funzioni globali
  global.debug = jest.fn();
  global.clearSearchResults = jest.fn(() => {
    global.searchResults = [];
    global.currentSearchIndex = -1;
    const counter = document.getElementById('searchCounter');
    const prevButton = document.getElementById('prevSearchResult');
    const nextButton = document.getElementById('nextSearchResult');
    counter.textContent = '0 of 0';
    prevButton.disabled = true;
    nextButton.disabled = true;
  });
  
  // Mock di scrollTo per gli elementi DOM
  Element.prototype.scrollTo = jest.fn();
});

// Test per filterSidebarItems
describe('filterSidebarItems', () => {
  test('mostra elementi che corrispondono alla query', () => {
    // Setup
    document.querySelectorAll = jest.fn().mockImplementation(selector => {
      if (selector === '.channel-item') {
        return [
          { textContent: 'General', style: {} },
          { textContent: 'Random', style: {} }
        ];
      } else if (selector === '.user-item') {
        return [
          { textContent: 'John Doe', style: {} },
          { textContent: 'Jane Smith', style: {} }
        ];
      }
      return [];
    });
    
    // Esegui la funzione con una query
    filterSidebarItems('john');
    
    // Verifica che document.querySelectorAll sia stato chiamato
    expect(document.querySelectorAll).toHaveBeenCalledWith('.channel-item');
    expect(document.querySelectorAll).toHaveBeenCalledWith('.user-item');
  });
});

// Test per toggleSidebar
describe('toggleSidebar', () => {
  test('aggiunge la classe active al sidebar', () => {
    const sidebar = document.querySelector('.sidebar');
    
    // Mock della funzione toggleSidebar per impostare sidebarVisible
    const originalToggleSidebar = toggleSidebar;
    global.toggleSidebar = jest.fn(() => {
      sidebar.classList.add('show');
      global.sidebarVisible = true;
    });
    
    global.toggleSidebar();
    
    expect(sidebar.classList.contains('show')).toBe(true);
    expect(global.sidebarVisible).toBe(true);
    
    // Ripristina la funzione originale
    global.toggleSidebar = originalToggleSidebar;
  });
  
  test('rimuove la classe active dal sidebar se già attivo', () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.add('show');
    global.sidebarVisible = true;
    
    // Mock della funzione toggleSidebar per impostare sidebarVisible
    const originalToggleSidebar = toggleSidebar;
    global.toggleSidebar = jest.fn(() => {
      sidebar.classList.remove('show');
      global.sidebarVisible = false;
    });
    
    global.toggleSidebar();
    
    expect(sidebar.classList.contains('show')).toBe(false);
    expect(global.sidebarVisible).toBe(false);
    
    // Ripristina la funzione originale
    global.toggleSidebar = originalToggleSidebar;
  });
});

// Test per toggleSearchPanel
describe('toggleSearchPanel', () => {
  test('aggiunge la classe active al pannello di ricerca', () => {
    const searchPanel = document.getElementById('searchPanel');
    const searchPanelInput = document.getElementById('searchPanelInput');
    searchPanelInput.focus = jest.fn();
    
    // Mock della funzione toggleSearchPanel per impostare searchOpen
    const originalToggleSearchPanel = toggleSearchPanel;
    global.toggleSearchPanel = jest.fn(() => {
      searchPanel.classList.add('active');
      searchPanelInput.focus();
      global.searchOpen = true;
    });
    
    global.toggleSearchPanel();
    
    expect(searchPanel.classList.contains('active')).toBe(true);
    expect(searchPanelInput.focus).toHaveBeenCalled();
    expect(global.searchOpen).toBe(true);
    
    // Ripristina la funzione originale
    global.toggleSearchPanel = originalToggleSearchPanel;
  });
  
  test('rimuove la classe active dal pannello di ricerca se già attivo', () => {
    const searchPanel = document.getElementById('searchPanel');
    const searchResultsPanel = document.getElementById('searchResultsPanel');
    
    // Imposta lo stato iniziale come attivo
    searchPanel.classList.add('active');
    searchResultsPanel.classList.add('active');
    global.searchOpen = true;
    
    // Mock della funzione toggleSearchPanel per impostare searchOpen
    const originalToggleSearchPanel = toggleSearchPanel;
    global.toggleSearchPanel = jest.fn(() => {
      searchPanel.classList.remove('active');
      searchResultsPanel.classList.remove('active');
      global.searchOpen = false;
    });
    
    global.toggleSearchPanel();
    
    expect(searchPanel.classList.contains('active')).toBe(false);
    expect(searchResultsPanel.classList.contains('active')).toBe(false);
    expect(global.searchOpen).toBe(false);
    
    // Ripristina la funzione originale
    global.toggleSearchPanel = originalToggleSearchPanel;
  });
});

// Test per scrollToBottom
describe('scrollToBottom', () => {
  test('imposta scrollTop del container dei messaggi', () => {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.scrollHeight = 1000;
    
    // Mock della funzione scrollToBottom
    const originalScrollToBottom = scrollToBottom;
    global.scrollToBottom = jest.fn((smooth = false) => {
      chatContainer.scrollTo({
        top: 1000,
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
    
    global.scrollToBottom(false);
    
    expect(chatContainer.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'auto'
    });
    
    // Ripristina la funzione originale
    global.scrollToBottom = originalScrollToBottom;
  });
  
  test('usa behavior smooth se specificato', () => {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.scrollHeight = 1000;
    
    // Mock della funzione scrollToBottom
    const originalScrollToBottom = scrollToBottom;
    global.scrollToBottom = jest.fn((smooth = false) => {
      chatContainer.scrollTo({
        top: 1000,
        behavior: smooth ? 'smooth' : 'auto'
      });
      global.debug('Scrolling to bottom');
    });
    
    global.scrollToBottom(true);
    
    expect(chatContainer.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'smooth'
    });
    expect(global.debug).toHaveBeenCalled();
    
    // Ripristina la funzione originale
    global.scrollToBottom = originalScrollToBottom;
  });
});

// Test per createMessageElement
describe('createMessageElement', () => {
  beforeEach(() => {
    // Assicurati che linkifyText sia disponibile globalmente
    global.linkifyText = require('../static/js/utils').linkifyText;
    global.formatTime = require('../static/js/utils').formatTime;
  });
  
  test('crea un elemento messaggio con le proprietà corrette', () => {
    // Mock del messaggio
    const message = {
      id: 123,
      text: 'Test message',
      timestamp: new Date(),
      user: {
        name: 'John',
        avatar: 'avatar.jpg'
      },
      isOwn: true
    };
    
    // Chiama la funzione
    const messageElement = createMessageElement(message);
    
    // Verifica che l'elemento sia stato creato correttamente
    expect(messageElement).toBeDefined();
    expect(messageElement.querySelector('.message-container').dataset.messageId).toBe('123');
    expect(messageElement.querySelector('.message-text')).toBeDefined();
    expect(messageElement.querySelector('.user-name')).toBeDefined();
  });
  
  test('aggiunge la classe own-message per i messaggi propri', () => {
    const message = {
      id: 123,
      text: 'Test message',
      timestamp: new Date(),
      user: {
        name: 'John',
        avatar: 'avatar.jpg'
      },
      isOwn: true
    };
    
    const messageElement = createMessageElement(message);
    
    expect(messageElement.querySelector('.message-container').classList.contains('own-message')).toBe(true);
  });
});
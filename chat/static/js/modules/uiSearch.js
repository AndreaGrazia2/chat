/**
 * uiSearch.js - Gestione funzionalità di ricerca
 */
import { formatTime, debug } from './utils.js';

// Variabili di stato per la ricerca
let searchResults = [];
let currentSearchIndex = -1;

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
                    <div class="search-result-name">${result.message.user.displayName}</div>
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

function initializeSearchClearButtons() {
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
    
    debug("Search panel buttons initialized");
}

export {
    toggleSearchPanel,
    searchMessages,
    clearSearchResults,
    prevSearchResult,
    nextSearchResult,
    updateSearchCounter,
    highlightAndScrollToMessage,
    initializeSearchClearButtons,
    searchOpen
};
document.addEventListener('DOMContentLoaded', function() {
    // Elementi del DOM
    const queryForm = document.getElementById('queryForm');
    const userInput = document.getElementById('userInput');
    const loadingIndicator = document.getElementById('loading');
    const resultSection = document.getElementById('result');
    const reasoningOutput = document.getElementById('reasoning');
    const linkContainer = document.getElementById('linkContainer');
    const exampleQueries = document.querySelectorAll('.example-query');
    const resultsModal = document.getElementById('resultsModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModal = document.querySelector('.close-modal');
    const exportCsvBtn = document.getElementById('exportCsv');
    const exportJsonBtn = document.getElementById('exportJson');
    const toggleFavoriteBtn = document.getElementById('toggleFavorite');
    const suggestionsContainer = document.getElementById('suggestions');
    const recentQueriesSection = document.getElementById('recentQueries');
    const historyList = document.getElementById('historyList');

    // Stato dell'applicazione
    let currentVisualizationId = null;
    let isFavorite = false;

    // Gestione form di ricerca
    queryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!userInput.value.trim()) {
            alert('Inserisci una richiesta');
            return;
        }
        
        // Mostra il loading
        loadingIndicator.style.display = 'block';
        resultSection.classList.add('hidden');
        
        // Raccoglie i dati del form
        const formData = new FormData(this);
        
        // Invia la richiesta
        fetch('/process', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nella risposta del server');
            }
            return response.json();
        })
        .then(data => {
            // Nascondi il loading
            loadingIndicator.style.display = 'none';
            
            // Mostra il risultato
            resultSection.classList.remove('hidden');
            reasoningOutput.textContent = data.reasoning || 'Nessun ragionamento disponibile';
            
            // Gestisci il link se presente
            linkContainer.innerHTML = '';
            
            if (data.visualization_id) {
                currentVisualizationId = data.visualization_id;
                
                // Crea due bottoni: uno per aprire il modal e uno per aprire in nuova finestra
                const viewButton = document.createElement('button');
                viewButton.className = 'btn primary';
                viewButton.textContent = 'Visualizza qui';
                viewButton.onclick = function() {
                    openVisualization(data.visualization_id);
                };
                linkContainer.appendChild(viewButton);
                
                const link = document.createElement('a');
                link.href = '/visualization/' + data.visualization_id;
                link.target = '_blank';
                link.className = 'btn';
                link.textContent = 'Apri in nuova finestra';
                linkContainer.appendChild(link);
            } else {
                linkContainer.innerHTML = '<p>Nessuna visualizzazione disponibile</p>';
            }
            
            // Aggiorna la cronologia delle ricerche
            loadRecentQueries();
        })
        .catch(error => {
            console.error('Errore:', error);
            loadingIndicator.style.display = 'none';
            resultSection.classList.remove('hidden');
            reasoningOutput.textContent = 'Si è verificato un errore durante l\'elaborazione della richiesta.';
            linkContainer.innerHTML = '<p>Errore: ' + error.message + '</p>';
        });
    });

    // Gestione esempi di query
    exampleQueries.forEach(example => {
        example.addEventListener('click', function() {
            const query = this.dataset.query || this.textContent;
            userInput.value = query;
            queryForm.dispatchEvent(new Event('submit'));
        });
    });

    // Funzione per aprire la visualizzazione nel modal
	function openVisualization(vizId) {
		currentVisualizationId = vizId;
		
		// Apri semplicemente la visualizzazione in una nuova finestra
		window.open('/visualization/' + vizId, '_blank');
		
		// Aggiorna lo stato del preferito in background
		checkFavoriteStatus(vizId);
	}
	
    // Chiudi modal quando si clicca sulla X
    closeModal.addEventListener('click', function() {
        resultsModal.style.display = 'none';
    });

    // Chiudi modal quando si clicca fuori
    window.addEventListener('click', function(event) {
        if (event.target == resultsModal) {
            resultsModal.style.display = 'none';
        }
    });

    // Gestione esportazione CSV
    exportCsvBtn.addEventListener('click', function() {
        if (currentVisualizationId) {
            window.open('/export/' + currentVisualizationId + '?format=csv', '_blank');
        }
    });

    // Gestione esportazione JSON
    exportJsonBtn.addEventListener('click', function() {
        if (currentVisualizationId) {
            window.open('/export/' + currentVisualizationId + '?format=json', '_blank');
        }
    });

    // Gestione preferiti
    toggleFavoriteBtn.addEventListener('click', function() {
        if (currentVisualizationId) {
            toggleFavorite(currentVisualizationId);
        }
    });

    // Funzione per verificare se una visualizzazione è tra i preferiti
    function checkFavoriteStatus(vizId) {
        fetch('/visualization/' + vizId + '/favorite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ check_only: true })
        })
        .then(response => response.json())
        .then(data => {
            isFavorite = data.is_favorite;
            updateFavoriteButton();
        })
        .catch(error => {
            console.error('Errore nel controllare lo stato preferito:', error);
        });
    }

    // Funzione per cambiare lo stato preferito
    function toggleFavorite(vizId) {
        fetch('/visualization/' + vizId + '/favorite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_favorite: !isFavorite })
        })
        .then(response => response.json())
        .then(data => {
            isFavorite = data.is_favorite;
            updateFavoriteButton();
        })
        .catch(error => {
            console.error('Errore nel modificare lo stato preferito:', error);
        });
    }

    // Aggiorna il pulsante preferiti
    function updateFavoriteButton() {
        if (isFavorite) {
            toggleFavoriteBtn.textContent = 'Rimuovi dai preferiti';
            toggleFavoriteBtn.classList.add('favorited');
        } else {
            toggleFavoriteBtn.textContent = 'Aggiungi ai preferiti';
            toggleFavoriteBtn.classList.remove('favorited');
        }
    }

    // Carica le ricerche recenti
    function loadRecentQueries() {
        fetch('/history?limit=5')
            .then(response => response.json())
            .then(data => {
                if (data.history && data.history.length > 0) {
                    recentQueriesSection.classList.remove('hidden');
                    renderHistoryItems(data.history);
                } else {
                    recentQueriesSection.classList.add('hidden');
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento della cronologia:', error);
                recentQueriesSection.classList.add('hidden');
            });
    }

    // Renderizza gli elementi della cronologia
    function renderHistoryItems(historyItems) {
        historyList.innerHTML = '';
        
        historyItems.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item' + (item.success ? '' : ' failed');
            
            const content = document.createElement('div');
            content.className = 'history-item-content';
            
            const query = document.createElement('div');
            query.textContent = item.user_input;
            content.appendChild(query);
            
            const timestamp = document.createElement('div');
            timestamp.className = 'history-timestamp';
            timestamp.textContent = new Date(item.timestamp).toLocaleString();
            content.appendChild(timestamp);
            
            historyItem.appendChild(content);
            
            const actions = document.createElement('div');
            actions.className = 'history-item-actions';
            
            if (item.visualization_id) {
                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn';
                viewBtn.textContent = 'Visualizza';
                viewBtn.addEventListener('click', function() {
                    openVisualization(item.visualization_id);
                });
                actions.appendChild(viewBtn);
            }
            
            const rerunBtn = document.createElement('button');
            rerunBtn.className = 'btn';
            rerunBtn.textContent = 'Riesegui';
            rerunBtn.addEventListener('click', function() {
                userInput.value = item.user_input;
                queryForm.dispatchEvent(new Event('submit'));
            });
            actions.appendChild(rerunBtn);
            
            historyItem.appendChild(actions);
            historyList.appendChild(historyItem);
        });
    }

    // Suggerimenti autocomplete
    let typingTimer;
    const doneTypingInterval = 500; // ms
    
    userInput.addEventListener('input', function() {
        clearTimeout(typingTimer);
        
        if (userInput.value.trim().length > 3) {
            typingTimer = setTimeout(fetchSuggestions, doneTypingInterval);
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });
    
    function fetchSuggestions() {
        const partialInput = userInput.value.trim();
        
        fetch('/suggest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ partial: partialInput })
        })
        .then(response => response.json())
        .then(data => {
            if (data.suggestions && data.suggestions.length > 0) {
                renderSuggestions(data.suggestions);
            } else {
                suggestionsContainer.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Errore nel recupero dei suggerimenti:', error);
            suggestionsContainer.style.display = 'none';
        });
    }
    
    function renderSuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', function() {
                userInput.value = suggestion;
                suggestionsContainer.style.display = 'none';
                queryForm.dispatchEvent(new Event('submit'));
            });
            suggestionsContainer.appendChild(item);
        });
        
        suggestionsContainer.style.display = 'block';
    }
    
    // Nascondi suggerimenti quando si clicca altrove
    document.addEventListener('click', function(event) {
        if (!userInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Carica le ricerche recenti all'avvio
    loadRecentQueries();
});
/**
 * drag-drop.js - Gestione del drag and drop per gli eventi del calendario
 */

// Inizializza il drag and drop
function initDragAndDrop(viewName) {
    console.log('Inizializzazione drag and drop per vista:', viewName);
    
    // Selettori specifici per le diverse viste
    let selectors = [];
    
    if (viewName === 'month' || !viewName) {
        selectors.push('#monthGrid .event');
    }
    if (viewName === 'week' || !viewName) {
        selectors.push('#weekGrid .time-event');
    }
    if (viewName === 'day' || !viewName) {
        selectors.push('#dayGrid .time-event');
    }
    
    // Trova tutti gli elementi eventi
    const events = document.querySelectorAll(selectors.join(', '));
    console.log(`Trovati ${events.length} elementi`);
    
    // Rendi ogni elemento trascinabile
    events.forEach(event => {
        // Imposta l'attributo draggable=true
        event.setAttribute('draggable', 'true');
        
        // Assegna il gestore ondragstart
        event.setAttribute('ondragstart', 'dragFunction(event)');
        
        console.log('Elemento reso trascinabile:', event);
    });
    
    // Selettori per i drop target
    let dropTargets = [];
    if (viewName === 'month' || !viewName) {
        dropTargets.push('#monthGrid .calendar-day');
    }
    if (viewName === 'week' || !viewName) {
        dropTargets.push('#weekGrid .time-slot');
    }
    if (viewName === 'day' || !viewName) {
        dropTargets.push('#dayGrid .time-slot');
    }
    
    // Aggiungi event listeners per evidenziazione
    document.querySelectorAll(dropTargets.join(', ')).forEach(target => {
        // Aggiungi l'evidenziazione durante il dragover
        target.addEventListener('dragover', function(e) {
            e.preventDefault(); // Necessario per permettere il drop
            this.classList.add('drag-over');
        });
        
        // Rimuovi l'evidenziazione durante il dragleave
        target.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });
        
        // Rimuovi l'evidenziazione dopo il drop
        target.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            // Ottieni l'ID dell'evento trascinato
            const eventId = e.dataTransfer.getData('text/plain');
            console.log(`Evento ${eventId} rilasciato in:`, this);
            
            // Qui implementare la logica per spostare effettivamente l'evento
            // Ad esempio, se nella vista giornaliera:
            if (viewName === 'day') {
                const ora = parseInt(this.dataset.ora);
                const nuovaData = new Date(dataAttuale);
                nuovaData.setHours(ora, 0, 0);
                
                // Aggiorna l'evento nel database
                console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
            }
            
            // Se nella vista settimanale:
            if (viewName === 'week') {
                const ora = parseInt(this.dataset.ora);
                const giorno = parseInt(this.dataset.giorno);
                
                // Calcola la nuova data
                const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
                const nuovaData = new Date(inizioSettimana);
                nuovaData.setDate(nuovaData.getDate() + giorno);
                nuovaData.setHours(ora, 0, 0);
                
                // Aggiorna l'evento nel database
                console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
            }
            
            // Se nella vista mensile:
            if (viewName === 'month') {
                const dataStr = this.dataset.date;
                const [anno, mese, giorno] = dataStr.split('-').map(Number);
                
                // Trova l'evento originale
                const evento = eventi.find(e => e.id === eventId);
                
                if (evento) {
                    // Mantieni l'ora originale, cambia solo la data
                    const nuovaData = new Date(anno, mese - 1, giorno);
                    nuovaData.setHours(
                        evento.dataInizio.getHours(),
                        evento.dataInizio.getMinutes()
                    );
                    
                    // Aggiorna l'evento nel database
                    console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
                }
            }
            
            // In una vera implementazione, qui chiameresti la funzione per aggiornare l'evento
            // modificaEvento(eventId, { dataInizio: nuovaData });
            // Poi rigenereresti la vista
            // aggiornaViste();
        });
    });
}

// Funzione richiamata all'inizio del trascinamento
window.dragFunction = function(event) {
    // Passa l'ID dell'evento
    event.dataTransfer.setData('text/plain', event.target.dataset.id || 'dragging');
    
    // Aggiungi una classe all'elemento durante il trascinamento
    event.target.classList.add('dragging');
    
    console.log('Iniziato trascinamento elemento:', event.target);
};

// Listener globale per la fine del trascinamento
document.addEventListener('dragend', function(e) {
    // Rimuovi la classe dragging dall'elemento
    if (e.target.classList.contains('dragging')) {
        e.target.classList.remove('dragging');
    }
    
    // Rimuovi tutte le evidenziazioni
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
});

// Funzione per il codice esistente
function enableDragAndDrop() {
    initDragAndDrop(vistaAttuale || 'month');
}

// Esponi le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: function() {
        // Rimuovi eventuali evidenziazioni residue
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }
};
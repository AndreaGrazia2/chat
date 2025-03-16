/**
 * drag-only-fixed.js - Solo trascinamento, corretto per tutte le viste
 */

// Inizializza il drag
function initDragAndDrop(viewName) {
    console.log('Inizializzazione solo trascinamento per vista:', viewName);
    
    // Selettori specifici per le diverse viste
    let selectors = [];
    
    if (viewName === 'month' || !viewName) {
        selectors.push('#monthGrid .event');
    }
    if (viewName === 'week' || !viewName) {
        selectors.push('#weekGrid .time-event');
    }
    if (viewName === 'day' || !viewName) {
        // Per la vista giorno, usiamo un selettore più specifico
        selectors.push('#dayGrid .time-event');
        // Debug: stampa gli elementi trovati
        console.log('Elementi nella vista giorno:', document.querySelectorAll('#dayGrid .time-event').length);
    }
    
    // Trova tutti gli elementi eventi
    const events = document.querySelectorAll(selectors.join(', '));
    console.log(`Trovati ${events.length} elementi`);
    
    // Rendi ogni elemento trascinabile
    events.forEach(event => {
        // Imposta l'attributo draggable=true
        event.setAttribute('draggable', 'true');
        
        // Assegna il gestore ondragstart essenziale
        event.setAttribute('ondragstart', 'dragFunction(event)');
        
        console.log('Elemento reso trascinabile:', event);
    });
    
    // Debug: stampa gli elementi nella vista giorno dopo aver impostato draggable
    if (viewName === 'day' || !viewName) {
        document.querySelectorAll('#dayGrid .time-event[draggable="true"]').forEach(el => {
            console.log('Elemento in vista giorno reso trascinabile:', el);
        });
    }
}

// Necessario per iniziare il trascinamento
window.dragFunction = function(event) {
    // Imposta il data transfer (fondamentale per il drag)
    event.dataTransfer.setData('text/plain', 'dragging');
    // Non aggiungiamo la classe dragging per evitare errori
    
    console.log('Iniziato trascinamento elemento:', event.target);
};

// Funzione per il codice esistente
function enableDragAndDrop() {
    initDragAndDrop(vistaAttuale || 'month');
}

// Esponi le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: function() {}
};
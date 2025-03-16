/**
 * drag-only.js - Rende gli elementi trascinabili e nient'altro
 */

// Inizializza il drag
function initDragAndDrop(viewName) {
    console.log('Inizializzazione solo trascinamento per:', viewName);
    
    // Selettori per gli elementi eventi nelle diverse viste
    let selectors = [
        '#monthGrid .event', 
        '#weekGrid .time-event', 
        '#dayGrid .time-event'
    ];
    
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
}

// Necessario per iniziare il trascinamento
window.dragFunction = function(event) {
    // Imposta il data transfer (fondamentale per il drag)
    event.dataTransfer.setData('text/plain', 'dragging');
    //event.target.classList.add('dragging');
    
    console.log('Iniziato trascinamento elemento');
};

// Funzione per il codice esistente
function enableDragAndDrop() {
    initDragAndDrop();
}

// Esponi le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: function() {}
};
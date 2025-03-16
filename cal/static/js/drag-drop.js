/**
 * drag-drop.js - Sistema centralizzato per la gestione del drag and drop nel calendario
 * Implementazione personalizzata basata su eventi mouse/touch anziché API HTML5 Drag and Drop
 */

// Variabili globali per il tracciamento
let draggedElement = null;
let originalElement = null;
let offsetX = 0;
let offsetY = 0;
let startX = 0;
let startY = 0;
let isDragging = false;
let dragThreshold = 5; // Pixels di movimento prima di attivare il drag
let currentDropTarget = null;
let eventOriginalData = null;
let draggedEventId = null;

/**
 * Inizializza il drag and drop per tutti gli elementi evento nella vista corrente
 * @param {string} viewType - Tipo di vista ('month', 'week', 'day')
 */
function initDragAndDrop(viewType) {
    console.log(`Inizializzazione drag and drop per la vista: ${viewType}`);
    
    // Rimuovi eventuali listener precedenti
    cleanupDragListeners();
    
    // Rileva il tipo di vista e imposta i selettori corretti
    let itemSelector, dropTargetSelector;
    
    switch (viewType) {
        case 'month':
            itemSelector = '#monthGrid .event';
            dropTargetSelector = '#monthGrid .calendar-day';
            break;
        case 'week':
            itemSelector = '#weekGrid .time-event';
            dropTargetSelector = '#weekGrid .time-slot';
            break;
        case 'day':
            itemSelector = '#dayGrid .time-event';
            dropTargetSelector = '#dayGrid .time-slot';
            break;
        default:
            console.log(`Drag and drop non supportato per la vista: ${viewType}`);
            return;
    }
    
    // Seleziona tutti gli elementi trascinabili
    document.querySelectorAll(itemSelector).forEach(item => {
        // Rimuovi l'attributo draggable e gli event listener standard
        item.setAttribute('draggable', 'false');
        
        // Rimuovi eventuali listener precedenti per evitare duplicati
        item.removeEventListener('mousedown', handleMouseDown);
        item.removeEventListener('touchstart', handleTouchStart);
        
        // Aggiungi lo stile per indicare che è trascinabile
        item.classList.add('draggable');
        
        // Aggiungi event listener per il mouse e touch
        item.addEventListener('mousedown', handleMouseDown);
        item.addEventListener('touchstart', handleTouchStart, { passive: false });
    });
    
    // Configura tutte le destinazioni di drop
    document.querySelectorAll(dropTargetSelector).forEach(target => {
        target.classList.add('droppable');
    });
    
    // Gestisci i click sugli eventi (per l'apertura dei dettagli)
    initEventClicks(itemSelector);
}

/**
 * Rimuove tutti i listener di drag and drop precedenti
 */
function cleanupDragListeners() {
    console.log('Pulizia dei listener di drag and drop precedenti');
    
    // Rimuovi listener globali
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    // Rimuovi gli handler dagli elementi
    document.querySelectorAll('.draggable').forEach(item => {
        item.removeEventListener('mousedown', handleMouseDown);
        item.removeEventListener('touchstart', handleTouchStart);
        item.removeAttribute('draggable');
    });
    
    // Rimuovi le classi dalle destinazioni
    document.querySelectorAll('.droppable').forEach(target => {
        target.classList.remove('droppable', 'drag-over');
    });
    
    // Rimuovi eventuali elementi di feedback
    removeDragFeedback();
    
    // Reset delle variabili
    draggedElement = null;
    originalElement = null;
    isDragging = false;
    currentDropTarget = null;
    draggedEventId = null;
    eventOriginalData = null;
    window.eventDataForDrag = null;
}

/**
 * Avvia il trascinamento con mouse
 * @param {MouseEvent} e - Evento mouse
 */
function handleMouseDown(e) {
    // Verifica se l'elemento è effettivamente trascinabile
    if (!e.target.closest('.draggable') && !this.classList.contains('draggable')) {
        return;
    }
    
    // Impedisci selezione di testo e comportamento predefinito
    e.preventDefault();
    e.stopPropagation();
    
    // Salva l'elemento originale
    originalElement = this;
    
    // Salva la posizione iniziale del mouse
    startX = e.clientX;
    startY = e.clientY;
    
    // Registra l'offset del clic all'interno dell'elemento
    const rect = originalElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // Aggiungi gli event listeners globali
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

/**
 * Avvia il trascinamento con touch
 * @param {TouchEvent} e - Evento touch
 */
function handleTouchStart(e) {
    // Verifica se l'elemento è effettivamente trascinabile
    if (!e.target.closest('.draggable') && !this.classList.contains('draggable')) {
        return;
    }
    
    // Impedisci scroll e zoom durante il trascinamento
    e.preventDefault();
    e.stopPropagation();
    
    // Salva l'elemento originale
    originalElement = this;
    
    // Salva la posizione iniziale del touch
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    
    // Registra l'offset del touch all'interno dell'elemento
    const rect = originalElement.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
    
    // Aggiungi gli event listeners globali
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
}

/**
 * Durante il trascinamento con mouse
 * @param {MouseEvent} e - Evento mouse
 */
function handleMouseMove(e) {
    if (!originalElement) return;
    
    // Calcola la distanza percorsa
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);
    
    // Controlla se il movimento supera la soglia per considerarlo un drag
    if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        startDragging(e.clientX, e.clientY);
        isDragging = true;
    }
    
    if (isDragging) {
        // Aggiorna la posizione dell'elemento di feedback
        const feedbackElement = document.getElementById('drag-feedback');
        if (feedbackElement) {
            feedbackElement.style.left = (e.clientX - offsetX) + 'px';
            feedbackElement.style.top = (e.clientY - offsetY) + 'px';
        }
        
        // Trova e evidenzia il target di drop
        updateDropTarget(e.clientX, e.clientY);
    }
}

/**
 * Durante il trascinamento con touch
 * @param {TouchEvent} e - Evento touch
 */
function handleTouchMove(e) {
    if (!originalElement) return;
    
    // Impedisci scrolling durante il drag
    e.preventDefault();
    
    const touch = e.touches[0];
    
    // Calcola la distanza percorsa
    const deltaX = Math.abs(touch.clientX - startX);
    const deltaY = Math.abs(touch.clientY - startY);
    
    // Controlla se il movimento supera la soglia per considerarlo un drag
    if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        startDragging(touch.clientX, touch.clientY);
        isDragging = true;
    }
    
    if (isDragging) {
        // Aggiorna la posizione dell'elemento di feedback
        const feedbackElement = document.getElementById('drag-feedback');
        if (feedbackElement) {
            feedbackElement.style.left = (touch.clientX - offsetX) + 'px';
            feedbackElement.style.top = (touch.clientY - offsetY) + 'px';
        }
        
        // Trova e evidenzia il target di drop
        updateDropTarget(touch.clientX, touch.clientY);
    }
}

/**
 * Fine del trascinamento con mouse
 * @param {MouseEvent} e - Evento mouse
 */
function handleMouseUp(e) {
    if (isDragging) {
        // Completa il trascinamento
        finishDragging(e.clientX, e.clientY);
    } else if (originalElement) {
        // Se non era un drag, potrebbe essere un click
        // Il click sull'evento è gestito separatamente
    }
    
    // Rimuovi gli event listener
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Reset
    resetDragState();
}

/**
 * Fine del trascinamento con touch
 * @param {TouchEvent} e - Evento touch
 */
function handleTouchEnd(e) {
    if (isDragging) {
        // Per il touch, usiamo l'ultima posizione conosciuta
        // perché touchend non ha coordinate
        finishDragging();
    } else if (originalElement) {
        // Se non era un drag, potrebbe essere un tap
        // Il tap sull'evento è gestito separatamente
    }
    
    // Rimuovi gli event listener
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    // Reset
    resetDragState();
}

/**
 * Avvia il processo di trascinamento
 * @param {number} clientX - Coordinata X
 * @param {number} clientY - Coordinata Y
 */
function startDragging(clientX, clientY) {
    // Salva l'ID dell'evento trascinato
    draggedEventId = originalElement.getAttribute('data-id');
    
    console.log('Inizio trascinamento', draggedEventId);
    
    // Crea l'elemento di feedback per il trascinamento
    createDragFeedback(clientX, clientY);
    
    // Memorizza l'elemento che viene trascinato
    draggedElement = originalElement;
    
    // Memorizza i dati originali dell'evento
    eventOriginalData = {
        id: draggedEventId,
        element: draggedElement,
        parent: draggedElement.parentNode
    };
    
    // Aggiungi la classe dragging all'elemento originale per evidenziarlo
    originalElement.classList.add('dragging');
    
    // Aggiungi la classe al body per gestire CSS specifico durante drag
    document.body.classList.add('dragging-in-progress');
}

/**
 * Crea l'elemento visivo di feedback
 * @param {number} clientX - Coordinata X
 * @param {number} clientY - Coordinata Y
 */
function createDragFeedback(clientX, clientY) {
    // Rimuovi eventuali feedback precedenti
    removeDragFeedback();
    
    // Crea un clone dell'elemento per il feedback visivo
    const clone = originalElement.cloneNode(true);
    clone.id = 'drag-feedback';
    clone.style.position = 'fixed';
    clone.style.zIndex = '9999';
    clone.style.opacity = '0.8';
    clone.style.pointerEvents = 'none';
    clone.style.transform = 'scale(1.05)';
    clone.style.transition = 'box-shadow 0.2s ease';
    clone.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    
    // Posiziona il clone
    const rect = originalElement.getBoundingClientRect();
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.left = (clientX - offsetX) + 'px';
    clone.style.top = (clientY - offsetY) + 'px';
    
    document.body.appendChild(clone);
}

/**
 * Rimuovi l'elemento di feedback
 */
function removeDragFeedback() {
    const feedback = document.getElementById('drag-feedback');
    if (feedback) {
        feedback.parentNode.removeChild(feedback);
    }
}

/**
 * Trova il bersaglio di drop sotto le coordinate
 * @param {number} clientX - Coordinata X
 * @param {number} clientY - Coordinata Y
 */
function updateDropTarget(clientX, clientY) {
    // Nascondi temporaneamente il feedback per trovare l'elemento sottostante
    const feedback = document.getElementById('drag-feedback');
    if (feedback) feedback.style.display = 'none';
    
    // Trova l'elemento sotto il cursore/touch
    const elementUnder = document.elementFromPoint(clientX, clientY);
    
    // Ripristina la visualizzazione del feedback
    if (feedback) feedback.style.display = '';
    
    // Trova il contenitore droppable più vicino
    const target = findClosestDropTarget(elementUnder);
    
    // Se abbiamo cambiato target, aggiorna le classi CSS
    if (target !== currentDropTarget) {
        // Rimuovi la classe drag-over dal target precedente
        if (currentDropTarget) {
            currentDropTarget.classList.remove('drag-over');
        }
        
        // Aggiungi la classe al nuovo target
        if (target) {
            target.classList.add('drag-over');
        }
        
        currentDropTarget = target;
    }
}

/**
 * Trova il contenitore droppable più vicino
 * @param {HTMLElement} element - Elemento di partenza
 * @returns {HTMLElement|null} - Elemento droppable più vicino
 */
function findClosestDropTarget(element) {
    if (!element) return null;
    
    // Cerca il genitore più vicino che sia un elemento droppable
    let current = element;
    while (current && !current.classList.contains('droppable')) {
        current = current.parentElement;
    }
    
    return current;
}

/**
 * Completa il trascinamento
 * @param {number} clientX - Coordinata X
 * @param {number} clientY - Coordinata Y
 */
function finishDragging(clientX, clientY) {
    console.log('Fine trascinamento');
    
    // Rimuovi la classe dragging
    if (originalElement) {
        originalElement.classList.remove('dragging');
    }
    
    // Rimuovi la classe dal body
    document.body.classList.remove('dragging-in-progress');
    
    // Se non abbiamo le coordinate (touch), usa il currentDropTarget attuale
    if (typeof clientX !== 'undefined' && typeof clientY !== 'undefined') {
        // Aggiorna il target finale in base alla posizione corrente
        updateDropTarget(clientX, clientY);
    }
    
    // Esegui il drop se c'è un target valido
    if (currentDropTarget && draggedElement) {
        performDrop(draggedElement, currentDropTarget);
    }
    
    // Rimuovi il feedback visivo
    removeDragFeedback();
    
    // Rimuovi le evidenziazioni dai target
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

/**
 * Resetta lo stato del drag
 */
function resetDragState() {
    draggedElement = null;
    originalElement = null;
    isDragging = false;
    currentDropTarget = null;
}

/**
 * Esegue il drop dell'elemento
 * @param {HTMLElement} dragged - Elemento trascinato
 * @param {HTMLElement} target - Elemento di destinazione
 */
function performDrop(dragged, target) {
    if (!dragged || !target) return;
    
    const eventId = dragged.getAttribute('data-id');
    console.log('Drop eseguito', eventId, 'su', target.getAttribute('data-date') || target.getAttribute('data-ora'));
    
    // Esegui l'azione appropriata in base al tipo di target
    if (target.classList.contains('calendar-day')) {
        handleMonthViewDrop(dragged, target);
    } else if (target.classList.contains('time-slot')) {
        if (target.hasAttribute('data-giorno')) {
            handleWeekViewDrop(dragged, target);
        } else {
            handleDayViewDrop(dragged, target);
        }
    }
}

/**
 * Gestisci il drop in vista mensile
 * @param {HTMLElement} dragged - Elemento trascinato
 * @param {HTMLElement} target - Elemento di destinazione
 */
function handleMonthViewDrop(dragged, target) {
    const eventId = dragged.getAttribute('data-id');
    const targetDate = target.getAttribute('data-date');
    
    if (!eventId || !targetDate) return;
    
    // Converti la data nel formato corretto
    const [year, month, day] = targetDate.split('-').map(Number);
    const dropDate = new Date(year, month - 1, day);
    
    // Trova l'evento e aggiorna la data
    const evento = eventi.find(ev => ev.id === eventId);
    if (evento) {
        // Calcola la differenza di giorni
        const oldDate = new Date(evento.dataInizio);
        const diffDays = Math.floor((dropDate - oldDate) / (1000 * 60 * 60 * 24));
        
        // Aggiorna le date mantenendo l'ora originale
        const newStartDate = new Date(evento.dataInizio);
        newStartDate.setDate(newStartDate.getDate() + diffDays);
        
        const newEndDate = new Date(evento.dataFine);
        newEndDate.setDate(newEndDate.getDate() + diffDays);
        
        // Aggiorna l'evento
        if (typeof modificaEvento === 'function') {
            modificaEvento(eventId, {
                dataInizio: newStartDate,
                dataFine: newEndDate
            });
            
            // Aggiorna la vista
            if (typeof aggiornaVista === 'function') {
                aggiornaVista();
            }
            
            // Mostra notifica
            if (typeof mostraNotifica === 'function') {
                mostraNotifica(`Evento "${evento.titolo}" spostato`, 'success');
            }
            
            console.log(`Evento ${evento.titolo} spostato con successo alla data ${targetDate}`);
        } else {
            console.error('Funzione modificaEvento non disponibile');
        }
    } else {
        console.error(`Evento con ID ${eventId} non trovato`);
    }
}

/**
 * Gestisci il drop in vista settimanale
 * @param {HTMLElement} dragged - Elemento trascinato
 * @param {HTMLElement} target - Elemento di destinazione
 */
function handleWeekViewDrop(dragged, target) {
    const eventId = dragged.getAttribute('data-id');
    const hour = parseInt(target.getAttribute('data-ora') || '0');
    const dayIndex = parseInt(target.getAttribute('data-giorno') || '0');
    
    if (!eventId) return;
    
    // Calcola la nuova data/ora
    let targetDate = new Date();
    if (typeof getPrimoGiornoSettimana === 'function' && typeof dataAttuale !== 'undefined') {
        const weekStartDate = getPrimoGiornoSettimana(dataAttuale);
        targetDate = new Date(weekStartDate);
        targetDate.setDate(targetDate.getDate() + dayIndex);
    }
    targetDate.setHours(hour, 0, 0);
    
    // Trova l'evento e calcola la durata
    const evento = eventi.find(ev => ev.id === eventId);
    if (evento) {
        // Calcola la durata dell'evento in minuti
        const oldStart = new Date(evento.dataInizio);
        const oldEnd = new Date(evento.dataFine);
        const durationMs = oldEnd - oldStart;
        
        // Crea le nuove date
        const newStartDate = new Date(targetDate);
        const newEndDate = new Date(newStartDate.getTime() + durationMs);
        
        // Aggiorna l'evento
        if (typeof modificaEvento === 'function') {
            modificaEvento(eventId, {
                dataInizio: newStartDate,
                dataFine: newEndDate
            });
            
            // Aggiorna la vista
            if (typeof aggiornaVista === 'function') {
                aggiornaVista();
            }
            
            console.log(`Evento ${evento.titolo} spostato con successo a ${newStartDate.toLocaleString()}`);
        } else {
            console.error('Funzione modificaEvento non disponibile');
        }
    } else {
        console.error(`Evento con ID ${eventId} non trovato`);
    }
}

/**
 * Gestisci il drop in vista giornaliera
 * @param {HTMLElement} dragged - Elemento trascinato
 * @param {HTMLElement} target - Elemento di destinazione
 */
function handleDayViewDrop(dragged, target) {
    const eventId = dragged.getAttribute('data-id');
    const hour = parseInt(target.getAttribute('data-ora') || '0');
    
    if (!eventId) return;
    
    // Calcola la nuova data/ora
    let targetDate = new Date();
    if (typeof dataAttuale !== 'undefined') {
        targetDate = new Date(dataAttuale);
    }
    targetDate.setHours(hour, 0, 0);
    
    // Trova l'evento e calcola la durata
    const evento = eventi.find(ev => ev.id === eventId);
    if (evento) {
        // Calcola la durata dell'evento in minuti
        const oldStart = new Date(evento.dataInizio);
        const oldEnd = new Date(evento.dataFine);
        const durationMs = oldEnd - oldStart;
        
        // Crea le nuove date
        const newStartDate = new Date(targetDate);
        const newEndDate = new Date(newStartDate.getTime() + durationMs);
        
        // Aggiorna l'evento
        if (typeof modificaEvento === 'function') {
            modificaEvento(eventId, {
                dataInizio: newStartDate,
                dataFine: newEndDate
            });
            
            // Aggiorna la vista
            if (typeof aggiornaVista === 'function') {
                aggiornaVista();
            }
            
            console.log(`Evento ${evento.titolo} spostato con successo a ${newStartDate.toLocaleString()}`);
        } else {
            console.error('Funzione modificaEvento non disponibile');
        }
    } else {
        console.error(`Evento con ID ${eventId} non trovato`);
    }
}

/**
 * Gestisce i click sugli eventi (per l'apertura dei dettagli)
 * @param {string} selector - Selettore degli elementi da gestire
 */
function initEventClicks(selector) {
    // Rimuovi eventuali handler precedenti per evitare duplicati
    document.querySelectorAll(selector).forEach(item => {
        const oldHandler = item._clickHandler;
        if (oldHandler) {
            item.removeEventListener('click', oldHandler);
        }
    });
    
    // Aggiungi nuovi handler di click
    document.querySelectorAll(selector).forEach(item => {
        const clickHandler = function(e) {
            // Se stiamo trascinando, non aprire il modal
            if (isDragging) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const eventId = this.getAttribute('data-id');
            if (!eventId) return;
            
            console.log('Click su evento', eventId);
            
            // Chiama la funzione esistente per aprire il modal dell'evento
            if (typeof apriModalEvento === 'function') {
                apriModalEvento(eventId);
            } else {
                console.log('Funzione apriModalEvento non disponibile');
                // Fallback: prova a chiamare handleEventClick se esiste
                if (typeof handleEventClick === 'function') {
                    handleEventClick.call(this, e);
                }
            }
        };
        
        // Salva un riferimento all'handler per poterlo rimuovere in seguito
        item._clickHandler = clickHandler;
        
        item.addEventListener('click', clickHandler);
    });
}

/**
 * Funzione di supporto per inizializzare il drag and drop
 */
function enableDragAndDrop() {
    if (typeof vistaAttuale !== 'undefined') {
        initDragAndDrop(vistaAttuale);
    } else {
        // Fallback alla vista mensile
        initDragAndDrop('month');
    }
}

// Aggiungi stili personalizzati per il drag and drop
function addCustomStyles() {
    // Controlla se lo stile è già stato aggiunto
    if (document.getElementById('custom-drag-drop-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'custom-drag-drop-styles';
    style.textContent = `
        #drag-feedback {
            cursor: grabbing !important;
            transition: transform 0.1s ease, box-shadow 0.2s ease;
        }
        
        .dragging-in-progress {
            cursor: grabbing !important;
        }
        
        .draggable {
            cursor: grab;
        }
        
        .draggable:active {
            cursor: grabbing;
        }
        
        .dragging {
            opacity: 0.5 !important;
        }
        
        .drag-over {
            background-color: rgba(26, 115, 232, 0.2) !important;
            border: 2px dashed var(--primary) !important;
        }
        
        @keyframes dropComplete {
            0% { transform: scale(1.05); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .drop-complete {
            animation: dropComplete 0.3s ease-out forwards;
        }
    `;
    
    document.head.appendChild(style);
}

// Aggiungi gli stili personalizzati quando il documento è pronto
document.addEventListener('DOMContentLoaded', addCustomStyles);

// Esporta le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: cleanupDragListeners,
    enable: enableDragAndDrop
};

// Fornisci una funzione globale per la compatibilità con il codice esistente
window.enableDragAndDrop = enableDragAndDrop;
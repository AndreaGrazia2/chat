/**
 * drag-drop.js - Sistema di drag and drop per il calendario
 * Versione finale ottimizzata per eliminare flickering, correggere il posizionamento
 * e assicurare la corretta visualizzazione degli eventi in tutte le viste
 */

// Variabili globali essenziali
let draggedElement = null;
let activeDropTarget = null;
let draggingInProgress = false;
let draggedEventId = null;
let currentView = 'month';
let dragInitialized = false;

/**
 * Inizializza il sistema drag and drop
 * @param {string} viewName - Nome della vista ('month', 'week', 'day')
 */
function initDragAndDrop(viewName) {
    console.log('Inizializzazione drag and drop per:', viewName);
    
    // Prima pulisci eventuali residui di dragging precedenti
    cleanupDragAndDrop();
    
    // Salva la vista corrente
    currentView = viewName;
    
    // Attendi un momento per assicurarsi che le viste siano renderizzate
    setTimeout(() => {
        // Configura i selettori in base alla vista
        const eventSelector = getEventSelector(viewName);
        const dropTargetSelector = getDropTargetSelector(viewName);
        
        // Debug info
        console.log('Selettore eventi:', eventSelector);
        console.log('Selettore target:', dropTargetSelector);
        
        // Aggiungi i listener agli eventi
        const events = document.querySelectorAll(eventSelector);
        events.forEach(eventElement => {
            if (!eventElement.getAttribute('data-id')) {
                console.warn('Elemento evento senza data-id:', eventElement.textContent);
                return;
            }
            
            // Rimuovi listener esistenti
            eventElement.removeEventListener('mousedown', handleDragStart);
            eventElement.removeEventListener('touchstart', handleDragStart);
            
            // Aggiungi nuovi listener
            eventElement.addEventListener('mousedown', handleDragStart);
            eventElement.addEventListener('touchstart', handleDragStart, { passive: false });
            
            // Aggiungi classe per stile
            eventElement.classList.add('draggable');
        });
        
        // Configura i target di drop
        const dropTargets = document.querySelectorAll(dropTargetSelector);
        dropTargets.forEach(target => {
            // Aggiungi classe per stile
            target.classList.add('drop-target');
        });
        
        console.log(`Configurati ${events.length} eventi e ${dropTargets.length} destinazioni di drop`);
        
        // Aggiungi gli stili CSS
        addDragDropStyles();
        
        // Segna come inizializzato
        dragInitialized = true;
    }, 300);
}

/**
 * Ottiene il selettore per gli eventi in base alla vista
 */
function getEventSelector(viewName) {
    switch (viewName) {
        case 'month': return '#monthGrid .event';
        case 'week': return '#weekGrid .time-event';
        case 'day': return '#dayGrid .time-event';
        default: return '.event';
    }
}

/**
 * Ottiene il selettore per i target di drop in base alla vista
 */
function getDropTargetSelector(viewName) {
    switch (viewName) {
        case 'month': return '#monthGrid .calendar-day';
        case 'week': return '#weekGrid .time-slot';
        case 'day': return '#dayGrid .time-slot';
        default: return '.calendar-day';
    }
}

/**
 * Pulisce gli stati e i listener del drag and drop
 */
function cleanupDragAndDrop() {
    // Rimuovi stile dalle celle
    document.querySelectorAll('.drop-highlight').forEach(el => {
        el.classList.remove('drop-highlight');
    });
    
    // Rimuovi il ghost element se esiste
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.remove();
    
    // Rimuovi i listener globali
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
    
    // Rimuovi classe dal body
    document.body.classList.remove('drag-in-progress');
    
    // Reset variabili
    draggedElement = null;
    activeDropTarget = null;
    draggingInProgress = false;
    draggedEventId = null;
}

/**
 * Gestisce l'inizio del trascinamento
 * @param {Event} e - Evento di mouse o touch
 */
function handleDragStart(e) {
    // Ignora se non siamo completamente inizializzati
    if (!dragInitialized) return;
    
    // Controlla se siamo su un dispositivo touch
    const isTouch = e.type === 'touchstart';
    
    // Ottieni l'evento dell'elemento
    const eventElement = this;
    const eventId = eventElement.getAttribute('data-id');
    
    // Se non abbiamo un ID evento, esci
    if (!eventId) {
        console.warn('Elemento senza data-id');
        return;
    }
    
    // Previeni comportamenti predefiniti
    e.preventDefault();
    e.stopPropagation();
    
    // Salva riferimenti
    draggedElement = eventElement;
    draggedEventId = eventId;
    
    console.log('Inizio trascinamento evento:', eventId);
    
    // Crea il ghost element
    createDragGhost(eventElement, isTouch ? e.touches[0].clientX : e.clientX, 
                               isTouch ? e.touches[0].clientY : e.clientY);
    
    // Aggiungi stile all'elemento trascinato
    eventElement.classList.add('dragging');
    document.body.classList.add('drag-in-progress');
    
    // Aggiungi i listener globali
    document.addEventListener(isTouch ? 'touchmove' : 'mousemove', handleDragMove, 
                            { passive: false });
    document.addEventListener(isTouch ? 'touchend' : 'mouseup', handleDragEnd);
    
    // Imposta il flag di trascinamento
    draggingInProgress = true;
}

/**
 * Crea l'elemento ghost per il trascinamento
 */
function createDragGhost(sourceElement, clientX, clientY) {
    // Rimuovi eventuali ghost precedenti
    const existingGhost = document.getElementById('drag-ghost');
    if (existingGhost) existingGhost.remove();
    
    // Clona l'elemento
    const ghost = sourceElement.cloneNode(true);
    ghost.id = 'drag-ghost';
    
    // Imposta stile di base
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.width = sourceElement.offsetWidth + 'px';
    ghost.style.willChange = 'transform'; // Ottimizzazione renderizzazione
    
    // Per vista giorno/settimana, conserva altezza
    if (currentView !== 'month') {
        ghost.style.height = sourceElement.offsetHeight + 'px';
    }
    
    // Calcola posizione in base al tipo di vista
    let offsetX, offsetY;
    
    // In mese vuoi cliccare dove sta il mouse
    if (currentView === 'month') {
        const rect = sourceElement.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
    }
    // In vista settimana/giorno, vuoi afferrare dalla maniglia in alto
    else {
        offsetX = ghost.offsetWidth / 2;
        offsetY = 10; // Alta nell'elemento
    }
    
    // Posiziona il ghost con transform invece di left/top (più efficiente)
    ghost.style.transform = `translate(${clientX - offsetX}px, ${clientY - offsetY}px)`;
    
    // Salva gli offset come attributi per i movimenti successivi
    ghost.setAttribute('data-offset-x', offsetX);
    ghost.setAttribute('data-offset-y', offsetY);
    
    // Aggiungi al documento
    document.body.appendChild(ghost);
}

/**
 * Usa requestAnimationFrame per aggiornare la posizione del ghost
 */
let animationFrameId = null;

/**
 * Gestisce il movimento durante il trascinamento
 */
function handleDragMove(e) {
    if (!draggingInProgress) return;
    
    // Previeni comportamenti predefiniti (come lo scroll)
    e.preventDefault();
    
    // Ottieni posizione corrente
    const isTouch = e.type === 'touchmove';
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    // Cancella qualsiasi richiesta di animazione frame precedente
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Usa requestAnimationFrame per aggiornare l'UI in modo efficiente
    animationFrameId = requestAnimationFrame(() => {
        // Aggiorna posizione ghost con transform (nessun reflow)
        updateGhostPosition(clientX, clientY);
        
        // Trova e aggiorna target di drop
        findAndHighlightDropTarget(clientX, clientY);
    });
}

/**
 * Aggiorna la posizione dell'elemento ghost
 */
function updateGhostPosition(clientX, clientY) {
    const ghost = document.getElementById('drag-ghost');
    if (!ghost) return;
    
    // Recupera offset salvati
    const offsetX = parseInt(ghost.getAttribute('data-offset-x') || 0);
    const offsetY = parseInt(ghost.getAttribute('data-offset-y') || 0);
    
    // Aggiorna posizione con transform (più efficiente di left/top)
    ghost.style.transform = `translate(${clientX - offsetX}px, ${clientY - offsetY}px)`;
}

/**
 * Trova e evidenzia il target di drop sotto il puntatore
 */
function findAndHighlightDropTarget(clientX, clientY) {
    // Nascondi temporaneamente il ghost
    const ghost = document.getElementById('drag-ghost');
    let originalDisplay = '';
    if (ghost) {
        originalDisplay = ghost.style.display;
        ghost.style.display = 'none';
    }
    
    // Trova elemento sotto il puntatore
    let elementUnder = document.elementFromPoint(clientX, clientY);
    
    // Se non troviamo nulla, prova punti vicini
    if (!elementUnder || elementUnder.tagName === 'HTML' || elementUnder.tagName === 'BODY') {
        // Prova punti vicini per i dispositivi touch
        const points = [
            { x: clientX - 5, y: clientY - 5 },
            { x: clientX + 5, y: clientY - 5 },
            { x: clientX - 5, y: clientY + 5 },
            { x: clientX + 5, y: clientY + 5 }
        ];
        
        for (const point of points) {
            const tempElement = document.elementFromPoint(point.x, point.y);
            if (tempElement && tempElement.tagName !== 'HTML' && tempElement.tagName !== 'BODY') {
                elementUnder = tempElement;
                break;
            }
        }
    }
    
    // Ripristina ghost
    if (ghost) {
        ghost.style.display = originalDisplay;
    }
    
    // Trova il target di drop o il suo antenato
    const newDropTarget = findClosestDropTarget(elementUnder);
    
    // Se il target è cambiato, aggiorna evidenziazione
    if (newDropTarget !== activeDropTarget) {
        // Rimuovi highlight dal precedente
        if (activeDropTarget) {
            activeDropTarget.classList.remove('drop-highlight');
        }
        
        // Evidenzia il nuovo
        if (newDropTarget) {
            newDropTarget.classList.add('drop-highlight');
        }
        
        // Aggiorna riferimento
        activeDropTarget = newDropTarget;
    }
}

/**
 * Trova il target di drop valido più vicino
 */
function findClosestDropTarget(element) {
    if (!element) return null;
    
    // Verifica subito se è un target valido
    if (element.classList.contains('drop-target')) {
        return element;
    }
    
    // Cerca nei genitori
    let current = element.parentElement;
    let iterations = 0;
    const maxIterations = 5; // Per evitare loop infiniti
    
    while (current && iterations < maxIterations) {
        if (current.classList.contains('drop-target')) {
            return current;
        }
        current = current.parentElement;
        iterations++;
    }
    
    // Se non troviamo un target, usiamo altro metodo
    // Trova tutti i target di drop
    const allDropTargets = document.querySelectorAll('.drop-target');
    
    // Nessun target disponibile
    if (allDropTargets.length === 0) return null;
    
    // Per vista giorno/settimana, facciamo gestione speciale per gli slot orari
    // verifichiamo se siamo dentro una vista time-grid
    const timeGrid = element.closest('.time-grid-container, .week-grid, .day-grid');
    if (timeGrid && (currentView === 'day' || currentView === 'week')) {
        // Troviamo l'elemento time-slot più vicino
        const elementRect = element.getBoundingClientRect();
        const centerX = elementRect.left + elementRect.width / 2;
        const centerY = elementRect.top + elementRect.height / 2;
        
        // In viste time, troviamo lo slot al centro dell'elemento
        const slots = currentView === 'week' ? 
            document.querySelectorAll('#weekGrid .time-slot') :
            document.querySelectorAll('#dayGrid .time-slot');
        
        // Converti in array e filtra
        const slotsArray = Array.from(slots);
        
        // Troviamo lo slot più vicino
        let closestSlot = null;
        let minDistance = Infinity;
        
        slotsArray.forEach(slot => {
            const slotRect = slot.getBoundingClientRect();
            const slotCenterX = slotRect.left + slotRect.width / 2;
            const slotCenterY = slotRect.top + slotRect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(centerX - slotCenterX, 2) + 
                Math.pow(centerY - slotCenterY, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestSlot = slot;
            }
        });
        
        return closestSlot;
    }
    
    return null;
}

/**
 * Gestisce la fine del trascinamento
 */
function handleDragEnd(e) {
    // Cancella qualsiasi frame di animazione in corso
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Se non stavamo trascinando, esci
    if (!draggingInProgress || !draggedElement) {
        cleanupDragAndDrop();
        return;
    }
    
    console.log('Fine trascinamento');
    
    // Se abbiamo un target valido, esegui il drop
    if (activeDropTarget) {
        console.log('Drop su target:', activeDropTarget);
        performDrop();
    }
    
    // Pulisci lo stato del drag
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    
    document.body.classList.remove('drag-in-progress');
    
    // Rimuovi il ghost
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.remove();
    
    // Rimuovi highlight
    if (activeDropTarget) {
        activeDropTarget.classList.remove('drop-highlight');
    }
    
    // Rimuovi i listener globali
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
    
    // Reset variabili
    draggingInProgress = false;
}

/**
 * Esegue il drop dell'evento
 */
function performDrop() {
    if (!draggedEventId || !activeDropTarget) {
        console.error('Dati insufficienti per eseguire il drop');
        return;
    }
    
    console.log('Esecuzione drop:', draggedEventId, 'su target:', activeDropTarget);
    
    // Trova evento originale nel modello dati
    const origEvent = eventi.find(e => e.id === draggedEventId);
    if (!origEvent) {
        console.error('Evento non trovato:', draggedEventId);
        return;
    }
    
    console.log('Evento originale:', JSON.parse(JSON.stringify(origEvent)));
    
    // Determina la nuova data e ora in base alla vista
    const newDates = calculateNewDates(activeDropTarget, origEvent);
    if (!newDates) {
        console.error('Impossibile calcolare nuove date');
        return;
    }
    
    console.log('Nuove date:', {
        'start': newDates.start.toLocaleString(),
        'end': newDates.end.toLocaleString()
    });
    
    // Aggiorna l'evento
    const updated = updateEventData(draggedEventId, newDates.start, newDates.end);
    
    // Forza l'aggiornamento delle viste, con maggiore attesa
    if (updated) {
        setTimeout(() => {
            try {
                if (typeof aggiornaViste === 'function') {
                    aggiornaViste();
                } else {
                    console.warn('Funzione aggiornaViste non disponibile');
                    // Fallback a renderizzare la vista specifica
                    renderViewByName(currentView);
                }
            } catch (error) {
                console.error('Errore nell\'aggiornamento vista:', error);
            }
        }, 200);
    }
}

/**
 * Renderizza una specifica vista come fallback
 */
function renderViewByName(viewName) {
    switch(viewName) {
        case 'month':
            if (typeof renderizzaVistaMensile === 'function') renderizzaVistaMensile();
            break;
        case 'week':
            if (typeof renderizzaVistaSettimanale === 'function') renderizzaVistaSettimanale();
            break;
        case 'day':
            if (typeof renderizzaVistaGiornaliera === 'function') renderizzaVistaGiornaliera();
            break;
        case 'list':
            if (typeof renderizzaVistaLista === 'function') renderizzaVistaLista();
            break;
    }
}

/**
 * Calcola le nuove date dell'evento in base al target di drop
 */
function calculateNewDates(target, originalEvent) {
    // Debug info
    console.log('Target:', target);
    console.log('Target data-date:', target.getAttribute('data-date'));
    console.log('Target data-ora:', target.getAttribute('data-ora'));
    console.log('Target data-giorno:', target.getAttribute('data-giorno'));
    
    // Estrai informazioni dal target in base alla vista
    if (currentView === 'month') {
        return calculateMonthViewDates(target, originalEvent);
    } else if (currentView === 'week') {
        return calculateWeekViewDates(target, originalEvent);
    } else if (currentView === 'day') {
        return calculateDayViewDates(target, originalEvent);
    }
    
    return null;
}

/**
 * Calcola le nuove date per vista mensile
 */
function calculateMonthViewDates(target, originalEvent) {
    // Ottieni la data dal target
    const dateStr = target.getAttribute('data-date');
    if (!dateStr) {
        console.error('Target senza attributo data-date:', target);
        return null;
    }
    
    try {
        // Parse delle date
        const [year, month, day] = dateStr.split('-').map(Number);
        
        // Date originali
        const origStart = new Date(originalEvent.dataInizio);
        const origEnd = new Date(originalEvent.dataFine);
        
        // Durata originale in ms
        const duration = origEnd.getTime() - origStart.getTime();
        
        // Crea nuova data di inizio mantenendo ora e minuti originali
        const newStartDate = new Date(year, month - 1, day, 
                                    origStart.getHours(), 
                                    origStart.getMinutes(), 
                                    origStart.getSeconds());
        
        // Calcola la nuova data di fine aggiungendo la durata originale
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        return {
            start: newStartDate,
            end: newEndDate
        };
    } catch (error) {
        console.error('Errore nel calcolo date per vista mensile:', error);
        return null;
    }
}

/**
 * Calcola le nuove date per vista settimanale
 */
function calculateWeekViewDates(target, originalEvent) {
    try {
        // Estrai ora e giorno
        const hour = parseInt(target.getAttribute('data-ora') || '0');
        const dayIndex = parseInt(target.getAttribute('data-giorno') || '0');
        
        if (isNaN(hour) || isNaN(dayIndex)) {
            console.error('Attributi data-ora o data-giorno mancanti o non validi:', target);
            return null;
        }
        
        // Ottieni il primo giorno della settimana corrente
        const weekStart = getPrimoGiornoSettimana(dataAttuale);
        
        // Date originali
        const origStart = new Date(originalEvent.dataInizio);
        const origEnd = new Date(originalEvent.dataFine);
        
        // Durata originale in ms
        const duration = origEnd.getTime() - origStart.getTime();
        
        // Crea la nuova data di inizio
        const newStartDate = new Date(weekStart);
        newStartDate.setDate(weekStart.getDate() + dayIndex);
        newStartDate.setHours(hour, origStart.getMinutes(), 0, 0);
        
        // Calcola la nuova data di fine
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        return {
            start: newStartDate,
            end: newEndDate
        };
    } catch (error) {
        console.error('Errore nel calcolo date per vista settimanale:', error);
        return null;
    }
}

/**
 * Calcola le nuove date per vista giornaliera
 */
function calculateDayViewDates(target, originalEvent) {
    try {
        // Estrai ora
        const hour = parseInt(target.getAttribute('data-ora') || '0');
        
        if (isNaN(hour)) {
            console.error('Attributo data-ora mancante o non valido:', target);
            return null;
        }
        
        // Date originali
        const origStart = new Date(originalEvent.dataInizio);
        const origEnd = new Date(originalEvent.dataFine);
        
        // Durata originale in ms
        const duration = origEnd.getTime() - origStart.getTime();
        
        // Crea la nuova data di inizio
        const newStartDate = new Date(dataAttuale);
        newStartDate.setHours(hour, origStart.getMinutes(), 0, 0);
        
        // Calcola la nuova data di fine
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        return {
            start: newStartDate,
            end: newEndDate
        };
    } catch (error) {
        console.error('Errore nel calcolo date per vista giornaliera:', error);
        return null;
    }
}

/**
 * Aggiorna i dati dell'evento con le nuove date
 */
function updateEventData(eventId, newStartDate, newEndDate) {
    try {
        console.log('Aggiornamento evento:', eventId);
        console.log('Nuova data inizio:', newStartDate);
        console.log('Nuova data fine:', newEndDate);
        
        // Trova l'evento nel modello dati
        const eventoIndex = eventi.findIndex(e => e.id === eventId);
        if (eventoIndex === -1) {
            console.error('Evento non trovato nel modello dati');
            return false;
        }
        
        // Debug: salva stato precedente
        const eventoBefore = JSON.parse(JSON.stringify(eventi[eventoIndex]));
        console.log('Evento prima dell\'aggiornamento:', eventoBefore);
        
        // Aggiorna l'evento direttamente nel modello dati come backup
        eventi[eventoIndex].dataInizio = newStartDate;
        eventi[eventoIndex].dataFine = newEndDate;
        
        // Aggiorna l'evento usando la funzione globale
        const result = modificaEvento(eventId, {
            dataInizio: newStartDate,
            dataFine: newEndDate
        });
        
        // Forza il salvataggio
        if (typeof salvaEventi === 'function') {
            salvaEventi();
        } else {
            console.error('Funzione salvaEventi non disponibile');
            // Salvataggio diretto in localStorage
            localStorage.setItem('eventi', JSON.stringify(eventi));
        }
        
        // Debug: verifica l'aggiornamento
        const eventoAfter = JSON.parse(JSON.stringify(eventi.find(e => e.id === eventId)));
        console.log('Evento dopo l\'aggiornamento:', eventoAfter);
        
        // Verifica che le date siano state effettivamente aggiornate
        const updatedStart = new Date(eventoAfter.dataInizio);
        const updatedEnd = new Date(eventoAfter.dataFine);
        
        console.log('Date aggiornate:',
                   'Inizio:', updatedStart.toLocaleString(),
                   'Fine:', updatedEnd.toLocaleString());
        
        return result !== null;
    } catch (error) {
        console.error('Errore nell\'aggiornamento dell\'evento:', error);
        return false;
    }
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

/**
 * Aggiungi stili CSS minimali per il drag and drop
 */
function addDragDropStyles() {
    if (document.getElementById('drag-drop-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'drag-drop-styles';
    styleElement.textContent = `
        /* Stili minimali per il drag and drop */
        .draggable {
            cursor: grab;
        }
        .dragging {
            opacity: 0.4 !important;
            pointer-events: none;
        }
        #drag-ghost {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            transition: none !important;
            will-change: transform;
        }
        .drop-highlight {
            background-color: rgba(66, 133, 244, 0.3) !important;
            box-shadow: inset 0 0 0 2px rgba(66, 133, 244, 0.8) !important;
        }
        .drag-in-progress {
            cursor: grabbing !important;
        }
    `;
    
    document.head.appendChild(styleElement);
}

// Esporta le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: cleanupDragAndDrop,
    enable: enableDragAndDrop
};

// Funzione globale per compatibilità
window.enableDragAndDrop = enableDragAndDrop;
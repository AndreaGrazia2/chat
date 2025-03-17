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
        event.addEventListener('dragstart', dragFunction);
        
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
        // Rimuovi eventuali listener precedenti per evitare duplicati
        target.removeEventListener('dragover', handleDragOver);
        target.removeEventListener('dragleave', handleDragLeave);
        target.removeEventListener('drop', handleDrop);
        
        // Aggiungi i nuovi listener
        target.addEventListener('dragover', handleDragOver);
        target.addEventListener('dragleave', handleDragLeave);
        target.addEventListener('drop', handleDrop);
    });
}

// Funzione per gestire il dragover
function handleDragOver(e) {
    e.preventDefault(); // Necessario per permettere il drop
    this.classList.add('drag-over');
}

// Funzione per gestire il dragleave
function handleDragLeave() {
    this.classList.remove('drag-over');
}

// Funzione per gestire il drop
function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    // Ottieni l'ID dell'evento trascinato
    const eventId = e.dataTransfer.getData('text/plain');
    if (!eventId) {
        console.error('ID evento non valido durante il drop');
        return;
    }
    
    console.log(`Evento ${eventId} rilasciato in:`, this);
    
    // Trova l'evento originale
    const eventoOriginale = eventi.find(e => e.id === eventId);
    if (!eventoOriginale) {
        console.error('Evento non trovato:', eventId);
        return;
    }
    
    // Gestisci in base alla vista corrente
    if (vistaAttuale === 'day') {
        const ora = parseInt(this.dataset.ora, 10);
        if (isNaN(ora)) {
            console.error('Ora non valida nel target di drop');
            return;
        }
        
        const nuovaData = createDate(dataAttuale);
        nuovaData.setHours(ora, 0, 0);
        
        // Calcola la durata dell'evento originale in minuti
        const durataOriginale = (createDate(eventoOriginale.dataFine) - createDate(eventoOriginale.dataInizio)) / (1000 * 60);
        
        // Crea la nuova data di fine basata sulla durata originale
        const nuovaDataFine = createDate(nuovaData);
        nuovaDataFine.setTime(nuovaDataFine.getTime() + durataOriginale * 60 * 1000);
        
        // Aggiorna l'evento nel database
        console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
        modificaEvento(eventId, {
            dataInizio: nuovaData,
            dataFine: nuovaDataFine
        });
    } 
    // Se nella vista settimanale:
    else if (vistaAttuale === 'week') {
        const ora = parseInt(this.dataset.ora, 10);
        const giorno = parseInt(this.dataset.giorno, 10);
        
        if (isNaN(ora) || isNaN(giorno)) {
            console.error('Ora o giorno non validi nel target di drop');
            return;
        }
        
        // Calcola la nuova data
        const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
        const nuovaData = createDate(inizioSettimana);
        nuovaData.setDate(nuovaData.getDate() + giorno);
        nuovaData.setHours(ora, 0, 0);
        
        // Calcola la durata dell'evento originale in minuti
        const durataOriginale = (createDate(eventoOriginale.dataFine) - createDate(eventoOriginale.dataInizio)) / (1000 * 60);
        
        // Crea la nuova data di fine basata sulla durata originale
        const nuovaDataFine = createDate(nuovaData);
        nuovaDataFine.setTime(nuovaDataFine.getTime() + durataOriginale * 60 * 1000);
        
        // Aggiorna l'evento nel database
        console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
        modificaEvento(eventId, {
            dataInizio: nuovaData,
            dataFine: nuovaDataFine
        });
    } 
    // Se nella vista mensile:
    else if (vistaAttuale === 'month') {
        const dataStr = this.dataset.date;
        if (!dataStr) {
            console.error('Data non valida nel target di drop');
            return;
        }
        
        const [anno, mese, giorno] = dataStr.split('-').map(Number);
        
        // Trova l'evento originale
        const evento = eventi.find(e => e.id === eventId);
        
        if (evento) {
            // Mantieni l'ora originale, cambia solo la data
            const nuovaData = createDate({
                anno: anno,
                mese: mese,
                giorno: giorno,
                ore: createDate(evento.dataInizio).getHours(),
                minuti: createDate(evento.dataInizio).getMinutes()
            });
            
            // Calcola la durata dell'evento originale in minuti
            const durataOriginale = (createDate(evento.dataFine) - createDate(evento.dataInizio)) / (1000 * 60);
            
            // Crea la nuova data di fine basata sulla durata originale
            const nuovaDataFine = createDate(nuovaData);
            nuovaDataFine.setTime(nuovaDataFine.getTime() + durataOriginale * 60 * 1000);
            
            // Aggiorna l'evento nel database
            console.log(`Aggiornamento evento ${eventId} alla data:`, nuovaData);
            modificaEvento(eventId, {
                dataInizio: nuovaData,
                dataFine: nuovaDataFine
            });
        }
    }
    
    // Aggiorna le viste
    aggiornaViste();
    
    // Mostra una notifica di conferma
    mostraNotifica('Evento spostato con successo', 'success');
}

// Funzione richiamata all'inizio del trascinamento
function dragFunction(event) {
    // Verifica che l'elemento abbia un ID
    const id = this.dataset.id;
    if (!id) {
        console.error('Elemento trascinato senza ID:', this);
        event.preventDefault();
        return false;
    }
    
    // Passa l'ID dell'evento
    event.dataTransfer.setData('text/plain', id);
    
    // Aggiungi una classe all'elemento durante il trascinamento
    this.classList.add('dragging');
    
    console.log('Iniziato trascinamento elemento con ID:', id);
}

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
    // Rimuovi prima i listener di drag and drop esistenti
    cleanupDragAndDrop();
    
    // Inizializza il drag and drop per la vista corrente
    initDragAndDrop(vistaAttuale || 'month');
}

// Funzione per ripulire i listener di drag and drop
function cleanupDragAndDrop() {
    // Rimuovi le classi drag-over
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    // Rimuovi la classe dragging
    document.querySelectorAll('.dragging').forEach(el => {
        el.classList.remove('dragging');
    });
}

// Esponi le funzioni
window.dragDrop = {
    init: initDragAndDrop,
    cleanup: cleanupDragAndDrop
};
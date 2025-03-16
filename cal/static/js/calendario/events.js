/**
 * events.js - Gestione degli eventi del calendario
 */

// Array per memorizzare gli eventi
let eventi = [];

// Categorie di eventi disponibili
// Definizione delle categorie
const categorie = {
    work: {
        nome: 'Lavoro',
        colore: '#4285F4'
    },
    personal: {
        nome: 'Personale',
        colore: '#EA4335'
    },
    family: {
        nome: 'Famiglia',
        colore: '#FBBC05'
    },
    health: {
        nome: 'Salute',
        colore: '#34A853'
    }
};

/**
 * Aggiunge un nuovo evento
 * @param {Object} evento - Dati dell'evento
 * @returns {Object} - Evento creato
 */
function aggiungiEvento(evento) {
    // Genera un ID univoco
    const id = generateUniqueId();
    
    // Assicurati che le date siano create correttamente senza problemi di timezone
    let dataInizio = new Date(evento.dataInizio);
    let dataFine = new Date(evento.dataFine);
    
    // Crea l'oggetto evento
    const nuovoEvento = {
        id,
        titolo: evento.titolo,
        descrizione: evento.descrizione || '',
        dataInizio: dataInizio,
        dataFine: dataFine,
        categoria: evento.categoria || 'personal',
        creato: new Date()
    };
    
    // Aggiungi l'evento all'array
    eventi.push(nuovoEvento);
    
    // Salva gli eventi
    salvaEventi();
    
    // Aggiorna la vista del calendario
    updateCalendarView();
    
    return id;
}

/**
 * Modifica un evento esistente
 * @param {string} id - ID dell'evento da modificare
 * @param {Object} datiAggiornati - Nuovi dati dell'evento
 * @returns {Object|null} - Evento modificato o null se non trovato
 */
function modificaEvento(eventoId, datiAggiornati) {
    // Trova l'indice dell'evento
    const indice = eventi.findIndex(e => e.id === eventoId);
    
    // Se l'evento non esiste, restituisci null
    if (indice === -1) return null;
    
    // Aggiorna i dati dell'evento
    const eventoAggiornato = {
        ...eventi[indice],
        ...datiAggiornati,
        dataInizio: datiAggiornati.dataInizio ? new Date(datiAggiornati.dataInizio) : eventi[indice].dataInizio,
        dataFine: datiAggiornati.dataFine ? new Date(datiAggiornati.dataFine) : eventi[indice].dataFine,
        modificato: new Date()
    };
    
    // Sostituisci l'evento nell'array
    eventi[indice] = eventoAggiornato;
    
    // Salva gli eventi
    salvaEventi();
    
    // Aggiorna le viste
    aggiornaViste();
    
    return eventoAggiornato;
}

/**
 * Elimina un evento
 * @param {string} id - ID dell'evento da eliminare
 * @returns {boolean} - True se l'evento è stato eliminato, false altrimenti
 */
function eliminaEvento(id) {
    // Trova l'indice dell'evento
    const indice = eventi.findIndex(e => e.id === id);
    
    // Se l'evento non esiste, restituisci false
    if (indice === -1) return false;
    
    // Rimuovi l'evento dall'array
    eventi.splice(indice, 1);
    
    // Salva gli eventi
    salvaEventi();
    
    // Aggiorna le viste
    aggiornaViste();
    
    return true;
}

/**
 * Ottiene tutti gli eventi
 * @returns {Array} - Array di eventi
 */
function getEventi() {
    return [...eventi];
}

/**
 * Ottiene gli eventi per un giorno specifico
 * @param {Date} data - Data per cui cercare gli eventi
 * @returns {Array} - Eventi del giorno
 */
function getEventiGiorno(data) {
    return eventi.filter(evento => {
        const dataEvento = new Date(evento.dataInizio);
        return isStessoGiorno(dataEvento, data);
    });
}

/**
 * Ottiene gli eventi per un mese specifico
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {Array} - Eventi del mese
 */
function getEventiMese(anno, mese) {
    return eventi.filter(evento => {
        const dataEvento = new Date(evento.dataInizio);
        return dataEvento.getFullYear() === anno && dataEvento.getMonth() === mese;
    });
}

/**
 * Ottiene gli eventi per una settimana specifica
 * @param {Date} dataInizio - Data di inizio della settimana
 * @param {Date} dataFine - Data di fine della settimana
 * @returns {Array} - Eventi della settimana
 */
function getEventiSettimana(dataInizio, dataFine) {
    return eventi.filter(evento => {
        const dataEvento = new Date(evento.dataInizio);
        return dataEvento >= dataInizio && dataEvento <= dataFine;
    });
}

/**
 * Salva gli eventi (in localStorage per demo, in un'implementazione reale si userebbe un'API)
 */
function salvaEventi() {
    localStorage.setItem('eventi', JSON.stringify(eventi));
    // In un'implementazione reale, qui si chiamerebbe l'API per salvare gli eventi
}

/**
 * Carica gli eventi dal localStorage (o da un'API in un'implementazione reale)
 */
// Carica gli eventi dal localStorage
function caricaEventi() {
    const eventiSalvati = localStorage.getItem('eventi');
    if (eventiSalvati) {
        eventi = JSON.parse(eventiSalvati);
        
        // Converti le stringhe di data in oggetti Date
        eventi.forEach(evento => {
            evento.dataInizio = new Date(evento.dataInizio);
            evento.dataFine = new Date(evento.dataFine);
        });
        console.log(`Caricati ${eventi.length} eventi dal localStorage`);
    } else {
        // Se non ci sono eventi, genera eventi di test
        console.log('Nessun evento trovato, genero eventi di test...');
        generaEventiTest(15);
    }
}

// Genera eventi casuali per testare il calendario
function generaEventiTest(numEventi = 15) {
    const categorie = ['work', 'personal', 'family', 'health'];
    const titoli = [
        'Riunione', 'Appuntamento', 'Compleanno', 'Visita medica', 
        'Conferenza', 'Cena', 'Pranzo', 'Lezione', 'Allenamento',
        'Scadenza progetto', 'Viaggio', 'Vacanza', 'Anniversario'
    ];
    const descrizioni = [
        'Importante non mancare', 'Ricordati di portare i documenti',
        'Confermare presenza', 'Preparare presentazione',
        'Chiamare prima per confermare', 'Portare un regalo',
        'Prenotare in anticipo', 'Rivedere appunti'
    ];
    
    // Data di inizio: un mese indietro
    const dataInizioRange = new Date();
    dataInizioRange.setMonth(dataInizioRange.getMonth() - 1);
    
    // Data di fine: due mesi avanti
    const dataFineRange = new Date();
    dataFineRange.setMonth(dataFineRange.getMonth() + 2);
    
    for (let i = 0; i < numEventi; i++) {
        // Genera una data casuale nel range
        const dataInizio = new Date(
            dataInizioRange.getTime() + 
            Math.random() * (dataFineRange.getTime() - dataInizioRange.getTime())
        );
        
        // Imposta un'ora casuale (8-20)
        dataInizio.setHours(Math.floor(Math.random() * 12) + 8, 0, 0);
        
        // Durata casuale (30min - 2h)
        const durata = (Math.floor(Math.random() * 4) + 1) * 30;
        const dataFine = new Date(dataInizio);
        dataFine.setMinutes(dataFine.getMinutes() + durata);
        
        // Scegli categoria, titolo e descrizione casuali
        const categoria = categorie[Math.floor(Math.random() * categorie.length)];
        const titolo = titoli[Math.floor(Math.random() * titoli.length)];
        const descrizione = descrizioni[Math.floor(Math.random() * descrizioni.length)];
        
        // Aggiungi l'evento
        eventi.push({
            id: generaId(), // Ora questa funzione esiste
            titolo,
            descrizione,
            dataInizio,
            dataFine,
            categoria
        });
    }
    
    // Salva gli eventi
    salvaEventi();
    
    console.log(`Generati ${numEventi} eventi di test`);
}

// Implementazione del drag and drop per gli eventi
function enableDragAndDrop() {
    // Seleziona tutti gli eventi nella vista giornaliera e settimanale
    const timeEvents = document.querySelectorAll('.time-event');
    const timeSlots = document.querySelectorAll('.time-slot');
    
    timeEvents.forEach(event => {
        // Rendi l'evento trascinabile
        event.setAttribute('draggable', 'true');
        event.classList.add('draggable');
        
        // Gestisci l'inizio del trascinamento
        event.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', event.id);
            event.classList.add('dragging');
            
            // Memorizza l'offset del mouse all'interno dell'evento
            const rect = event.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: event.id,
                offsetY: offsetY,
                height: rect.height,
                category: event.dataset.category,
                startTime: event.dataset.startTime,
                endTime: event.dataset.endTime
            }));
        });
        
        // Gestisci la fine del trascinamento
        event.addEventListener('dragend', function() {
            event.classList.remove('dragging');
        });
    });
    
    // Gestisci il drop sugli slot temporali
    timeSlots.forEach(slot => {
        // Consenti il drop
        slot.addEventListener('dragover', function(e) {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        
        // Rimuovi l'evidenziazione quando il drag esce
        slot.addEventListener('dragleave', function() {
            slot.classList.remove('drag-over');
        });
        
        // Gestisci il drop
        slot.addEventListener('drop', function(e) {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            // Ottieni i dati dell'evento trascinato
            const eventId = e.dataTransfer.getData('text/plain');
            const eventData = JSON.parse(e.dataTransfer.getData('application/json'));
            const draggedEvent = document.getElementById(eventId);
            
            if (draggedEvent) {
                // Calcola la nuova posizione dell'evento
                const slotRect = slot.getBoundingClientRect();
                const dropY = e.clientY - slotRect.top - eventData.offsetY;
                
                // Calcola l'ora di inizio in base alla posizione del drop
                const hourHeight = 60; // Altezza di un'ora in pixel
                const hourOffset = Math.floor(dropY / hourHeight);
                const slotTime = slot.dataset.time || '00:00';
                const [slotHour, slotMinute] = slotTime.split(':').map(Number);
                
                // Calcola la nuova ora di inizio
                let newStartHour = slotHour + hourOffset;
                if (newStartHour >= 24) newStartHour = 23;
                if (newStartHour < 0) newStartHour = 0;
                
                // Calcola la durata dell'evento in ore
                const duration = (eventData.endTime - eventData.startTime) / (60 * 60 * 1000);
                
                // Calcola la nuova ora di fine
                let newEndHour = newStartHour + duration;
                if (newEndHour >= 24) newEndHour = 24;
                
                // Formatta le nuove ore
                const formatHour = (h) => {
                    const hour = Math.floor(h);
                    const minute = Math.round((h - hour) * 60);
                    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                };
                
                const newStartTimeStr = formatHour(newStartHour);
                const newEndTimeStr = formatHour(newEndHour);
                
                // Aggiorna la posizione visiva dell'evento
                const dayColumn = slot.parentElement;
                const topPosition = hourOffset * hourHeight;
                const heightPosition = duration * hourHeight;
                
                draggedEvent.style.top = `${topPosition}px`;
                draggedEvent.style.height = `${heightPosition}px`;
                
                // Aggiorna i dati dell'evento
                draggedEvent.dataset.startTime = newStartTimeStr;
                draggedEvent.dataset.endTime = newEndTimeStr;
                
                // Aggiorna il testo dell'orario nell'evento
                const timeElement = draggedEvent.querySelector('.time-event-time');
                if (timeElement) {
                    timeElement.textContent = `${newStartTimeStr} - ${newEndTimeStr}`;
                }
                
                // Sposta l'evento nel nuovo contenitore se necessario
                if (draggedEvent.parentElement !== dayColumn) {
                    dayColumn.appendChild(draggedEvent);
                }
                
                // Qui potresti anche salvare le modifiche nel tuo database o storage
                saveEventChanges(eventId, {
                    startTime: newStartTimeStr,
                    endTime: newEndTimeStr,
                    day: slot.dataset.day
                });
            }
        });
    });
}

// Funzione per salvare le modifiche agli eventi
function saveEventChanges(eventId, changes) {
    // Qui implementa la logica per salvare le modifiche
    console.log('Evento aggiornato:', eventId, changes);
    
    // Se stai usando localStorage per memorizzare gli eventi
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
    const eventIndex = events.findIndex(e => e.id === eventId);
    
    if (eventIndex !== -1) {
        events[eventIndex] = {...events[eventIndex], ...changes};
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    }
}

// Inizializza il drag and drop quando la vista cambia
function initializeEventHandlers() {
    // Inizializza il drag and drop
    enableDragAndDrop();
    
    // Aggiungi altri gestori di eventi se necessario
}

// Assicurati che il drag and drop venga inizializzato quando la pagina è caricata
document.addEventListener('DOMContentLoaded', function() {
    initializeEventHandlers();
    
    // Reinizializza quando cambia la vista
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Attendi che la nuova vista sia caricata
            setTimeout(initializeEventHandlers, 100);
        });
    });
});

// Funzione per inizializzare i gestori degli eventi
function initEventHandlers() {
    console.log('Initializing event handlers');
    
    // Gestione click sul pulsante "Nuovo Evento"
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) {
        console.log('Add Event button found');
        addEventBtn.addEventListener('click', function() {
            console.log('Add Event button clicked');
            openEventModal();
        });
    } else {
        console.error('Add Event button not found');
    }

    // Gestione click sul pulsante "Chiudi" del modal
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            console.log('Close modal button clicked');
            closeEventModal();
        });
    }

    // Gestione click sul pulsante "Annulla" del modal
    const cancelEventBtn = document.getElementById('cancelEvent');
    if (cancelEventBtn) {
        cancelEventBtn.addEventListener('click', function() {
            console.log('Cancel event button clicked');
            closeEventModal();
        });
    }

    // Gestione click sul pulsante "Salva" del modal
    const saveEventBtn = document.getElementById('saveEvent');
    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', function() {
            console.log('Save event button clicked');
            saveEvent();
        });
    }

    // Gestione click sugli eventi del calendario
    attachEventClickHandlers();
}

// Funzione per collegare i gestori di click agli eventi del calendario
function attachEventClickHandlers() {
    console.log('Attaching event click handlers');
    
    // Seleziona tutti gli elementi evento in tutte le viste
    const eventElements = document.querySelectorAll('.event, .time-event, .list-event');
    
    console.log('Found ' + eventElements.length + ' event elements');
    
    eventElements.forEach(function(eventElement) {
        // Verifica se l'elemento ha già un gestore di eventi
        if (eventElement.getAttribute('data-has-click-handler') === 'true') {
            console.log('Event already has click handler, skipping:', eventElement);
            return; // Salta questo elemento
        }
        
        console.log('Attaching click handler to:', eventElement);
        
        // Aggiungi il nuovo listener
        eventElement.addEventListener('click', handleEventClick);
        
        // Aggiungi un attributo per debug
        eventElement.setAttribute('data-has-click-handler', 'true');
    });
}

// Funzione per gestire il click su un evento
function handleEventClick(e) {
    console.log('Event clicked!', this);
    e.preventDefault();
    e.stopPropagation();
    
    // Ottieni i dati dell'evento
    const eventId = this.getAttribute('data-id');
    let eventTitle = this.getAttribute('data-title') || this.textContent.trim().split('\n')[0];
    
    // Estrai la data e l'ora dall'elemento o dai suoi attributi
    let eventDate = this.getAttribute('data-date');
    let eventTime = this.getAttribute('data-time');
    let eventEndDate = this.getAttribute('data-end-date');
    let eventEndTime = this.getAttribute('data-end-time');
    
    // Cerca l'ora nel titolo (formato "18:00 - Compleanno di Marco")
    const titleTimeMatch = eventTitle.match(/^(\d{1,2}:\d{2})\s*-\s*(.+)$/);
    if (titleTimeMatch && !eventTime) {
        eventTime = titleTimeMatch[1];
        eventTitle = titleTimeMatch[2].trim(); // Rimuovi l'ora dal titolo
        console.log('Extracted time from title:', eventTime);
    }
    
    // Se l'evento ha un testo che contiene l'orario (come "09:00 - 18:00")
    const timeRangeMatch = this.textContent.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (timeRangeMatch && (!eventTime || !eventEndTime)) {
        if (!eventTime) eventTime = timeRangeMatch[1];
        if (!eventEndTime) eventEndTime = timeRangeMatch[2];
        console.log('Extracted time range from text:', eventTime, eventEndTime);
    }
    
    const eventDescription = this.getAttribute('data-description') || '';
    const eventCategory = this.getAttribute('data-category') || 
                         (this.classList.contains('work') ? 'work' : 
                         this.classList.contains('personal') ? 'personal' :
                         this.classList.contains('family') ? 'family' : 
                         this.classList.contains('health') ? 'health' : '');
    
    console.log('Event data:', {
        id: eventId,
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        endDate: eventEndDate,
        endTime: eventEndTime,
        category: eventCategory
    });
    
    // Apri il modal con i dati dell'evento
    openEventModal(eventId, eventTitle, eventDate, eventTime, eventEndDate, eventEndTime, eventDescription, eventCategory);
}

// Funzione per aprire il modal degli eventi
function openEventModal(id = '', title = '', date = '', time = '', endDate = '', endTime = '', description = '', category = 'work') {
    console.log('Opening event modal with:', id, title, date, time, endDate, endTime);
    
    // Imposta il titolo del modal
    document.getElementById('modalTitle').textContent = id ? 'Modifica Evento' : 'Nuovo Evento';
    
    // Estrai il titolo se contiene informazioni sull'orario
    const titleParts = title.split(/\s+\d{1,2}:\d{2}/);
    const cleanTitle = titleParts[0].trim();
    
    // Compila i campi del form
    document.getElementById('eventTitle').value = cleanTitle;
    document.getElementById('eventDate').value = date || getCurrentDate();
    document.getElementById('eventTime').value = time || '';
    document.getElementById('eventEndDate').value = endDate || date || getCurrentDate();
    document.getElementById('eventEndTime').value = endTime || '';
    document.getElementById('eventDescription').value = description;
    document.getElementById('eventCategory').value = category;
    
    // Memorizza l'ID dell'evento nel form (per l'aggiornamento)
    document.getElementById('eventForm').setAttribute('data-event-id', id);
    
    // Aggiungi la classe della categoria all'header del modal
    const modalHeader = document.querySelector('.modal-header');
    modalHeader.className = 'modal-header'; // Rimuovi classi precedenti
    if (category) {
        modalHeader.classList.add(category);
    }
    
    // Mostra il modal
    document.getElementById('eventModal').style.display = 'block';
}

// Funzione per chiudere il modal degli eventi
function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
}

// Funzione per salvare un evento
function saveEvent() {
    // Ottieni i valori dal form
    const eventId = document.getElementById('eventForm').getAttribute('data-event-id');
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const endDate = document.getElementById('eventEndDate').value;
    const endTime = document.getElementById('eventEndTime').value;
    const description = document.getElementById('eventDescription').value;
    const category = document.getElementById('eventCategory').value;
    
    if (!title || !date) {
        apriModalAvviso('Titolo e data sono obbligatori!');
        return;
    }
    
    // Qui dovresti implementare la logica per salvare l'evento
    // Per ora, simuliamo un aggiornamento della UI
    
    // Chiudi il modal
    closeEventModal();
    
    // Aggiorna la vista del calendario
    updateCalendarView();
    
    // Riattacca i gestori di click agli eventi
    setTimeout(attachEventClickHandlers, 100);
}

// Funzione per ottenere la data corrente in formato YYYY-MM-DD
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Funzione per aggiornare la vista del calendario
function updateCalendarView() {
    // Questa funzione dovrebbe essere implementata nel file calendar.js
    // Per ora, ricarica semplicemente la vista corrente
    const activeView = document.querySelector('.view-btn.active')?.getAttribute('data-view') || 'month';
    const currentDate = new Date(); // Use current date as default
    
    switch (activeView) {
        case 'month':
            if (typeof renderMonthView === 'function') renderMonthView(currentDate);
            break;
        case 'week':
            if (typeof renderWeekView === 'function') renderWeekView(currentDate);
            break;
        case 'day':
            if (typeof renderDayView === 'function') renderDayView(currentDate);
            break;
        case 'list':
            if (typeof renderListView === 'function') renderListView(currentDate);
            break;
    }
}

// Inizializza i gestori degli eventi quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    initEventHandlers();
    
    // Riattacca i gestori di click quando cambia la vista
    document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            console.log('View changed to:', this.getAttribute('data-view'));
            // Attendi che la vista sia aggiornata
            setTimeout(attachEventClickHandlers, 200);
            // Aggiorna l'indicatore dell'ora corrente
            setTimeout(updateCurrentTimeIndicator, 200);
        });
    });
    
    // Verifica periodicamente se ci sono nuovi eventi senza handler
    setInterval(function() {
        const eventsWithoutHandlers = document.querySelectorAll('.event:not([data-has-click-handler]), .time-event:not([data-has-click-handler]), .list-event:not([data-has-click-handler])');
        if (eventsWithoutHandlers.length > 0) {
            console.log('Found ' + eventsWithoutHandlers.length + ' events without handlers, reattaching...');
            attachEventClickHandlers();
        }
    }, 2000);
    
    // Inizializza l'indicatore dell'ora corrente
    updateCurrentTimeIndicator();
    // Aggiorna l'indicatore ogni minuto
    setInterval(updateCurrentTimeIndicator, 60000);
});

// Funzione per aggiornare l'indicatore dell'ora corrente
function updateCurrentTimeIndicator() {
    console.log('Updating current time indicator');
    
    // Rimuovi eventuali indicatori esistenti
    document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());
    
    // Ottieni l'ora corrente
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Calcola la posizione verticale in base all'ora corrente
    const hourHeight = 60; // Altezza di ogni slot orario in pixel
    const topPosition = (hours * hourHeight) + (minutes / 60 * hourHeight) + 50; // +50 per l'header
    
    // Crea l'indicatore per la vista giornaliera
    const dayGrid = document.querySelector('.day-grid');
    if (dayGrid) {
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = `${topPosition}px`;
        dayGrid.appendChild(indicator);
        console.log('Added time indicator to day view at position:', topPosition);
    }
    
    // Crea l'indicatore per la vista settimanale
    const weekGrid = document.querySelector('.week-grid');
    if (weekGrid) {
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = `${topPosition}px`;
        weekGrid.appendChild(indicator);
        console.log('Added time indicator to week view at position:', topPosition);
    }
}

// Funzione per aggiornare l'indicatore dell'ora corrente
function updateCurrentTimeIndicator() {
    console.log('Updating current time indicator');
    
    // Rimuovi eventuali indicatori esistenti
    document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());
    
    // Ottieni l'ora corrente
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Calcola la posizione verticale in base all'ora corrente
    const hourHeight = 60; // Altezza di ogni slot orario in pixel
    const topPosition = (hours * hourHeight) + (minutes / 60 * hourHeight) + 50; // +50 per l'header
    
    // Crea l'indicatore per la vista giornaliera
    const dayGrid = document.querySelector('.day-grid');
    if (dayGrid) {
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = `${topPosition}px`;
        dayGrid.appendChild(indicator);
        console.log('Added time indicator to day view at position:', topPosition);
    }
    
    // Crea l'indicatore per la vista settimanale
    const weekGrid = document.querySelector('.week-grid');
    if (weekGrid) {
        const indicator = document.createElement('div');
        indicator.className = 'current-time-indicator';
        indicator.style.top = `${topPosition}px`;
        weekGrid.appendChild(indicator);
        console.log('Added time indicator to week view at position:', topPosition);
    }
}

/**
 * Genera un ID univoco per gli eventi
 * @returns {string} - ID univoco
 */
function generaId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function handleDayClick(e) {
    // Get the date from the clicked day
    const clickedDay = this.getAttribute('data-date');
    
    // Set default times (8:00 AM and 9:00 AM)
    const defaultStartTime = '08:00';
    const defaultEndTime = '09:00';
    
    // Open the modal
    openModal();
    
    // Set the values in the form
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventDate').value = clickedDay;
    document.getElementById('eventTime').value = defaultStartTime;
    document.getElementById('eventEndDate').value = clickedDay;
    document.getElementById('eventEndTime').value = defaultEndTime;
    
    // Set the default category
    document.getElementById('eventCategory').value = 'personal';
    
    // Set the modal title
    document.getElementById('modalTitle').textContent = 'Nuovo Evento';
    
    // Hide the delete button if present
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }
}


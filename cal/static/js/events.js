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
    
    // Utilizza la funzione helper centralizzata per gestire le date
    let dataInizio = createDate(evento.dataInizio);
    let dataFine = createDate(evento.dataFine);
    
    // Crea l'oggetto evento
    const nuovoEvento = {
        id,
        titolo: evento.titolo,
        descrizione: evento.descrizione || '',
        dataInizio: dataInizio,
        dataFine: dataFine,
        categoria: evento.categoria || 'personal',
        creato: createDate(new Date()),
        isNew: true // Aggiungiamo questo flag per l'animazione
    };
    
    // Aggiungi l'evento all'array
    eventi.push(nuovoEvento);
    
    // Salva gli eventi
    salvaEventi();
    
    // Aggiorna la vista del calendario
    aggiornaViste();
    
    // Rimuoviamo il flag isNew dopo un po' di tempo
    setTimeout(() => {
        const index = eventi.findIndex(e => e.id === id);
        if (index !== -1) {
            eventi[index].isNew = false;
        }
    }, 2000);
    
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
        dataInizio: datiAggiornati.dataInizio ? createDate(datiAggiornati.dataInizio) : eventi[indice].dataInizio,
        dataFine: datiAggiornati.dataFine ? createDate(datiAggiornati.dataFine) : eventi[indice].dataFine,
        modificato: createDate(new Date())
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
        const dataEvento = createDate(evento.dataInizio);
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
        const dataEvento = createDate(evento.dataInizio);
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
        const dataEvento = createDate(evento.dataInizio);
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
        
        // Converti le stringhe di data in oggetti Date usando la funzione centralizzata
        eventi.forEach(evento => {
            evento.dataInizio = createDate(evento.dataInizio);
            evento.dataFine = createDate(evento.dataFine);
            if (evento.creato) evento.creato = createDate(evento.creato);
            if (evento.modificato) evento.modificato = createDate(evento.modificato);
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
    const dataInizioRange = createDate(new Date());
    dataInizioRange.setMonth(dataInizioRange.getMonth() - 1);
    
    // Data di fine: due mesi avanti
    const dataFineRange = createDate(new Date());
    dataFineRange.setMonth(dataFineRange.getMonth() + 2);
    
    for (let i = 0; i < numEventi; i++) {
        // Genera una data casuale nel range
        const dataInizio = createDate(
            new Date(dataInizioRange.getTime() + 
            Math.random() * (dataFineRange.getTime() - dataInizioRange.getTime()))
        );
        
        // Imposta un'ora casuale (8-20)
        dataInizio.setHours(Math.floor(Math.random() * 12) + 8, 0, 0);
        
        // Durata casuale (30min - 2h)
        const durata = (Math.floor(Math.random() * 4) + 1) * 30;
        const dataFine = createDate(dataInizio);
        dataFine.setMinutes(dataFine.getMinutes() + durata);
        
        // Scegli categoria, titolo e descrizione casuali
        const categoria = categorie[Math.floor(Math.random() * categorie.length)];
        const titolo = titoli[Math.floor(Math.random() * titoli.length)];
        const descrizione = descrizioni[Math.floor(Math.random() * descrizioni.length)];
        
        // Aggiungi l'evento
        eventi.push({
            id: generateUniqueId(), // Ora questa funzione esiste
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

// Funzione per salvare le modifiche agli eventi
function saveEventChanges(eventId, changes) {
    // Qui implementa la logica per salvare le modifiche
    console.log('Evento aggiornato:', eventId, changes);
    
    // Normalizza le date usando la funzione centralizzata
    if (changes.dataInizio) {
        changes.dataInizio = createDate(changes.dataInizio);
    }
    if (changes.dataFine) {
        changes.dataFine = createDate(changes.dataFine);
    }
    
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
}

// Funzione per collegare i gestori di click agli eventi del calendario
function attachEventClickHandlers() {
    console.log('Attaching event click handlers');
    
    // Rimuovi prima eventuali listener esistenti
    removeEventClickHandlers();
    
    // Seleziona tutti gli elementi evento in tutte le viste
    const eventElements = document.querySelectorAll('.event, .time-event, .list-event');
    
    console.log('Found ' + eventElements.length + ' event elements');
    
    eventElements.forEach(function(eventElement) {
        console.log('Attaching click handler to:', eventElement);
        
        // Aggiungi il nuovo listener
        eventElement.addEventListener('click', handleEventClick);
        
        // Aggiungi un attributo per debug
        eventElement.setAttribute('data-has-click-handler', 'true');
    });
}

// Funzione per rimuovere i gestori di click dagli eventi
function removeEventClickHandlers() {
    const eventElements = document.querySelectorAll('.event[data-has-click-handler="true"], .time-event[data-has-click-handler="true"], .list-event[data-has-click-handler="true"]');
    
    eventElements.forEach(function(eventElement) {
        eventElement.removeEventListener('click', handleEventClick);
        eventElement.removeAttribute('data-has-click-handler');
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
    apriModalEvento(eventId);
}

// Funzione per ottenere la data corrente in formato YYYY-MM-DD
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Aggiorna l'indicatore dell'ora corrente nelle viste giornaliera e settimanale
 */
// Cerca questa funzione nel file events.js
function updateCurrentTimeIndicator() {
    console.log('Updating current time indicator');
    
    // Rimuovi eventuali indicatori esistenti
    document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());
    
    // Ottieni l'ora corrente con precisione ai secondi
    const now = createDate(new Date());
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    // Calcola la posizione verticale in base all'ora corrente con maggiore precisione
    const hourHeight = 60; // Altezza di ogni slot orario in pixel
    const topPosition = (hours * hourHeight) + 
                         (minutes / 60 * hourHeight) + 
                         (seconds / 3600 * hourHeight) + 
                         50; // +50 per l'header
    
    // Crea l'indicatore per la vista giornaliera
    if (vistaAttuale === 'day') {
        const dayGrid = document.querySelector('.day-grid');
        if (dayGrid && isStessoGiorno(dataAttuale, now)) {
            const indicator = document.createElement('div');
            indicator.className = 'current-time-indicator';
            indicator.style.top = `${topPosition}px`;
            dayGrid.appendChild(indicator);
            console.log('Added time indicator to day view at position:', topPosition);
        }
    }
    
    // Crea l'indicatore per la vista settimanale
    if (vistaAttuale === 'week') {
        const weekGrid = document.querySelector('.week-grid');
        if (weekGrid) {
            // Verifica se il giorno corrente è nella settimana visualizzata
            const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
            const fineSettimana = createDate(inizioSettimana);
            fineSettimana.setDate(fineSettimana.getDate() + 6);
            
            if (now >= inizioSettimana && now <= fineSettimana) {
                const indicator = document.createElement('div');
                indicator.className = 'current-time-indicator';
                indicator.style.top = `${topPosition}px`;
                
                // Trova l'indice corretto del giorno corrente nella settimana visualizzata
                let giornoCorretto = -1;
                const giorniSettimana = [];
                for (let i = 0; i < 7; i++) {
                    const giorno = createDate(inizioSettimana);
                    giorno.setDate(giorno.getDate() + i);
                    giorniSettimana.push(giorno);
                    
                    if (isStessoGiorno(now, giorno)) {
                        giornoCorretto = i;
                    }
                }
                
                if (giornoCorretto !== -1) {
                    // Calcola la larghezza di ogni colonna
                    const columnWidth = 100 / 7; // percentuale
                    
                    // Imposta la posizione orizzontale basata sull'indice corretto
                    indicator.style.left = `${giornoCorretto * columnWidth}%`;
                    indicator.style.width = `${columnWidth}%`;
                    
                    weekGrid.appendChild(indicator);
                    console.log('Added time indicator to week view at position:', topPosition, 'day index:', giornoCorretto);
                }
            }
        }
    }
}

function handleDayClick(e) {
    // Get the date from the clicked day
    const clickedDay = this.getAttribute('data-date');
    
    // Set default times (8:00 AM and 9:00 AM)
    const defaultStartTime = '08:00';
    const defaultEndTime = '09:00';
    
    // Open the modal
    apriModal('eventModal');
    
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
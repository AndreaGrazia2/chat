/**
 * events.js - Gestione degli eventi del calendario
 */

// Array per memorizzare gli eventi
let eventi = [];

// Categorie di eventi disponibili
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
    
    // Crea l'oggetto evento
    const nuovoEvento = {
        id,
        titolo: evento.titolo,
        descrizione: evento.descrizione || '',
        dataInizio: new Date(evento.dataInizio),
        dataFine: new Date(evento.dataFine),
        categoria: evento.categoria || 'personal',
        creato: new Date()
    };
    
    // Aggiungi l'evento all'array
    eventi.push(nuovoEvento);
    
    // Salva gli eventi (in un'implementazione reale, qui si chiamerebbe l'API)
    salvaEventi();
    
    // Aggiorna le viste
    aggiornaViste();
    
    return nuovoEvento;
}

/**
 * Modifica un evento esistente
 * @param {string} id - ID dell'evento da modificare
 * @param {Object} datiAggiornati - Nuovi dati dell'evento
 * @returns {Object|null} - Evento modificato o null se non trovato
 */
function modificaEvento(id, datiAggiornati) {
    // Trova l'indice dell'evento
    const indice = eventi.findIndex(e => e.id === id);
    
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
    localStorage.setItem('calendario_eventi', JSON.stringify(eventi));
    // In un'implementazione reale, qui si chiamerebbe l'API per salvare gli eventi
}

/**
 * Carica gli eventi dal localStorage (o da un'API in un'implementazione reale)
 */
function caricaEventi() {
    const eventiSalvati = localStorage.getItem('calendario_eventi');
    if (eventiSalvati) {
        try {
            eventi = JSON.parse(eventiSalvati).map(evento => ({
                ...evento,
                dataInizio: new Date(evento.dataInizio),
                dataFine: new Date(evento.dataFine),
                creato: new Date(evento.creato),
                modificato: evento.modificato ? new Date(evento.modificato) : null
            }));
        } catch (error) {
            console.error('Errore nel caricamento degli eventi:', error);
            eventi = [];
        }
    }
    // In un'implementazione reale, qui si chiamerebbe l'API per caricare gli eventi
}

/**
 * Crea eventi di esempio per la demo
 */
function creaEventiDemo() {
    // Se ci sono già eventi, non creare quelli di esempio
    if (eventi.length > 0) return;
    
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = oggi.getMonth();
    
    // Evento oggi
    aggiungiEvento({
        titolo: 'Riunione di lavoro',
        descrizione: 'Discussione sul nuovo progetto',
        dataInizio: new Date(anno, mese, oggi.getDate(), 10, 0),
        dataFine: new Date(anno, mese, oggi.getDate(), 11, 30),
        categoria: 'work'
    });
    
    // Evento domani
    aggiungiEvento({
        titolo: 'Appuntamento medico',
        descrizione: 'Visita di controllo',
        dataInizio: new Date(anno, mese, oggi.getDate() + 1, 15, 0),
        dataFine: new Date(anno, mese, oggi.getDate() + 1, 16, 0),
        categoria: 'health'
    });
    
    // Evento tra 3 giorni
    aggiungiEvento({
        titolo: 'Cena di famiglia',
        descrizione: 'Ristorante Da Luigi',
        dataInizio: new Date(anno, mese, oggi.getDate() + 3, 20, 0),
        dataFine: new Date(anno, mese, oggi.getDate() + 3, 22, 30),
        categoria: 'family'
    });
    
    // Evento la prossima settimana
    aggiungiEvento({
        titolo: 'Compleanno di Marco',
        descrizione: 'Portare un regalo',
        dataInizio: new Date(anno, mese, oggi.getDate() + 7, 18, 0),
        dataFine: new Date(anno, mese, oggi.getDate() + 7, 23, 0),
        categoria: 'personal'
    });
    
    // Evento tutto il giorno
    aggiungiEvento({
        titolo: 'Conferenza Web',
        descrizione: 'Conferenza annuale sulle tecnologie web',
        dataInizio: new Date(anno, mese, oggi.getDate() + 10, 9, 0),
        dataFine: new Date(anno, mese, oggi.getDate() + 10, 18, 0),
        categoria: 'work'
    });
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
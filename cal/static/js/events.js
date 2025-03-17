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

    if (vistaAttuale === 'day') {
        dataSelezionata = createDate(dataInizio);
    }
    
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

    if (vistaAttuale === 'day' && datiAggiornati.dataInizio) {
        dataSelezionata = createDate(datiAggiornati.dataInizio);
    }

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

/**
 * events.js - Miglioramento della funzione generaEventiTest
 * Genera eventi di test più realistici e meglio distribuiti
 */
function generaEventiTest(numEventi = 15) {
    const categorie = ['work', 'personal', 'family', 'health'];
    
    // Titoli più realistici per gli eventi
    const titoli = {
        work: ['Riunione di team', 'Call con cliente', 'Planning sprint', 'Presentazione progetto', 
               'Revisione codice', 'Workshop', 'Formazione', 'Colloquio candidato'],
        personal: ['Appuntamento', 'Palestra', 'Cinema', 'Shopping', 'Hobby', 'Visita amici', 'Evento sociale'],
        family: ['Compleanno', 'Cena famiglia', 'Anniversario', 'Visita parenti', 'Vacanza famiglia', 
                'Attività con bambini', 'Riunione scuola'],
        health: ['Visita medica', 'Dentista', 'Terapia', 'Allenamento', 'Controllo annuale', 'Analisi sangue']
    };
    
    // Descrizioni più realistiche
    const descrizioni = {
        work: ['Preparare presentazione', 'Portare documenti', 'Agenda: revisione obiettivi trimestrali',
              'Discutere nuova strategia', 'Completare report', 'Riunione online - controllare link'],
        personal: ['Portare regalo', 'Prenotare tavolo', 'Orario flessibile', 'Non dimenticare attrezzatura',
                  'Incontrare davanti all\'ingresso', 'Portare abbigliamento adeguato'],
        family: ['Comprare torta', 'Organizzare sorpresa', 'Chiamare per confermare', 'Prenotare ristorante',
                'Preparare regalo', 'Portare foto', 'Organizzare trasporto'],
        health: ['Portare documentazione', 'A digiuno', 'Portare impegnativa', 'Ricordare ultima visita',
                'Chiedere ricetta', 'Parlare dei sintomi', 'Controllo di routine']
    };
    
    // Data di inizio: un mese indietro
    const dataInizioRange = createDate(new Date());
    dataInizioRange.setMonth(dataInizioRange.getMonth() - 1);
    
    // Data di fine: due mesi avanti
    const dataFineRange = createDate(new Date());
    dataFineRange.setMonth(dataFineRange.getMonth() + 2);
    
    // Distribuisci gli eventi in modo più realistico durante la settimana e l'orario lavorativo
    for (let i = 0; i < numEventi; i++) {
        // Seleziona una categoria
        const categoria = categorie[Math.floor(Math.random() * categorie.length)];
        
        // Genera una data casuale nel range
        const dataInizio = createDate(
            new Date(dataInizioRange.getTime() + 
            Math.random() * (dataFineRange.getTime() - dataInizioRange.getTime()))
        );
        
        // Distribuisci gli eventi lavorativi principalmente nei giorni feriali e orari lavorativi
        if (categoria === 'work') {
            // Aggiusta al giorno feriale più vicino (1-5 = Lun-Ven)
            const giorno = dataInizio.getDay();
            if (giorno === 0) dataInizio.setDate(dataInizio.getDate() + 1); // Domenica -> Lunedì
            if (giorno === 6) dataInizio.setDate(dataInizio.getDate() + 2); // Sabato -> Lunedì
            
            // Orario lavorativo (9-18)
            dataInizio.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 4) * 15, 0);
        } 
        // Eventi familiari più probabili nel weekend e serali
        else if (categoria === 'family') {
            // Più probabilità di weekend
            if (Math.random() < 0.6) {
                const giornoAttuale = dataInizio.getDay();
                if (giornoAttuale >= 1 && giornoAttuale <= 5) {
                    // Sposta al weekend più vicino
                    dataInizio.setDate(dataInizio.getDate() + (6 - giornoAttuale));
                }
            }
            
            // Sera o giorno nel weekend
            if (dataInizio.getDay() === 0 || dataInizio.getDay() === 6) {
                dataInizio.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 4) * 15, 0);
            } else {
                dataInizio.setHours(18 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 4) * 15, 0);
            }
        }
        // Eventi salute più probabili in orario lavorativo
        else if (categoria === 'health') {
            dataInizio.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 4) * 15, 0);
        }
        // Eventi personali variabili ma più frequenti dopo il lavoro
        else {
            if (Math.random() < 0.7) {
                dataInizio.setHours(17 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 4) * 15, 0);
            } else {
                dataInizio.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 4) * 15, 0);
            }
        }
        
        // Durata in base alla categoria
        let durata;
        if (categoria === 'work') {
            durata = [30, 60, 90, 120][Math.floor(Math.random() * 4)]; // 30min - 2h
        } else if (categoria === 'health') {
            durata = [30, 45, 60][Math.floor(Math.random() * 3)]; // 30-60min
        } else if (categoria === 'family') {
            durata = [60, 120, 180, 240][Math.floor(Math.random() * 4)]; // 1-4h
        } else {
            durata = [45, 60, 90, 120, 180][Math.floor(Math.random() * 5)]; // 45min - 3h
        }
        
        const dataFine = createDate(dataInizio);
        dataFine.setMinutes(dataFine.getMinutes() + durata);
        
        // Scegli titolo e descrizione in base alla categoria
        const titolo = titoli[categoria][Math.floor(Math.random() * titoli[categoria].length)];
        const descrizione = descrizioni[categoria][Math.floor(Math.random() * descrizioni[categoria].length)];
        
        // Aggiungi l'evento
        eventi.push({
            id: generateUniqueId(),
            titolo,
            descrizione,
            dataInizio,
            dataFine,
            categoria
        });
    }
    
    // Salva gli eventi
    salvaEventi();
    
    console.log(`Generati ${numEventi} eventi di test realistici`);
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
    
    // Rimuovi prima tutti i listener esistenti, in modo più efficace
    removeEventClickHandlers();
    
    // Seleziona tutti gli elementi evento in tutte le viste usando delegazione di eventi
    // Questo approccio è più efficiente e riduce il numero di listener
    const containers = [
        document.getElementById('monthGrid'),     // Vista mensile
        document.getElementById('weekGrid'),      // Vista settimanale
        document.getElementById('dayGrid'),       // Vista giornaliera
        document.getElementById('eventsList')     // Vista lista
    ];
    
    // Rimuovi i listener esistenti
    containers.forEach(container => {
        if (container) {
            container.removeEventListener('click', handleContainerClick);
            // Aggiungi il nuovo listener usando delegazione di eventi
            container.addEventListener('click', handleContainerClick);
        }
    });
    
    console.log('Event handlers attached via event delegation');
}

function handleContainerClick(e) {
    // Controlla se il click è su un evento o un elemento "più eventi"
    const eventElement = e.target.closest('.event, .time-event, .list-event');
    const moreEventsElement = e.target.closest('.more-events');
    const dayElement = e.target.closest('.calendar-day, .time-slot');
    
    // Evita che l'evento si propaghi ulteriormente
    e.stopPropagation();
    
    // Se è un click su un evento
    if (eventElement) {
        const id = eventElement.dataset.id;
        if (id) {
            console.log('Event clicked:', id);
            apriModalEvento(id);
            return;
        }
    }
    
    // Se è un click su "più eventi"
    if (moreEventsElement) {
        const parentDay = moreEventsElement.closest('.calendar-day, .time-slot');
        if (parentDay) {
            const dataStr = parentDay.dataset.date;
            if (dataStr) {
                console.log('More events clicked for date:', dataStr);
                // Converti la stringa in oggetto data
                const [anno, mese, giorno] = dataStr.split('-').map(Number);
                const data = createDate({anno, mese, giorno});
                apriModalListaEventi(data);
                return;
            }
        }
    }
    
    // Se è un click su un giorno o slot temporale (per aggiungere evento)
    if (dayElement && !eventElement && !moreEventsElement) {
        const dataStr = dayElement.dataset.date;
        const ora = dayElement.dataset.ora;
        
        if (dataStr) {
            console.log('Day/slot clicked for new event:', dataStr, ora);
            // Converti la stringa in oggetto data
            let data;
            
            if (dataStr.includes('T')) {
                // Formato ISO completo
                data = createDate(new Date(dataStr));
            } else {
                // Formato YYYY-MM-DD con ora opzionale
                const [anno, mese, giorno] = dataStr.split('-').map(Number);
                data = createDate({anno, mese, giorno});
                
                // Se c'è anche l'ora, impostala
                if (ora !== undefined) {
                    data.setHours(parseInt(ora), 0, 0);
                }
            }
            
            apriModalNuovoEvento(data);
        }
    }
}


// Funzione per rimuovere i gestori di click dagli eventi
function removeEventClickHandlers() {
    // Utilizziamo la delegazione degli eventi, quindi dobbiamo rimuovere
    // solo i listener dai container principali
    const containers = [
        document.getElementById('monthGrid'),
        document.getElementById('weekGrid'),
        document.getElementById('dayGrid'),
        document.getElementById('eventsList')
    ];
    
    containers.forEach(container => {
        if (container) {
            container.removeEventListener('click', handleContainerClick);
        }
    });
    
    console.log('Removed all event click handlers');
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
function updateCurrentTimeIndicator() {
    console.log('Updating current time indicator');
    
    // Rimuovi eventuali indicatori esistenti per evitare duplicati
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
    
    // Vista giornaliera
    if (vistaAttuale === 'day') {
        const dayGrid = document.querySelector('.day-grid');
        if (dayGrid && isStessoGiorno(dataAttuale, now)) {
            const indicator = document.createElement('div');
            indicator.className = 'current-time-indicator';
            indicator.style.top = `${topPosition}px`;
            dayGrid.appendChild(indicator);
            
            // Aggiungi anche un marker per il punto corrente
            const marker = document.createElement('div');
            marker.className = 'current-time-marker';
            marker.style.top = `${topPosition - 5}px`;
            marker.style.left = '0px';
            dayGrid.appendChild(marker);
        }
    }
    
    // Vista settimanale
    if (vistaAttuale === 'week') {
        const weekGrid = document.querySelector('.week-grid');
        if (weekGrid) {
            // Verifica se il giorno corrente è nella settimana visualizzata
            const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
            const fineSettimana = createDate(inizioSettimana);
            fineSettimana.setDate(fineSettimana.getDate() + 6);
            
            if (now >= inizioSettimana && now <= fineSettimana) {
                // Trova l'indice corretto del giorno corrente nella settimana visualizzata
                let giornoCorretto = -1;
                for (let i = 0; i < 7; i++) {
                    const giorno = createDate(inizioSettimana);
                    giorno.setDate(giorno.getDate() + i);
                    
                    if (isStessoGiorno(now, giorno)) {
                        giornoCorretto = i;
                        break;
                    }
                }
                
                if (giornoCorretto !== -1) {
                    // Calcola la larghezza di ogni colonna
                    const dayColumns = weekGrid.querySelectorAll('.time-slot-header');
                    if (dayColumns.length > 0) {
                        const columnWidth = dayColumns[0].offsetWidth;
                        const leftPosition = (giornoCorretto * columnWidth);
                        
                        const indicator = document.createElement('div');
                        indicator.className = 'current-time-indicator';
                        indicator.style.top = `${topPosition}px`;
                        indicator.style.left = `${leftPosition}px`;
                        indicator.style.width = `${columnWidth}px`;
                        
                        weekGrid.appendChild(indicator);
                        
                        // Aggiungi il marker per la posizione esatta
                        const marker = document.createElement('div');
                        marker.className = 'current-time-marker';
                        marker.style.top = `${topPosition - 5}px`;
                        marker.style.left = `${leftPosition + (columnWidth / 2) - 5}px`;
                        weekGrid.appendChild(marker);
                    }
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
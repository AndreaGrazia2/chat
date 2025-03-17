/**
 * views.js - Gestione delle viste del calendario
 */

// Variabili globali per le viste
let vistaAttuale = 'month';
let dataAttuale = new Date();
let dataSelezionata = null; // variabile per tenere traccia della data selezionata

/**
 * Inizializza le viste del calendario
 */
function inizializzaViste() {
    // Inizializza il mini calendario nella sidebar
    renderizzaMiniCalendario();
    
    // Inizializza la vista attuale
    aggiornaVista();
    
    // Aggiorna l'intestazione con la data corrente
    aggiornaIntestazione();
}

/**
 * Aggiorna la vista attuale
 */
function aggiornaVista() {
    console.log('Aggiornamento vista:', vistaAttuale);
    
    // Nascondi tutte le viste
    document.querySelectorAll('.calendar-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostra la vista attuale
    document.getElementById(`${vistaAttuale}View`).classList.add('active');
    
    // Disattiva il drag and drop precedente, se esiste
    if (window.dragDrop && typeof window.dragDrop.cleanup === 'function') {
        window.dragDrop.cleanup();
    }
    
    // Aggiorna la vista in base al tipo
    switch (vistaAttuale) {
        case 'month':
            renderizzaVistaMensile();
            break;
        case 'week':
            renderizzaVistaSettimanale();
            break;
        case 'day':
            renderizzaVistaGiornaliera();
            break;
        case 'list':
            renderizzaVistaLista();
            break;
    }
    
    // Inizializza il drag and drop dopo aver renderizzato la vista
    setTimeout(() => {
        if (window.dragDrop && typeof window.dragDrop.init === 'function') {
            window.dragDrop.init(vistaAttuale);
        }
        
        // Attacca i gestori di eventi agli elementi dopo il caricamento completo
        if (typeof attachEventClickHandlers === 'function') {
            attachEventClickHandlers();
        }
        
        if (typeof updateCurrentTimeIndicator === 'function') {
            updateCurrentTimeIndicator();
        }
    }, 300);
    
    // Aggiorna l'intestazione
    aggiornaIntestazione();
}

/**
 * Valida le date di un evento
 * @param {Date} dataInizio - Data di inizio dell'evento
 * @param {Date} dataFine - Data di fine dell'evento
 * @returns {boolean} - True se le date sono valide, altrimenti false
 */
function validaDateEvento(dataInizio, dataFine) {
    // Verifica che entrambe le date siano valide
    if (isNaN(dataInizio.getTime()) || isNaN(dataFine.getTime())) {
        mostraNotifica('Date non valide. Controllare il formato.', 'warning');
        return false;
    }
    
    // Verifica che la data di fine non sia precedente alla data di inizio
    if (dataFine <= dataInizio) {
        mostraNotifica('La data di fine deve essere successiva alla data di inizio', 'warning');
        return false;
    }
    
    return true;
}

/**
 * Aggiorna l'intestazione con la data corrente
 */
function aggiornaIntestazione() {
    const currentDateElement = document.querySelector('.current-date');
    if (!currentDateElement) return;
    
    switch (vistaAttuale) {
        case 'month':
            const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            currentDateElement.textContent = `${mesi[dataAttuale.getMonth()]} ${dataAttuale.getFullYear()}`;
            break;
        case 'week':
            const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
            const fineSettimana = createDate(inizioSettimana);
            fineSettimana.setDate(fineSettimana.getDate() + 6);
            
            if (inizioSettimana.getMonth() === fineSettimana.getMonth()) {
                currentDateElement.textContent = `${inizioSettimana.getDate()} - ${fineSettimana.getDate()} ${formatDateItalian(inizioSettimana, false).split(' ')[1]} ${inizioSettimana.getFullYear()}`;
            } else {
                currentDateElement.textContent = `${formatDateItalian(inizioSettimana, false).split(' ')[0]} ${formatDateItalian(inizioSettimana, false).split(' ')[1]} - ${formatDateItalian(fineSettimana, false)}`;
            }
            break;
        case 'day':
            currentDateElement.textContent = formatDateItalian(dataAttuale);
            break;
        case 'list':
            currentDateElement.textContent = formatDateItalian(dataAttuale, false);
            break;
    }
}

/**
 * Renderizza il mini calendario nella sidebar
 */
function renderizzaMiniCalendario() {
    const miniCalendario = document.getElementById('miniCalendar');
    if (!miniCalendario) return;
    
    // Ottieni l'anno e il mese correnti
    const anno = dataAttuale.getFullYear();
    const mese = dataAttuale.getMonth();
    
    // Crea l'intestazione del mini calendario
    const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    let html = `
        <div class="mini-calendar-header">
            <button class="btn btn-icon" id="miniCalendarPrev">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="mini-calendar-title">${mesi[mese]} ${anno}</div>
            <button class="btn btn-icon" id="miniCalendarNext">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div class="mini-calendar-grid">
            <div class="mini-calendar-weekday">L</div>
            <div class="mini-calendar-weekday">M</div>
            <div class="mini-calendar-weekday">M</div>
            <div class="mini-calendar-weekday">G</div>
            <div class="mini-calendar-weekday">V</div>
            <div class="mini-calendar-weekday">S</div>
            <div class="mini-calendar-weekday">D</div>
    `;
    
    // Ottieni il primo giorno del mese e il numero di giorni
    const primoGiorno = getPrimoGiornoMese(anno, mese);
    const giorniTotali = getGiorniInMese(anno, mese);
    
    // Calcola il giorno della settimana del primo giorno (0 = Domenica, 1 = Lunedì, ...)
    let giornoSettimana = primoGiorno.getDay();
    giornoSettimana = giornoSettimana === 0 ? 6 : giornoSettimana - 1; // Converti in formato europeo (0 = Lunedì, 6 = Domenica)
    
    // Aggiungi i giorni del mese precedente
    const mesePrecedente = mese === 0 ? 11 : mese - 1;
    const annoPrecedente = mese === 0 ? anno - 1 : anno;
    const giorniMesePrecedente = getGiorniInMese(annoPrecedente, mesePrecedente);
    
    for (let i = 0; i < giornoSettimana; i++) {
        const giorno = giorniMesePrecedente - giornoSettimana + i + 1;
        html += `<div class="mini-calendar-day other-month" data-date="${annoPrecedente}-${mesePrecedente + 1}-${giorno}">${giorno}</div>`;
    }
    
    // Aggiungi i giorni del mese corrente
    const oggi = createDate(new Date());
    
    for (let i = 1; i <= giorniTotali; i++) {
        const isOggi = oggi.getDate() === i && oggi.getMonth() === mese && oggi.getFullYear() === anno;
        const isSelected = dataAttuale.getDate() === i && dataAttuale.getMonth() === mese && dataAttuale.getFullYear() === anno;
        
        html += `<div class="mini-calendar-day ${isOggi ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${anno}-${mese + 1}-${i}">${i}</div>`;
    }
    
    // Aggiungi i giorni del mese successivo
    const giorniTotaliMostrati = giornoSettimana + giorniTotali;
    const giorniMeseSuccessivo = 42 - giorniTotaliMostrati; // 42 = 6 righe x 7 giorni
    
    const meseSuccessivo = mese === 11 ? 0 : mese + 1;
    const annoSuccessivo = mese === 11 ? anno + 1 : anno;
    
    for (let i = 1; i <= giorniMeseSuccessivo; i++) {
        html += `<div class="mini-calendar-day other-month" data-date="${annoSuccessivo}-${meseSuccessivo + 1}-${i}">${i}</div>`;
    }
    
    html += '</div>';
    
    // Aggiorna il mini calendario
    miniCalendario.innerHTML = html;
    
    // Aggiungi gli event listener
    document.getElementById('miniCalendarPrev').addEventListener('click', () => {
        dataAttuale.setMonth(dataAttuale.getMonth() - 1);
        renderizzaMiniCalendario();
        aggiornaVista();
    });
    
    document.getElementById('miniCalendarNext').addEventListener('click', () => {
        dataAttuale.setMonth(dataAttuale.getMonth() + 1);
        renderizzaMiniCalendario();
        aggiornaVista();
    });
    
    // Aggiungi gli event listener ai giorni
    document.querySelectorAll('.mini-calendar-day').forEach(day => {
        day.addEventListener('click', () => {
            const [anno, mese, giorno] = day.dataset.date.split('-').map(Number);
            dataSelezionata = createDate({anno, mese, giorno});
            dataAttuale = createDate({anno, mese, giorno});
            renderizzaMiniCalendario();
            aggiornaVista();
        });
    });
}

/**
 * Apre il modal per creare un nuovo evento
 * @param {Date} data - Data iniziale per l'evento
 */
function apriModalNuovoEvento(data) {
    // Aggiorna il titolo del modal
    document.getElementById('modalTitle').textContent = 'Nuovo Evento';
    
    // Resetta il form e rimuovi eventuali ID evento precedenti
    const eventForm = document.getElementById('eventForm');
    eventForm.reset();
    eventForm.removeAttribute('data-event-id');
    
    // Utilizza la funzione centralizzata per gestire le date
    const dataEventoInizio = createDate(data);
    
    // Imposta la data e l'ora iniziale usando il fuso orario locale
    const anno = dataEventoInizio.getFullYear();
    const mese = (dataEventoInizio.getMonth() + 1).toString().padStart(2, '0');
    const giorno = dataEventoInizio.getDate().toString().padStart(2, '0');
    const dataStr = `${anno}-${mese}-${giorno}`;
    
    const ore = dataEventoInizio.getHours().toString().padStart(2, '0');
    const minuti = dataEventoInizio.getMinutes().toString().padStart(2, '0');
    const oraStr = `${ore}:${minuti}`;
    
    document.getElementById('eventDate').value = dataStr;
    document.getElementById('eventTime').value = oraStr;
    
    // Imposta la data e l'ora finale (1 ora dopo)
    const dataEventoFine = createDate(dataEventoInizio);
    dataEventoFine.setHours(dataEventoFine.getHours() + 1);
    
    const annoFine = dataEventoFine.getFullYear();
    const meseFine = (dataEventoFine.getMonth() + 1).toString().padStart(2, '0');
    const giornoFine = dataEventoFine.getDate().toString().padStart(2, '0');
    const dataFineStr = `${annoFine}-${meseFine}-${giornoFine}`;
    
    const oreFine = dataEventoFine.getHours().toString().padStart(2, '0');
    const minutiFine = dataEventoFine.getMinutes().toString().padStart(2, '0');
    const oraFineStr = `${oreFine}:${minutiFine}`;
    
    document.getElementById('eventEndDate').value = dataFineStr;
    document.getElementById('eventEndTime').value = oraFineStr;
    
    // Rimuovi il pulsante elimina se presente
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) {
        deleteButton.remove();
    }
    
    // Aggiorna l'event listener del pulsante salva
    const saveButton = document.getElementById('saveEvent');
    // Nel saveButton.onclick della funzione apriModalNuovoEvento 
    saveButton.onclick = () => {
        // Raccogli i dati dal form
        const titolo = document.getElementById('eventTitle').value;
        const descrizione = document.getElementById('eventDescription').value;
        const data = document.getElementById('eventDate').value;
        const ora = document.getElementById('eventTime').value;
        const dataFine = document.getElementById('eventEndDate').value;
        const oraFine = document.getElementById('eventEndTime').value;
        const categoria = document.getElementById('eventCategory').value;
        
        // Verifica che il titolo sia stato inserito
        if (!titolo.trim()) {
            mostraNotifica('Inserisci un titolo per l\'evento', 'warning');
            return;
        }
        
        // Verifica che la descrizione sia stata inserita
        if (!descrizione.trim()) {
            mostraNotifica('Inserisci una descrizione per l\'evento', 'warning');
            return;
        }
        
        // Crea oggetti Date usando la funzione centralizzata
        const dataInizio = createDate({
            anno: parseInt(data.split('-')[0]),
            mese: parseInt(data.split('-')[1]),
            giorno: parseInt(data.split('-')[2]),
            ore: parseInt(ora.split(':')[0]),
            minuti: parseInt(ora.split(':')[1])
        });
        
        const dataFinale = createDate({
            anno: parseInt(dataFine.split('-')[0]),
            mese: parseInt(dataFine.split('-')[1]),
            giorno: parseInt(dataFine.split('-')[2]),
            ore: parseInt(oraFine.split(':')[0]),
            minuti: parseInt(oraFine.split(':')[1])
        });
        
        // Validazione delle date
        if (!validaDateEvento(dataInizio, dataFinale)) {
            return; // Esci se la validazione fallisce
        }
        
        // Crea l'evento
        aggiungiEvento({
            titolo,
            descrizione,
            dataInizio,
            dataFine: dataFinale,
            categoria
        });
        
        // Chiudi il modal
        chiudiModal('eventModal');
        
        // Mostra conferma
        mostraNotifica('Evento creato con successo', 'success');
    };
    
    // Apri il modal
    apriModal('eventModal');
}

/**
 * Apre il modal per visualizzare tutti gli eventi di un giorno
 * @param {Date} data - Data per cui visualizzare gli eventi
 */
function apriModalListaEventi(data) {
    // Ottieni gli eventi del giorno
    const eventiGiorno = getEventiGiorno(data);
    
    // Aggiorna il titolo del modal
    document.getElementById('eventsListModalTitle').textContent = `Eventi del ${formatDateItalian(data, false)}`;
    
    // Crea l'HTML per la lista degli eventi
    let html = '';
    
    // Ordina gli eventi per orario
    eventiGiorno.sort((a, b) => createDate(a.dataInizio) - createDate(b.dataInizio));
    
    // Aggiungi ogni evento alla lista
    eventiGiorno.forEach(evento => {
        html += `
            <div class="events-list-item" data-id="${evento.id}">
                <div class="events-list-item-category" style="background-color: ${categorie[evento.categoria].colore};"></div>
                <div class="events-list-item-content">
                    <div class="events-list-item-title">${evento.titolo}</div>
                    <div class="events-list-item-time">${formatTimeItalian(evento.dataInizio)} - ${formatTimeItalian(evento.dataFine)}</div>
                    <div class="events-list-item-description">${evento.descrizione}</div>
                </div>
            </div>
        `;
    });
    
    // Se non ci sono eventi, mostra un messaggio
    if (eventiGiorno.length === 0) {
        html = '<div class="empty-message">Nessun evento in questa data</div>';
    }
    
    // Aggiorna la lista
    document.getElementById('eventsListModalContent').innerHTML = html;
    
    // Aggiungi gli event listener per gli eventi
    document.querySelectorAll('.events-list-item').forEach(eventElement => {
        eventElement.addEventListener('click', () => {
            const id = eventElement.dataset.id;
            chiudiModal('eventsListModal');
            apriModalEvento(id);
        });
    });
    
    // Apri il modal
    apriModal('eventsListModal');
}

/**
 * Apre il modal per visualizzare/modificare un evento
 * @param {string} id - ID dell'evento da visualizzare
 */
function apriModalEvento(id) {
    // Trova l'evento
    const evento = eventi.find(e => e.id === id);
    if (!evento) return;
    
    // Aggiorna il titolo del modal
    document.getElementById('modalTitle').textContent = 'Modifica Evento';
    
    // Popola il form
    document.getElementById('eventTitle').value = evento.titolo;
    document.getElementById('eventDescription').value = evento.descrizione || '';
    
    const dataInizio = createDate(evento.dataInizio);
    const dataFine = createDate(evento.dataFine);
    
    // Formatta le date con padding zero
    const annoInizio = dataInizio.getFullYear();
    const meseInizio = (dataInizio.getMonth() + 1).toString().padStart(2, '0');
    const giornoInizio = dataInizio.getDate().toString().padStart(2, '0');
    const oreInizio = dataInizio.getHours().toString().padStart(2, '0');
    const minutiInizio = dataInizio.getMinutes().toString().padStart(2, '0');
    
    const annoFine = dataFine.getFullYear();
    const meseFine = (dataFine.getMonth() + 1).toString().padStart(2, '0');
    const giornoFine = dataFine.getDate().toString().padStart(2, '0');
    const oreFine = dataFine.getHours().toString().padStart(2, '0');
    const minutiFine = dataFine.getMinutes().toString().padStart(2, '0');
    
    document.getElementById('eventDate').value = `${annoInizio}-${meseInizio}-${giornoInizio}`;
    document.getElementById('eventTime').value = `${oreInizio}:${minutiInizio}`;
    document.getElementById('eventEndDate').value = `${annoFine}-${meseFine}-${giornoFine}`;
    document.getElementById('eventEndTime').value = `${oreFine}:${minutiFine}`;
    document.getElementById('eventCategory').value = evento.categoria;
    
    // IMPORTANTE: Imposta l'ID dell'evento nel form per l'aggiornamento
    document.getElementById('eventForm').setAttribute('data-event-id', id);
    
    // Aggiungi il pulsante elimina se non esiste già
    let deleteButton = document.getElementById('deleteEvent');
    if (!deleteButton) {
        deleteButton = document.createElement('button');
        deleteButton.id = 'deleteEvent';
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Elimina';
        
        // Inserisci il pulsante nel footer del modal
        const modalFooter = document.querySelector('.modal-footer');
        modalFooter.insertBefore(deleteButton, document.getElementById('cancelEvent'));
    }
    
    // Aggiorna l'event listener del pulsante elimina
    deleteButton.onclick = () => {
        // Apri il modal di conferma
        apriModalConfermaEliminazione(id);
    };
    
    // Aggiorna l'event listener del pulsante salva
    const saveButton = document.getElementById('saveEvent');
    // Nel saveButton.onclick della funzione apriModalEvento
    saveButton.onclick = () => {
        // Raccogli i dati dal form
        const titolo = document.getElementById('eventTitle').value;
        const descrizione = document.getElementById('eventDescription').value;
        const data = document.getElementById('eventDate').value;
        const ora = document.getElementById('eventTime').value;
        const dataFine = document.getElementById('eventEndDate').value;
        const oraFine = document.getElementById('eventEndTime').value;
        const categoria = document.getElementById('eventCategory').value;
        
        // Verifica che il titolo sia stato inserito
        if (!titolo.trim()) {
            mostraNotifica('Inserisci un titolo per l\'evento', 'warning');
            return;
        }
        
        // Verifica che la descrizione sia stata inserita
        if (!descrizione.trim()) {
            mostraNotifica('Inserisci una descrizione per l\'evento', 'warning');
            return;
        }
        
        // Crea oggetti Date usando la funzione centralizzata
        const dataInizio = createDate({
            anno: parseInt(data.split('-')[0]),
            mese: parseInt(data.split('-')[1]),
            giorno: parseInt(data.split('-')[2]),
            ore: parseInt(ora.split(':')[0]),
            minuti: parseInt(ora.split(':')[1])
        });
        
        const dataFinale = createDate({
            anno: parseInt(dataFine.split('-')[0]),
            mese: parseInt(dataFine.split('-')[1]),
            giorno: parseInt(dataFine.split('-')[2]),
            ore: parseInt(oraFine.split(':')[0]),
            minuti: parseInt(oraFine.split(':')[1])
        });
        
        // Validazione delle date
        if (!validaDateEvento(dataInizio, dataFinale)) {
            return; // Esci se la validazione fallisce
        }
        
        // Modifica l'evento
        modificaEvento(id, {
            titolo,
            descrizione,
            dataInizio,
            dataFine: dataFinale,
            categoria
        });
        
        // Chiudi il modal
        chiudiModal('eventModal');
        
        // Mostra conferma
        mostraNotifica('Evento aggiornato con successo', 'success');
    };
    
    // Apri il modal
    apriModal('eventModal');
}

/**
 * Apre il modal di conferma eliminazione
 * @param {string} id - ID dell'evento da eliminare
 */
function apriModalConfermaEliminazione(id) {
    // Crea il modal se non esiste
    let modal = document.getElementById('confirmDeleteModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmDeleteModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Conferma eliminazione</h3>
                    <button class="close-modal" id="closeConfirmDeleteModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Sei sicuro di voler eliminare questo evento?</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-text" id="cancelDelete">Annulla</button>
                    <button class="btn btn-danger" id="confirmDelete">Elimina</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Aggiungi gli event listener
        document.getElementById('closeConfirmDeleteModal').addEventListener('click', () => {
            chiudiModal('confirmDeleteModal');
        });
        
        document.getElementById('cancelDelete').addEventListener('click', () => {
            chiudiModal('confirmDeleteModal');
        });
    }
    
    // Aggiorna l'event listener per il pulsante di conferma
    document.getElementById('confirmDelete').onclick = () => {
        // Elimina l'evento
        eliminaEvento(id);
        
        // Chiudi entrambi i modal
        chiudiModal('confirmDeleteModal');
        chiudiModal('eventModal');
        
        // Mostra conferma
        mostraNotifica('Evento eliminato con successo', 'success');
    };
    
    // Apri il modal
    apriModal('confirmDeleteModal');
}

/**
 * Apre un modal
 * @param {string} modalId - ID del modal da aprire
 */
function apriModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Chiude un modal
 * @param {string} modalId - ID del modal da chiudere
 */
function chiudiModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Aggiorna tutte le viste del calendario
 */
function aggiornaViste() {
    renderizzaMiniCalendario();
    aggiornaVista();
}
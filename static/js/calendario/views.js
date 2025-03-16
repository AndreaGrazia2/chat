/**
 * views.js - Gestione delle viste del calendario
 */

// Variabili globali per le viste
let vistaAttuale = 'month';
let dataAttuale = new Date();

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
    // Nascondi tutte le viste
    document.querySelectorAll('.calendar-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostra la vista attuale
    document.getElementById(`${vistaAttuale}View`).classList.add('active');
    
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
    
    // Aggiorna l'intestazione
    aggiornaIntestazione();
}

/**
 * Aggiorna l'intestazione con la data corrente
 */
function aggiornaIntestazione() {
    const currentDateElement = document.querySelector('.current-date');
    
    switch (vistaAttuale) {
        case 'month':
            const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            currentDateElement.textContent = `${mesi[dataAttuale.getMonth()]} ${dataAttuale.getFullYear()}`;
            break;
        case 'week':
            const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
            const fineSettimana = new Date(inizioSettimana);
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
    const oggi = new Date();
    
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
            dataAttuale = new Date(anno, mese - 1, giorno);
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
    
    // Resetta il form
    document.getElementById('eventForm').reset();
    
    // Imposta la data e l'ora iniziale usando il fuso orario locale
    const anno = data.getFullYear();
    const mese = (data.getMonth() + 1).toString().padStart(2, '0');
    const giorno = data.getDate().toString().padStart(2, '0');
    const dataStr = `${anno}-${mese}-${giorno}`;
    
    const ore = data.getHours().toString().padStart(2, '0');
    const minuti = data.getMinutes().toString().padStart(2, '0');
    const oraStr = `${ore}:${minuti}`;
    
    document.getElementById('eventDate').value = dataStr;
    document.getElementById('eventTime').value = oraStr;
    
    // Imposta la data e l'ora finale (1 ora dopo)
    const dataFine = new Date(data);
    dataFine.setHours(dataFine.getHours() + 1);
    
    document.getElementById('eventEndDate').value = dataFine.toISOString().split('T')[0];
    document.getElementById('eventEndTime').value = dataFine.toTimeString().substring(0, 5);
    
    // Rimuovi il pulsante elimina se presente
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) {
        deleteButton.remove();
    }
    
    // Aggiorna l'event listener del pulsante salva
    const saveButton = document.getElementById('saveEvent');
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
            apriModalAvviso('Inserisci un titolo per l\'evento');
            return;
        }
        
        // Verifica che la descrizione sia stata inserita
        if (!descrizione.trim()) {
            apriModalAvviso('Inserisci una descrizione per l\'evento');
            return;
        }
        
        // Crea le date
        const dataInizio = new Date(`${data}T${ora}`);
        const dataFinale = new Date(`${dataFine}T${oraFine}`);
        
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
    eventiGiorno.sort((a, b) => new Date(a.dataInizio) - new Date(b.dataInizio));
    
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
 * Apre un modal
 * @param {string} modalId - ID del modal da aprire
 */
function apriModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Cambiamo questo per usare display invece di classi
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
        // Cambiamo questo per usare display invece di classi
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
    
    const dataInizio = new Date(evento.dataInizio);
    const dataFine = new Date(evento.dataFine);
    
    document.getElementById('eventDate').value = dataInizio.toISOString().split('T')[0];
    document.getElementById('eventTime').value = dataInizio.toTimeString().substring(0, 5);
    document.getElementById('eventEndDate').value = dataFine.toISOString().split('T')[0];
    document.getElementById('eventEndTime').value = dataFine.toTimeString().substring(0, 5);
    document.getElementById('eventCategory').value = evento.categoria;
    
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
            alert('Inserisci un titolo per l\'evento');
            return;
        }
        
        // Verifica che la descrizione sia stata inserita
        if (!descrizione.trim()) {
            apriModalAvviso('Inserisci una descrizione per l\'evento');
            return;
        }
        
        // Crea le date
        const dataInizio = new Date(`${data}T${ora}`);
        const dataFinale = new Date(`${dataFine}T${oraFine}`);
        
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
    };
    
    // Apri il modal
    apriModal('confirmDeleteModal');
}

/**
 * Apre un modal di avviso
 * @param {string} messaggio - Messaggio da mostrare
 */
function apriModalAvviso(messaggio) {
    // Crea il modal se non esiste
    let modal = document.getElementById('alertModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'alertModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Avviso</h3>
                    <button class="close-modal" id="closeAlertModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p id="alertMessage"></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="confirmAlert">OK</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Aggiungi gli event listener
        document.getElementById('closeAlertModal').addEventListener('click', () => {
            chiudiModal('alertModal');
        });
        
        document.getElementById('confirmAlert').addEventListener('click', () => {
            chiudiModal('alertModal');
        });
    }
    
    // Aggiorna il messaggio
    document.getElementById('alertMessage').textContent = messaggio;
    
    // Apri il modal
    apriModal('alertModal');
}
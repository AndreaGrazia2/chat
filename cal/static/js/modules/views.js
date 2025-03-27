/**
 * views.js - Gestione delle viste del calendario
 */

import { caricaEventiPeriodo, getIntervalloVista } from './data-loader.js';
import { renderizzaVistaMensile } from './views-month.js';
import { renderizzaVistaSettimanale } from './views-week.js';
import { renderizzaVistaGiornaliera } from './views-day.js';
import { renderizzaVistaLista } from './views-list.js';
import { 
    formatDateItalian, 
    formatTimeItalian, 
    getPrimoGiornoSettimana, 
    getPrimoGiornoMese,
    getGiorniInMese,
    isStessoGiorno,
    createDate,
    mostraNotifica
} from './utils.js';

import { initDragAndDrop, cleanupDragAndDrop } from './drag-drop.js';
import { attachEventClickHandlers, getEventiGiorno, modificaEvento, aggiungiEvento, eliminaEvento,  updateCurrentTimeIndicator } from './events.js';
import { initTimeIndicator } from '../app.js';

// Variabili globali per le viste
let vistaAttuale = 'month';
let dataAttuale = new Date();
let dataSelezionata = null; // variabile per tenere traccia della data selezionata

// Categorie di eventi (da spostare in un modulo separato in futuro)
const categorie = {
    work: { nome: 'Lavoro', colore: '#4285f4' },
    personal: { nome: 'Personale', colore: '#34a853' },
    family: { nome: 'Famiglia', colore: '#fbbc05' },
    health: { nome: 'Salute', colore: '#ea4335' },
    other: { nome: 'Altro', colore: '#9e9e9e' }
};

/**
 * Inizializza le viste del calendario
 */
export function inizializzaViste() {
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
export function aggiornaVista() {
    console.log('Aggiornamento vista:', vistaAttuale);
    
    // Nascondi tutte le viste
    document.querySelectorAll('.calendar-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostra la vista attuale
    document.getElementById(`${vistaAttuale}View`).classList.add('active');
    
    // Disattiva il drag and drop precedente, se esiste
    cleanupDragAndDrop();
    
    // Aggiorna la vista in base al tipo
    switch (vistaAttuale) {
        case 'month':
            renderizzaVistaMensile();
            break;
        case 'week':
            renderizzaVistaSettimanale();
            break;
        case 'day':
            // NUOVO: Se siamo nella vista giornaliera, assicuriamoci che dataSelezionata sia sincronizzata con dataAttuale
            if (!dataSelezionata || !isStessoGiorno(dataSelezionata, dataAttuale)) {
                dataSelezionata = createDate(dataAttuale);
                console.log('Vista giornaliera: dataSelezionata sincronizzata con dataAttuale', dataSelezionata);
            }
            renderizzaVistaGiornaliera();
            break;
        case 'list':
            renderizzaVistaLista();
            break;
    }
    
    // Inizializza il drag and drop dopo aver renderizzato la vista
    setTimeout(() => {

            initDragAndDrop(vistaAttuale);
        
            attachEventClickHandlers();
        
            updateCurrentTimeIndicator();
        
            setTimeout(initTimeIndicator, 300);
    }, 300);
    
    // Aggiorna l'intestazione
    aggiornaIntestazione();
    
    // Renderizza gli eventi
    renderEventi();
}

/**
 * Valida le date di un evento
 * @param {Date} dataInizio - Data di inizio dell'evento
 * @param {Date} dataFine - Data di fine dell'evento
 * @returns {boolean} - True se le date sono valide, altrimenti false
 */
export function validaDateEvento(dataInizio, dataFine) {
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
export function aggiornaIntestazione() {
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
export function renderizzaMiniCalendario() {
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
        
        // Carica i dati per il nuovo mese
        const intervallo = getIntervalloVista('month', dataAttuale);
        caricaEventiPeriodo(intervallo).then(() => {
            renderizzaMiniCalendario();
            aggiornaVista();
        });
    });
    
    document.getElementById('miniCalendarNext').addEventListener('click', () => {
        dataAttuale.setMonth(dataAttuale.getMonth() + 1);
        
        // Carica i dati per il nuovo mese
        const intervallo = getIntervalloVista('month', dataAttuale);
        caricaEventiPeriodo(intervallo).then(() => {
            renderizzaMiniCalendario();
            aggiornaVista();
        });
    });
    
    // Aggiungi gli event listener ai giorni
    document.querySelectorAll('.mini-calendar-day').forEach(day => {
        day.addEventListener('click', () => {
            const [anno, mese, giorno] = day.dataset.date.split('-').map(Number);
            dataSelezionata = createDate({anno, mese, giorno});
            dataAttuale = createDate({anno, mese, giorno});
            
            // Carica i dati per il giorno selezionato
            const intervallo = getIntervalloVista(vistaAttuale, dataAttuale);
            caricaEventiPeriodo(intervallo).then(() => {
                renderizzaMiniCalendario();
                aggiornaVista();
            });
        });
    });
}

/**
 * Apre il modal per creare un nuovo evento
 * @param {Date} data - Data iniziale per l'evento
 */
export function apriModalNuovoEvento(data) {
    if (vistaAttuale === 'day') {
        dataSelezionata = createDate(data);
    }

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
    
    // Rimuovi il pulsante nascondi se presente
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) {
        deleteButton.style.display = 'none'; // Nascondi invece di rimuovere
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
export function apriModalListaEventi(data) {
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
export function apriModalEvento(id) {
    // Trova l'evento
    const evento = window.eventi.find(e => e.id === id);
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
export function apriModalConfermaEliminazione(id) {
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
export function apriModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * Chiude un modal
 * @param {string} modalId - ID del modal da chiudere
 */
export function chiudiModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Renderizza gli eventi nel calendario
 */
export function renderEventi() {
    console.log('%c[RENDER] Rendering eventi nel calendario', 'background: #16a085; color: white; padding: 2px 5px; border-radius: 3px;');
    
    // Verifica che gli eventi siano disponibili
    if (!window.eventi || window.eventi.length === 0) {
        console.log('[RENDER] Nessun evento da visualizzare');
        return;
    }
    
    console.log('[RENDER] Rendering di', window.eventi.length, 'eventi');
    
    // Rimuovi tutti gli eventi esistenti dal DOM
    const eventiEsistenti = document.querySelectorAll('.event');
    eventiEsistenti.forEach(evento => evento.remove());
    console.log('[RENDER] Rimossi', eventiEsistenti.length, 'eventi esistenti');
    
    // Ottieni tutti i giorni del calendario
    const giorniCalendario = document.querySelectorAll('.calendar-day');
    console.log('[RENDER] Trovati', giorniCalendario.length, 'giorni nel calendario');
    
    // Crea una mappa dei giorni per data
    const mappaGiorni = new Map();
    giorniCalendario.forEach(giorno => {
        const dataGiorno = giorno.getAttribute('data-date');
        if (dataGiorno) {
            mappaGiorni.set(dataGiorno, giorno);
        }
    });
    
    // Per ogni evento, trova il giorno corrispondente e aggiungi l'evento
    window.eventi.forEach(evento => {
        // Formatta la data dell'evento nello stesso formato dell'attributo data-date
        const dataEvento = evento.dataInizio.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Trova il giorno corrispondente
        const giorno = mappaGiorni.get(dataEvento);
        
        if (giorno) {
            // Trova o crea il contenitore degli eventi
            let contenitoreEventi = giorno.querySelector('.day-events');
            
            if (!contenitoreEventi) {
                // Se non esiste, crealo
                contenitoreEventi = document.createElement('div');
                contenitoreEventi.className = 'day-events';
                giorno.appendChild(contenitoreEventi);
            }
            
            // Crea l'elemento evento
            const elementoEvento = document.createElement('div');
            elementoEvento.className = `event category-${evento.categoria}`;
            elementoEvento.setAttribute('data-event-id', evento.id);
            
            // Formatta l'ora dell'evento (se disponibile)
            let orarioEvento = '';
            if (evento.dataInizio) {
                const ore = evento.dataInizio.getHours().toString().padStart(2, '0');
                const minuti = evento.dataInizio.getMinutes().toString().padStart(2, '0');
                orarioEvento = `${ore}:${minuti}`;
            }
            
            // Aggiungi il contenuto dell'evento
            elementoEvento.innerHTML = `
                <div class="event-time">${orarioEvento}</div>
                <div class="event-title">${evento.titolo}</div>
            `;
            
            // Aggiungi l'evento al contenitore
            contenitoreEventi.appendChild(elementoEvento);
            
            // Aggiungi event listener per il click
            elementoEvento.addEventListener('click', () => {
                console.log('[EVENT] Click su evento:', evento);
                // Qui puoi aggiungere la logica per mostrare i dettagli dell'evento
                apriModalEvento(evento.id);
            });
        } else {
            console.log('[RENDER] Nessun giorno trovato per la data:', dataEvento);
        }
    });
    
    console.log('[RENDER] Rendering eventi completato');
}

/**
 * Funzione per aggiornare l'indicatore dell'ora corrente nelle viste
 */
export function aggiornaIndicatoreOraCorrente() {
    // Ottieni l'ora corrente
    const oraCorrente = new Date();
    
    // Calcola la posizione dell'indicatore in base all'ora
    const ore = oraCorrente.getHours();
    const minuti = oraCorrente.getMinutes();
    const percentualeGiorno = (ore * 60 + minuti) / (24 * 60);
    
    // Aggiorna l'indicatore nella vista giornaliera
    const indicatoreGiornaliero = document.querySelector('.current-time-indicator.day-view');
    if (indicatoreGiornaliero) {
        const altezzaContenitore = document.querySelector('.day-hours-container').offsetHeight;
        const posizione = percentualeGiorno * altezzaContenitore;
        indicatoreGiornaliero.style.top = `${posizione}px`;
        
        // Aggiorna l'etichetta dell'ora
        const etichettaOra = indicatoreGiornaliero.querySelector('.time-label');
        if (etichettaOra) {
            etichettaOra.textContent = `${ore.toString().padStart(2, '0')}:${minuti.toString().padStart(2, '0')}`;
        }
    }
    
    // Aggiorna l'indicatore nella vista settimanale
    const indicatoreSettimanale = document.querySelector('.current-time-indicator.week-view');
    if (indicatoreSettimanale) {
        const altezzaContenitore = document.querySelector('.week-hours-container').offsetHeight;
        const posizione = percentualeGiorno * altezzaContenitore;
        indicatoreSettimanale.style.top = `${posizione}px`;
        
        // Aggiorna l'etichetta dell'ora
        const etichettaOra = indicatoreSettimanale.querySelector('.time-label');
        if (etichettaOra) {
            etichettaOra.textContent = `${ore.toString().padStart(2, '0')}:${minuti.toString().padStart(2, '0')}`;
        }
    }
}

/**
 * Inizializza l'indicatore dell'ora corrente e imposta l'aggiornamento periodico
 */
export function inizializzaIndicatoreOraCorrente() {
    // Crea l'indicatore per la vista giornaliera se non esiste
    let indicatoreGiornaliero = document.querySelector('.current-time-indicator.day-view');
    if (!indicatoreGiornaliero && document.querySelector('.day-hours-container')) {
        indicatoreGiornaliero = document.createElement('div');
        indicatoreGiornaliero.className = 'current-time-indicator day-view';
        indicatoreGiornaliero.innerHTML = '<div class="time-label"></div>';
        document.querySelector('.day-hours-container').appendChild(indicatoreGiornaliero);
    }
    
    // Crea l'indicatore per la vista settimanale se non esiste
    let indicatoreSettimanale = document.querySelector('.current-time-indicator.week-view');
    if (!indicatoreSettimanale && document.querySelector('.week-hours-container')) {
        indicatoreSettimanale = document.createElement('div');
        indicatoreSettimanale.className = 'current-time-indicator week-view';
        indicatoreSettimanale.innerHTML = '<div class="time-label"></div>';
        document.querySelector('.week-hours-container').appendChild(indicatoreSettimanale);
    }
    
    // Aggiorna subito l'indicatore
    aggiornaIndicatoreOraCorrente();
    
    // Imposta l'aggiornamento periodico (ogni minuto)
    setInterval(aggiornaIndicatoreOraCorrente, 60000);
}

/**
 * Cambia la vista del calendario
 * @param {string} nuovaVista - La nuova vista da mostrare ('month', 'week', 'day', 'list')
 */
export function cambiaVista(nuovaVista) {
    // Verifica che la vista sia valida
    if (!['month', 'week', 'day', 'list'].includes(nuovaVista)) {
        console.error('Vista non valida:', nuovaVista);
        return;
    }
    
    // Aggiorna la vista attuale
    vistaAttuale = nuovaVista;
    
    // Aggiorna la classe attiva nei pulsanti di selezione vista
    document.querySelectorAll('.view-selector button').forEach(button => {
        button.classList.remove('active');
    });
    
    document.querySelector(`.view-selector button[data-view="${nuovaVista}"]`).classList.add('active');
    
    // Carica i dati per la nuova vista
    const intervallo = getIntervalloVista(nuovaVista, dataAttuale);
    caricaEventiPeriodo(intervallo).then(() => {
        // Aggiorna la vista
        aggiornaVista();
    });
}

/**
 * Naviga alla data precedente nella vista corrente
 */
export function navigaDataPrecedente() {
    switch (vistaAttuale) {
        case 'month':
            dataAttuale.setMonth(dataAttuale.getMonth() - 1);
            break;
        case 'week':
            dataAttuale.setDate(dataAttuale.getDate() - 7);
            break;
        case 'day':
            dataAttuale.setDate(dataAttuale.getDate() - 1);
            break;
        case 'list':
            dataAttuale.setDate(dataAttuale.getDate() - 7);
            break;
    }
    
    // Carica i dati per la nuova data
    const intervallo = getIntervalloVista(vistaAttuale, dataAttuale);
    caricaEventiPeriodo(intervallo).then(() => {
        // Aggiorna la vista
        aggiornaVista();
    });
}

/**
 * Naviga alla data successiva nella vista corrente
 */
export function navigaDataSuccessiva() {
    switch (vistaAttuale) {
        case 'month':
            dataAttuale.setMonth(dataAttuale.getMonth() + 1);
            break;
        case 'week':
            dataAttuale.setDate(dataAttuale.getDate() + 7);
            break;
        case 'day':
            dataAttuale.setDate(dataAttuale.getDate() + 1);
            break;
        case 'list':
            dataAttuale.setDate(dataAttuale.getDate() + 7);
            break;
    }
    
    // Carica i dati per la nuova data
    const intervallo = getIntervalloVista(vistaAttuale, dataAttuale);
    caricaEventiPeriodo(intervallo).then(() => {
        // Aggiorna la vista
        aggiornaVista();
    });
}

/**
 * Naviga alla data odierna
 */
export function navigaDataOggi() {
    dataAttuale = new Date();
    
    // Carica i dati per la data odierna
    const intervallo = getIntervalloVista(vistaAttuale, dataAttuale);
    caricaEventiPeriodo(intervallo).then(() => {
        // Aggiorna la vista
        aggiornaVista();
    });
}

// Esporta le variabili globali per l'accesso da altri moduli
export { vistaAttuale, dataAttuale, dataSelezionata };
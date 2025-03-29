/**
 * views-day.js - Gestione della vista giornaliera del calendario
 */

// Imports from utils.js
import {
    formatTimeItalian,
    createDate,
    isStessoGiorno,
    getEuropeanWeekday
} from './utils.js';

// Imports from events.js
import {
    getEventiGiorno
} from './events.js';

// Imports from views.js
import {
    apriModalEvento,
    apriModalNuovoEvento
} from './views.js';

// Imports from drag-drop.js
import {
    enableDragAndDrop
} from './drag-drop.js';

/**
 * Posiziona gli eventi sovrapposti nella vista giornaliera
 * @param {Array} eventiGiorno - Eventi del giorno
 * @returns {Array} - Eventi con informazioni di posizionamento
 */
export function posizionaEventiSovrapposti(eventiGiorno) {
    // Clona gli eventi per non modificare gli originali
    const eventi = JSON.parse(JSON.stringify(eventiGiorno));

    // Ordina gli eventi per ora di inizio
    eventi.sort((a, b) => createDate(a.dataInizio) - createDate(b.dataInizio));

    // Traccia delle colonne occupate (fino a che ora)
    const colonne = [];

    eventi.forEach(evento => {
        const dataInizio = createDate(evento.dataInizio);
        const dataFine = createDate(evento.dataFine);

        // Trova la prima colonna disponibile
        let colonnaDisponibile = 0;
        while (colonne[colonnaDisponibile] && dataInizio < colonne[colonnaDisponibile]) {
            colonnaDisponibile++;
        }

        // Assegna la colonna all'evento
        evento.colonna = colonnaDisponibile;
        evento.totalColonne = 1;

        // Aggiorna lo spazio occupato
        colonne[colonnaDisponibile] = dataFine;
    });

    // Calcola il numero totale di colonne necessarie
    const maxColonne = Math.max(...eventi.map(e => e.colonna), 0) + 1;

    // Aggiorna il totale delle colonne per ogni evento
    eventi.forEach(evento => {
        evento.totalColonne = maxColonne;
    });

    return eventi;
}

/**
 * Renderizza la vista giornaliera
 */
export function renderizzaVistaGiornaliera() {
    const dayGrid = document.getElementById('dayGrid');
    if (!dayGrid) return;

    if (!window.dataSelezionata || !isStessoGiorno(window.dataSelezionata, window.dataAttuale)) {
        window.dataSelezionata = createDate(window.dataAttuale);
    }

    const dataVisualizzata = window.dataSelezionata; // Usiamo sempre window.dataSelezionata qui

    // Crea l'intestazione della griglia giornaliera
    const isOggi = isStessoGiorno(dataVisualizzata, createDate(new Date()));
    let headerHtml = `
        <div class="time-slot-header ${isOggi ? 'today' : ''}">
            <div>${['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'][getEuropeanWeekday(dataVisualizzata)]}</div>
            <div>${dataVisualizzata.getDate()}</div>
        </div>
    `;

    // Ottieni tutti gli eventi del giorno e posizionali
    const eventiGiorno = getEventiGiorno(dataVisualizzata);
    const eventiPosizionati = posizionaEventiSovrapposti(eventiGiorno);

    // Organizza gli eventi per ora
    const eventiPerOra = Array(25).fill().map(() => []);

    eventiPosizionati.forEach(evento => {
        const dataInizio = createDate(evento.dataInizio);
        const oraInizio = dataInizio.getHours();

        // Aggiungi l'evento all'array dell'ora corrispondente
        if (oraInizio >= 0 && oraInizio < 25) {
            eventiPerOra[oraInizio].push(evento);
        }
    });

    // Crea la griglia oraria
    let gridHtml = headerHtml;

    // Crea le celle orarie per ogni ora
    for (let ora = 0; ora < 25; ora++) {
        const dataOra = createDate(dataVisualizzata);
        dataOra.setHours(ora, 0, 0);

        const isOraCorrente = createDate(new Date()).getHours() === ora && isStessoGiorno(dataOra, createDate(new Date()));

        // Ottieni gli eventi per questa ora
        const eventiOra = eventiPerOra[ora];

        // Crea l'HTML per gli eventi in questa ora
        let eventiHtml = '';
        eventiOra.forEach(evento => {
            const dataInizio = createDate(evento.dataInizio);
            const dataFine = createDate(evento.dataFine);

            // Aggiungi la classe new-event solo se l'evento è nuovo
            const newEventClass = evento.isNew ? 'new-event' : '';

            // Calcola la larghezza in base alla colonna e al totale di colonne
            const larghezza = 100 / evento.totalColonne;
            const margineSinistro = (larghezza * evento.colonna);
            const larghezzaEvento = larghezza;

            eventiHtml += `
                <div class="time-event ${evento.categoria} ${newEventClass}" 
                     data-id="${evento.id}" 
                     style="left: ${margineSinistro}%; width: ${larghezzaEvento}%;">
                    <div class="time-event-title">${evento.titolo}</div>
                    <div class="time-event-time">${formatTimeItalian(dataInizio)} - ${formatTimeItalian(dataFine)}</div>
                    <div class="time-event-description">${evento.descrizione || ''}</div>
                </div>
            `;
        });

        // Crea la cella con gli eventi
        gridHtml += `
            <div class="time-slot ${isOraCorrente ? 'current-time' : ''}" data-ora="${ora}">
                ${eventiHtml}
            </div>
        `;
    }

    // Aggiorna la griglia
    dayGrid.innerHTML = gridHtml;

    // Aggiungi l'indicatore dell'ora corrente
    const oggi = createDate(new Date());
    if (isStessoGiorno(oggi, dataVisualizzata)) {
        const ora = oggi.getHours();
        const minuti = oggi.getMinutes();

        const top = (ora + minuti / 60) * 60; // 60px per ora

        const indicatore = document.createElement('div');
        indicatore.className = 'current-time-indicator';
        indicatore.style.top = `${top}px`;

        const timeSlots = dayGrid.querySelectorAll('.time-slot');
        if (timeSlots[ora]) {
            timeSlots[ora].appendChild(indicatore);
        }
    }

    // Aggiungi gli event listener per aggiungere eventi
    dayGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            // Evita di aprire il modal se si è cliccato su un evento
            if (e.target.closest('.time-event')) return;

            const ora = parseInt(slot.dataset.ora);

            const data = createDate(dataVisualizzata);
            data.setHours(ora, 0, 0);

            apriModalNuovoEvento(data);
        });
    });

    // Aggiungi gli event listener agli eventi
    dayGrid.querySelectorAll('.time-event').forEach(eventElement => {
        eventElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = eventElement.dataset.id;
            apriModalEvento(id);
        });
    });

    // Inizializza il drag and drop
    if (typeof enableDragAndDrop === 'function') {
        setTimeout(enableDragAndDrop, 100);
    }
}

/**
 * views-week.js - Gestione della vista settimanale del calendario
 */

// Imports from utils.js
import {
    createDate,
    getPrimoGiornoSettimana,
    isStessoGiorno,
    formatTimeItalian
} from './utils.js';

// Imports from events.js
import {
    getEventiSettimana
} from './events.js';

// Imports from views-day.js
import {
    posizionaEventiSovrapposti
} from './views-day.js';

// Imports from views.js
import {
    apriModalEvento,
    apriModalListaEventi,
    apriModalNuovoEvento
} from './views.js';

// Imports from drag-drop.js
import {
    enableDragAndDrop
} from './drag-drop.js';

/**
 * Renderizza la vista settimanale
 */
/**
 * views-week.js - Miglioramento della funzione renderizzaVistaSettimanale
 * Risolve il problema della visualizzazione degli eventi sovrapposti
 * e mantiene la funzionalità "+X eventi"
 */
export function renderizzaVistaSettimanale() {
    const weekGrid = document.getElementById('weekGrid');
    if (!weekGrid) return;

    // Ottieni il primo giorno della settimana (lunedì)
    const inizioSettimana = getPrimoGiornoSettimana(window.dataAttuale);

    // Crea l'array dei giorni della settimana
    const giorniSettimana = [];
    for (let i = 0; i < 7; i++) {
        const giorno = createDate(inizioSettimana);
        giorno.setDate(giorno.getDate() + i);
        giorniSettimana.push(giorno);
    }

    // Crea l'intestazione della griglia settimanale
    let headerHtml = '';
    giorniSettimana.forEach(giorno => {
        const isOggi = isStessoGiorno(giorno, createDate(new Date()));
        headerHtml += `
            <div class="time-slot-header ${isOggi ? 'today' : ''}">
                <div>${['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][giorno.getDay() === 0 ? 6 : giorno.getDay() - 1]}</div>
                <div>${giorno.getDate()}</div>
            </div>
        `;
    });

    // Crea la griglia oraria
    let gridHtml = headerHtml;

    // Ottieni tutti gli eventi della settimana
    const fineSettimana = createDate(inizioSettimana);
    fineSettimana.setDate(fineSettimana.getDate() + 6);
    fineSettimana.setHours(23, 59, 59);

    const eventiSettimana = getEventiSettimana(inizioSettimana, fineSettimana);

    // Organizza gli eventi per ora e giorno
    const eventiPerCella = Array(24 * 7).fill().map(() => []);

    eventiSettimana.forEach(evento => {
        const dataInizio = createDate(evento.dataInizio);
        // Calcola il giorno della settimana (0-6, dove 0 è lunedì)
        const giornoSettimana = dataInizio.getDay() === 0 ? 6 : dataInizio.getDay() - 1;
        // Usa l'ora come indice
        const oraInizio = dataInizio.getHours();
        // Calcola l'indice della cella (ora * 7 + giorno)
        const indiceCella = oraInizio * 7 + giornoSettimana;

        // Aggiungi l'evento all'array della cella corrispondente
        if (indiceCella >= 0 && indiceCella < 24 * 7) {
            eventiPerCella[indiceCella].push(evento);
        }
    });

    // Per ogni cella, posiziona gli eventi sovrapposti
    for (let i = 0; i < eventiPerCella.length; i++) {
        if (eventiPerCella[i].length > 0) {
            eventiPerCella[i] = posizionaEventiSovrapposti(eventiPerCella[i]);
        }
    }

    // Crea le celle orarie per ogni ora e giorno
    for (let ora = 0; ora < 24; ora++) {
        for (let giorno = 0; giorno < 7; giorno++) {
            const dataOra = createDate(giorniSettimana[giorno]);
            dataOra.setHours(ora, 0, 0);

            const isOraCorrente = createDate(new Date()).getHours() === ora && isStessoGiorno(dataOra, createDate(new Date()));
            const indiceCella = ora * 7 + giorno;

            // Ottieni gli eventi per questa cella
            const eventiCella = eventiPerCella[indiceCella];

            // Crea l'HTML per gli eventi in questa cella
            let eventiHtml = '';

            // Costante per il numero massimo di eventi da mostrare direttamente
            const maxEventiVisibili = 1;

            // Mostra solo il primo evento e un indicatore se ce ne sono altri
            if (eventiCella.length > 0) {
                const primoEvento = eventiCella[0];
                const dataInizio = createDate(primoEvento.dataInizio);
                const dataFine = createDate(primoEvento.dataFine);

                // Aggiungi la classe new-event solo se l'evento è nuovo
                const newEventClass = primoEvento.isNew ? 'new-event' : '';

                // Non usiamo le colonne per un singolo evento nella vista settimanale
                // Utilizziamo l'intera larghezza della cella
                eventiHtml += `
                    <div class="time-event ${primoEvento.categoria} ${newEventClass}" data-id="${primoEvento.id}">
                        <div class="time-event-title">${primoEvento.titolo}</div>
                        <div class="time-event-time">${formatTimeItalian(dataInizio)} - ${formatTimeItalian(dataFine)}</div>
                    </div>
                `;

                // Aggiungi un indicatore se ci sono più eventi
                if (eventiCella.length > 1) {
                    eventiHtml += `
                        <div class="more-events" data-count="${eventiCella.length - 1}">
                            +${eventiCella.length - 1} altri
                        </div>
                    `;
                }
            }

            // Crea la cella con gli eventi
            gridHtml += `
                <div class="time-slot ${isOraCorrente ? 'current-time' : ''}" data-ora="${ora}" data-giorno="${giorno}" data-date="${dataOra.toISOString()}">
                    ${eventiHtml}
                </div>
            `;
        }
    }

    // Aggiorna la griglia
    weekGrid.innerHTML = gridHtml;

    // Aggiungi l'indicatore dell'ora corrente
    const oggi = createDate(new Date());
    const giornoSettimanaOggi = oggi.getDay() === 0 ? 6 : oggi.getDay() - 1;

    // Verifica se il giorno corrente è nella settimana visualizzata
    if (oggi >= giorniSettimana[0] && oggi <= giorniSettimana[6]) {
        const ora = oggi.getHours();
        const minuti = oggi.getMinutes();
        const secondi = oggi.getSeconds(); // Aggiungiamo i secondi per maggiore precisione

        // Rimuovi tutti i marker e indicatori esistenti
        document.querySelectorAll('.current-time-marker, .current-time-indicator').forEach(el => el.remove());

        // Approccio completamente diverso: crea un elemento che attraversa tutta la riga
        const timeIndicator = document.createElement('div');
        timeIndicator.className = 'current-time-indicator';
        timeIndicator.style.position = 'absolute';
        timeIndicator.style.left = '0';
        timeIndicator.style.right = '0';
        timeIndicator.style.height = '2px';
        timeIndicator.style.backgroundColor = '#f44336';
        timeIndicator.style.zIndex = '100';

        // Calcola la posizione verticale in base all'ora e ai minuti
        const hourHeight = 60; // altezza in pixel di ogni cella oraria
        const topPosition = (ora * hourHeight) +
            (minuti / 60 * hourHeight) +
            (secondi / 3600 * hourHeight) +
            50; // +50 per l'header
        timeIndicator.style.top = `${topPosition}px`;

        // Trova l'indice corretto del giorno corrente nella settimana visualizzata
        let giornoCorretto = -1;
        for (let i = 0; i < giorniSettimana.length; i++) {
            if (isStessoGiorno(oggi, giorniSettimana[i])) {
                giornoCorretto = i;
                break;
            }
        }

        // Se abbiamo trovato il giorno corrente nella settimana visualizzata
        if (giornoCorretto !== -1) {
            const dayColumns = weekGrid.querySelectorAll('.time-slot-header');
            if (dayColumns[giornoCorretto]) {
                const columnWidth = dayColumns[0].offsetWidth;
                const leftPosition = (giornoCorretto * columnWidth);
                timeIndicator.style.left = `${leftPosition}px`;
                timeIndicator.style.width = `${columnWidth}px`;

                // Aggiungi l'indicatore direttamente alla griglia
                weekGrid.style.position = 'relative';
                weekGrid.appendChild(timeIndicator);

                // Debug - aggiungi un attributo per identificare quale giorno è stato selezionato
                timeIndicator.setAttribute('data-day-index', giornoCorretto);
            }
        }
    }

    // Aggiungi gli event listener per aggiungere eventi
    weekGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            // Evita di aprire il modal se si è cliccato su un evento
            if (e.target.closest('.time-event, .more-events')) return;

            const ora = parseInt(slot.dataset.ora);
            const giorno = parseInt(slot.dataset.giorno);

            const data = createDate(giorniSettimana[giorno]);
            data.setHours(ora, 0, 0);

            apriModalNuovoEvento(data);
        });
    });

    // Aggiungi gli event listener agli eventi
    weekGrid.querySelectorAll('.time-event').forEach(eventElement => {
        eventElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = eventElement.dataset.id;
            apriModalEvento(id);
        });
    });

    // Aggiungi gli event listener agli indicatori "più eventi"
    weekGrid.querySelectorAll('.more-events').forEach(indicator => {
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            const slot = indicator.closest('.time-slot');
            const dataISOString = slot.dataset.date;

            // Ottieni la data e l'ora per questo slot
            const data = new Date(dataISOString);

            // Usa la funzione esistente apriModalListaEventi
            apriModalListaEventi(data);
        });
    });

    // Inizializza il drag and drop
    if (typeof enableDragAndDrop === 'function') {
        setTimeout(enableDragAndDrop, 100);
    }
}
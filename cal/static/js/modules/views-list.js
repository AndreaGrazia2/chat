/**
 * views-list.js - Gestione della vista lista del calendario
 */

// Imports from utils.js
import {
    formatDateItalian,
    formatTimeItalian,
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

/**
 * Renderizza la vista lista
 */
export function renderizzaVistaLista() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;

    // Ottieni tutti gli eventi del giorno
    const eventiGiorno = getEventiGiorno(window.dataAttuale);

    // Se non ci sono eventi, mostra un messaggio
    if (eventiGiorno.length === 0) {
        eventsList.innerHTML = `
            <div class="list-empty">
                <p class="empty-message">Nessun evento per ${formatDateItalian(window.dataAttuale)}.</p>
                <button class="btn btn-primary add-event-btn" id="addEventListBtn">
                    <i class="fas fa-plus"></i>
                    Aggiungi evento
                </button>
            </div>
        `;

        // Aggiungi l'event listener per aggiungere un evento
        document.getElementById('addEventListBtn').addEventListener('click', () => {
            apriModalNuovoEvento(window.dataAttuale);
        });

        return;
    }

    // Ordina gli eventi per orario
    eventiGiorno.sort((a, b) => new Date(a.dataInizio) - new Date(b.dataInizio));

    // Crea l'HTML per la lista degli eventi
    let html = `
        <div class="list-day">
            <div class="list-day-header">${formatDateItalian(window.dataAttuale)}</div>
    `;

    // Aggiungi ogni evento alla lista
    eventiGiorno.forEach(evento => {
        // Aggiungi la classe new-event solo se l'evento è nuovo
        const newEventClass = evento.isNew ? 'new-event' : '';

        html += `
            <div class="list-event ${newEventClass}" data-id="${evento.id}">
                <div class="list-event-category ${evento.categoria}"></div>
                <div class="list-event-time">
                    ${formatTimeItalian(evento.dataInizio)} - ${formatTimeItalian(evento.dataFine)}
                </div>
                <div class="list-event-content">
                    <div class="list-event-title">${evento.titolo}</div>
                    <div class="list-event-description">${evento.descrizione}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Aggiorna la lista
    eventsList.innerHTML = html;

    // Aggiungi gli event listener per gli eventi
    document.querySelectorAll('.list-event').forEach(eventElement => {
        eventElement.addEventListener('click', () => {
            const id = eventElement.dataset.id;
            apriModalEvento(id);
        });
    });
}
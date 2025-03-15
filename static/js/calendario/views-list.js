/**
 * views-list.js - Gestione della vista lista del calendario
 */

/**
 * Renderizza la vista lista
 */
function renderizzaVistaLista() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    // Ottieni tutti gli eventi del giorno
    const eventiGiorno = getEventiGiorno(dataAttuale);
    
    // Se non ci sono eventi, mostra un messaggio
    if (eventiGiorno.length === 0) {
        eventsList.innerHTML = `
            <div class="list-empty">
                <p>Nessun evento per ${formatDateItalian(dataAttuale)}.</p>
                <button class="btn btn-primary" id="addEventListBtn">
                    <i class="fas fa-plus"></i>
                    Aggiungi evento
                </button>
            </div>
        `;
        
        // Aggiungi l'event listener per aggiungere un evento
        document.getElementById('addEventListBtn').addEventListener('click', () => {
            apriModalNuovoEvento(dataAttuale);
        });
        
        return;
    }
    
    // Ordina gli eventi per orario
    eventiGiorno.sort((a, b) => new Date(a.dataInizio) - new Date(b.dataInizio));
    
    // Crea l'HTML per la lista degli eventi
    let html = `
        <div class="list-day">
            <div class="list-day-header">${formatDateItalian(dataAttuale)}</div>
    `;
    
    // Aggiungi ogni evento alla lista
    eventiGiorno.forEach(evento => {
        html += `
            <div class="list-event" data-id="${evento.id}">
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
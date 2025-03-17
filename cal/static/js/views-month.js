/**
 * views-month.js - Gestione della vista mensile del calendario
 */

/**
 * Renderizza la vista mensile
 */
function renderizzaVistaMensile() {
    const monthGrid = document.getElementById('monthGrid');
    if (!monthGrid) return;
    
    // Ottieni l'anno e il mese correnti
    const anno = dataAttuale.getFullYear();
    const mese = dataAttuale.getMonth();
    
    // Ottieni il primo giorno del mese e il numero di giorni
    const primoGiorno = getPrimoGiornoMese(anno, mese);
    const giorniTotali = getGiorniInMese(anno, mese);
    
    // Calcola il giorno della settimana del primo giorno (0 = Domenica, 1 = Lunedì, ...)
    let giornoSettimana = primoGiorno.getDay();
    giornoSettimana = giornoSettimana === 0 ? 6 : giornoSettimana - 1; // Converti in formato europeo (0 = Lunedì, 6 = Domenica)
    
    // Prepara l'HTML per la griglia
    let html = '';
    
    // Aggiungi i giorni del mese precedente
    const mesePrecedente = mese === 0 ? 11 : mese - 1;
    const annoPrecedente = mese === 0 ? anno - 1 : anno;
    const giorniMesePrecedente = getGiorniInMese(annoPrecedente, mesePrecedente);
    
    for (let i = 0; i < giornoSettimana; i++) {
        const giorno = giorniMesePrecedente - giornoSettimana + i + 1;
        const data = new Date(annoPrecedente, mesePrecedente, giorno);
        const eventiGiorno = getEventiGiorno(data);
        
        html += `
            <div class="calendar-day other-month" data-date="${annoPrecedente}-${mesePrecedente + 1}-${giorno}">
                <div class="day-number">${giorno}</div>
                <div class="day-events">
                    ${renderizzaEventiGiorno(eventiGiorno, 2)}
                </div>
            </div>
        `;
    }
    
    // Aggiungi i giorni del mese corrente
    const oggi = new Date();
    
    for (let i = 1; i <= giorniTotali; i++) {
        const isOggi = oggi.getDate() === i && oggi.getMonth() === mese && oggi.getFullYear() === anno;
        const data = new Date(anno, mese, i);
        const eventiGiorno = getEventiGiorno(data);
        
        html += `
            <div class="calendar-day ${isOggi ? 'today' : ''}" data-date="${anno}-${mese + 1}-${i}">
                <div class="day-number">${i}</div>
                <div class="day-events">
                    ${renderizzaEventiGiorno(eventiGiorno, 3)}
                </div>
            </div>
        `;
    }
    
    // Aggiungi i giorni del mese successivo
    const giorniTotaliMostrati = giornoSettimana + giorniTotali;
    const giorniRimanenti = 42 - giorniTotaliMostrati; // 42 = 6 righe x 7 giorni
    
    const meseSuccessivo = mese === 11 ? 0 : mese + 1;
    const annoSuccessivo = mese === 11 ? anno + 1 : anno;
    
    for (let i = 1; i <= giorniRimanenti; i++) {
        const data = new Date(annoSuccessivo, meseSuccessivo, i);
        const eventiGiorno = getEventiGiorno(data);
        
        html += `
            <div class="calendar-day other-month" data-date="${annoSuccessivo}-${meseSuccessivo + 1}-${i}">
                <div class="day-number">${i}</div>
                <div class="day-events">
                    ${renderizzaEventiGiorno(eventiGiorno, 2)}
                </div>
            </div>
        `;
    }
    
    // Aggiorna la griglia
    monthGrid.innerHTML = html;
    
    // Aggiungi gli event listener per gli eventi
    document.querySelectorAll('.event').forEach(eventElement => {
        eventElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = eventElement.dataset.id;
            apriModalEvento(id);
        });
    });
    
    // Aggiungi gli event listener per "più eventi"
    document.querySelectorAll('.more-events').forEach(moreElement => {
        moreElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const dataStr = moreElement.closest('.calendar-day').dataset.date;
            const [anno, mese, giorno] = dataStr.split('-').map(Number);
            const data = new Date(anno, mese - 1, giorno);
            console.log('Cliccato su più eventi:', data);
            apriModalListaEventi(data);
        });
    });
    
    // Aggiungi gli event listener per i giorni (per aggiungere eventi)
    document.querySelectorAll('.calendar-day').forEach(dayElement => {
        dayElement.addEventListener('click', () => {
            const dataStr = dayElement.dataset.date;
            const [anno, mese, giorno] = dataStr.split('-').map(Number);
            const data = new Date(anno, mese - 1, giorno);
            apriModalNuovoEvento(data);
        });
    });
    
    // Nota: la gestione drag and drop è stata spostata nel modulo centralizzato
}

/**
 * Renderizza gli eventi di un giorno nella vista mensile
 * @param {Array} eventi - Eventi del giorno
 * @param {number} maxEventi - Numero massimo di eventi da mostrare
 * @returns {string} - HTML degli eventi
 */
function renderizzaEventiGiorno(eventi, maxEventi = 3) {
    if (!eventi || eventi.length === 0) return '';
    
    let html = '';
    
    // Mostra solo il numero specificato di eventi
    const eventiDaMostrare = eventi.slice(0, maxEventi);
    
    // Crea l'HTML per ogni evento
    eventiDaMostrare.forEach(evento => {
        // Aggiungi la classe new-event solo se l'evento è nuovo
        const newEventClass = evento.isNew ? 'new-event' : '';
        
        html += `
            <div class="event ${evento.categoria} ${newEventClass}" data-id="${evento.id}">
                ${formatTimeItalian(evento.dataInizio)} - ${evento.titolo}
            </div>
        `;
    });
    
    // Se ci sono più eventi di quelli mostrati, aggiungi un link "più eventi"
    if (eventi.length > maxEventi) {
        html += `<div class="more-events">+${eventi.length - maxEventi} altri</div>`;
    }
    
    return html;
}

// Funzione di supporto per la vista mensile
function renderMonthView(date = new Date()) {
    // Assicurati che dataAttuale sia impostata correttamente
    dataAttuale = date || dataAttuale;
    
    // Renderizza la vista
    renderizzaVistaMensile();
}
/**
 * views-day.js - Gestione della vista giornaliera del calendario
 */

/**
 * Renderizza la vista giornaliera
 */
function renderizzaVistaGiornaliera() {
    const dayGrid = document.getElementById('dayGrid');
    if (!dayGrid) return;
    
    // Crea l'intestazione della griglia giornaliera
    const isOggi = isStessoGiorno(dataAttuale, new Date());
    let headerHtml = `
        <div class="time-slot-header ${isOggi ? 'today' : ''}">
            <div>${['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'][dataAttuale.getDay() === 0 ? 6 : dataAttuale.getDay() - 1]}</div>
            <div>${dataAttuale.getDate()}</div>
        </div>
    `;
    
    // Ottieni tutti gli eventi del giorno
    const eventiGiorno = getEventiGiorno(dataAttuale);
    
    // Organizza gli eventi per ora
    const eventiPerOra = Array(25).fill().map(() => []);
    
    eventiGiorno.forEach(evento => {
        const dataInizio = new Date(evento.dataInizio);
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
        const dataOra = new Date(dataAttuale);
        dataOra.setHours(ora, 0, 0);
        
        const isOraCorrente = new Date().getHours() === ora && isStessoGiorno(dataOra, new Date());
        
        // Ottieni gli eventi per questa ora
        const eventiOra = eventiPerOra[ora];
        
        // Crea l'HTML per gli eventi in questa ora
        let eventiHtml = '';
        eventiOra.forEach(evento => {
            const dataInizio = new Date(evento.dataInizio);
            const dataFine = new Date(evento.dataFine);
            
            // Aggiungi la classe new-event solo se l'evento è nuovo
            const newEventClass = evento.isNew ? 'new-event' : '';
            
            eventiHtml += `
                <div class="time-event ${evento.categoria} ${newEventClass}" data-id="${evento.id}">
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
    const oggi = new Date();
    if (isStessoGiorno(oggi, dataAttuale)) {
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
            
            const data = new Date(dataAttuale);
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
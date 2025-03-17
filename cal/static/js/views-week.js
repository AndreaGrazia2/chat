/**
 * views-week.js - Gestione della vista settimanale del calendario
 */

/**
 * Renderizza la vista settimanale
 */
function renderizzaVistaSettimanale() {
    const weekGrid = document.getElementById('weekGrid');
    if (!weekGrid) return;
    
    // Ottieni il primo giorno della settimana (lunedì)
    const inizioSettimana = getPrimoGiornoSettimana(dataAttuale);
    
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
            eventiCella.forEach(evento => {
                const dataInizio = createDate(evento.dataInizio);
                const dataFine = createDate(evento.dataFine);
                
                // Aggiungi la classe new-event solo se l'evento è nuovo
                const newEventClass = evento.isNew ? 'new-event' : '';
                
                eventiHtml += `
                    <div class="time-event ${evento.categoria} ${newEventClass}" data-id="${evento.id}">
                        <div class="time-event-title">${evento.titolo}</div>
                        <div class="time-event-time">${formatTimeItalian(dataInizio)} - ${formatTimeItalian(dataFine)}</div>
                    </div>
                `;
            });
            
            // Crea la cella con gli eventi
            gridHtml += `
                <div class="time-slot ${isOraCorrente ? 'current-time' : ''}" data-ora="${ora}" data-giorno="${giorno}">
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
    if (isStessoGiorno(oggi, giorniSettimana[0]) || 
        isStessoGiorno(oggi, giorniSettimana[1]) || 
        isStessoGiorno(oggi, giorniSettimana[2]) || 
        isStessoGiorno(oggi, giorniSettimana[3]) || 
        isStessoGiorno(oggi, giorniSettimana[4]) || 
        isStessoGiorno(oggi, giorniSettimana[5]) || 
        isStessoGiorno(oggi, giorniSettimana[6])) {
        
        const ora = oggi.getHours();
        const minuti = oggi.getMinutes();
        
        const top = (ora + minuti / 60) * 60; // 60px per ora
        
        const indicatore = document.createElement('div');
        indicatore.className = 'current-time-indicator';
        indicatore.style.top = `${top}px`;
        
        const timeSlots = weekGrid.querySelectorAll('.time-slot');
        const index = giornoSettimanaOggi + (ora * 7);
        if (timeSlots[index]) {
            timeSlots[index].appendChild(indicatore);
        }
    }
    
    // Aggiungi gli event listener per aggiungere eventi
    weekGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            // Evita di aprire il modal se si è cliccato su un evento
            if (e.target.closest('.time-event')) return;
            
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
    
    // Inizializza il drag and drop
    if (typeof enableDragAndDrop === 'function') {
        setTimeout(enableDragAndDrop, 100);
    }
}

// Funzione di supporto per la vista settimanale
function renderWeekView(date = new Date()) {
    // Assicurati che dataAttuale sia impostata correttamente
    dataAttuale = createDate(date) || dataAttuale;
    
    // Renderizza la vista
    renderizzaVistaSettimanale();
}
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
        const giorno = new Date(inizioSettimana);
        giorno.setDate(giorno.getDate() + i);
        giorniSettimana.push(giorno);
    }
    
    // Crea l'intestazione della griglia settimanale
    let headerHtml = '';
    giorniSettimana.forEach(giorno => {
        const isOggi = isStessoGiorno(giorno, new Date());
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
    const fineSettimana = new Date(inizioSettimana);
    fineSettimana.setDate(fineSettimana.getDate() + 6);
    fineSettimana.setHours(23, 59, 59);
    
    const eventiSettimana = getEventiSettimana(inizioSettimana, fineSettimana);
    
    // Crea le celle orarie per ogni ora e giorno
    for (let ora = 0; ora < 24; ora++) {
        for (let giorno = 0; giorno < 7; giorno++) {
            const dataOra = new Date(giorniSettimana[giorno]);
            dataOra.setHours(ora, 0, 0);
            
            const isOraCorrente = new Date().getHours() === ora && isStessoGiorno(dataOra, new Date());
            
            gridHtml += `<div class="time-slot ${isOraCorrente ? 'current-time' : ''}" data-ora="${ora}" data-giorno="${giorno}"></div>`;
        }
    }
    
    // Aggiorna la griglia
    weekGrid.innerHTML = gridHtml;
    
    // Aggiungi gli eventi alla griglia
    eventiSettimana.forEach(evento => {
        const dataInizio = new Date(evento.dataInizio);
        const dataFine = new Date(evento.dataFine);
        
        // Calcola il giorno della settimana (0-6, dove 0 è lunedì)
        const giornoSettimana = dataInizio.getDay() === 0 ? 6 : dataInizio.getDay() - 1;
        
        // Calcola la posizione e l'altezza dell'evento
        const oraInizio = dataInizio.getHours();
        const minInizio = dataInizio.getMinutes();
        const oraFine = dataFine.getHours();
        const minFine = dataFine.getMinutes();
        
        const top = (oraInizio + minInizio / 60) * 60; // 60px per ora
        const height = ((oraFine - oraInizio) + (minFine - minInizio) / 60) * 60;
        
        // Crea l'elemento dell'evento
        const eventoElement = document.createElement('div');
        eventoElement.className = `time-event ${evento.categoria}`;
        eventoElement.dataset.id = evento.id;
        eventoElement.style.top = `${top}px`;
        eventoElement.style.height = `${height}px`;
        eventoElement.innerHTML = `
            <div class="time-event-title">${evento.titolo}</div>
            <div class="time-event-time">${formatTimeItalian(dataInizio)} - ${formatTimeItalian(dataFine)}</div>
            <div class="time-event-description">${evento.descrizione || ''}</div>
        `;
        
        // Aggiungi l'evento alla cella corrispondente
        const timeSlots = weekGrid.querySelectorAll('.time-slot');
        const index = giornoSettimana + (oraInizio * 7);
        if (timeSlots[index]) {
            timeSlots[index].appendChild(eventoElement);
        }
        
        // Aggiungi l'event listener per aprire il modal dell'evento
        eventoElement.addEventListener('click', (e) => {
            e.stopPropagation();
            apriModalEvento(evento.id);
        });
    });
    
    // Aggiungi l'indicatore dell'ora corrente
    const oggi = new Date();
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
        slot.addEventListener('click', () => {
            const ora = parseInt(slot.dataset.ora);
            const giorno = parseInt(slot.dataset.giorno);
            
            const data = new Date(giorniSettimana[giorno]);
            data.setHours(ora, 0, 0);
            
            apriModalNuovoEvento(data);
        });
    });
    
    // Nota: la gestione drag and drop è stata spostata nel modulo centralizzato
}

// Funzione di supporto per la vista settimanale
function renderWeekView(date = new Date()) {
    // Assicurati che dataAttuale sia impostata correttamente
    dataAttuale = date || dataAttuale;
    
    // Renderizza la vista
    renderizzaVistaSettimanale();
}
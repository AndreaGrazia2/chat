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
        html += `
            <div class="event ${evento.categoria}" data-id="${evento.id}">
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
        eventoElement.className = `time-event ${evento.categoria} draggable`;
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
        
        // Aggiungi funzionalità di drag and drop
        eventoElement.setAttribute('draggable', 'true');
        eventoElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', evento.id);
            e.dataTransfer.effectAllowed = 'move';
            eventoElement.classList.add('dragging');
            
            // Crea un'immagine fantasma per il trascinamento
            const ghost = eventoElement.cloneNode(true);
            ghost.classList.add('drag-ghost');
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            
            setTimeout(() => {
                ghost.remove();
            }, 0);
        });
        
        eventoElement.addEventListener('dragend', () => {
            eventoElement.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
    });
    
    // Aggiungi l'indicatore dell'ora corrente
    const oggi = new Date();
    if (isStessoGiorno(oggi, giorniSettimana[0]) || isStessoGiorno(oggi, giorniSettimana[6])) {
        const giornoSettimana = oggi.getDay() === 0 ? 6 : oggi.getDay() - 1;
        const ora = oggi.getHours();
        const minuti = oggi.getMinutes();
        
        const top = (ora + minuti / 60) * 60; // 60px per ora
        
        const indicatore = document.createElement('div');
        indicatore.className = 'current-time-indicator';
        indicatore.style.top = `${top}px`;
        
        const timeSlots = weekGrid.querySelectorAll('.time-slot');
        const index = giornoSettimana + (ora * 7);
        if (timeSlots[index]) {
            timeSlots[index].appendChild(indicatore);
        }
    }
    
    // Aggiungi gli event listener per aggiungere eventi e drag and drop
    weekGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const ora = parseInt(slot.dataset.ora);
            const giorno = parseInt(slot.dataset.giorno);
            
            const data = new Date(giorniSettimana[giorno]);
            data.setHours(ora, 0, 0);
            
            apriModalNuovoEvento(data);
        });
        
        // Aggiungi funzionalità di drag and drop
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            const id = e.dataTransfer.getData('text/plain');
            const ora = parseInt(slot.dataset.ora);
            const giorno = parseInt(slot.dataset.giorno);
            
            // Trova l'evento e aggiorna l'orario
            const evento = eventi.find(e => e.id === id);
            if (evento) {
                const nuovaDataInizio = new Date(giorniSettimana[giorno]);
                nuovaDataInizio.setHours(ora, 0, 0);
                
                const durata = (new Date(evento.dataFine) - new Date(evento.dataInizio)) / (1000 * 60); // durata in minuti
                
                const nuovaDataFine = new Date(nuovaDataInizio);
                nuovaDataFine.setMinutes(nuovaDataFine.getMinutes() + durata);
                
                modificaEvento(id, {
                    dataInizio: nuovaDataInizio,
                    dataFine: nuovaDataFine
                });
                
                renderizzaVistaSettimanale();
            }
        });
    });
}

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
    
    // Crea la griglia oraria
    let gridHtml = headerHtml;
    
    // Ottieni tutti gli eventi del giorno
    const eventiGiorno = getEventiGiorno(dataAttuale);
    
    // Crea le celle orarie per ogni ora
    for (let ora = 0; ora < 25; ora++) {
        const dataOra = new Date(dataAttuale);
        dataOra.setHours(ora, 0, 0);
        
        const isOraCorrente = new Date().getHours() === ora && isStessoGiorno(dataOra, new Date());
        
        gridHtml += `<div class="time-slot ${isOraCorrente ? 'current-time' : ''}" data-ora="${ora}"></div>`;
    }
    
    // Aggiorna la griglia
    dayGrid.innerHTML = gridHtml;
    
    // Aggiungi gli eventi alla griglia
    eventiGiorno.forEach(evento => {
        const dataInizio = new Date(evento.dataInizio);
        const dataFine = new Date(evento.dataFine);
        
        // Calcola la posizione e l'altezza dell'evento
        const oraInizio = dataInizio.getHours();
        const minInizio = dataInizio.getMinutes();
        const oraFine = dataFine.getHours();
        const minFine = dataFine.getMinutes();
        
        const top = (oraInizio + minInizio / 60) * 60; // 60px per ora
        const height = ((oraFine - oraInizio) + (minFine - minInizio) / 60) * 60;
        
        // Crea l'elemento dell'evento
        const eventoElement = document.createElement('div');
        eventoElement.className = `time-event ${evento.categoria} draggable`;
        eventoElement.dataset.id = evento.id;
        eventoElement.style.top = `${top}px`;
        eventoElement.style.height = `${height}px`;
        eventoElement.innerHTML = `
            <div class="time-event-title">${evento.titolo}</div>
            <div class="time-event-time">${formatTimeItalian(dataInizio)} - ${formatTimeItalian(dataFine)}</div>
            <div class="time-event-description">${evento.descrizione || ''}</div>
        `;
        
        // Aggiungi l'evento alla cella corrispondente
        const timeSlots = dayGrid.querySelectorAll('.time-slot');
        if (timeSlots[oraInizio]) {
            timeSlots[oraInizio].appendChild(eventoElement);
            
            // Gestisci la sovrapposizione di eventi
            const eventiSovrapposti = Array.from(timeSlots[oraInizio].querySelectorAll('.time-event')).filter(el => {
                if (el === eventoElement) return false;
                const elTop = parseInt(el.style.top.replace('px', ''));
                const elHeight = parseInt(el.style.height.replace('px', ''));
                const elBottom = elTop + elHeight;
                
                const thisTop = top;
                const thisBottom = top + height;
                
                return (thisTop < elBottom && thisBottom > elTop);
            });
            
            if (eventiSovrapposti.length > 0) {
                const width = 100 / (eventiSovrapposti.length + 1);
                let leftOffset = 0;
                
                eventiSovrapposti.forEach((el, index) => {
                    el.style.width = `${width}%`;
                    el.style.left = `${leftOffset}%`;
                    leftOffset += width;
                });
                
                eventoElement.style.width = `${width}%`;
                eventoElement.style.left = `${leftOffset}%`;
            }
        }
        
        // Aggiungi l'event listener per aprire il modal dell'evento
        eventoElement.addEventListener('click', (e) => {
            e.stopPropagation();
            apriModalEvento(evento.id);
        });
        
        // Aggiungi funzionalità di drag and drop
        eventoElement.setAttribute('draggable', 'true');
        eventoElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', evento.id);
            e.dataTransfer.effectAllowed = 'move';
            eventoElement.classList.add('dragging');
            
            // Crea un'immagine fantasma per il trascinamento
            const ghost = eventoElement.cloneNode(true);
            ghost.classList.add('drag-ghost');
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            
            setTimeout(() => {
                ghost.remove();
            }, 0);
        });
        
        eventoElement.addEventListener('dragend', () => {
            eventoElement.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        
        // Aggiungi funzionalità di drag and drop
        eventoElement.setAttribute('draggable', 'true');
        eventoElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', evento.id);
            e.dataTransfer.effectAllowed = 'move';
            eventoElement.classList.add('dragging');
            
            // Crea un'immagine fantasma per il trascinamento
            const ghost = eventoElement.cloneNode(true);
            ghost.classList.add('drag-ghost');
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            
            setTimeout(() => {
                ghost.remove();
            }, 0);
        });
        
        eventoElement.addEventListener('dragend', () => {
            eventoElement.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
    });
    
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
        slot.addEventListener('click', () => {
            const ora = parseInt(slot.dataset.ora);
            
            const data = new Date(dataAttuale);
            data.setHours(ora, 0, 0);
            
            apriModalNuovoEvento(data);
        });
        
        // Aggiungi funzionalità di drag and drop
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            
            const id = e.dataTransfer.getData('text/plain');
            const ora = parseInt(slot.dataset.ora);
            
            // Trova l'evento e aggiorna l'orario
            const evento = eventi.find(e => e.id === id);
            if (evento) {
                const nuovaDataInizio = new Date(dataAttuale);
                nuovaDataInizio.setHours(ora, 0, 0);
                
                const durata = (new Date(evento.dataFine) - new Date(evento.dataInizio)) / (1000 * 60); // durata in minuti
                
                const nuovaDataFine = new Date(nuovaDataInizio);
                nuovaDataFine.setMinutes(nuovaDataFine.getMinutes() + durata);
                
                modificaEvento(id, {
                    dataInizio: nuovaDataInizio,
                    dataFine: nuovaDataFine
                });
                
                renderizzaVistaGiornaliera();
            }
        });
    });
}

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

/**
 * Apre il modal per visualizzare/modificare un evento
 * @param {string} id - ID dell'evento
 */
function apriModalEvento(id) {
    console.log("Apertura modal per evento:", id); // Aggiungi questo log
    const evento = eventi.find(e => e.id === id);
    if (!evento) return;
    
    // Aggiorna il titolo del modal
    document.getElementById('modalTitle').textContent = 'Modifica Evento';
    
    // Compila il form con i dati dell'evento
    document.getElementById('eventTitle').value = evento.titolo;
    document.getElementById('eventDescription').value = evento.descrizione;
    
    const dataInizio = new Date(evento.dataInizio);
    const dataFine = new Date(evento.dataFine);
    
    document.getElementById('eventDate').value = dataInizio.toISOString().split('T')[0];
    document.getElementById('eventTime').value = dataInizio.toTimeString().substring(0, 5);
    document.getElementById('eventEndDate').value = dataFine.toISOString().split('T')[0];
    document.getElementById('eventEndTime').value = dataFine.toTimeString().substring(0, 5);
    document.getElementById('eventCategory').value = evento.categoria;
    
    // Mostra il pulsante elimina
    const footerElement = document.querySelector('.modal-footer');
    if (!document.getElementById('deleteEvent')) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-text delete';
        deleteButton.id = 'deleteEvent';
        deleteButton.textContent = 'Elimina';
        footerElement.insertBefore(deleteButton, document.getElementById('cancelEvent'));
        
        // Aggiungi l'event listener per eliminare l'evento
        deleteButton.addEventListener('click', () => {
            eliminaEvento(id);
            chiudiModal('eventModal');
        });
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
        
        // Crea le date
        const dataInizio = new Date(`${data}T${ora}`);
        const dataFinale = new Date(`${dataFine}T${oraFine}`);
        
        // Aggiorna l'evento
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
 * Apre il modal per creare un nuovo evento
 * @param {Date} data - Data iniziale per l'evento
 */
function apriModalNuovoEvento(data) {
    // Aggiorna il titolo del modal
    document.getElementById('modalTitle').textContent = 'Nuovo Evento';
    
    // Resetta il form
    document.getElementById('eventForm').reset();
    
    // Imposta la data e l'ora iniziale
    const dataStr = data.toISOString().split('T')[0];
    const oraStr = data.toTimeString().substring(0, 5);
    
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
        modal.classList.add('active');
    }
}

/**
 * Chiude un modal
 * @param {string} modalId - ID del modal da chiudere
 */
function chiudiModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Aggiorna tutte le viste del calendario
 */
function aggiornaViste() {
    renderizzaMiniCalendario();
    aggiornaVista();
}
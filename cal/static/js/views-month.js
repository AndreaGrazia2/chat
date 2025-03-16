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
    
    // Dopo aver aggiunto gli eventi alla griglia, aggiungi la funzionalità di drag & drop
    document.querySelectorAll('.event').forEach(eventoElement => {
        // Rimuovi eventuali listener precedenti per evitare duplicati
        eventoElement.removeEventListener('click', eventoElement.clickHandler);
        
        // Rendi l'evento trascinabile
        eventoElement.setAttribute('draggable', 'true');
        
        // Variabile per tenere traccia se stiamo trascinando o cliccando
        let isDragging = false;
        
        eventoElement.addEventListener('dragstart', (e) => {
            isDragging = true;
            e.stopPropagation(); // Impedisce che l'evento si propaghi al calendario
            e.dataTransfer.setData('text/plain', eventoElement.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            eventoElement.classList.add('dragging');
            
            // Aggiungi un ritardo per evitare conflitti con il click
            setTimeout(() => {
                document.querySelectorAll('.calendar-day').forEach(day => {
                    day.classList.add('droppable');
                });
            }, 0);
        });
        
        eventoElement.addEventListener('dragend', (e) => {
            e.stopPropagation();
            eventoElement.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.droppable').forEach(el => el.classList.remove('droppable'));
            
            // Resettiamo isDragging dopo un breve ritardo
            setTimeout(() => {
                isDragging = false;
            }, 100);
        });
        
        // Salva il gestore di click come proprietà dell'elemento per poterlo rimuovere in seguito
        eventoElement.clickHandler = (e) => {
            e.stopPropagation();
            if (!isDragging) {
                const id = eventoElement.dataset.id;
                apriModalEvento(id);
            }
        };
        
        eventoElement.addEventListener('click', eventoElement.clickHandler);
    });
    
    // Aggiungi gli event listener per il drop sulle celle del calendario
    document.querySelectorAll('.calendar-day').forEach(day => {
        // Rimuovi eventuali listener precedenti
        day.removeEventListener('dragover', day.dragoverHandler);
        day.removeEventListener('dragleave', day.dragleaveHandler);
        day.removeEventListener('drop', day.dropHandler);
        
        day.dragoverHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            day.classList.add('drag-over');
        };
        
        day.dragleaveHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            day.classList.remove('drag-over');
        };
        
        day.dropHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            day.classList.remove('drag-over');
            
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return; // Assicuriamoci che ci sia un ID
            
            // Ottieni la data del giorno di destinazione
            const dataStr = day.dataset.date;
            if (!dataStr) return;
            
            const [anno, mese, giorno] = dataStr.split('-').map(Number);
            const dataGiorno = new Date(anno, mese - 1, giorno);
            
            if (!dataGiorno || isNaN(dataGiorno.getTime())) return; // Verifica che la data sia valida
            
            // Trova l'evento e aggiorna la data
            const evento = eventi.find(e => e.id === id);
            if (evento) {
                // Calcola la differenza di giorni
                const vecchiaData = new Date(evento.dataInizio);
                const differenzaGiorni = Math.floor((dataGiorno - vecchiaData) / (1000 * 60 * 60 * 24));
                
                // Aggiorna le date mantenendo l'ora originale
                const nuovaDataInizio = new Date(evento.dataInizio);
                nuovaDataInizio.setDate(nuovaDataInizio.getDate() + differenzaGiorni);
                
                const nuovaDataFine = new Date(evento.dataFine);
                nuovaDataFine.setDate(nuovaDataFine.getDate() + differenzaGiorni);
                
                // Modifica l'evento
                modificaEvento(id, {
                    dataInizio: nuovaDataInizio,
                    dataFine: nuovaDataFine
                });
                
                // Aggiorna la vista
                renderizzaVistaMensile();
                
                // Feedback visivo
                console.log(`Evento spostato: ${evento.titolo} -> ${formatDateItalian(nuovaDataInizio)}`);
            }
        };
        
        day.addEventListener('dragover', day.dragoverHandler);
        day.addEventListener('dragleave', day.dragleaveHandler);
        day.addEventListener('drop', day.dropHandler);
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

function renderMonthView() {
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

function renderMonthView(date = new Date()) {
    const currentDate = date || new Date();
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
        
        // Quando crei i giorni del mese, assicurati che l'attributo data-date sia nel formato corretto
        const day = document.createElement('div');
        day.classList.add('day');
        
        // Formatta la data nel formato YYYY-MM-DD
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const date = currentDate.getDate().toString().padStart(2, '0');
        const formattedDate = `${year}-${month}-${date}`;
        
        day.setAttribute('data-date', formattedDate);
        
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
}
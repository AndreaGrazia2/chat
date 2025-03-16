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
    
    // Aggiungi gli event listener per aggiungere eventi (solo click)
    dayGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const ora = parseInt(slot.dataset.ora);
            
            const data = new Date(dataAttuale);
            data.setHours(ora, 0, 0);
            
            apriModalNuovoEvento(data);
        });
        
        // RIMOSSO: Tutta la logica di drag and drop (dragover, dragleave, drop)
        // Questa viene gestita centralmente in drag-drop.js
    });
}
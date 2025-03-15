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
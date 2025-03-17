/**
 * utils.js - Funzioni di utilità per il calendario
 */

/**
 * Formatta una data nel formato italiano (es. "Lunedì, 15 Marzo 2025")
 * @param {Date} date - Data da formattare
 * @param {boolean} includeWeekday - Se includere il giorno della settimana
 * @returns {string} - Data formattata
 */
function formatDateItalian(date, includeWeekday = true) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    const giorno = date.getDate();
    const mese = mesi[date.getMonth()];
    const anno = date.getFullYear();
    
    if (includeWeekday) {
        const giornoSettimana = giorni[date.getDay()];
        return `${giornoSettimana}, ${giorno} ${mese} ${anno}`;
    } else {
        return `${giorno} ${mese} ${anno}`;
    }
}

/**
 * Formatta un orario nel formato italiano (es. "14:30")
 * @param {Date} date - Data da formattare
 * @returns {string} - Orario formattato
 */
function formatTimeItalian(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    const ore = date.getHours().toString().padStart(2, '0');
    const minuti = date.getMinutes().toString().padStart(2, '0');
    
    return `${ore}:${minuti}`;
}

/**
 * Formatta una data e un orario nel formato italiano (es. "15 Marzo 2025, 14:30")
 * @param {Date} date - Data da formattare
 * @returns {string} - Data e orario formattati
 */
function formatDateTimeItalian(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    return `${formatDateItalian(date, false)}, ${formatTimeItalian(date)}`;
}

/**
 * Ottiene il primo giorno del mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {Date} - Primo giorno del mese
 */
function getPrimoGiornoMese(anno, mese) {
    return new Date(anno, mese, 1);
}

/**
 * Ottiene l'ultimo giorno del mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {Date} - Ultimo giorno del mese
 */
function getUltimoGiornoMese(anno, mese) {
    return new Date(anno, mese + 1, 0);
}

/**
 * Ottiene il numero di giorni in un mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {number} - Numero di giorni nel mese
 */
function getGiorniInMese(anno, mese) {
    return new Date(anno, mese + 1, 0).getDate();
}

/**
 * Ottiene il primo giorno della settimana (lunedì) per una data
 * @param {Date} date - Data di riferimento
 * @returns {Date} - Primo giorno della settimana (lunedì)
 */
function getPrimoGiornoSettimana(date) {
    const giorno = date.getDay();
    const diff = date.getDate() - giorno + (giorno === 0 ? -6 : 1); // Aggiusta per iniziare da lunedì
    return new Date(date.setDate(diff));
}

/**
 * Controlla se due date sono nello stesso giorno
 * @param {Date} date1 - Prima data
 * @param {Date} date2 - Seconda data
 * @returns {boolean} - True se le date sono nello stesso giorno
 */
function isStessoGiorno(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Genera un ID univoco per gli eventi, verificando che non sia già in uso
 * @returns {string} - ID univoco
 */
function generateUniqueId() {
    let id;
    let isUnique = false;
    
    // Continua a generare ID finché non ne troviamo uno univoco
    while (!isUnique) {
        // Genera un ID combinando timestamp e numeri casuali
        id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        // Verifica che questo ID non sia già in uso
        isUnique = eventi.every(evento => evento.id !== id);
    }
    
    return id;
}

/**
 * Mostra una notifica all'utente
 * @param {string} messaggio - Messaggio da mostrare
 * @param {string} tipo - Tipo di notifica (success, error, warning)
 */
function mostraNotifica(messaggio, tipo = '') {
    const notifica = document.createElement('div');
    notifica.className = `notification ${tipo}`;
    notifica.textContent = messaggio;
    
    document.body.appendChild(notifica);
    
    // Mostra la notifica
    setTimeout(() => {
        notifica.classList.add('show');
    }, 10);
    
    // Rimuovi la notifica dopo 3 secondi
    setTimeout(() => {
        notifica.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notifica);
        }, 300);
    }, 3000);
}

/**
 * Calcola la posizione e l'altezza di un evento nella vista giornaliera o settimanale
 * @param {Object} evento - Evento da posizionare
 * @param {Date} inizioGiornata - Inizio della giornata
 * @returns {Object} - Posizione e altezza dell'evento
 */
function calcolaPosizioneEvento(evento, inizioGiornata) {
    const oraInizio = new Date(evento.dataInizio);
    const oraFine = new Date(evento.dataFine);
    
    // Calcola la posizione dall'inizio della giornata (in minuti)
    const inizioMinuti = (oraInizio.getHours() * 60) + oraInizio.getMinutes();
    const fineMinuti = (oraFine.getHours() * 60) + oraFine.getMinutes();
    
    // Converti in percentuale (1440 minuti in un giorno)
    const top = (inizioMinuti / 1440) * 100;
    const height = ((fineMinuti - inizioMinuti) / 1440) * 100;
    
    return {
        top: `${top}%`,
        height: `${height}%`
    };
}

/**
 * Aggiunge ore a una data
 * @param {Date} date - Data di partenza
 * @param {number} hours - Numero di ore da aggiungere
 * @returns {Date} - Nuova data
 */
function addHour(date, hours) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    return newDate;
}
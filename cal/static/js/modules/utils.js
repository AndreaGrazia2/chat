/**
 * utils.js - Funzioni di utilità per il calendario
 */

/**
 * Formatta una data nel formato italiano (es. "Lunedì, 15 Marzo 2025")
 * @param {Date} date - Data da formattare
 * @param {boolean} includeWeekday - Se includere il giorno della settimana
 * @returns {string} - Data formattata
 */
export function formatDateItalian(date, includeWeekday = true) {
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
export function formatTimeItalian(date) {
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
export function formatDateTimeItalian(date) {
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
export function getPrimoGiornoMese(anno, mese) {
    return new Date(anno, mese, 1);
}

/**
 * Ottiene l'ultimo giorno del mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {Date} - Ultimo giorno del mese
 */
export function getUltimoGiornoMese(anno, mese) {
    return new Date(anno, mese + 1, 0);
}

/**
 * Ottiene il numero di giorni in un mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {number} - Numero di giorni nel mese
 */
export function getGiorniInMese(anno, mese) {
    return new Date(anno, mese + 1, 0).getDate();
}

/**
 * Ottiene il primo giorno della settimana (lunedì) per una data
 * @param {Date} date - Data di riferimento
 * @returns {Date} - Primo giorno della settimana (lunedì)
 */
export function getPrimoGiornoSettimana(date) {
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
export function isStessoGiorno(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

/**
 * Genera un ID univoco per gli eventi, verificando che non sia già in uso
 * @returns {string} - ID univoco
 */
export function generateUniqueId() {
    let id;
    let isUnique = false;

    // Continua a generare ID finché non ne troviamo uno univoco
    while (!isUnique) {
        // Genera un ID combinando timestamp e numeri casuali
        id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Verifica che questo ID non sia già in uso
        isUnique = window.eventi.every(evento => evento.id !== id);
    }

    return id;
}

/**
 * Mostra una notifica all'utente
 * @param {string} messaggio - Messaggio da mostrare
 * @param {string} tipo - Tipo di notifica (success, error, warning)
 */
export function mostraNotifica(messaggio, tipo = '') {
    const notifica = document.createElement('div');
    notifica.className = `notification ${tipo}`;
    notifica.textContent = messaggio;

    // Controlla se esiste già il container delle notifiche
    let notificationContainer = document.getElementById('notification-container');
    
    // Se non esiste, crealo
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '10px';
        notificationContainer.style.right = '10px';
        notificationContainer.style.zIndex = '1000';
        document.body.appendChild(notificationContainer);
    }
    
    // Aggiungi la notifica al container invece che direttamente al body
    notificationContainer.appendChild(notifica);

    // Mostra la notifica
    setTimeout(() => {
        notifica.classList.add('show');
    }, 10);

    // Rimuovi la notifica dopo 3 secondi
    setTimeout(() => {
        notifica.classList.remove('show');
        setTimeout(() => {
            notificationContainer.removeChild(notifica);
            
            // Se non ci sono più notifiche, rimuovi il container
            if (notificationContainer.children.length === 0) {
                document.body.removeChild(notificationContainer);
            }
        }, 300);
    }, 3000);
}

/**
 * Calcola la posizione e l'altezza di un evento nella vista giornaliera o settimanale
 * @param {Object} evento - Evento da posizionare
 * @param {Date} inizioGiornata - Inizio della giornata
 * @returns {Object} - Posizione e altezza dell'evento
 */
export function calcolaPosizioneEvento(evento, inizioGiornata) {
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
export function addHour(date, hours) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    return newDate;
}

/**
 * Crea una data locale senza problemi di fuso orario
 * @param {number} year - Anno
 * @param {number} month - Mese (1-12)
 * @param {number} day - Giorno
 * @param {number} hours - Ore (default 0)
 * @param {number} minutes - Minuti (default 0)
 * @returns {Date} - Data locale
 */
export function createLocalDate(year, month, day, hours = 0, minutes = 0) {
    // Mese in JavaScript è 0-based (0 = gennaio, 11 = dicembre)
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Converte l'indice del giorno della settimana in formato europeo (0 = Lunedì, 6 = Domenica)
 * @param {Date} date - Data da cui estrarre il giorno della settimana
 * @returns {number} - Indice del giorno in formato europeo
 */
export function getEuropeanWeekday(date) {
    // Converti da 0-6 (domenica-sabato) a 0-6 (lunedì-domenica)
    return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

/**
 * Funzione centralizzata per creare o convertire date, gestendo uniformemente i timezone
 * @param {Date|string|Object} data - Può essere:
 *                                   - Un oggetto Date esistente
 *                                   - Una stringa in formato ISO
 *                                   - Un oggetto con proprietà: {anno, mese, giorno, ore, minuti}
 * @returns {Date} - Un oggetto Date normalizzato
 */
/**
 * utils.js - Miglioramento della funzione createDate
 * Questa soluzione centralizzata risolve problemi di timezone e incoerenze
 */
export function createDate(data) {
    // Caso 1: Se è già un oggetto Date, ritorna una copia
    if (data instanceof Date) {
        return new Date(data.getTime());
    }

    // Caso 2: Se è una stringa
    if (typeof data === 'string') {
        // Formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            const [anno, mese, giorno] = data.split('-').map(Number);
            return new Date(anno, mese - 1, giorno, 0, 0, 0, 0);
        }

        // Formato ISO con orario
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(data)) {
            const dateObj = new Date(data);
            // Gestisce esplicitamente la timezone locale
            return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(),
                dateObj.getHours(), dateObj.getMinutes(), dateObj.getSeconds());
        }

        // Altri formati
        return new Date(data);
    }

    // Caso 3: Oggetto con proprietà specifiche
    if (data && typeof data === 'object') {
        // Supporta sia il formato 0-based (getMonth) che 1-based (input form)
        const mese = data.mese > 0 && data.mese <= 12 ? data.mese - 1 : data.mese;
        const { anno, giorno, ore = 0, minuti = 0 } = data;
        if (anno !== undefined && mese !== undefined && giorno !== undefined) {
            return new Date(anno, mese, giorno, ore, minuti, 0, 0);
        }
    }

    // Default: data corrente
    console.warn('Formato data non valido:', data);
    return new Date();
}
/**
 * data-loader.js - Gestione del caricamento dinamico dei dati per il calendario
 */

import { 
    createDate, 
    getPrimoGiornoSettimana, 
    mostraNotifica 
} from './utils.js';
import { aggiornaVista } from './views.js';

// Variabile per tenere traccia dell'intervallo attualmente caricato
let intervalloCaricato = null;

// Variabile per tenere traccia se è in corso un caricamento
let caricamentoInCorso = false;

/**
 * Ottiene l'intervallo di date per una vista specifica
 * @param {string} vista - Tipo di vista ('month', 'week', 'day', 'list')
 * @param {Date} data - Data di riferimento
 * @returns {Object} - Oggetto con le date di inizio e fine dell'intervallo
 */
export function getIntervalloVista(vista, data) {
    const dataRif = createDate(data);
    let dataInizio, dataFine;
    
    switch (vista) {
        case 'month':
            // Per la vista mensile, carica dal mese precedente al mese successivo
            dataInizio = createDate(dataRif);
            dataInizio.setDate(1); // Primo giorno del mese corrente
            dataInizio.setMonth(dataInizio.getMonth() - 1); // Mese precedente
            
            dataFine = createDate(dataRif);
            dataFine.setMonth(dataFine.getMonth() + 2, 0); // Ultimo giorno del mese successivo
            break;
            
        case 'week':
            // Per la vista settimanale, carica dalla settimana precedente alla settimana successiva
            const inizioSettimanaCorrente = getPrimoGiornoSettimana(dataRif);
            
            dataInizio = createDate(inizioSettimanaCorrente);
            dataInizio.setDate(dataInizio.getDate() - 7); // Settimana precedente
            
            dataFine = createDate(inizioSettimanaCorrente);
            dataFine.setDate(dataFine.getDate() + 21); // Due settimane dopo
            break;
            
        case 'day':
        case 'list':
            // Per le viste giornaliera e lista, carica 15 giorni prima e 15 dopo
            dataInizio = createDate(dataRif);
            dataInizio.setDate(dataInizio.getDate() - 15);
            
            dataFine = createDate(dataRif);
            dataFine.setDate(dataFine.getDate() + 15);
            break;
            
        default:
            // Default: carica un mese prima e un mese dopo
            dataInizio = createDate(dataRif);
            dataInizio.setMonth(dataInizio.getMonth() - 1);
            
            dataFine = createDate(dataRif);
            dataFine.setMonth(dataFine.getMonth() + 1);
    }
    
    return { dataInizio, dataFine };
}

/**
 * Verifica se un intervallo è completamente contenuto in un altro
 * @param {Object} intervallo1 - Primo intervallo con dataInizio e dataFine
 * @param {Object} intervallo2 - Secondo intervallo con dataInizio e dataFine
 * @returns {boolean} - True se intervallo1 è contenuto in intervallo2
 */
export function isIntervalloContenuto(intervallo1, intervallo2) {
    return intervallo1.dataInizio >= intervallo2.dataInizio && 
           intervallo1.dataFine <= intervallo2.dataFine;
}

/**
 * Verifica se due intervalli si sovrappongono
 * @param {Object} intervallo1 - Primo intervallo con dataInizio e dataFine
 * @param {Object} intervallo2 - Secondo intervallo con dataInizio e dataFine
 * @returns {boolean} - True se gli intervalli si sovrappongono
 */
export function isIntervalliSovrapposti(intervallo1, intervallo2) {
    return (intervallo1.dataInizio <= intervallo2.dataFine && 
            intervallo1.dataFine >= intervallo2.dataInizio);
}

/**
 * Carica gli eventi per un determinato intervallo di date
 * @param {Object} intervallo - Intervallo con dataInizio e dataFine
 * @param {boolean} forzaRicarica - Se true, forza il caricamento anche se l'intervallo è già caricato
 * @returns {Promise} - Promise che si risolve quando gli eventi sono caricati
 */
export function caricaEventiPeriodo(intervallo, forzaRicarica = false) {
    console.log('%c[LOADER] Inizio caricaEventiPeriodo', 'background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('[LOADER] Parametri:', { intervallo, forzaRicarica });
    
    // Se è già in corso un caricamento, ritorna una promise che si risolve immediatamente
    if (caricamentoInCorso) {
        console.log('[LOADER] Caricamento già in corso, richiesta ignorata');
        return Promise.resolve();
    }
    
    // Se l'intervallo è già completamente caricato e non è richiesta una ricarica forzata, non fare nulla
    if (!forzaRicarica && intervalloCaricato && isIntervalloContenuto(intervallo, intervalloCaricato)) {
        console.log('[LOADER] Intervallo già caricato:', 
            intervallo.dataInizio.toLocaleDateString(), 'al', 
            intervallo.dataFine.toLocaleDateString());
        return Promise.resolve();
    }
    
    // Se l'intervallo richiesto si sovrappone a quello caricato, espandi l'intervallo
    let intervalloRichiesto = { ...intervallo };
    if (intervalloCaricato && isIntervalliSovrapposti(intervallo, intervalloCaricato)) {
        // Prendi il minimo tra le date di inizio
        if (intervalloCaricato.dataInizio < intervallo.dataInizio) {
            intervalloRichiesto.dataInizio = intervalloCaricato.dataInizio;
        }
        
        // Prendi il massimo tra le date di fine
        if (intervalloCaricato.dataFine > intervallo.dataFine) {
            intervalloRichiesto.dataFine = intervalloCaricato.dataFine;
        }
        
        console.log('[LOADER] Espansione intervallo da', 
            intervallo.dataInizio.toLocaleDateString(), '-', intervallo.dataFine.toLocaleDateString(),
            'a', intervalloRichiesto.dataInizio.toLocaleDateString(), '-', 
            intervalloRichiesto.dataFine.toLocaleDateString());
    }
    
    // Segna che è in corso un caricamento
    caricamentoInCorso = true;
    console.log('[LOADER] Caricamento iniziato, flag caricamentoInCorso =', caricamentoInCorso);
    
    // Mostra l'indicatore di caricamento
    mostraLoaderCalendario();
    
    // Formatta le date in ISO
    const startIso = intervalloRichiesto.dataInizio.toISOString();
    const endIso = intervalloRichiesto.dataFine.toISOString();
    
    console.log('[LOADER] Caricamento eventi dal', intervalloRichiesto.dataInizio.toLocaleDateString(), 
        'al', intervalloRichiesto.dataFine.toLocaleDateString());
    console.log('[LOADER] URL API:', `/cal/api/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
    
    // Carica gli eventi dall'API
    return fetch(`/cal/api/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`)
        .then(response => {
            console.log('[LOADER] Risposta API ricevuta:', response.status, response.statusText);
            if (!response.ok) {
                console.error('[LOADER] Risposta API non valida:', response.status, response.statusText);
                throw new Error('Errore durante il caricamento degli eventi');
            }
            return response.json();
        })
        .then(data => {
            console.log('%c[LOADER] Dati JSON ricevuti', 'background: #2ecc71; color: white; padding: 2px 5px; border-radius: 3px;');
            console.log('[LOADER] API ha restituito:', data.length, 'eventi');
            
            // Se è una ricarica forzata o non c'è un intervallo caricato, sostituisci gli eventi
            if (forzaRicarica || !intervalloCaricato) {
                // Pulisce l'array degli eventi
                window.eventi = [];
                console.log('[LOADER] Array eventi pulito per ricarica forzata o primo caricamento');
            }
            
            // Mantieni gli eventi esistenti che non sono nell'intervallo richiesto
            if (intervalloCaricato && !forzaRicarica) {
                // Filtra gli eventi esistenti che sono fuori dall'intervallo richiesto
                window.eventi = window.eventi.filter(evento => {
                    const dataEvento = createDate(evento.dataInizio);
                    return dataEvento < intervalloRichiesto.dataInizio || 
                           dataEvento > intervalloRichiesto.dataFine;
                });
            }
            
            // Converti le stringhe di data in oggetti Date e aggiungi i nuovi eventi
            data.forEach(evento => {
                // Verifica che l'evento abbia tutti i campi necessari
                if (!evento.id) {
                    console.warn('[LOADER] Evento senza ID:', evento);
                    return; // Salta questo evento
                }
                
                // Controlla i campi di data
                if (!evento.start_date && !evento.dataInizio) {
                    console.warn('[LOADER] Evento senza data inizio:', evento);
                    return; // Salta questo evento
                }
                
                if (!evento.end_date && !evento.dataFine) {
                    console.warn('[LOADER] Evento senza data fine:', evento);
                    return; // Salta questo evento
                }
                
                // Controlla se l'evento esiste già (per ID)
                const eventoEsistente = window.eventi.find(e => e.id === evento.id);
                
                // Se l'evento non esiste o se è una ricarica forzata, aggiungilo
                if (!eventoEsistente || forzaRicarica) {
                    // Assicurati che tutti i campi siano presenti con valori di default se necessario
                    const nuovoEvento = {
                        id: evento.id,
                        titolo: evento.titolo || evento.title || 'Evento senza titolo',
                        descrizione: evento.descrizione || evento.description || '',
                        dataInizio: createDate(evento.dataInizio || evento.start_date),
                        dataFine: createDate(evento.dataFine || evento.end_date),
                        categoria: evento.categoria || evento.category_id || 'default',
                        location: evento.location || '',
                        creato: evento.creato || evento.created_at ? createDate(evento.creato || evento.created_at) : null,
                        modificato: evento.modificato || evento.updated_at ? createDate(evento.modificato || evento.updated_at) : null
                    };
                    
                    window.eventi.push(nuovoEvento);
                    console.log('[LOADER] Aggiunto evento:', nuovoEvento.id, nuovoEvento.titolo);
                }
            });
            
            // Aggiorna l'intervallo caricato
            intervalloCaricato = { ...intervalloRichiesto };
            
            console.log(`[LOADER] Caricati ${data.length} eventi dall'API, totale eventi in memoria: ${window.eventi.length}`);
            
            // Aggiorna le viste
            if (typeof aggiornaVista === 'function') {
                console.log('[LOADER] Chiamata aggiornaVista()');
                aggiornaVista();
            } else {
                console.error('[LOADER] ERRORE: funzione aggiornaVista non disponibile');
            }
            
            return data;
        })
        .catch(error => {
            console.error('%c[LOADER] ERRORE', 'background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;');
            console.error('[LOADER] Errore durante il caricamento degli eventi:', error);
            if (typeof mostraNotifica === 'function') {
                mostraNotifica('Errore durante il caricamento degli eventi.', 'error');
            }
        })
        .finally(() => {
            // Segna che il caricamento è terminato
            caricamentoInCorso = false;
            console.log('[LOADER] Caricamento terminato, flag caricamentoInCorso =', caricamentoInCorso);
            
            // Nascondi l'indicatore di caricamento
            nascondiLoaderCalendario();
        });
}

/**
 * Mostra l'indicatore di caricamento
 */
export function mostraLoaderCalendario() {
    // Mostra il loader se esiste
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.add('active');
    } else {
        // Creo un loader se non esiste
        const newLoader = document.createElement('div');
        newLoader.className = 'loader active';
        newLoader.innerHTML = '<div class="loader-spinner"></div>';
        document.body.appendChild(newLoader);
    }
    
    // Debug
    console.log('[LOADER] Loader calendario mostrato');
}

/**
 * Nasconde l'indicatore di caricamento
 */
export function nascondiLoaderCalendario() {
    // Nascondi il loader
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.remove('active');
        console.log('[LOADER] Loader calendario nascosto');
    } else {
        console.warn('[LOADER] Loader calendario non trovato');
    }
}

/**
 * Sostituisce la funzione caricaEventi originale per usare il nuovo sistema
 */
export function caricaEventi() {
    console.log('%c[CALENDAR] caricaEventi chiamata', 'background: #9b59b6; color: white; padding: 2px 5px; border-radius: 3px;');
    
    // Verifica che le variabili globali siano definite
    if (typeof window.vistaAttuale === 'undefined' || typeof window.dataAttuale === 'undefined') {
        console.error('[CALENDAR] ERRORE: vistaAttuale o dataAttuale non definite', {
            vistaAttuale: window.vistaAttuale,
            dataAttuale: window.dataAttuale
        });
        return Promise.reject(new Error('Variabili globali mancanti'));
    }
    
    // Calcola l'intervallo di date per cui caricare gli eventi basato sulla vista attuale
    const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
    console.log('[CALENDAR] Intervallo calcolato:', {
        vistaAttuale: window.vistaAttuale,
        dataAttuale: window.dataAttuale,
        intervallo: {
            dataInizio: intervallo.dataInizio.toLocaleDateString(),
            dataFine: intervallo.dataFine.toLocaleDateString()
        }
    });
    
    // Carica gli eventi per l'intervallo specificato, forzando la ricarica
    return caricaEventiPeriodo(intervallo, true);
}


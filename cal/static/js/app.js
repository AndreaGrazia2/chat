/**
 * app.js - Inizializzazione e gestione dell'applicazione calendario
 */

import { caricaEventiPeriodo, getIntervalloVista } from './modules/data-loader.js';
import { enableDragAndDrop } from './modules/drag-drop.js';
import { inizializzaViste, aggiornaVista, apriModalNuovoEvento, chiudiModal } from './modules/views.js';
import { createDate, mostraNotifica } from './modules/utils.js';
import { attachEventClickHandlers  } from './modules/events.js';

// Inizializza le variabili globali necessarie
window.vistaAttuale = 'month';
window.dataAttuale = new Date();
window.dataSelezionata = null;
window.eventi = [];
window.darkMode = false;
window.sidebarVisible = false;

// Variabile per tenere traccia del timer dell'ora corrente
window.currentTimeIndicatorInterval = null;
window.socket = null;

// Cache degli elementi DOM frequentemente utilizzati
window.domCache = {
    monthGrid: null,
    weekGrid: null,
    dayGrid: null,
    eventsList: null,
    miniCalendar: null,
    currentDate: null,
    modals: {}
};

/**
 * Inizializza la cache degli elementi DOM
 */
function initDomCache() {
    window.domCache.monthGrid = document.getElementById('monthGrid');
    window.domCache.weekGrid = document.getElementById('weekGrid');
    window.domCache.dayGrid = document.getElementById('dayGrid');
    window.domCache.eventsList = document.getElementById('eventsList');
    window.domCache.miniCalendar = document.getElementById('miniCalendar');
    window.domCache.currentDate = document.querySelector('.current-date');
    
    // Modals
    window.domCache.modals.event = document.getElementById('eventModal');
    window.domCache.modals.eventsList = document.getElementById('eventsListModal');
    
    // Form elements
    window.domCache.eventForm = document.getElementById('eventForm');
    window.domCache.eventTitle = document.getElementById('eventTitle');
    window.domCache.eventDescription = document.getElementById('eventDescription');
    window.domCache.eventDate = document.getElementById('eventDate');
    window.domCache.eventTime = document.getElementById('eventTime');
    window.domCache.eventEndDate = document.getElementById('eventEndDate');
    window.domCache.eventEndTime = document.getElementById('eventEndTime');
    window.domCache.eventCategory = document.getElementById('eventCategory');
}

function initSocketListeners() {
    //console.log('[CALENDAR_DEBUG] initSocketListeners() called');
    
    // Verifica se Socket.IO è disponibile
    if (typeof io !== 'undefined') {
        //console.log('[CALENDAR_DEBUG] Socket.IO is available');
        
        // Inizializza una nuova connessione Socket.IO
        window.socket = io();
        
        // Aggiungi log per verificare la connessione
        window.socket.on('connect', function() {
            //console.log('[CALENDAR_DEBUG] Socket.IO connected successfully', socket.id);
            
            // Identifica l'utente (per multi-tenancy futuro)
            const userId = getUserId(); 
            if (userId) {
                window.socket.emit('calendar_join_room', userId);
            }
            
            // Mostra una notifica di connessione riuscita
            mostraNotifica('Connessione Socket.IO stabilita', 'success');
        });
        
        window.socket.on('disconnect', function(reason) {
            //console.log('[CALENDAR_DEBUG] Socket.IO disconnected:', reason);
            mostraNotifica('Connessione persa: aggiornamenti in tempo reale disattivati', 'warning');
        });
        
        window.socket.on('connect_error', function(error) {
            console.error('[CALENDAR_DEBUG] Socket.IO connection error:', error);
            mostraNotifica('Errore di connessione', 'error');
        });
        
        // Gestione degli eventi del calendario
        window.socket.on('calendarEvent', function(data) {
            try {
                //console.log('[CALENDAR_DEBUG] Received calendarEvent:', data);
                
                if (data.type === 'calendar_update') {
                    //console.log('[CALENDAR_DEBUG] Action:', data.action);
                    //console.log('[CALENDAR_DEBUG] Data:', data.data);
                    
                    // Ricarica i dati in modo intelligente in base all'azione
                    if (data.action === 'create' || data.action === 'delete') {
                        // Per creazione o eliminazione, ricarica l'intervallo corrente
                        const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
                        caricaEventiPeriodo(intervallo, true).then(() => {
                            // Aggiorna la vista
                            aggiornaVista();
                            
                            // Mostra notifica
                            let message = getMessageForAction(data.action);
                            mostraNotifica(message, 'success');
                        });
                    } else if (data.action === 'update' && data.data && data.data.id) {
                        // Per aggiornamenti, verifica se l'evento è nell'intervallo corrente
                        const eventData = data.data;
                        const eventDate = eventData.dataInizio || eventData.start_date;
                        
                        if (eventDate) {
                            const eventDateObj = createDate(eventDate);
                            const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
                            
                            // Se l'evento è nel periodo visualizzato, ricarica i dati
                            if (eventDateObj >= intervallo.dataInizio && eventDateObj <= intervallo.dataFine) {
                                caricaEventiPeriodo(intervallo, true).then(() => {
                                    // Aggiorna la vista
                                    aggiornaVista();
                                    
                                    // Mostra notifica
                                    let message = getMessageForAction(data.action);
                                    mostraNotifica(message, 'success');
                                });
                            } else {
                                console.log('[CALENDAR_DEBUG] L\'evento aggiornato è fuori dall\'intervallo visualizzato');
                                // Aggiorna l'evento localmente se presente
                                updateEventLocally(data.data);
                            }
                        } else {
                            // Se non abbiamo informazioni sulla data, ricarica comunque
                            const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
                            caricaEventiPeriodo(intervallo, true).then(() => {
                                aggiornaVista();
                                
                                let message = getMessageForAction(data.action);
                                mostraNotifica(message, 'success');
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[CALENDAR_DEBUG] Error handling calendar event:', error);
                mostraNotifica('Errore nell\'elaborazione dell\'aggiornamento', 'error');
            }
        });
    } else {
        console.error('[CALENDAR_DEBUG] Socket.IO not available!');
        mostraNotifica('Socket.IO non disponibile. Aggiornamenti in tempo reale disattivati.', 'warning');
    }
}

// Funzioni helper
function getUserId() {
    // Qui puoi implementare la logica per ottenere l'ID dell'utente
    // Per ora ritorna null (nessun filtro)
    return null;
}

function getMessageForAction(action) {
    switch (action) {
        case 'create': return 'Nuovo evento creato';
        case 'update': return 'Evento aggiornato';
        case 'delete': return 'Evento eliminato';
        default: return 'Calendario aggiornato';
    }
}

function updateEventLocally(eventData) {
    if (!eventData || !eventData.id) {
        console.error('[CALENDAR_DEBUG] Impossibile aggiornare evento: dati mancanti o ID mancante', eventData);
        return;
    }
    
    console.log('[CALENDAR_DEBUG] Aggiornamento locale dell\'evento:', eventData.id);
    
    // Compatibilità con diversi formati di dati
    const eventId = eventData.id;
    const eventIndex = window.eventi.findIndex(e => e.id === eventId);
    
    if (eventIndex !== -1) {
        //console.log('[CALENDAR_DEBUG] Evento trovato nell\'array locale, indice:', eventIndex);
        
        // Estrai i campi necessari con fallback ai valori esistenti
        const titolo = eventData.titolo || eventData.title || window.eventi[eventIndex].titolo;
        const descrizione = eventData.descrizione || eventData.description || window.eventi[eventIndex].descrizione;
        
        // Gestisci sia il formato ISO che gli oggetti Date
        let dataInizio = window.eventi[eventIndex].dataInizio;
        if (eventData.dataInizio) {
            dataInizio = createDate(eventData.dataInizio);
        } else if (eventData.start_date) {
            dataInizio = createDate(eventData.start_date);
        }
        
        let dataFine = window.eventi[eventIndex].dataFine;
        if (eventData.dataFine) {
            dataFine = createDate(eventData.dataFine);
        } else if (eventData.end_date) {
            dataFine = createDate(eventData.end_date);
        }
        
        const categoria = eventData.categoria || eventData.category_id || window.eventi[eventIndex].categoria;
        const location = eventData.location || window.eventi[eventIndex].location || '';
        
        // Aggiorna l'evento esistente
        window.eventi[eventIndex] = {
            ...window.eventi[eventIndex],
            titolo: titolo,
            descrizione: descrizione,
            dataInizio: dataInizio,
            dataFine: dataFine,
            categoria: categoria,
            location: location,
            modificato: new Date()
        };
        
        console.log('[CALENDAR_DEBUG] Evento aggiornato localmente con successo');
        
        // Aggiorna la vista se l'evento è visibile
        const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
        if (dataInizio >= intervallo.dataInizio && dataInizio <= intervallo.dataFine) {
            aggiornaVista();
            mostraNotifica('Evento aggiornato', 'success');
        }
    } else {
        console.warn('[CALENDAR_DEBUG] Evento non trovato nell\'array locale:', eventId);
        // L'evento non esiste, ma non ricarichiamo tutti gli eventi
        // perché potrebbe essere un evento che non ci riguarda
    }
}

/**
 * Inizializza il time indicator
 */
function initTimeIndicator() {
    // Pulisci eventuali timer esistenti
    if (window.currentTimeIndicatorInterval) {
        clearInterval(window.currentTimeIndicatorInterval);
        window.currentTimeIndicatorInterval = null;
    }
    
    // Prima esecuzione immediata
    if (typeof updateCurrentTimeIndicator === 'function') {
        updateCurrentTimeIndicator();
        
        // Calcola millisecondi fino al prossimo minuto esatto
        const now = new Date();
        const secondsToNextMinute = 60 - now.getSeconds();
        const msToNextMinute = secondsToNextMinute * 1000 - now.getMilliseconds();
        
        // Imposta un timeout per allinearsi con il prossimo minuto esatto
        setTimeout(() => {
            updateCurrentTimeIndicator();
            // Dopo il primo allineamento, aggiorna ogni minuto esatto
            window.currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
        }, msToNextMinute);
    }
}

/**
 * Inizializza gli event listener
 */
function initEventListeners() {
    // Toggle dark mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Toggle sidebar
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    // Chiudi sidebar
    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', toggleSidebar);
    }
    
    // Overlay per chiudere la sidebar
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
    
    // Navigazione tra le viste
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Prima di cambiare vista, pulisci i timer esistenti
            if (window.currentTimeIndicatorInterval) {
                clearInterval(window.currentTimeIndicatorInterval);
                window.currentTimeIndicatorInterval = null;
            }
            
            // Aggiorna la vista attuale
            const nuovaVista = btn.dataset.view;
            if (nuovaVista !== window.vistaAttuale) {
                window.vistaAttuale = nuovaVista;
                
                // Carica i dati per la nuova vista
                const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
                caricaEventiPeriodo(intervallo).then(() => {
                    aggiornaVista();
                    
                    // Dopo l'aggiornamento della vista, collega i gestori agli eventi
                    if (typeof attachEventClickHandlers === 'function') {
                        setTimeout(attachEventClickHandlers, 300);
                    }
                    
                    // Aggiorna l'indicatore dell'ora corrente
                    if (typeof updateCurrentTimeIndicator === 'function') {
                        setTimeout(() => {
                            updateCurrentTimeIndicator();
                            
                            // Imposta un nuovo intervallo per l'ora corrente
                            window.currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
                        }, 300);
                    }
                });
            }
        });
    });
    
    // Navigazione tra i periodi
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const todayBtn = document.getElementById('todayBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            // Salva la data attuale prima di modificarla
            const vecchiaData = createDate(window.dataAttuale);
            
            // Cambia il periodo in base alla vista
            switch (window.vistaAttuale) {
                case 'month':
                    window.dataAttuale.setMonth(window.dataAttuale.getMonth() - 1);
                    break;
                case 'week':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() - 7);
                    break;
                case 'day':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() - 1);
                    
                    // Aggiorna anche dataSelezionata per mantenerle sincronizzate
                    if (window.dataSelezionata) {
                        window.dataSelezionata = createDate(window.dataAttuale);
                    }
                    break;
                case 'list':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() - 1);
                    break;
            }
            
            // Verifica se è necessario caricare nuovi dati
            const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
            caricaEventiPeriodo(intervallo).then(() => {
                aggiornaVista();
                
                // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
                if (typeof attachEventClickHandlers === 'function') {
                    setTimeout(attachEventClickHandlers, 300);
                }
            });
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Salva la data attuale prima di modificarla
            const vecchiaData = createDate(window.dataAttuale);
            
            // Cambia il periodo in base alla vista
            switch (window.vistaAttuale) {
                case 'month':
                    window.dataAttuale.setMonth(window.dataAttuale.getMonth() + 1);
                    break;
                case 'week':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() + 7);
                    break;
                case 'day':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() + 1);
                    
                    // Aggiorna anche dataSelezionata per mantenerle sincronizzate
                    if (window.dataSelezionata) {
                        window.dataSelezionata = createDate(window.dataAttuale);
                    }
                    break;
                case 'list':
                    window.dataAttuale.setDate(window.dataAttuale.getDate() + 1);
                    break;
            }
            
            // Verifica se è necessario caricare nuovi dati
            const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
            caricaEventiPeriodo(intervallo).then(() => {
                aggiornaVista();
                
                // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
                if (typeof attachEventClickHandlers === 'function') {
                    setTimeout(attachEventClickHandlers, 300);
                }
            });
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            // Cambia la data attuale alla data odierna
            window.dataAttuale = new Date();
        
            // Aggiorna dataSelezionata per tutte le viste
            window.dataSelezionata = createDate(window.dataAttuale);
            
            // Carica gli eventi per la data odierna
            const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
            caricaEventiPeriodo(intervallo).then(() => {
                aggiornaVista();
                
                // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
                if (typeof attachEventClickHandlers === 'function') {
                    setTimeout(attachEventClickHandlers, 300);
                }
            });
        });
    }
    
    // Aggiungi evento
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            apriModalNuovoEvento(window.dataAttuale);
        });
    }
    
    // Modal eventi
    const closeModal = document.getElementById('closeModal');
    const cancelEvent = document.getElementById('cancelEvent');
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            chiudiModal('eventModal');
        });
    }
    
    if (cancelEvent) {
        cancelEvent.addEventListener('click', () => {
            chiudiModal('eventModal');
        });
    }
    
    // Modal lista eventi
    const closeEventsListModal = document.getElementById('closeEventsListModal');
    
    if (closeEventsListModal) {
        closeEventsListModal.addEventListener('click', () => {
            chiudiModal('eventsListModal');
        });
    }  
}

/**
 * Controlla se è attiva la modalità dark
 */
function checkDarkMode() {
    // Controlla se è stata salvata una preferenza
    const savedMode = localStorage.getItem('calendario_dark_mode');
    
    if (savedMode === 'true') {
        window.darkMode = true;
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        
        // Aggiorna l'icona
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
}

/**
 * Toggle della modalità dark
 */
function toggleDarkMode() {
    window.darkMode = !window.darkMode;
    
    if (window.darkMode) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        
        // Aggiorna l'icona
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        
        // Aggiorna l'icona
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
    
    // Salva la preferenza
    localStorage.setItem('calendario_dark_mode', window.darkMode);
}

/**
 * Toggle della sidebar
 */
function toggleSidebar() {
    window.sidebarVisible = !window.sidebarVisible;
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (window.sidebarVisible) {
        sidebar.classList.add('active');
        // Mostra l'overlay solo su schermi piccoli (mobile/tablet)
        if (window.innerWidth <= 992) {
            overlay.classList.add('active');
        }
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// Funzione di debug migliorata per monitorare gli eventi Socket.IO
function setupSocketIODebug() {
    console.log('[SOCKET_DEBUG] Configurazione debug Socket.IO');
    
    if (typeof io === 'undefined') {
        console.error('[SOCKET_DEBUG] ERROR: Socket.IO non è disponibile!');
        return;
    }
    
    // Salva il riferimento alla connessione originale per debugging
    const originalConnect = io.connect;
    io.connect = function() {
        console.log('[SOCKET_DEBUG] Chiamata a io.connect con parametri:', arguments);
        return originalConnect.apply(this, arguments);
    };
    
    // Monitora la creazione del socket
    const originalIO = io;
    window.io = function() {
        console.log('[SOCKET_DEBUG] Chiamata a io() con parametri:', arguments);
        const socket = originalIO.apply(this, arguments);
        
        // Monitora eventi di connessione
        const originalOn = socket.on;
        socket.on = function(event, callback) {
            console.log(`[SOCKET_DEBUG] Registrato handler per evento: ${event}`);
            
            // Wrapper per monitorare la chiamata dell'evento
            const wrappedCallback = function() {
                console.log(`[SOCKET_DEBUG] Ricevuto evento: ${event}`, arguments);
                return callback.apply(this, arguments);
            };
            
            return originalOn.call(this, event, wrappedCallback);
        };
        
        // Monitora emissione di eventi
        const originalEmit = socket.emit;
        socket.emit = function(event) {
            console.log(`[SOCKET_DEBUG] Emissione evento: ${event}`, Array.from(arguments).slice(1));
            return originalEmit.apply(this, arguments);
        };
        
        return socket;
    };
    
    console.log('[SOCKET_DEBUG] Debug Socket.IO configurato con successo');
}

/**
 * Inizializza l'applicazione
 */
function initApp() {
    // Inizializza la cache DOM
    initDomCache();
    
    // Aggiungi l'indicatore di caricamento al DOM se non esiste già
    if (!document.querySelector('.loader')) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = '<div class="loader-spinner"></div>';
        document.body.appendChild(loader);
    }
    
    // Carica gli eventi per il periodo iniziale
    const intervallo = getIntervalloVista(window.vistaAttuale, window.dataAttuale);
    caricaEventiPeriodo(intervallo, true).then(() => {
        // Inizializza le viste del calendario dopo il caricamento dei dati
        inizializzaViste();
        
        // Inizializza gli event listener
        initEventListeners();
        
        // Controlla se è attiva la modalità dark
        checkDarkMode();
        
        // Inizializza le funzionalità mobile se disponibili
        if (typeof initMobile === 'function') {
            initMobile();
        }
        
        // Inizializza il drag and drop
        if (typeof enableDragAndDrop === 'function') {
            enableDragAndDrop();
        }

        // Inizializza i listener di Socket.IO
        initSocketListeners();

        // Collega i gestori di click agli eventi
        if (typeof attachEventClickHandlers === 'function') {
            attachEventClickHandlers();
        }
        
        // Pulisci eventuali timer esistenti
        if (window.currentTimeIndicatorInterval) {
            clearInterval(window.currentTimeIndicatorInterval);
            window.currentTimeIndicatorInterval = null;
        }
        
        // Inizializza l'indicatore dell'ora corrente
        if (typeof updateCurrentTimeIndicator === 'function') {
            updateCurrentTimeIndicator();
            
            // Calcola i millisecondi rimanenti fino al prossimo minuto
            const now = new Date();
            const millisecondsToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
            
            // Imposta un timeout per allinearsi con il prossimo minuto esatto
            setTimeout(() => {
                updateCurrentTimeIndicator();
                // Dopo il primo allineamento, aggiorna ogni minuto esatto
                window.currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
            }, millisecondsToNextMinute);
        }

        initTimeIndicator();

        // Verifica lo stato della connessione Socket.IO dopo un po' di tempo
        setTimeout(setupSocketIODebug, 2000);
        
        // Mostra una notifica di benvenuto
        mostraNotifica('Calendario inizializzato con successo', 'success');
    });
}

// Inizializza l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', initApp);

// Esporta le funzioni che potrebbero essere necessarie in altri moduli
export {
    initDomCache,
    initSocketListeners,
    initTimeIndicator,
    initEventListeners,
    checkDarkMode,
    toggleDarkMode,
    toggleSidebar,
    setupSocketIODebug,
    initApp
};
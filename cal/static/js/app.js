//TODO: Quando mi vuovo nel calendario, devo caricare i dati dal database, adesso carica solo quando parte

/**
 * app.js - Inizializzazione e gestione dell'applicazione calendario
 */

// Variabili globali
let darkMode = false;
let sidebarVisible = false;

// Variabile per tenere traccia del timer dell'ora corrente
let currentTimeIndicatorInterval;
let socket;

// Cache degli elementi DOM frequentemente utilizzati
const domCache = {
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
    domCache.monthGrid = document.getElementById('monthGrid');
    domCache.weekGrid = document.getElementById('weekGrid');
    domCache.dayGrid = document.getElementById('dayGrid');
    domCache.eventsList = document.getElementById('eventsList');
    domCache.miniCalendar = document.getElementById('miniCalendar');
    domCache.currentDate = document.querySelector('.current-date');
    
    // Modals
    domCache.modals.event = document.getElementById('eventModal');
    domCache.modals.eventsList = document.getElementById('eventsListModal');
    
    // Form elements
    domCache.eventForm = document.getElementById('eventForm');
    domCache.eventTitle = document.getElementById('eventTitle');
    domCache.eventDescription = document.getElementById('eventDescription');
    domCache.eventDate = document.getElementById('eventDate');
    domCache.eventTime = document.getElementById('eventTime');
    domCache.eventEndDate = document.getElementById('eventEndDate');
    domCache.eventEndTime = document.getElementById('eventEndTime');
    domCache.eventCategory = document.getElementById('eventCategory');
}

function initSocketListeners() {
    console.log('[CALENDAR_DEBUG] initSocketListeners() called');
    
    // Verifica se Socket.IO è disponibile
    if (typeof io !== 'undefined') {
        console.log('[CALENDAR_DEBUG] Socket.IO is available');
        
        // Usa il socket globale già inizializzato
        socket = io();
        
        // Aggiungi log per verificare la connessione
        socket.on('connect', function() {
            console.log('[CALENDAR_DEBUG] Socket.IO connected successfully');
            
            // Identifica l'utente (per multi-tenancy futuro)
            // Sostituire con l'ID dell'utente o azienda effettiva quando implementerai l'auth
            const userId = getUserId(); // Funzione helper da implementare
            if (userId) {
                socket.emit('calendar_join_room', userId);
            }
        });
        
        // Ascolta gli eventi del calendario con gestione errori migliorata
        socket.on('calendarEvent', function(data) {
            try {
                console.log('[CALENDAR_DEBUG] Received calendarEvent:', data);
                
                if (data.type === 'calendar_update') {
                    console.log('[CALENDAR_DEBUG] Action:', data.action);
                    console.log('[CALENDAR_DEBUG] Data:', data.data);
                    
                    // Carica i nuovi dati ma evita di ricaricare tutto se possibile
                    if (data.action === 'create' || data.action === 'delete') {
                        // Per creazione o eliminazione, ricarica tutto
                        caricaEventi();
                    } else if (data.action === 'update' && data.data && data.data.id) {
                        // Per aggiornamenti, potresti aggiornare solo l'evento specifico
                        updateEventLocally(data.data);
                    }
                    
                    // Aggiorna la vista
                    if (typeof aggiornaViste === 'function') {
                        aggiornaViste();
                    } else if (typeof aggiornaVista === 'function') {
                        aggiornaVista();
                    } else if (typeof inizializzaViste === 'function') {
                        inizializzaViste();
                    }
                    
                    // Mostra notifica
                    let message = getMessageForAction(data.action);
                    if (typeof mostraNotifica === 'function') {
                        mostraNotifica(message, 'success');
                    }
                }
            } catch (error) {
                console.error('[CALENDAR_DEBUG] Error handling calendar event:', error);
            }
        });
    } else {
        console.error('[CALENDAR_DEBUG] Socket.IO not available!');
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

// Sostituisci la funzione updateEventLocally in app.js con questa versione migliorata
function updateEventLocally(eventData) {
    // Aggiorna un evento specifico nell'array eventi senza ricaricare tutto
    if (!eventData || !eventData.id) {
        console.error('[CALENDAR_DEBUG] Impossibile aggiornare evento: dati mancanti o ID mancante', eventData);
        return;
    }
    
    console.log('[CALENDAR_DEBUG] Aggiornamento locale dell\'evento:', eventData.id);
    
    // Compatibilità con diversi formati di dati
    const eventId = eventData.id;
    const eventIndex = eventi.findIndex(e => e.id === eventId);
    
    if (eventIndex !== -1) {
        console.log('[CALENDAR_DEBUG] Evento trovato nell\'array locale, indice:', eventIndex);
        
        // Estrai i campi necessari con fallback ai valori esistenti
        const titolo = eventData.titolo || eventData.title || eventi[eventIndex].titolo;
        const descrizione = eventData.descrizione || eventData.description || eventi[eventIndex].descrizione;
        
        // Gestisci sia il formato ISO che gli oggetti Date
        let dataInizio = eventi[eventIndex].dataInizio;
        if (eventData.dataInizio) {
            dataInizio = createDate(eventData.dataInizio);
        } else if (eventData.start_date) {
            dataInizio = createDate(eventData.start_date);
        }
        
        let dataFine = eventi[eventIndex].dataFine;
        if (eventData.dataFine) {
            dataFine = createDate(eventData.dataFine);
        } else if (eventData.end_date) {
            dataFine = createDate(eventData.end_date);
        }
        
        const categoria = eventData.categoria || eventData.category_id || eventi[eventIndex].categoria;
        const location = eventData.location || eventi[eventIndex].location || '';
        
        // Aggiorna l'evento esistente
        eventi[eventIndex] = {
            ...eventi[eventIndex],
            titolo: titolo,
            descrizione: descrizione,
            dataInizio: dataInizio,
            dataFine: dataFine,
            categoria: categoria,
            location: location,
            modificato: new Date()
        };
        
        console.log('[CALENDAR_DEBUG] Evento aggiornato localmente con successo');
    } else {
        console.warn('[CALENDAR_DEBUG] Evento non trovato nell\'array locale:', eventId);
        // L'evento non esiste, ricarichiamo tutti gli eventi
        console.log('[CALENDAR_DEBUG] Ricaricamento completo degli eventi...');
        caricaEventi();
    }
}

/**
 * Inizializza l'applicazione
 */
function initApp() {
    // Inizializza la cache DOM
    initDomCache();
    
    // Carica gli eventi salvati
    caricaEventi();
    
    // Inizializza le viste del calendario
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
    if (currentTimeIndicatorInterval) {
        clearInterval(currentTimeIndicatorInterval);
        currentTimeIndicatorInterval = null;
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
            currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
        }, millisecondsToNextMinute);
    }

    initTimeIndicator();

    // Verifica lo stato della connessione Socket.IO dopo un po' di tempo
    setTimeout(checkSocketConnection, 2000);
    
    // Ricontrolla periodicamente la connessione Socket.IO
    setInterval(checkSocketConnection, 30000);
}


// In app.js, migliora la gestione dell'intervallo di aggiornamento dell'ora
function initTimeIndicator() {
    // Pulisci eventuali timer esistenti
    if (currentTimeIndicatorInterval) {
        clearInterval(currentTimeIndicatorInterval);
        currentTimeIndicatorInterval = null;
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
            currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
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
            if (currentTimeIndicatorInterval) {
                clearInterval(currentTimeIndicatorInterval);
                currentTimeIndicatorInterval = null;
            }
            
            vistaAttuale = btn.dataset.view;
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
                    currentTimeIndicatorInterval = setInterval(updateCurrentTimeIndicator, 60000);
                }, 300);
            }
        });
    });
    
    // Navigazione tra i mesi
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const todayBtn = document.getElementById('todayBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            switch (vistaAttuale) {
                case 'month':
                    dataAttuale.setMonth(dataAttuale.getMonth() - 1);
                    break;
                case 'week':
                    dataAttuale.setDate(dataAttuale.getDate() - 7);
                    break;
                case 'day':
                    dataAttuale.setDate(dataAttuale.getDate() - 1);
                    
                    // MODIFICATO: Aggiorna anche dataSelezionata per mantenerle sincronizzate
                    if (dataSelezionata) {
                        dataSelezionata = createDate(dataAttuale);
                    }
                    break;
                case 'list':
                    dataAttuale.setDate(dataAttuale.getDate() - 1);
                    break;
            }
            aggiornaViste();
            
            // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
            if (typeof attachEventClickHandlers === 'function') {
                setTimeout(attachEventClickHandlers, 300);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            switch (vistaAttuale) {
                case 'month':
                    dataAttuale.setMonth(dataAttuale.getMonth() + 1);
                    break;
                case 'week':
                    dataAttuale.setDate(dataAttuale.getDate() + 7);
                    break;
                case 'day':
                    dataAttuale.setDate(dataAttuale.getDate() + 1);
                    
                    // MODIFICATO: Aggiorna anche dataSelezionata per mantenerle sincronizzate
                    if (dataSelezionata) {
                        dataSelezionata = createDate(dataAttuale);
                    }
                    break;
                case 'list':
                    dataAttuale.setDate(dataAttuale.getDate() + 1);
                    break;
            }
            aggiornaViste();
            
            // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
            if (typeof attachEventClickHandlers === 'function') {
                setTimeout(attachEventClickHandlers, 300);
            }
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            dataAttuale = new Date();
        
            // MODIFICATO: Aggiorna dataSelezionata per tutte le viste, non solo per la vista giornaliera
            dataSelezionata = createDate(dataAttuale);
        
            aggiornaViste();
            
            // Dopo l'aggiornamento delle viste, collega i gestori agli eventi
            if (typeof attachEventClickHandlers === 'function') {
                setTimeout(attachEventClickHandlers, 300);
            }
        });
    }
    
    // Aggiungi evento
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            apriModalNuovoEvento(dataAttuale);
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
        darkMode = true;
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
    darkMode = !darkMode;
    
    if (darkMode) {
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
    localStorage.setItem('calendario_dark_mode', darkMode);
}

/**
 * Toggle della sidebar
 */
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebarVisible) {
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

function checkSocketConnection() {
    console.log('[CALENDAR_DEBUG] Checking socket connection status...');
    
    if (!socket) {
        console.error('[CALENDAR_DEBUG] Socket object not initialized!');
        return false;
    }
    
    console.log('[CALENDAR_DEBUG] Socket object exists');
    console.log('[CALENDAR_DEBUG] Socket connected:', socket.connected);
    
    if (!socket.connected) {
        console.log('[CALENDAR_DEBUG] Attempting to reconnect...');
        socket.connect();
    }
    
    return socket.connected;
}

// Aggiungi questo al fondo della funzione initApp() in app.js
// Dopo la riga "initSocketListeners();"
setTimeout(checkSocketConnection, 2000); // Controlla lo stato della connessione dopo 2 secondi

// Inizializza l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', initApp);
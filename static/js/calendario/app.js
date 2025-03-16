/**
 * app.js - Inizializzazione e gestione dell'applicazione calendario
 */

// Variabili globali
let darkMode = false;
let sidebarVisible = false;

/**
 * Inizializza l'applicazione
 */
function initApp() {
    // Carica gli eventi salvati
    caricaEventi();
    
    // Crea eventi di esempio se non ce ne sono
    if (eventi.length === 0) {
        generaEventiTest(15); // Modificato da creaEventiDemo a generaEventiTest
    }
    
    // Inizializza le viste del calendario
    inizializzaViste();
    
    // Inizializza gli event listener
    initEventListeners();
    
    // Controlla se è attiva la modalità dark
    checkDarkMode();
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
            
            vistaAttuale = btn.dataset.view;
            aggiornaVista();
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
                case 'list':
                    dataAttuale.setDate(dataAttuale.getDate() - 1);
                    break;
            }
            aggiornaViste();
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
                case 'list':
                    dataAttuale.setDate(dataAttuale.getDate() + 1);
                    break;
            }
            aggiornaViste();
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            dataAttuale = new Date();
            aggiornaViste();
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

// Inizializza l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', initApp);
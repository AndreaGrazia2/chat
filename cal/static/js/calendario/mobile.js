/**
 * mobile.js - Gestione delle funzionalità specifiche per dispositivi mobili
 */

/**
 * Inizializza le funzionalità mobile
 */
function initMobile() {
    // Crea il selettore di vista mobile se non esiste già
    if (!document.querySelector('.mobile-view-selector')) {
        createMobileViewSelector();
    }
    
    // Aggiorna la visibilità del selettore di vista mobile in base alla dimensione dello schermo
    updateMobileViewSelector();
    
    // Aggiungi un listener per il ridimensionamento della finestra
    window.addEventListener('resize', updateMobileViewSelector);
}

/**
 * Crea il selettore di vista mobile
 */
function createMobileViewSelector() {
    // Rimuovi eventuali selettori esistenti
    const existingSelector = document.querySelector('.mobile-view-selector');
    if (existingSelector) {
        existingSelector.remove();
    }
    
    // Crea il container
    const mobileViewSelector = document.createElement('div');
    mobileViewSelector.className = 'mobile-view-selector';
    
    // Aggiungi i controlli di navigazione del periodo
    const navigationControls = document.createElement('div');
    navigationControls.className = 'mobile-navigation-controls';
    
    // Ottieni il testo della data corrente
    const currentDateText = document.querySelector('.current-date')?.textContent || 'Oggi';
    
    navigationControls.innerHTML = `
        <div class="calendar-title">
            <button id="mobilePrevBtn" class="nav-btn">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="mobile-current-date">${currentDateText}</div>
            <button id="mobileNextBtn" class="nav-btn">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <button id="mobileTodayBtn" class="today-btn">Oggi</button>
    `;
    
    mobileViewSelector.appendChild(navigationControls);
    
    // Crea i pulsanti per le diverse viste
    const viewButtons = document.createElement('div');
    viewButtons.className = 'mobile-view-buttons';
    
    const views = [
        { id: 'month', icon: 'fa-calendar-alt', text: 'Mese' },
        { id: 'week', icon: 'fa-calendar-week', text: 'Settimana' },
        { id: 'day', icon: 'fa-calendar-day', text: 'Giorno' },
        { id: 'list', icon: 'fa-list', text: 'Lista' }
    ];
    
    views.forEach(view => {
        const button = document.createElement('button');
        button.className = `mobile-view-btn ${view.id === vistaAttuale ? 'active' : ''}`;
        button.dataset.view = view.id;
        button.innerHTML = `
            <i class="fas ${view.icon}"></i>
            <span>${view.text}</span>
        `;
        viewButtons.appendChild(button);
    });
    
    mobileViewSelector.appendChild(viewButtons);
    
    // Aggiungi il selettore al DOM
    document.querySelector('.app-container').appendChild(mobileViewSelector);
    
    // Aggiungi gli event listener per i pulsanti di navigazione mobile
    document.getElementById('mobilePrevBtn').addEventListener('click', () => {
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) prevBtn.click();
        updateMobileCurrentDate();
    });
    
    document.getElementById('mobileNextBtn').addEventListener('click', () => {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.click();
        updateMobileCurrentDate();
    });
    
    document.getElementById('mobileTodayBtn').addEventListener('click', () => {
        const todayBtn = document.getElementById('todayBtn');
        if (todayBtn) todayBtn.click();
        updateMobileCurrentDate();
    });
    
    // Aggiungi gli event listener per i pulsanti di vista
    document.querySelectorAll('.mobile-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Replace cambiaVista with the correct function
            const viewType = btn.dataset.view;
            
            // Find all view buttons and update active state
            document.querySelectorAll('.view-btn').forEach(viewBtn => {
                if (viewBtn.dataset.view === viewType) {
                    viewBtn.click(); // Click the corresponding desktop view button
                }
            });
            
            updateMobileViewSelector();
        });
    });
}

/**
 * Aggiorna la data corrente nel selettore mobile
 */
function updateMobileCurrentDate() {
    const mobileCurrentDate = document.querySelector('.mobile-current-date');
    const currentDate = document.querySelector('.current-date');
    
    if (mobileCurrentDate && currentDate) {
        mobileCurrentDate.textContent = currentDate.textContent;
    }
}

/**
 * Aggiorna il selettore di vista mobile
 */
function updateMobileViewSelector() {
    document.querySelectorAll('.mobile-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === vistaAttuale);
    });
    
    updateMobileCurrentDate();
}

// Assicurati che il selettore mobile venga creato quando la pagina è caricata
document.addEventListener('DOMContentLoaded', function() {
    // Controlla se siamo su mobile
    const isMobile = window.innerWidth <= 992;
    
    if (isMobile) {
        createMobileViewSelector();
    }
    
    // Aggiungi un listener per il ridimensionamento della finestra
    window.addEventListener('resize', function() {
        const isMobile = window.innerWidth <= 992;
        const mobileSelector = document.querySelector('.mobile-view-selector');
        
        if (isMobile && !mobileSelector) {
            createMobileViewSelector();
        } else if (!isMobile && mobileSelector) {
            mobileSelector.remove();
        }
    });
});
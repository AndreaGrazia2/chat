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
    // Crea il container
    const mobileViewSelector = document.createElement('div');
    mobileViewSelector.className = 'mobile-view-selector';
    
    // Crea i pulsanti per le diverse viste
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
        
        // Aggiungi l'event listener
        button.addEventListener('click', () => {
            // Rimuovi la classe active da tutti i pulsanti
            document.querySelectorAll('.mobile-view-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Aggiungi la classe active al pulsante cliccato
            button.classList.add('active');
            
            // Aggiorna anche i pulsanti nella vista desktop
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.view === view.id) {
                    btn.classList.add('active');
                }
            });
            
            // Cambia la vista
            vistaAttuale = view.id;
            aggiornaVista();
        });
        
        mobileViewSelector.appendChild(button);
    });
    
    // Aggiungi il selettore al DOM
    document.querySelector('.app-container').appendChild(mobileViewSelector);
}

/**
 * Aggiorna la visibilità del selettore di vista mobile
 */
function updateMobileViewSelector() {
    const mobileViewSelector = document.querySelector('.mobile-view-selector');
    if (!mobileViewSelector) return;
    
    // Mostra il selettore solo su schermi piccoli
    if (window.innerWidth <= 768) {
        mobileViewSelector.style.display = 'flex';
        
        // Aggiungi padding al fondo del calendario per fare spazio al selettore
        document.querySelector('.calendar-area').style.paddingBottom = '60px';
    } else {
        mobileViewSelector.style.display = 'none';
        
        // Rimuovi il padding
        document.querySelector('.calendar-area').style.paddingBottom = '0';
    }
    
    // Aggiorna il pulsante attivo
    document.querySelectorAll('.mobile-view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === vistaAttuale) {
            btn.classList.add('active');
        }
    });
}

// Inizializza le funzionalità mobile quando il DOM è caricato
document.addEventListener('DOMContentLoaded', initMobile);
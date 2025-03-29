/**
 * mobile.js - Gestione delle funzionalità specifiche per dispositivi mobili
 */

// Handler functions defined outside to be able to remove them
export function handleMobilePrevClick() {
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.click();
    updateMobileCurrentDate();
}

export function handleMobileNextClick() {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.click();
    updateMobileCurrentDate();
}

export function handleMobileTodayClick() {
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) todayBtn.click();
    updateMobileCurrentDate();
}

export function handleMobileViewChange() {
    const viewType = this.dataset.view;

    document.querySelectorAll('.view-btn').forEach(viewBtn => {
        if (viewBtn.dataset.view === viewType) {
            viewBtn.click();
        }
    });

    updateMobileViewSelector();
}

/**
 * Inizializza le funzionalità mobile
 */
export function initMobile() {
    // Crea il selettore di vista mobile se non esiste già
    if (!document.querySelector('.mobile-view-selector')) {
        createMobileViewSelector();
    }

    // Aggiorna la visibilità del selettore di vista mobile in base alla dimensione dello schermo
    updateMobileViewSelector();

    // Aggiungi un listener per il ridimensionamento della finestra
    window.addEventListener('resize', updateMobileViewSelector);

    // Adatta il mini calendario per dispositivi mobili
    adjustMiniCalendarForMobile();

    // Aggiungi un listener per ridimensionamento per il mini calendario
    window.addEventListener('resize', adjustMiniCalendarForMobile);
}

/**
 * Adatta il mini calendario per dispositivi mobili
 */
export function adjustMiniCalendarForMobile() {
    // Verifica se siamo su dispositivo mobile
    if (window.innerWidth <= 768) {
        // Aggiungi classe specifica per dispositivi mobili al mini calendario
        const miniCalendar = document.getElementById('miniCalendar');
        if (miniCalendar) {
            miniCalendar.classList.add('mobile-optimized');

            // Assicura che tutti i giorni abbiano una dimensione touch adeguata
            const calendarDays = miniCalendar.querySelectorAll('.mini-calendar-day');
            calendarDays.forEach(day => {
                day.style.minWidth = '28px';
                day.style.minHeight = '28px';
            });
        }
    } else {
        // Rimuovi la classe se siamo su desktop
        const miniCalendar = document.getElementById('miniCalendar');
        if (miniCalendar) {
            miniCalendar.classList.remove('mobile-optimized');

            // Reimposta le dimensioni
            const calendarDays = miniCalendar.querySelectorAll('.mini-calendar-day');
            calendarDays.forEach(day => {
                day.style.minWidth = '';
                day.style.minHeight = '';
            });
        }
    }
}

/**
 * Crea il selettore di vista mobile
 */
export function createMobileViewSelector() {
    // Rimuovi eventuali selettori esistenti
    const existingSelector = document.querySelector('.mobile-view-selector');
    if (existingSelector) {
        // Rimuovi prima i listener
        const prevBtn = existingSelector.querySelector('#mobilePrevBtn');
        const nextBtn = existingSelector.querySelector('#mobileNextBtn');
        const todayBtn = existingSelector.querySelector('#mobileTodayBtn');

        if (prevBtn) prevBtn.removeEventListener('click', handleMobilePrevClick);
        if (nextBtn) nextBtn.removeEventListener('click', handleMobileNextClick);
        if (todayBtn) todayBtn.removeEventListener('click', handleMobileTodayClick);

        existingSelector.querySelectorAll('.mobile-view-btn').forEach(btn => {
            btn.removeEventListener('click', handleMobileViewChange);
        });

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
        button.className = `mobile-view-btn ${view.id === window.vistaAttuale ? 'active' : ''}`;
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

    // Aggiungi gli event listener con le funzioni handler separate
    document.getElementById('mobilePrevBtn').addEventListener('click', handleMobilePrevClick);
    document.getElementById('mobileNextBtn').addEventListener('click', handleMobileNextClick);
    document.getElementById('mobileTodayBtn').addEventListener('click', handleMobileTodayClick);

    document.querySelectorAll('.mobile-view-btn').forEach(btn => {
        btn.addEventListener('click', handleMobileViewChange);
    });
}

/**
 * Aggiorna la data corrente nel selettore mobile
 */
export function updateMobileCurrentDate() {
    const mobileCurrentDate = document.querySelector('.mobile-current-date');
    const currentDate = document.querySelector('.current-date');

    if (mobileCurrentDate && currentDate) {
        mobileCurrentDate.textContent = currentDate.textContent;
    }
}

/**
 * Aggiorna il selettore di vista mobile
 */
export function updateMobileViewSelector() {
    document.querySelectorAll('.mobile-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === window.vistaAttuale);
    });

    updateMobileCurrentDate();
}

// Assicurati che il selettore mobile venga creato quando la pagina è caricata
document.addEventListener('DOMContentLoaded', function () {
    // Controlla se siamo su mobile
    const isMobile = window.innerWidth <= 992;

    if (isMobile) {
        createMobileViewSelector();
    }

    // Aggiungi un listener per il ridimensionamento della finestra
    window.addEventListener('resize', function () {
        const isMobile = window.innerWidth <= 992;
        const mobileSelector = document.querySelector('.mobile-view-selector');

        if (isMobile && !mobileSelector) {
            createMobileViewSelector();
        } else if (!isMobile && mobileSelector) {
            mobileSelector.remove();
        }
    });
});
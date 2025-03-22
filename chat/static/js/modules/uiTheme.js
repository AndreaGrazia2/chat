/**
 * uiTheme.js - Gestione del tema dell'interfaccia
 */

// Variabile di stato per il tema
window.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

function toggleTheme() {
    darkMode = !darkMode;
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    document.querySelector('.theme-toggle').innerHTML = darkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    
    // Salva la preferenza dell'utente
    localStorage.setItem('chatDarkMode', darkMode);
    
    // Non tentare di sincronizzare con il server se l'endpoint non esiste
    // saveThemePreference(darkMode ? 'dark' : 'light');
}

function initializeTheme() {
    console.log('Initializing theme...');
    
    // Usa direttamente le impostazioni locali invece di tentare di contattare il server
    const savedDarkMode = localStorage.getItem('chatDarkMode');
    
    if (savedDarkMode !== null) {
        // Usa la preferenza salvata
        darkMode = savedDarkMode === 'true';
        console.log('Using localStorage theme, darkMode:', darkMode);
    } else {
        // Usa la preferenza del sistema
        darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        console.log('Using system preference, darkMode:', darkMode);
    }
    
    applyTheme();
}

function applyTheme() {
    console.log('Applying theme, darkMode:', darkMode);
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = darkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
    
    // Ensure consistent icon sizing for fa-bars to match calendar
    const menuIcons = document.querySelectorAll('.fas.fa-bars');
    menuIcons.forEach(icon => {
        icon.classList.add('calendar-icon-size');
    });
}

// Auto-inizializza il tema quando il modulo viene caricato
document.addEventListener('DOMContentLoaded', initializeTheme);

export {
    toggleTheme,
    initializeTheme    
}
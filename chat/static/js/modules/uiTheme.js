/**
 * uiTheme.js - Gestione del tema dell'interfaccia
 */

// Variabile di stato per il tema
let darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

function toggleTheme() {
    darkMode = !darkMode;
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    document.querySelector('.theme-toggle').textContent = darkMode ? '☀️' : '🌙';
    
    // Salva la preferenza dell'utente
    localStorage.setItem('darkMode', darkMode);
    
    // Non tentare di sincronizzare con il server se l'endpoint non esiste
    // saveThemePreference(darkMode ? 'dark' : 'light');
}

function initializeTheme() {
    console.log('Initializing theme...');
    
    // Usa direttamente le impostazioni locali invece di tentare di contattare il server
    const savedDarkMode = localStorage.getItem('darkMode');
    
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
        themeToggle.textContent = darkMode ? '☀️' : '🌙';
    }
}

// Auto-inizializza il tema quando il modulo viene caricato
document.addEventListener('DOMContentLoaded', initializeTheme);

export {
    toggleTheme,
    initializeTheme,
    darkMode
}
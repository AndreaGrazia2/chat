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
}

function initializeTheme() {
    // Controlla se c'è una preferenza salvata
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode !== null) {
        // Usa la preferenza salvata
        darkMode = savedDarkMode === 'true';
    } else {
        // Usa la preferenza del sistema
        darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    // Applica il tema
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    document.querySelector('.theme-toggle').textContent = darkMode ? '☀️' : '🌙';
}

export {
    toggleTheme,
    initializeTheme,
    darkMode
};
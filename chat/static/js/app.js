/**
 * app.js - Entry point dell'applicazione
 * 
 * Inizializza l'applicazione quando il DOM è caricato.
 */

// Inizializza l'app quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    // Inizializza l'applicazione
    if (typeof initializeApp === 'function') {
        initializeApp();
        console.log('Applicazione inizializzata con successo.');
    } else {
        console.error('Funzione initializeApp non trovata. Verifica che i moduli siano caricati correttamente.');
    }
});

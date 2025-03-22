/**
 * app.js - File bridge per rendere disponibili le funzioni dei moduli
 */

// Importa le variabili globali
import * as globals from './modules/globals.js';

// Importa le funzioni dai moduli
import { initializeApp } from './modules/coreInit.js';

// Rendi disponibili globalmente le variabili
Object.entries(globals).forEach(([key, value]) => {
    window[key] = value;
});

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

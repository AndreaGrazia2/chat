// Import delle funzioni da testare - percorso aggiornato
const { 
  formatTime, 
  formatDate, 
  linkifyText,
  debug,
  showLoader,
  hideLoader,
  showNotification,
  showConfirmDialog
} = require('../chat/static/js/utils');

// Test esistenti per formatTime, formatDate e linkifyText
describe('formatTime', () => {
  test('formatta correttamente l\'orario', () => {
    const date = new Date('2023-01-01T14:30:00');
    // Modifica per accettare il formato 12 ore (02:30 PM)
    expect(formatTime(date)).toMatch(/02:30 PM/);
  });

  test('gestisce input di tipo stringa', () => {
    // Modifica per accettare il formato 12 ore (02:30 PM)
    expect(formatTime('2023-01-01T14:30:00')).toMatch(/02:30 PM/);
  });
});

// Test per formatDate
describe('formatDate', () => {
  test('formatta correttamente la data', () => {
    const date = new Date('2023-01-01T14:30:00');
    // Il formato esatto dipende dalle impostazioni locali
    expect(formatDate(date)).toContain('1');
    expect(formatDate(date)).toMatch(/January|gennaio|Gennaio/i);
  });

  test('gestisce input di tipo stringa', () => {
    const result = formatDate('2023-01-01T14:30:00');
    expect(result).toContain('1');
    expect(result).toMatch(/January|gennaio|Gennaio/i);
  });
});

// Test per linkifyText
describe('linkifyText', () => {
  test('converte URL normali in link HTML', () => {
    const text = 'Visita https://example.com per maggiori informazioni';
    const result = linkifyText(text);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  test('gestisce URL con classe link-example', () => {
    const text = 'Visita <span class="link-example">https://example.com</span> per info';
    const result = linkifyText(text);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('class="link-example"');
  });

  test('non modifica testo senza URL', () => {
    const text = 'Questo è un testo senza URL';
    const result = linkifyText(text);
    expect(result).toBe(text);
  });

  test('gestisce input vuoto', () => {
    expect(linkifyText('')).toBe('');
    expect(linkifyText(null)).toBe('');
    expect(linkifyText(undefined)).toBe('');
  });
});

// Test per debug
describe('debug', () => {
  test('non causa errori quando chiamato', () => {
    // Mock di console.log per evitare output nei test
    const originalConsoleLog = console.log;
    console.log = jest.fn();
    
    // Verifica che la funzione non generi errori
    expect(() => debug('Test message')).not.toThrow();
    expect(() => debug('Test message', { data: 'test' })).not.toThrow();
    
    // Ripristina console.log
    console.log = originalConsoleLog;
  });
});

// Test per showLoader e hideLoader
describe('loader functions', () => {
  beforeEach(() => {
    // Setup del DOM per i test
    document.body.innerHTML = `
      <div id="messagesLoader"></div>
    `;
  });
  
  test('showLoader aggiunge la classe active', () => {
    const loader = document.getElementById('messagesLoader');
    showLoader();
    expect(loader.classList.contains('active')).toBe(true);
  });
  
  test('hideLoader rimuove la classe active', () => {
    const loader = document.getElementById('messagesLoader');
    loader.classList.add('active');
    hideLoader();
    expect(loader.classList.contains('active')).toBe(false);
  });
  
  test('le funzioni non generano errori se l\'elemento non esiste', () => {
    document.body.innerHTML = ''; // Rimuove tutti gli elementi
    expect(() => showLoader()).not.toThrow();
    expect(() => hideLoader()).not.toThrow();
  });
});

// Test per showNotification
describe('showNotification', () => {
  beforeEach(() => {
    // Pulisci il DOM prima di ogni test
    document.body.innerHTML = '';
  });
  
  test('crea un elemento di notifica nel DOM', () => {
    showNotification('Test notification');
    
    // Verifica che la notifica sia stata aggiunta al DOM
    const notifications = document.body.querySelectorAll('div');
    expect(notifications.length).toBeGreaterThan(0);
    
    // Verifica che il testo della notifica sia corretto
    expect(notifications[0].textContent).toBe('Test notification');
  });
  
  test('usa colori diversi per errori e successi', () => {
    // Notifica di successo (default)
    showNotification('Success');
    const successNotification = document.body.querySelector('div');
    const successStyle = successNotification.style.background;
    
    // Pulisci il DOM
    document.body.innerHTML = '';
    
    // Notifica di errore
    showNotification('Error', true);
    const errorNotification = document.body.querySelector('div');
    const errorStyle = errorNotification.style.background;
    
    // Verifica che gli stili siano diversi
    expect(successStyle).not.toBe(errorStyle);
  });
});

// Test per showConfirmDialog
describe('showConfirmDialog', () => {
  beforeEach(() => {
    // Setup del DOM per i test
    document.body.innerHTML = `
      <div id="confirmDialog" style="display: none;">
        <p id="confirmMessage"></p>
        <button id="confirmAction">Confirm</button>
        <button id="cancelConfirm">Cancel</button>
      </div>
    `;
  });
  
  test('mostra il dialogo con il messaggio corretto', () => {
    const dialog = document.getElementById('confirmDialog');
    const message = document.getElementById('confirmMessage');
    
    showConfirmDialog('Are you sure?', () => {});
    
    expect(dialog.style.display).toBe('flex');
    expect(message.textContent).toBe('Are you sure?');
  });
  
  test('esegue il callback quando si conferma', () => {
    const mockCallback = jest.fn();
    showConfirmDialog('Test confirm', mockCallback);
    
    // Simula il click sul pulsante di conferma
    document.getElementById('confirmAction').click();
    
    expect(mockCallback).toHaveBeenCalled();
    expect(document.getElementById('confirmDialog').style.display).toBe('none');
  });
  
  test('nasconde il dialogo quando si annulla', () => {
    const mockCallback = jest.fn();
    showConfirmDialog('Test cancel', mockCallback);
    
    // Simula il click sul pulsante di annullamento
    document.getElementById('cancelConfirm').click();
    
    expect(mockCallback).not.toHaveBeenCalled();
    expect(document.getElementById('confirmDialog').style.display).toBe('none');
  });
});
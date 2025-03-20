#!/usr/bin/env python3
"""
js_splitter.py - Script per suddividere file JavaScript monolitici in moduli più piccoli

Questo script analizza i file JavaScript esistenti e li suddivide in moduli più piccoli
senza utilizzare la sintassi dei moduli ES6.
"""

import os
import re
import shutil
from collections import defaultdict

# Percorsi corretti basati sulla struttura del progetto fornita
INPUT_FILES = [
    'static/js/app.js',
    'static/js/chat.js',
    'static/js/socketio.js',
    'static/js/utils.js'
]
OUTPUT_DIR = 'static/js/modules'  # Directory di output
SAVE_ORIGINAL = True  # Se True, salva una copia dei file originali

# Struttura dei moduli
MODULES = {
    'globals.js': {
        'description': 'Variabili globali condivise',
    },
    'core.js': {
        'description': 'Funzionalità principali e inizializzazione',
        'functions': [
            'initializeApp', 'setupHistoryLockFailsafe', 'setupEventListeners',
            'setupScrollHandlers', 'handleScroll', 'loadOlderMessages',
            'loadInitialMessages', 'loadMoreMessages', 'resetMessages'
        ]
    },
    'ui.js': {
        'description': 'Gestione interfaccia utente',
        'functions': [
            'toggleTheme', 'toggleSidebar', 'setActiveChannel', 'setActiveUser',
            'updateChatHeaderInfo', 'filterSidebarItems', 'toggleSearchPanel',
            'searchMessages', 'updateSearchResultsPanel', 'clearSearchResults',
            'prevSearchResult', 'nextSearchResult', 'updateSearchCounter',
            'highlightAndScrollToMessage', 'showContextMenu', 'toggleScrollBottomButton',
            'scrollToBottom', 'updateUnreadBadge', 'initializeSearchClearButtons',
            'renderUsersList', 'renderChannelsList'
        ]
    },
    'chat.js': {
        'description': 'Gestione messaggi e conversazioni',
        'functions': [
            'createMessageElement', 'sendMessage', 'handleReply', 'cancelReply',
            'forwardMessage', 'copyMessageText', 'editMessage', 'deleteMessage',
            'loadChannelMessages', 'loadDirectMessages', 'renderMessages',
            'loadInitialData', 'refreshCurrentConversation', 'getUserIdByName'
        ]
    },
    'socket.js': {
        'description': 'Gestione Socket.IO e comunicazione tempo reale',
        'functions': [
            'initializeSocketIO', 'setupSocketIOEvents', 'handleSocketConnect',
            'handleSocketDisconnect', 'handleMessageHistory', 'handleNewMessage',
            'handleUserTyping', 'handleModelInference', 'handleUserStatusUpdate',
            'joinChannel', 'joinDirectMessage', 'sendChannelMessage', 
            'sendDirectMessage', 'sendTypingEvent', 'debugSocketIO'
        ]
    },
    'utils.js': {
        'description': 'Funzioni di utilità',
        'functions': [
            'debug', 'formatTime', 'formatDate', 'showLoader', 'hideLoader',
            'linkifyText', 'showNotification', 'showConfirmDialog', 'diagnoseChatIssues'
        ]
    }
}

def backup_original_files():
    """Crea backup dei file originali."""
    backup_dir = 'static/js/original'
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    for file_path in INPUT_FILES:
        if os.path.exists(file_path):
            filename = os.path.basename(file_path)
            shutil.copy2(file_path, os.path.join(backup_dir, filename))
            print(f"Backup creato: {os.path.join(backup_dir, filename)}")

def create_output_dir():
    """Crea la directory di output se non esiste."""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Creata directory: {OUTPUT_DIR}")

def extract_function_definitions(content):
    """Estrae tutte le definizioni di funzioni dal contenuto."""
    # Pattern per trovare definizioni di funzioni
    function_pattern = r'function\s+(\w+)\s*\([^)]*\)\s*\{'
    
    functions = {}
    matches = list(re.finditer(function_pattern, content))
    
    for i, match in enumerate(matches):
        func_name = match.group(1)
        start_pos = match.start()
        
        # Trova la parentesi di apertura della funzione
        open_pos = content.find('{', start_pos)
        if open_pos == -1:
            continue
        
        # Trova la fine della funzione (tracciando le parentesi graffe)
        open_braces = 1
        end_pos = open_pos + 1
        
        while end_pos < len(content) and open_braces > 0:
            if content[end_pos] == '{':
                open_braces += 1
            elif content[end_pos] == '}':
                open_braces -= 1
            end_pos += 1
        
        # Se abbiamo trovato la chiusura della funzione
        if open_braces == 0:
            # Estrai la funzione completa
            func_content = content[start_pos:end_pos]
            functions[func_name] = func_content
    
    return functions

def extract_global_variables(content):
    """Estrae le variabili globali dal contenuto."""
    global_vars = []
    
    # Pattern per trovare dichiarazioni di variabili
    var_pattern = r'(?:^|\n)(?:let|var|const)\s+([^{=]+?)\s*=\s*([^;]*?);'
    
    # Trova tutte le dichiarazioni di variabili globali
    for match in re.finditer(var_pattern, content, re.MULTILINE):
        var_decl = match.group(0)
        # Semplice euristica per evitare variabili all'interno di funzioni
        prev_content = content[:match.start()]
        open_braces = prev_content.count('{') - prev_content.count('}')
        
        # Se il numero di parentesi graffe aperte è 0 o 1 (per il blocco principale)
        # consideriamo la variabile come globale
        if open_braces <= 1:
            global_vars.append(var_decl)
    
    # Pattern per array e oggetti globali (più complessi)
    array_obj_pattern = r'(?:^|\n)(?:let|var|const)\s+(\w+)\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*?\});'
    
    for match in re.finditer(array_obj_pattern, content, re.MULTILINE):
        var_decl = match.group(0)
        # Stessa euristica per evitare catture all'interno di funzioni
        prev_content = content[:match.start()]
        open_braces = prev_content.count('{') - prev_content.count('}')
        
        if open_braces <= 1:
            global_vars.append(var_decl)
    
    return global_vars

def generate_modules():
    """Genera i file dei moduli."""
    # Contenuto estratto da tutti i file
    all_functions = {}
    all_globals = []
    
    # Leggi e analizza i file di input
    for file_path in INPUT_FILES:
        if not os.path.exists(file_path):
            print(f"File non trovato: {file_path}")
            continue
        
        print(f"Analisi di {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Estrai funzioni e variabili globali
        functions = extract_function_definitions(content)
        globals_vars = extract_global_variables(content)
        
        # Aggiorna le collezioni complessive
        all_functions.update(functions)
        all_globals.extend(globals_vars)
    
    # Crea contenuto per ogni modulo
    module_contents = defaultdict(str)
    
    # Aggiungi variabili globali a globals.js
    for var_decl in all_globals:
        module_contents['globals.js'] += var_decl + "\n\n"
    
    # Assegna funzioni ai moduli appropriati
    assigned_functions = set()
    
    for module_name, module_info in MODULES.items():
        if 'functions' in module_info:
            for func_name in module_info['functions']:
                if func_name in all_functions:
                    module_contents[module_name] += all_functions[func_name] + "\n\n"
                    assigned_functions.add(func_name)
    
    # Identifica funzioni non assegnate
    unassigned = set(all_functions.keys()) - assigned_functions
    if unassigned:
        print(f"\nFunzioni non assegnate ({len(unassigned)}):")
        for func in sorted(unassigned):
            print(f"  - {func}")
        
        # Aggiungi le funzioni non assegnate a core.js
        for func_name in unassigned:
            module_contents['core.js'] += all_functions[func_name] + "\n\n"
    
    # Scrivi i file dei moduli
    for module_name, content in module_contents.items():
        description = MODULES.get(module_name, {}).get('description', 'Modulo JavaScript')
        
        # Crea intestazione del file
        header = f"""/**
 * {module_name} - {description}
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

"""
        
        # Scrivi il file
        output_path = os.path.join(OUTPUT_DIR, module_name)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(header + content)
        
        print(f"Creato modulo: {output_path}")
    
    # Crea app.js principale
    create_app_js()
    
    # Crea lo snippet HTML per includere i file
    create_html_include_snippet()

def create_app_js():
    """Crea il file app.js principale."""
    content = """/**
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
"""
    
    output_path = 'static/js/app.js'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Creato file app.js: {output_path}")

def create_html_include_snippet():
    """Crea uno snippet HTML per includere tutti i moduli."""
    modules = ['globals.js', 'utils.js', 'ui.js', 'chat.js', 'socket.js', 'core.js']
    
    html = "<!-- Inclusione dei moduli JavaScript -->\n"
    
    # Aggiungi i moduli nell'ordine corretto
    for module in modules:
        module_path = f"static/js/modules/{module}"
        html += f'<script src="{{ url_for(\'static\', filename=\'js/modules/{module}\') }}"></script>\n'
    
    # Aggiungi app.js alla fine
    html += '<script src="{{ url_for(\'static\', filename=\'js/app.js\') }}"></script>\n'
    
    output_path = os.path.join(OUTPUT_DIR, 'include_snippet.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Creato snippet HTML: {output_path}")

def main():
    """Funzione principale."""
    print("=== JS Splitter - Divisione file JavaScript ===")
    
    # Crea backup dei file originali
    if SAVE_ORIGINAL:
        backup_original_files()
    
    # Crea directory di output
    create_output_dir()
    
    # Genera i moduli
    generate_modules()
    
    print("\nOperazione completata!")
    print(f"I moduli sono stati salvati in: {OUTPUT_DIR}")
    print(f"Aggiungi lo snippet HTML dal file {os.path.join(OUTPUT_DIR, 'include_snippet.html')} al tuo file HTML principale.")
    print("\nIstruzioni per completare l'integrazione:")
    print("1. Sostituisci i tag script nel tuo HTML con il contenuto dello snippet generato")
    print("2. Verifica che l'applicazione funzioni correttamente")
    print("3. Se tutto funziona, puoi rimuovere i file JS originali o lasciarli come backup")

if __name__ == "__main__":
    main()
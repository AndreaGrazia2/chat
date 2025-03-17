#!/usr/bin/env python3
import os
import re
import sys

# Configurazione: definisci quali funzioni vanno in quali file
function_mapping = {
    'js/connections.js': [
        'createTempConnection', 'updateTempConnection', 'removeTempConnection',
        'addConnection', 'renderConnection', 'selectConnection',
        'updateConnections', 'updateConnectionPath', 'updateConnectionHitArea',
        'deleteConnection'
    ],
    'js/nodes.js': [
        'addNode', 'renderNode', 'selectNode', 'clearSelection',
        'deleteSelectedNodes'
    ],
    'js/ui.js': [
        'showConfigPanel', 'createZoomControls', 'initCanvasTransform',
        'updateCanvasTransform', 'zoomCanvas', 'resetView',
        'showConfirmModal', 'initTheme', 'getCanvasCoordinates',
        'updateDeleteButton', 'addUsageInstructions'
    ],
    'js/utils.js': [
        'startSelection', 'updateSelection', 'endSelection',
        'validateWorkflow', 'hasCycle', 'dfsCheckCycle', 'highlightCycle',
        'clearWorkflow', 'loadWorkflow'
    ]
}

# Constants e variabili che vanno in ogni file
constants_mapping = {
    'js/connections.js': [
        'isConnecting', 'connectionStart', 'connectionStartEl', 'connections', 'selectedConnection'
    ],
    'js/nodes.js': [
        'nodes', 'selectedNodes', 'nextNodeId', 'nodeOffsets',
        'isDragging', 'dragStartX', 'dragStartY'
    ],
    'js/ui.js': [
        'configPanel', 'typeConfigs', 'zoomLevelElement'
    ],
    'js/utils.js': [
        'isSelecting', 'selectionBox', 'selectionStartX', 'selectionStartY',
        'scale', 'panX', 'panY', 'isPanning', 'panStartX', 'panStartY', 'spaceKeyPressed'
    ]
}

# Path del file sorgente
source_file = 'workflow.js'

# Leggi il contenuto del file
with open(source_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Assicurati che la cartella js esista
if not os.path.exists('js'):
    os.makedirs('js')

# Estrai le funzioni
function_definitions = {}
all_functions = []

# Trova tutte le definizioni di funzione
pattern = r'function\s+(\w+)\s*\([^)]*\)\s*\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\}'
matches = re.finditer(pattern, content, re.DOTALL)

for match in matches:
    full_function = match.group(0)
    function_name = match.group(1)
    all_functions.append(function_name)
    function_definitions[function_name] = full_function

# Crea i file di destinazione con intestazioni e importazioni
for file_path in function_mapping.keys():
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f'// Modulo {os.path.basename(file_path)}\n\n')
        
        # Aggiungi importazioni
        imports = []
        for other_file, funcs in function_mapping.items():
            if other_file != file_path:
                other_module = os.path.basename(other_file).replace('.js', '')
                imports.append(f'import * as {other_module.capitalize()} from \'./{other_module}.js\';')
        
        if imports:
            f.write('\n'.join(imports) + '\n\n')
        
        # Esporta funzioni
        exports = []
        for func in function_mapping[file_path]:
            exports.append(f'export {function_definitions.get(func, "function " + func + "() {/* TODO: Implement */}")}')
        
        if exports:
            f.write('\n\n'.join(exports))

# Crea il file workflow.js principale
with open('js/workflow.js', 'w', encoding='utf-8') as f:
    f.write('// File principale dell\'applicazione\n\n')
    
    # Importa tutti i moduli
    imports = []
    for file_path in function_mapping.keys():
        module = os.path.basename(file_path).replace('.js', '')
        imports.append(f'import * as {module.capitalize()} from \'./{module}.js\';')
    
    f.write('\n'.join(imports) + '\n\n')
    
    # Aggiungi il listener DOMContentLoaded
    f.write('''
// Inizializzazione dell'applicazione
document.addEventListener('DOMContentLoaded', function () {
    // Elementi DOM principali
    const canvas = document.getElementById('workflow-canvas');
    const configPanel = document.getElementById('config-panel');
    const saveBtn = document.getElementById('save-btn');
    const loadFile = document.getElementById('load-file');
    const closeConfig = document.getElementById('close-config');
    const saveConfig = document.getElementById('save-config');
    const configTitle = document.getElementById('config-title');
    const nodeNameInput = document.getElementById('node-name');
    const typeSpecificConfig = document.getElementById('type-specific-config');
    const deleteNodeBtn = document.getElementById('delete-node-btn');
    const deleteButtonContainer = document.getElementById('delete-btn-container');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');

    // Stato dell'applicazione
    let nodes = [];
    let connections = [];
    let nextNodeId = 1;
    let selectedNodes = [];
    let selectedConnection = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let nodeOffsets = [];
    let isConnecting = false;
    let connectionStart = null;
    let connectionStartEl = null;
    let pendingAction = null;

    // Variabili per selezione multipla
    let isSelecting = false;
    let selectionBox = null;
    let selectionStartX = 0;
    let selectionStartY = 0;

    // Variabili per zoom e pan
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let spaceKeyPressed = false;
    let zoomLevelElement = null;

    // Inizializza l'applicazione
    Ui.initTheme();
    const canvasContent = Ui.initCanvasTransform();
    const zoomControls = Ui.createZoomControls();
    Ui.updateCanvasTransform();
    Ui.addUsageInstructions();

    // Event listeners
    // ... qui dovresti copiare tutti gli event listener dal file originale
    
    // Se hai bisogno di accedere a funzioni specifiche da altri moduli, usa:
    // Nodes.addNode(...)
    // Connections.renderConnection(...)
    // Utils.validateWorkflow(...)
});
''')

print("Script completato! I file sono stati creati nella cartella 'js/'.")
print("Nota: Dovrai completare manualmente il file workflow.js con gli event listeners e verificare che tutto funzioni correttamente.")
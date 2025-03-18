// Modulo ui.js

import { DOM, state, typeConfigs } from './stato.js';
import * as Connections from './connections.js';
import * as Nodes from './nodes.js';

export function showConfigPanel(node) {
    DOM.configPanel.classList.remove('hidden');
    DOM.configTitle.textContent = `${node.config.name || node.name} Settings`;
    DOM.nodeNameInput.value = node.config.name || node.name;

    // Mostra il pulsante cestino
    DOM.deleteButtonContainer.classList.remove('hidden');

    // Aggiorna la configurazione specifica per tipo
    if (typeConfigs[node.type]) {
        DOM.typeSpecificConfig.innerHTML = typeConfigs[node.type]();

        // Imposta i valori sui campi
        if (node.type === 'trigger') {
            const triggerType = document.getElementById('trigger-type');
            if (triggerType) {
                triggerType.value = node.config.triggerType || 'interval';
            }

            const intervalValue = document.getElementById('interval-value');
            if (intervalValue) {
                intervalValue.value = node.config.interval || 5;
            }

            // Aggiungi listener per mostrare/nascondere campi specifici
            triggerType.addEventListener('change', function () {
                const intervalConfig = document.getElementById('interval-config');
                if (this.value === 'interval') {
                    intervalConfig.classList.remove('hidden');
                } else {
                    intervalConfig.classList.add('hidden');
                }
            });

            // Imposta visibilità iniziale
            const intervalConfig = document.getElementById('interval-config');
            if (triggerType.value !== 'interval') {
                intervalConfig.classList.add('hidden');
            }
        } else if (node.type === 'action') {
            const actionConfig = document.getElementById('action-config');
            if (actionConfig) {
                actionConfig.value = node.config.actionConfig || '';
            }
        } else if (node.type === 'condition') {
            const conditionExpr = document.getElementById('condition-expr');
            if (conditionExpr) {
                conditionExpr.value = node.config.expression || '';
            }
        } else if (node.type === 'output') {
            const outputType = document.getElementById('output-type');
            if (outputType) {
                outputType.value = node.config.outputType || 'api';
            }

            const apiEndpoint = document.getElementById('api-endpoint');
            if (apiEndpoint) {
                apiEndpoint.value = node.config.endpoint || '';
            }

            // Aggiungi listener per mostrare/nascondere campi specifici
            outputType.addEventListener('change', function () {
                const apiConfig = document.getElementById('api-config');
                if (this.value === 'api') {
                    apiConfig.classList.remove('hidden');
                } else {
                    apiConfig.classList.add('hidden');
                }
            });

            // Imposta visibilità iniziale
            const apiConfig = document.getElementById('api-config');
            if (outputType.value !== 'api') {
                apiConfig.classList.add('hidden');
            }
        }
    } else {
        DOM.typeSpecificConfig.innerHTML = '';
    }
}

export function createZoomControls() {
    const zoomControls = document.createElement('div');
    zoomControls.className = 'fixed bottom-4 right-4 flex space-x-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-10 transition-colors duration-200';
    zoomControls.innerHTML = `
    <button id="zoom-in-btn" class="p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200" title="Zoom In">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>
    <button id="zoom-out-btn" class="p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200" title="Zoom Out">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
      </svg>
    </button>
    <button id="reset-zoom-btn" class="p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200" title="Reset View">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
      </svg>
    </button>
    <span id="zoom-level" class="p-2 bg-gray-100 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 text-sm transition-colors duration-200">100%</span>
  `;
    document.body.appendChild(zoomControls);

    // Salva il riferimento all'elemento dello zoom level
    DOM.zoomLevelElement = zoomControls.querySelector('#zoom-level');

    // Aggiungi event listeners per i pulsanti di zoom
    zoomControls.querySelector('#zoom-in-btn').addEventListener('click', () => {
        zoomCanvas(0.1);
    });

    zoomControls.querySelector('#zoom-out-btn').addEventListener('click', () => {
        zoomCanvas(-0.1);
    });

    zoomControls.querySelector('#reset-zoom-btn').addEventListener('click', () => {
        resetView();
    });

    return zoomControls;
}

export function initCanvasTransform() {
    // Crea un wrapper per trasformazione all'interno del canvas
    const canvasContent = document.createElement('div');
    canvasContent.id = 'canvas-content';
    canvasContent.style.position = 'absolute';
    canvasContent.style.width = '100%';
    canvasContent.style.height = '100%';
    canvasContent.style.transformOrigin = '0 0';
    canvasContent.style.transition = 'transform 0.1s ease';

    // Sposta tutti i figli esistenti del canvas al contenitore
    while (DOM.canvas.firstChild) {
        canvasContent.appendChild(DOM.canvas.firstChild);
    }

    DOM.canvas.appendChild(canvasContent);

    // Crea il rettangolo di selezione (nascosto inizialmente)
    DOM.selectionBox = document.createElement('div');
    DOM.selectionBox.id = 'selection-box';
    DOM.selectionBox.style.position = 'absolute';
    DOM.selectionBox.style.border = '1px dashed #1d74f5';
    DOM.selectionBox.style.backgroundColor = 'rgba(29, 116, 245, 0.1)';
    DOM.selectionBox.style.pointerEvents = 'none';
    DOM.selectionBox.style.display = 'none';
    DOM.selectionBox.style.zIndex = '10';
    canvasContent.appendChild(DOM.selectionBox);

    return canvasContent;
}

export function updateCanvasTransform() {
    const canvasContent = document.getElementById('canvas-content');
    if (canvasContent) {
        canvasContent.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;

        // Aggiorna il testo dello zoom level se l'elemento esiste
        if (DOM.zoomLevelElement) {
            DOM.zoomLevelElement.textContent = `${Math.round(state.scale * 100)}%`;
        }
    }
}

export function zoomCanvas(delta) {
    const oldScale = state.scale;
    state.scale = Math.max(0.1, Math.min(2, state.scale + delta));

    // Aggiorna la trasformazione
    updateCanvasTransform();

    // Aggiorna le connessioni per il nuovo scale
    Connections.updateConnections();
}

export function resetView() {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    updateCanvasTransform();
    Connections.updateConnections();
}

export function showConfirmModal(title, message, callback, infoOnly = false) {
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    DOM.confirmModal.classList.remove('hidden');

    // Per i messaggi informativi, nascondi il pulsante di cancellazione e rinomina "Confirm" in "OK"
    if (infoOnly) {
        DOM.cancelBtn.classList.add('hidden');
        DOM.confirmBtn.textContent = 'OK';
    } else {
        DOM.cancelBtn.classList.remove('hidden');
        DOM.confirmBtn.textContent = 'Confirm';
    }

    // Salva l'azione in sospeso
    state.pendingAction = callback;
}

export function initTheme() {
    const darkMode = localStorage.getItem('workflow-theme') === 'true';
    if (darkMode) {
        document.documentElement.classList.add('dark');
        document.getElementById('sun-icon').classList.remove('hidden');
        document.getElementById('moon-icon').classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('sun-icon').classList.add('hidden');
        document.getElementById('moon-icon').classList.remove('hidden');
    }
}

export function getCanvasCoordinates(clientX, clientY) {
    const rect = DOM.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - state.panX) / state.scale;
    const y = (clientY - rect.top - state.panY) / state.scale;
    return { x, y };
}

export function updateDeleteButton() {
    if ((state.selectedNodes.length > 0 || state.selectedConnection) && !DOM.configPanel.classList.contains('hidden')) {
        // Mostra il pulsante se c'è qualcosa selezionato E il pannello configurazione è visibile
        DOM.deleteButtonContainer.classList.remove('hidden');

        // Aggiorna il testo del pulsante per riflettere il numero di elementi selezionati
        if (state.selectedNodes.length > 1) {
            DOM.deleteNodeBtn.title = `Delete ${state.selectedNodes.length} selected nodes`;
        } else if (state.selectedNodes.length === 1) {
            DOM.deleteNodeBtn.title = `Delete node`;
        } else if (state.selectedConnection) {
            DOM.deleteNodeBtn.title = `Delete connection`;
        }
    } else {
        // Nascondi il pulsante se non c'è nulla selezionato
        DOM.deleteButtonContainer.classList.add('hidden');
    }
}

export function addUsageInstructions() {
    const instructions = document.createElement('div');
    instructions.className = 'absolute top-20 left-4 bg-white dark:bg-gray-800 p-2 rounded shadow-lg text-gray-800 dark:text-gray-200 text-xs z-10 opacity-80 hover:opacity-100 transition-opacity duration-200';
    instructions.innerHTML = `
    <div class="font-bold mb-1">Shortcuts:</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Shift + Drag</span> - Select multiple nodes</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Space + Drag</span> - Pan canvas</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Mouse Wheel</span> - Zoom in/out</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Delete</span> - Remove selected items</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl + A</span> - Select all nodes</div>
    <div><span class="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Escape</span> - Cancel connection</div>
  `;
    DOM.canvas.appendChild(instructions);
}
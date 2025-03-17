// stato.js - Modulo per gestire lo stato condiviso dell'applicazione

// Elementi DOM principali
export const DOM = {
    canvas: null,
    configPanel: null,
    saveBtn: null,
    loadFile: null,
    closeConfig: null,
    saveConfig: null,
    configTitle: null,
    nodeNameInput: null,
    typeSpecificConfig: null,
    deleteNodeBtn: null,
    deleteButtonContainer: null,
    clearAllBtn: null,
    confirmModal: null,
    confirmBtn: null,
    cancelBtn: null,
    modalTitle: null,
    modalMessage: null,
    canvasContent: null,
    selectionBox: null,
    zoomLevelElement: null
};

// Stato dell'applicazione
export const state = {
    nodes: [],
    connections: [],
    nextNodeId: 1,
    selectedNodes: [],
    selectedConnection: null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    nodeOffsets: [],
    isConnecting: false,
    connectionStart: null,
    connectionStartEl: null,
    pendingAction: null,
    
    // Variabili per selezione multipla
    isSelecting: false,
    selectionStartX: 0,
    selectionStartY: 0,
    
    // Variabili per zoom e pan
    scale: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    spaceKeyPressed: false
};

// Configurazioni specifiche per tipo di nodo
export const typeConfigs = {
    trigger: () => {
        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">Trigger Type</label>
        <select id="trigger-type" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200">
          <option value="interval">Time Interval</option>
          <option value="webhook">Webhook</option>
          <option value="event">Event Based</option>
        </select>
        
        <div id="interval-config" class="mt-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">Interval (minutes)</label>
          <input type="number" id="interval-value" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200" value="5" min="1">
        </div>
      </div>
    `;
    },
    action: () => {
        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">Action Configuration</label>
        <textarea id="action-config" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 h-32" placeholder="Enter action configuration"></textarea>
      </div>
    `;
    },
    condition: () => {
        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">Condition Expression</label>
        <textarea id="condition-expr" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 h-32" placeholder="Enter condition expression"></textarea>
      </div>
    `;
    },
    output: () => {
        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">Output Type</label>
        <select id="output-type" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200">
          <option value="api">API Call</option>
          <option value="email">Send Email</option>
          <option value="database">Database</option>
        </select>
        
        <div id="api-config" class="mt-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200">API Endpoint</label>
          <input type="text" id="api-endpoint" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200" placeholder="https://api.example.com/endpoint">
        </div>
      </div>
    `;
    }
};

// Inizializzazione degli elementi DOM
export function initDOM() {
    DOM.canvas = document.getElementById('workflow-canvas');
    DOM.configPanel = document.getElementById('config-panel');
    DOM.saveBtn = document.getElementById('save-btn');
    DOM.loadFile = document.getElementById('load-file');
    DOM.closeConfig = document.getElementById('close-config');
    DOM.saveConfig = document.getElementById('save-config');
    DOM.configTitle = document.getElementById('config-title');
    DOM.nodeNameInput = document.getElementById('node-name');
    DOM.typeSpecificConfig = document.getElementById('type-specific-config');
    DOM.deleteNodeBtn = document.getElementById('delete-node-btn');
    DOM.deleteButtonContainer = document.getElementById('delete-btn-container');
    DOM.clearAllBtn = document.getElementById('clear-all-btn');
    DOM.confirmModal = document.getElementById('confirm-modal');
    DOM.confirmBtn = document.getElementById('confirm-btn');
    DOM.cancelBtn = document.getElementById('cancel-btn');
    DOM.modalTitle = document.getElementById('modal-title');
    DOM.modalMessage = document.getElementById('modal-message');
}
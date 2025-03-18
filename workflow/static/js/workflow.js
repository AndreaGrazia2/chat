// File principale dell'applicazione

import { DOM, state, typeConfigs, initDOM } from './stato.js';
import * as Connections from './connections.js';
import * as Nodes from './nodes.js';
import * as Ui from './ui.js';
import * as Utils from './utils.js';

// Inizializzazione dell'applicazione
document.addEventListener('DOMContentLoaded', function () {
    // Inizializza gli elementi DOM
    initDOM();

    // Inizializza l'applicazione
    Ui.initTheme();
    DOM.canvasContent = Ui.initCanvasTransform();
    const zoomControls = Ui.createZoomControls();
    Ui.updateCanvasTransform();
    Ui.addUsageInstructions();

    // Event listeners per drag&drop dalla palette al canvas
    const nodeItems = document.querySelectorAll('.node-item');
    nodeItems.forEach(item => {
        item.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: this.dataset.type,
                name: this.dataset.name
            }));
        });
    });

    DOM.canvas.addEventListener('dragover', function (e) {
        e.preventDefault();
    });

    DOM.canvas.addEventListener('drop', function (e) {
        e.preventDefault();

        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));

            // Calcolare la posizione dentro il canvas con lo zoom
            const coords = Ui.getCanvasCoordinates(e.clientX, e.clientY);

            Nodes.addNode(data.type, data.name, coords.x, coords.y);
        } catch (err) {
            console.error('Error adding node:', err);
        }
    });

    // Event listener per il mouse move globale
    document.addEventListener('mousemove', function (e) {
        // Gestione dello spostamento dei nodi
        if (state.isDragging && state.selectedNodes.length > 0) {
            // Calcola lo spostamento del mouse
            const deltaX = (e.clientX - state.dragStartX) / state.scale;
            const deltaY = (e.clientY - state.dragStartY) / state.scale;

            // Per ogni nodo selezionato
            for (let i = 0; i < state.selectedNodes.length; i++) {
                const node = state.selectedNodes[i];
                const offset = state.nodeOffsets.find(o => o.id === node.id);

                if (offset) {
                    // Calcola la nuova posizione mantenendo le posizioni relative
                    const newX = offset.offsetX + deltaX;
                    const newY = offset.offsetY + deltaY;

                    // Aggiorna il nodo
                    node.x = newX;
                    node.y = newY;

                    // Aggiorna l'elemento DOM
                    const nodeElement = document.getElementById(node.id);
                    if (nodeElement) {
                        nodeElement.style.left = `${newX}px`;
                        nodeElement.style.top = `${newY}px`;
                    }
                }
            }

            // Aggiorna le connessioni
            Connections.updateConnections();
        }

        // Aggiorna la connessione temporanea
        if (state.isConnecting) {
            Connections.updateTempConnection(e.clientX, e.clientY);
        }

        // Aggiorna la selezione ad area
        if (state.isSelecting) {
            Utils.updateSelection(e);
        }

        // Gestione del pan
        if (state.isPanning) {
            const deltaX = e.clientX - state.panStartX;
            const deltaY = e.clientY - state.panStartY;

            state.panX += deltaX;
            state.panY += deltaY;

            state.panStartX = e.clientX;
            state.panStartY = e.clientY;

            Ui.updateCanvasTransform();
        }
    });

    // Mouse up per terminare lo spostamento e altre operazioni
    document.addEventListener('mouseup', function (e) {
        // Fine del trascinamento
        state.isDragging = false;

        // Fine della selezione ad area
        if (state.isSelecting) {
            Utils.endSelection();
        }

        // Fine del panning
        state.isPanning = false;
        if (DOM.canvas.classList.contains('panning')) {
            DOM.canvas.classList.remove('panning');
        }

        // Se stavamo creando una connessione ma non l'abbiamo completata
        if (state.isConnecting) {
            // Rimuovi la classe active
            document.querySelectorAll('.connector.active').forEach(el => {
                el.classList.remove('active');
            });

            state.isConnecting = false;
            state.connectionStart = null;
            state.connectionStartEl = null;
            Connections.removeTempConnection();
        }
    });

    // Mouse down sul canvas per iniziare la selezione ad area o il pan
    DOM.canvas.addEventListener('mousedown', function (e) {
        // Se è premuto il tasto centrale o space key è premuto, inizia il pan
        if (e.button === 1 || (e.button === 0 && state.spaceKeyPressed)) {
            e.preventDefault();
            state.isPanning = true;
            state.panStartX = e.clientX;
            state.panStartY = e.clientY;
            DOM.canvas.classList.add('panning');
            DOM.canvas.style.cursor = 'grabbing';
        }
        // Altrimenti se è premuto shift, inizia la selezione ad area
        else if (e.shiftKey && e.button === 0) {
            Utils.startSelection(e);
        }
    });

    // Event listener per la rotella del mouse per lo zoom
    DOM.canvas.addEventListener('wheel', function (e) {
        e.preventDefault();

        // Calcola il delta dello zoom
        const delta = -e.deltaY * 0.001;

        // Calcola le coordinate del mouse prima dello zoom
        const rect = DOM.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calcola le coordinate nel canvas prima dello zoom
        const oldX = (mouseX - state.panX) / state.scale;
        const oldY = (mouseY - state.panY) / state.scale;

        // Applica lo zoom
        const oldScale = state.scale;
        state.scale = Math.max(0.1, Math.min(2, state.scale + delta));

        // Calcola il nuovo pan per mantenere il punto sotto il mouse
        state.panX = mouseX - oldX * state.scale;
        state.panY = mouseY - oldY * state.scale;

        // Aggiorna la trasformazione
        Ui.updateCanvasTransform();

        // Aggiorna le connessioni per il nuovo scale
        Connections.updateConnections();
    });

    // Gestione dei tasti per pan (spazio) e altri shortcut
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            state.spaceKeyPressed = true;
            DOM.canvas.style.cursor = 'grab';
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA') {
                return; // Non fare nulla se siamo in un campo di input
            }

            if (state.selectedNodes.length > 0) {
                Nodes.deleteSelectedNodes();
            } else if (state.selectedConnection) {
                Connections.deleteConnection(state.selectedConnection.id);
            }
        }

        // Supporto per selezionare tutti i nodi (Ctrl+A)
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            Nodes.clearSelection();
            state.nodes.forEach(node => Nodes.selectNode(node, true));
        }

        // Aggiungi supporto per tasto Escape per annullare connessione
        if (e.key === 'Escape' && state.isConnecting) {
            state.isConnecting = false;
            if (state.connectionStartEl) {
                state.connectionStartEl.classList.remove('active');
                state.connectionStartEl = null;
            }
            state.connectionStart = null;
            Connections.removeTempConnection();
        }
    });

    document.addEventListener('keyup', function (e) {
        if (e.code === 'Space') {
            state.spaceKeyPressed = false;
            DOM.canvas.style.cursor = '';
        }
    });

    // Prevenire la selezione di testo durante il trascinamento
    document.addEventListener('selectstart', function (e) {
        if (state.isConnecting || state.isDragging || state.isSelecting || state.isPanning) {
            e.preventDefault();
        }
    });

    // Click sul canvas per deselezionare
    DOM.canvas.addEventListener('click', function (e) {
        if (e.target === DOM.canvas || e.target.id === 'canvas-content') {
            if (!e.shiftKey) {
                Nodes.clearSelection();
                Ui.updateDeleteButton();
                DOM.configPanel.classList.add('hidden');
                // Nascondi il pulsante cestino
                DOM.deleteButtonContainer.classList.add('hidden');
            }
        }
    });

    // Gestione eventi per i pulsanti dell'interfaccia
    DOM.closeConfig.addEventListener('click', function () {
        DOM.configPanel.classList.add('hidden');
        // Nascondi il pulsante cestino quando chiudi il pannello
        DOM.deleteButtonContainer.classList.add('hidden');
        Nodes.clearSelection();
    });

    DOM.saveConfig.addEventListener('click', function () {
        if (state.selectedNodes.length !== 1) return;
        const selectedNode = state.selectedNodes[0];

        // Nome base
        selectedNode.config.name = DOM.nodeNameInput.value;

        // Configurazione specifica per tipo
        if (selectedNode.type === 'trigger') {
            const triggerType = document.getElementById('trigger-type');
            if (triggerType) {
                selectedNode.config.triggerType = triggerType.value;
            }

            const intervalValue = document.getElementById('interval-value');
            if (intervalValue && selectedNode.config.triggerType === 'interval') {
                selectedNode.config.interval = parseInt(intervalValue.value);
            }
        } else if (selectedNode.type === 'action') {
            const actionConfig = document.getElementById('action-config');
            if (actionConfig) {
                selectedNode.config.actionConfig = actionConfig.value;
            }
        } else if (selectedNode.type === 'condition') {
            const conditionExpr = document.getElementById('condition-expr');
            if (conditionExpr) {
                selectedNode.config.expression = conditionExpr.value;
            }
        } else if (selectedNode.type === 'output') {
            const outputType = document.getElementById('output-type');
            if (outputType) {
                selectedNode.config.outputType = outputType.value;
            }

            const apiEndpoint = document.getElementById('api-endpoint');
            if (apiEndpoint && selectedNode.config.outputType === 'api') {
                selectedNode.config.endpoint = apiEndpoint.value;
            }
        }

        // Aggiorna il nome visualizzato
        const nodeElement = document.getElementById(selectedNode.id);
        const nodeTitle = nodeElement.querySelector('.node-title');
        nodeTitle.textContent = selectedNode.config.name || selectedNode.name;

        DOM.configPanel.classList.add('hidden');
        // Nascondi il pulsante cestino quando chiudi il pannello
        DOM.deleteButtonContainer.classList.add('hidden');
    });

    DOM.deleteNodeBtn.addEventListener('click', function () {
        if (state.selectedNodes.length > 0) {
            const message = state.selectedNodes.length === 1
                ? `Are you sure you want to delete the "${state.selectedNodes[0].config.name || state.selectedNodes[0].name}" node?`
                : `Are you sure you want to delete ${state.selectedNodes.length} selected nodes?`;

            Ui.showConfirmModal(
                'Delete Node' + (state.selectedNodes.length > 1 ? 's' : ''),
                message,
                Nodes.deleteSelectedNodes
            );
        } else if (state.selectedConnection) {
            Ui.showConfirmModal(
                'Delete Connection',
                'Are you sure you want to delete this connection?',
                () => Connections.deleteConnection(state.selectedConnection.id)
            );
        }
    });

    DOM.clearAllBtn.addEventListener('click', function () {
        if (state.nodes.length === 0 && state.connections.length === 0) return;

        Ui.showConfirmModal(
            'Clear Workflow',
            'Are you sure you want to clear the entire workflow? This action cannot be undone.',
            Utils.clearWorkflow
        );
    });

    DOM.saveBtn.addEventListener('click', function () {
        // Verifica se ci sono nodi nel workflow
        if (state.nodes.length === 0) {
            Ui.showConfirmModal('Cannot Save', 'The canvas is empty. There is nothing to save.', null, true);
            return;
        }

        const workflow = {
            nodes: state.nodes.map(node => ({
                id: node.id,
                type: node.type,
                name: node.name,
                x: node.x,
                y: node.y,
                config: node.config
            })),
            connections: state.connections.map(conn => ({
                id: conn.id,
                source: conn.source,
                target: conn.target
            }))
        };

        const json = JSON.stringify(workflow, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow.json';
        a.click();

        URL.revokeObjectURL(url);
    });

    DOM.loadFile.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const workflow = JSON.parse(e.target.result);

                // Chiedi conferma solo se ci sono nodi esistenti
                if (state.nodes.length > 0 || state.connections.length > 0) {
                    Ui.showConfirmModal(
                        'Load Workflow',
                        'Loading a new workflow will replace the current one. Do you want to continue?',
                        () => Utils.loadWorkflow(workflow)
                    );
                } else {
                    Utils.loadWorkflow(workflow);
                }
            } catch (err) {
                console.error('Error loading workflow:', err);
                alert('Invalid workflow file');
            }
        };

        reader.readAsText(file);
    });

    // Gestione eventi del modale di conferma
    DOM.confirmBtn.addEventListener('click', function () {
        DOM.confirmModal.classList.add('hidden');
        if (state.pendingAction) {
            state.pendingAction();
            state.pendingAction = null;
        }
    });

    DOM.cancelBtn.addEventListener('click', function () {
        DOM.confirmModal.classList.add('hidden');
        state.pendingAction = null;
    });

    // Toggle Dark Mode
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    themeToggle.addEventListener('click', function () {
        // Toggle della classe dark
        document.documentElement.classList.toggle('dark');

        // Salva lo stato nel localStorage
        const isDarkMode = document.documentElement.classList.contains('dark');
        localStorage.setItem('workflow-theme', isDarkMode);

        // Aggiorna le icone
        if (isDarkMode) {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    });

    // Aggiungi l'event listener per il pulsante Validate
    const validateBtn = document.getElementById('validate-btn');
    validateBtn.addEventListener('click', function () {
        // Rimuovi eventuali evidenziazioni precedenti
        document.querySelectorAll('.node').forEach(el => {
            el.style.boxShadow = '';
        });
        document.querySelectorAll('.connection path').forEach(path => {
            path.setAttribute('stroke', '');
            path.setAttribute('stroke-width', '2');
        });

        Utils.validateWorkflow();
    });

    //=========================
    // Listener for the Backend

    // Funzione per salvare il workflow nel database
    async function saveWorkflowToServer() {
        // Verifica se ci sono nodi nel workflow
        if (state.nodes.length === 0) {
            Ui.showConfirmModal('Cannot Save', 'The canvas is empty. There is nothing to save.', null, true);
            return;
        }

        // Prepara i dati del workflow
        const workflow = {
            name: document.getElementById('workflow-name-input').value || 'Untitled Workflow',
            description: document.getElementById('workflow-description-input').value || '',
            json_definition: {
                nodes: state.nodes.map(node => ({
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    x: node.x,
                    y: node.y,
                    config: node.config
                })),
                connections: state.connections.map(conn => ({
                    id: conn.id,
                    source: conn.source,
                    target: conn.target
                }))
            },
            is_active: true
        };

        try {
            // Se abbiamo un ID del workflow, aggiorniamo il workflow esistente
            if (state.workflowId) {
                const response = await fetch(`/workflow/api/workflows/${state.workflowId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(workflow)
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                Ui.showConfirmModal('Success', 'Workflow updated successfully!', null, true);
            } else {
                // Altrimenti creiamo un nuovo workflow
                const response = await fetch('/workflow/api/workflows', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(workflow)
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                state.workflowId = result.id;

                Ui.showConfirmModal('Success', `Workflow created successfully with ID: ${result.id}`, null, true);
            }
        } catch (error) {
            console.error('Error saving workflow:', error);
            Ui.showConfirmModal('Error', `Failed to save workflow: ${error.message}`, null, true);
        }
    }

    // Funzione per eseguire il workflow
    async function executeWorkflow(input) {
        // Verifica se abbiamo un ID del workflow
        if (!state.workflowId) {
            // Se non abbiamo un ID, salva prima il workflow
            Ui.showConfirmModal('Execute Workflow',
                'The workflow needs to be saved before execution. Do you want to save it now?',
                async () => {
                    await saveWorkflowToServer();
                    if (state.workflowId) {
                        executeWorkflowWithId(state.workflowId, input);
                    }
                });
            return;
        }

        executeWorkflowWithId(state.workflowId, input);
    }

    // Funzione helper per eseguire il workflow con un ID specifico
    async function executeWorkflowWithId(workflowId, input) {
        try {
            // Mostra un loader
            const executionLoader = document.createElement('div');
            executionLoader.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            executionLoader.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Executing Workflow</h3>
                <div class="flex items-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Executing workflow, please wait...</span>
                </div>
            </div>
        `;
            document.body.appendChild(executionLoader);

            // Prepara l'input per l'esecuzione
            const executionInput = input || {};

            // Chiama l'API per eseguire il workflow
            const response = await fetch(`/workflow/api/workflows/${workflowId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(executionInput)
            });

            // Rimuovi il loader
            executionLoader.remove();

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Mostra i risultati dell'esecuzione
                showExecutionResults(result);

                // Offri un link per visualizzare i dettagli dell'esecuzione
                Ui.showConfirmModal('Execution Complete',
                    `Workflow executed successfully! Execution ID: ${result.execution_id}`,
                    () => {
                        window.open(`/workflow/executions/${result.execution_id}/view`, '_blank');
                    },
                    false);
            } else {
                Ui.showConfirmModal('Execution Failed', `Error: ${result.error}`, null, true);
            }
        } catch (error) {
            console.error('Error executing workflow:', error);
            document.querySelector('.execution-loader')?.remove();
            Ui.showConfirmModal('Error', `Failed to execute workflow: ${error.message}`, null, true);
        }
    }

    // Funzione per mostrare i risultati dell'esecuzione
    function showExecutionResults(result) {
        // Crea un modale per visualizzare i risultati
        const resultsModal = document.createElement('div');
        resultsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        resultsModal.id = 'execution-results-modal';

        resultsModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mx-auto max-w-4xl max-h-[80vh] overflow-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">Execution Results</h2>
                <button id="close-results-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="mb-4">
                <p><span class="font-medium">Execution ID:</span> ${result.execution_id}</p>
            </div>
            
            <div class="mt-4">
                <h3 class="text-lg font-semibold mb-2">Result</h3>
                <pre class="p-3 bg-gray-100 dark:bg-gray-700 rounded overflow-auto max-h-96">${JSON.stringify(result.result, null, 2)}</pre>
            </div>
            
            <div class="mt-6 flex justify-end">
                <a href="/workflow/executions/${result.execution_id}/view" target="_blank" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    View Detailed Logs
                </a>
            </div>
        </div>
    `;

        document.body.appendChild(resultsModal);

        // Aggiungi event listener per chiudere il modale
        document.getElementById('close-results-modal').addEventListener('click', function () {
            resultsModal.remove();
        });
    }

    // Funzione per caricare un workflow dal server
    async function loadWorkflowFromServer(workflowId) {
        try {
            const response = await fetch(`/workflow/api/workflows/${workflowId}`);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const workflow = await response.json();

            // Imposta l'ID del workflow nello stato
            state.workflowId = workflow.id;

            // Imposta i campi del form con i dati del workflow
            document.getElementById('workflow-name-input').value = workflow.name;
            document.getElementById('workflow-description-input').value = workflow.description || '';

            // Carica il workflow nell'editor
            Utils.loadWorkflow(workflow.json_definition);

            return workflow;
        } catch (error) {
            console.error('Error loading workflow:', error);
            Ui.showConfirmModal('Error', `Failed to load workflow: ${error.message}`, null, true);
            return null;
        }
    }

    // Funzione per caricare e mostrare l'elenco dei workflow
    async function loadWorkflowsList() {
        try {
            const response = await fetch('/workflow/api/workflows');

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const workflows = await response.json();

            // Crea un modale per mostrare l'elenco
            const listModal = document.createElement('div');
            listModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            listModal.id = 'workflows-list-modal';

            // Se non ci sono workflow
            if (workflows.length === 0) {
                listModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Load Workflow</h2>
                        <button id="close-list-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <p class="text-center text-gray-500 dark:text-gray-400 py-4">No workflows found.</p>
                    
                    <div class="mt-6 flex justify-end">
                        <button id="close-modal-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Close</button>
                    </div>
                </div>
            `;
            } else {
                // Crea la tabella di workflow
                let workflowsHTML = '';
                workflows.forEach(workflow => {
                    const createdAt = new Date(workflow.created_at).toLocaleString();
                    const updatedAt = new Date(workflow.updated_at).toLocaleString();

                    workflowsHTML += `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${workflow.id}
                        </td>
                        <td class="px-6 py-4">
                            ${workflow.name}
                        </td>
                        <td class="px-6 py-4">
                            ${workflow.description || '-'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${createdAt}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${updatedAt}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 load-workflow-btn" data-id="${workflow.id}">
                                <i class="fas fa-edit"></i> Load
                            </button>
                        </td>
                    </tr>
                `;
                });

                listModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mx-auto max-w-6xl max-h-[80vh] overflow-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Load Workflow</h2>
                        <button id="close-list-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Updated
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                ${workflowsHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            }

            document.body.appendChild(listModal);

            // Aggiungi event listener per chiudere il modale
            document.getElementById('close-list-modal').addEventListener('click', function () {
                listModal.remove();
            });

            // Aggiungi event listener per i pulsanti di caricamento
            document.querySelectorAll('.load-workflow-btn').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const workflowId = parseInt(this.getAttribute('data-id'));

                    // Chiedi conferma se ci sono nodi esistenti
                    if (state.nodes.length > 0 || state.connections.length > 0) {
                        Ui.showConfirmModal(
                            'Load Workflow',
                            'Loading a new workflow will replace the current one. Do you want to continue?',
                            async () => {
                                listModal.remove();
                                await loadWorkflowFromServer(workflowId);
                            }
                        );
                    } else {
                        listModal.remove();
                        await loadWorkflowFromServer(workflowId);
                    }
                });
            });

        } catch (error) {
            console.error('Error loading workflows list:', error);
            Ui.showConfirmModal('Error', `Failed to load workflows list: ${error.message}`, null, true);
        }
    }

    // Funzione per preparare il form di input per l'esecuzione
    function showExecutionInputForm() {
        // Verifica se ci sono nodi nel workflow
        if (state.nodes.length === 0) {
            Ui.showConfirmModal('Cannot Execute', 'The canvas is empty. There is nothing to execute.', null, true);
            return;
        }

        // Crea un modale per l'input dell'esecuzione
        const inputModal = document.createElement('div');
        inputModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        inputModal.id = 'execution-input-modal';

        inputModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">Execute Workflow</h2>
                <button id="close-input-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="execution-input">
                    Input JSON (optional)
                </label>
                <textarea id="execution-input" rows="6" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="{}">{}</textarea>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Provide input data for your workflow in JSON format.
                </p>
            </div>
            
            <div class="mt-6 flex justify-end space-x-3">
                <button id="cancel-execution-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                    Cancel
                </button>
                <button id="run-execution-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Run Workflow
                </button>
            </div>
        </div>
    `;

        document.body.appendChild(inputModal);

        // Aggiungi event listener per chiudere il modale
        document.getElementById('close-input-modal').addEventListener('click', function () {
            inputModal.remove();
        });

        document.getElementById('cancel-execution-btn').addEventListener('click', function () {
            inputModal.remove();
        });

        document.getElementById('run-execution-btn').addEventListener('click', function () {
            // Ottieni il JSON di input
            const inputText = document.getElementById('execution-input').value;

            try {
                // Parse del JSON
                const inputData = inputText.trim() ? JSON.parse(inputText) : {};

                // Chiudi il modale
                inputModal.remove();

                // Esegui il workflow
                executeWorkflow(inputData);

            } catch (error) {
                console.error('Invalid JSON input:', error);
                Ui.showConfirmModal('Invalid Input', 'Please provide valid JSON input.', null, true);
            }
        });
    }

    // Aggiungi questi eventi agli event handler nell'editor

    // 1. Modifica il comportamento del pulsante Save
    DOM.saveBtn.addEventListener('click', function () {
        // Aggiungi una richiesta per nome e descrizione
        const saveModal = document.createElement('div');
        saveModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        saveModal.id = 'save-workflow-modal';

        saveModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">Save Workflow</h2>
                <button id="close-save-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="workflow-name-input">
                    Workflow Name *
                </label>
                <input type="text" id="workflow-name-input" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="My Workflow" value="${state.workflowName || ''}">
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="workflow-description-input">
                    Description (optional)
                </label>
                <textarea id="workflow-description-input" rows="3" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Workflow description...">${state.workflowDescription || ''}</textarea>
            </div>
            
            <div class="mt-6 flex justify-end space-x-3">
                <button id="cancel-save-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                    Cancel
                </button>
                <button id="confirm-save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Save
                </button>
            </div>
        </div>
    `;

        document.body.appendChild(saveModal);

        // Aggiungi event listener per chiudere il modale
        document.getElementById('close-save-modal').addEventListener('click', function () {
            saveModal.remove();
        });

        document.getElementById('cancel-save-btn').addEventListener('click', function () {
            saveModal.remove();
        });

        document.getElementById('confirm-save-btn').addEventListener('click', function () {
            const name = document.getElementById('workflow-name-input').value;
            const description = document.getElementById('workflow-description-input').value;

            if (!name) {
                Ui.showConfirmModal('Error', 'Workflow name is required.', null, true);
                return;
            }

            // Salva i valori nello stato
            state.workflowName = name;
            state.workflowDescription = description;

            // Chiudi il modale
            saveModal.remove();

            // Salva il workflow
            saveWorkflowToServer();
        });
    });

    // 2. Modifica il comportamento del pulsante Load
    DOM.loadFile.addEventListener('change', function (e) {
        // Sostituisci con un pulsante che apre l'elenco di workflow dal server
        e.preventDefault();

        loadWorkflowsList();
    });

    // 3. Aggiungi un pulsante per eseguire il workflow
    const executeBtn = document.createElement('button');
    executeBtn.id = 'execute-btn';
    executeBtn.className = 'px-3 py-1 bg-green-600 dark:bg-green-700 rounded hover:bg-green-700 dark:hover:bg-green-800 transition-colors duration-200';
    executeBtn.innerHTML = '<i class="fas fa-play mr-1"></i> Execute';
    executeBtn.addEventListener('click', showExecutionInputForm);

    // Aggiungi il pulsante alla toolbar
    document.querySelector('.toolbar .flex.space-x-3.items-center').appendChild(executeBtn);


});

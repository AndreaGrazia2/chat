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
        localStorage.setItem('darkMode', isDarkMode);

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
});
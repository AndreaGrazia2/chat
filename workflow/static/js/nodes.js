// Modulo nodes.js

import { DOM, state, typeConfigs } from './stato.js';
import * as Connections from './connections.js';
import * as Ui from './ui.js';

export function addNode(type, name, x, y) {
    // Correzione qui: utilizza state.nextNodeId invece di nextNodeId
    const nodeId = 'node-' + state.nextNodeId++;

    const node = {
        id: nodeId,
        type: type,
        name: name,
        x: x,
        y: y,
        config: {
            name: name
        }
    };

    state.nodes.push(node);
    renderNode(node);

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}

export function renderNode(node) {
    const canvasContent = document.getElementById('canvas-content');
    const nodeElement = document.createElement('div');
    nodeElement.id = node.id;
    nodeElement.className = `node ${node.type}`;
    nodeElement.style.left = `${node.x}px`;
    nodeElement.style.top = `${node.y}px`;

    nodeElement.innerHTML = `
    <div class="node-title">${node.config.name || node.name}</div>
    <div class="node-desc">${node.type.charAt(0).toUpperCase() + node.type.slice(1)}</div>
    <div class="connector input-port" data-node-id="${node.id}" data-port-type="input"></div>
    <div class="connector output-port" data-node-id="${node.id}" data-port-type="output"></div>
  `;

    // Gestione dello spostamento
    nodeElement.addEventListener('mousedown', function (e) {
        // Verifica se abbiamo cliccato su un connettore
        if (e.target.classList.contains('connector')) {
            e.stopPropagation();
            return;
        }

        state.isDragging = true;

        // MODIFICATO: Selezione con shift premuto per selezione multipla
        if (!e.shiftKey && !state.selectedNodes.some(n => n.id === node.id)) {
            clearSelection();
        }

        selectNode(node, true); // true indica di non deselezionare gli altri nodi

        // Coordinate del mouse all'inizio del trascinamento
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;

        // Memorizza gli offset di tutti i nodi selezionati
        state.nodeOffsets = [];
        state.selectedNodes.forEach(n => {
            state.nodeOffsets.push({
                id: n.id,
                offsetX: n.x,
                offsetY: n.y
            });
        });

        e.preventDefault();
    });

    // Cliccabile per mostrare il pannello di configurazione
    nodeElement.addEventListener('click', function (e) {
        if (!state.isDragging && !state.isConnecting) {
            if (!e.shiftKey) {
                clearSelection();
                selectNode(node, false);
                Ui.showConfigPanel(node);
            } else {
                // Toggle selezione con shift
                const index = state.selectedNodes.findIndex(n => n.id === node.id);
                if (index !== -1) {
                    // Deseleziona
                    nodeElement.classList.remove('selected');
                    state.selectedNodes.splice(index, 1);
                } else {
                    // Seleziona
                    selectNode(node, true);
                }
            }
        }
    });

    // Gestione delle connessioni
    const inputPort = nodeElement.querySelector('.input-port');
    const outputPort = nodeElement.querySelector('.output-port');

    outputPort.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();

        state.isConnecting = true;
        state.connectionStart = node.id;
        state.connectionStartEl = this;

        this.classList.add('active');

        // Crea una connessione temporanea
        Connections.createTempConnection(e.clientX, e.clientY);
    });

    inputPort.addEventListener('mouseup', function (e) {
        e.stopPropagation();

        if (state.isConnecting && state.connectionStart) {
            const sourceId = state.connectionStart;
            const targetId = node.id;

            // Rimuovi la classe active
            document.querySelectorAll('.connector.active').forEach(el => {
                el.classList.remove('active');
            });

            // Evita connessioni a se stesso
            if (sourceId !== targetId) {
                // Evita connessioni duplicate
                const exists = state.connections.some(conn =>
                    conn.source === sourceId && conn.target === targetId
                );

                if (!exists) {
                    Connections.addConnection(sourceId, targetId);
                }
            }

            // Reset
            state.isConnecting = false;
            state.connectionStart = null;
            state.connectionStartEl = null;
            Connections.removeTempConnection();
        }
    });

    // Stop propagation per entrambi i connettori
    inputPort.addEventListener('click', (e) => e.stopPropagation());
    outputPort.addEventListener('click', (e) => e.stopPropagation());

    canvasContent.appendChild(nodeElement);
}

// Replace the incomplete selectNode function in nodes.js with this complete version:
export function selectNode(node, keepExisting = false) {
    if (!keepExisting) {
        clearSelection();
    }

    // Verifica se il nodo è già selezionato
    if (!state.selectedNodes.some(n => n.id === node.id)) {
        state.selectedNodes.push(node);

        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
            nodeElement.classList.add('selected');
        }
    }

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}

export function clearSelection() {
    // Deseleziona tutti i nodi
    document.querySelectorAll('.node').forEach(el => {
        el.classList.remove('selected');
    });

    // Deseleziona tutte le connessioni
    document.querySelectorAll('.connection').forEach(el => {
        el.classList.remove('selected');
    });

    state.selectedNodes = [];
    state.selectedConnection = null;
}

export function deleteSelectedNodes() {
    if (state.selectedNodes.length === 0) return;

    // Rimuovi tutti i nodi selezionati
    state.selectedNodes.forEach(node => {
        // Rimuovi il nodo dal DOM
        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
            nodeElement.remove();
        }

        // Rimuovi il nodo dall'array
        const nodeIndex = state.nodes.findIndex(n => n.id === node.id);
        if (nodeIndex !== -1) {
            state.nodes.splice(nodeIndex, 1);
        }

        // Rimuovi tutte le connessioni associate a questo nodo
        state.connections = state.connections.filter(conn => {
            if (conn.source === node.id || conn.target === node.id) {
                // Rimuovi anche l'elemento DOM della connessione
                const connElement = document.getElementById(conn.id);
                if (connElement) {
                    connElement.remove();
                }
                return false;
            }
            return true;
        });
    });

    // Reset della selezione
    state.selectedNodes = [];
    state.selectedConnection = null;

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}
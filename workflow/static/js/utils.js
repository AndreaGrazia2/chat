// Complete replacement for utils.js with proper DOM safety checks

import { DOM, state } from './stato.js';
import * as Connections from './connections.js';
import * as Nodes from './nodes.js';
import * as Ui from './ui.js';

// Add DOM safety checks to all functions
export function startSelection(e) {
    if (!DOM || !DOM.selectionBox) return;

    // Verifica se il click non è su un nodo o su un altro elemento interattivo
    if (e.target === DOM.canvas || e.target.id === 'canvas-content') {
        state.isSelecting = true;

        // Converti le coordinate del mouse alle coordinate del canvas
        const coords = Ui.getCanvasCoordinates(e.clientX, e.clientY);
        state.selectionStartX = coords.x;
        state.selectionStartY = coords.y;

        // Posiziona e mostra il rettangolo di selezione
        DOM.selectionBox.style.left = `${state.selectionStartX}px`;
        DOM.selectionBox.style.top = `${state.selectionStartY}px`;
        DOM.selectionBox.style.width = '0px';
        DOM.selectionBox.style.height = '0px';
        DOM.selectionBox.style.display = 'block';

        // Se non è premuto shift, deseleziona tutto
        if (!e.shiftKey) {
            Nodes.clearSelection();
        }
    }
}

export function updateSelection(e) {
    if (!state.isSelecting || !DOM || !DOM.selectionBox) return;

    const coords = Ui.getCanvasCoordinates(e.clientX, e.clientY);
    const x = Math.min(state.selectionStartX, coords.x);
    const y = Math.min(state.selectionStartY, coords.y);
    const width = Math.abs(coords.x - state.selectionStartX);
    const height = Math.abs(coords.y - state.selectionStartY);

    DOM.selectionBox.style.left = `${x}px`;
    DOM.selectionBox.style.top = `${y}px`;
    DOM.selectionBox.style.width = `${width}px`;
    DOM.selectionBox.style.height = `${height}px`;
}

export function endSelection() {
    if (!state.isSelecting || !DOM || !DOM.selectionBox) return;

    // Calcola i limiti del rettangolo di selezione
    const boxLeft = parseFloat(DOM.selectionBox.style.left);
    const boxTop = parseFloat(DOM.selectionBox.style.top);
    const boxRight = boxLeft + parseFloat(DOM.selectionBox.style.width);
    const boxBottom = boxTop + parseFloat(DOM.selectionBox.style.height);

    // Seleziona i nodi all'interno del rettangolo
    state.nodes.forEach(node => {
        const nodeEl = document.getElementById(node.id);
        if (!nodeEl) return;

        const nodeRect = {
            left: node.x,
            top: node.y,
            right: node.x + nodeEl.offsetWidth,
            bottom: node.y + nodeEl.offsetHeight
        };

        // Verifica se il nodo è all'interno del rettangolo di selezione
        if (nodeRect.left < boxRight &&
            nodeRect.right > boxLeft &&
            nodeRect.top < boxBottom &&
            nodeRect.bottom > boxTop) {
            Nodes.selectNode(node, true);
        }
    });

    // Nasconde il rettangolo di selezione
    DOM.selectionBox.style.display = 'none';
    state.isSelecting = false;

    Ui.updateDeleteButton();
}

export function validateWorkflow() {
    // Controlla se ci sono nodi nel workflow
    if (state.nodes.length === 0) {
        Ui.showConfirmModal('Validation Result', 'The canvas is empty. There are no elements to validate.', null, true);
        return false;
    }

    // Controlla se ci sono cicli nel workflow
    if (hasCycle()) {
        Ui.showConfirmModal('Validation Result', 'Warning: The workflow contains an infinite loop. Modify the connections to resolve it.', null, true);
        return false;
    }

    Ui.showConfirmModal('Validation Result', 'The workflow is valid! No infinite loops detected.', null, true);
    return true;
}

export function hasCycle() {
    const visitedNodes = new Set();
    const currentPath = new Set();

    // Controlla ciascun nodo per verificare se è parte di un ciclo
    for (const node of state.nodes) {
        if (!visitedNodes.has(node.id)) {
            if (dfsCheckCycle(node.id, visitedNodes, currentPath)) {
                return true; // Ciclo trovato
            }
        }
    }

    return false; // Nessun ciclo trovato
}

export function dfsCheckCycle(nodeId, visitedNodes, currentPath) {
    currentPath.add(nodeId);

    // Trova tutte le connessioni in uscita da questo nodo
    const outgoingConnections = state.connections.filter(conn => conn.source === nodeId);

    for (const conn of outgoingConnections) {
        const targetId = conn.target;

        if (currentPath.has(targetId)) {
            // Evidenzia visivamente il ciclo trovato
            highlightCycle(Array.from(currentPath), targetId);
            return true; // Ciclo trovato
        }

        if (!visitedNodes.has(targetId)) {
            if (dfsCheckCycle(targetId, visitedNodes, currentPath)) {
                return true;
            }
        }
    }

    currentPath.delete(nodeId);
    visitedNodes.add(nodeId);
    return false;
}

export function highlightCycle(pathNodes, targetId) {
    // Trova l'indice di inizio del ciclo
    const startIndex = pathNodes.indexOf(targetId);

    // Estrai i nodi che fanno parte del ciclo
    const cycleNodes = pathNodes.slice(startIndex);

    // Evidenzia visivamente tutti i nodi nel ciclo
    document.querySelectorAll('.node').forEach(el => {
        if (cycleNodes.includes(el.id)) {
            el.style.boxShadow = '0 0 0 2px red, 0 2px 5px rgba(0, 0, 0, 0.2)';
        }
    });

    // Evidenzia anche le connessioni nel ciclo
    document.querySelectorAll('.connection').forEach(el => {
        const connId = el.id;
        const connParts = connId.split('-');
        if (connParts.length >= 3) {
            const source = connParts[1];
            const target = connParts[2];
            if (cycleNodes.includes(source) && cycleNodes.includes(target)) {
                const path = el.querySelector('path');
                if (path) {
                    path.setAttribute('stroke', 'red');
                    path.setAttribute('stroke-width', '3');
                }
            }
        }
    });
}

export function clearWorkflow() {
    // Rimuovi tutti i nodi dal DOM
    state.nodes.forEach(node => {
        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
            nodeElement.remove();
        }
    });

    // Rimuovi tutte le connessioni dal DOM
    state.connections.forEach(conn => {
        const connElement = document.getElementById(conn.id);
        if (connElement) {
            connElement.remove();
        }
    });

    // Reset degli array
    state.nodes = [];
    state.connections = [];

    // Reset della selezione
    state.selectedNodes = [];
    state.selectedConnection = null;

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}

export function loadWorkflow(workflow) {
    // Pulisci il canvas
    clearWorkflow();

    // Aggiungi i nodi
    if (workflow.nodes && Array.isArray(workflow.nodes)) {
        state.nextNodeId = 1;

        workflow.nodes.forEach(node => {
            // Crea un nuovo oggetto nodo
            const newNode = {
                id: node.id,
                type: node.type,
                name: node.name,
                x: node.x,
                y: node.y,
                config: node.config || {}
            };

            state.nodes.push(newNode);
            Nodes.renderNode(newNode);

            // Aggiorna nextNodeId se necessario
            const idParts = node.id.split('-');
            if (idParts.length > 1) {
                const id = parseInt(idParts[1]);
                if (!isNaN(id) && id >= state.nextNodeId) {
                    state.nextNodeId = id + 1;
                }
            }
        });
    }

    // Aggiungi le connessioni
    if (workflow.connections && Array.isArray(workflow.connections)) {
        workflow.connections.forEach(conn => {
            const newConn = {
                id: conn.id,
                source: conn.source,
                target: conn.target
            };

            state.connections.push(newConn);
            Connections.renderConnection(newConn);
        });
    }
}
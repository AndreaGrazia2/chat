// Modulo connections.js

import { DOM, state } from './stato.js';
import * as Nodes from './nodes.js';
import * as Ui from './ui.js';

export function createTempConnection(x, y) {
    removeTempConnection(); // Rimuove eventuali temporanee esistenti

    const canvasContent = document.getElementById('canvas-content');
    if (!canvasContent) return;

    const tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempConnection.id = 'temp-connection';
    tempConnection.classList.add('connection');
    tempConnection.style.position = 'absolute';
    tempConnection.style.left = '0';
    tempConnection.style.top = '0';
    tempConnection.style.width = '100%';
    tempConnection.style.height = '100%';
    tempConnection.style.pointerEvents = 'none';
    tempConnection.style.zIndex = '5';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', '#9ca3af');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    tempConnection.appendChild(path);
    canvasContent.appendChild(tempConnection);

    updateTempConnection(x, y);
}

export function updateTempConnection(mouseX, mouseY) {
    // Correzione qui: usa state.connectionStartEl invece di connectionStartEl
    if (!state.connectionStartEl) return;

    const tempConnection = document.getElementById('temp-connection');
    if (!tempConnection) return;

    const path = tempConnection.querySelector('path');
    const rect = DOM.canvas.getBoundingClientRect();

    const startRect = state.connectionStartEl.getBoundingClientRect();
    const startX = (startRect.left - rect.left - state.panX) / state.scale + startRect.width / (2 * state.scale);
    const startY = (startRect.top - rect.top - state.panY) / state.scale + startRect.height / (2 * state.scale);

    const coords = Ui.getCanvasCoordinates(mouseX, mouseY);
    const endX = coords.x;
    const endY = coords.y;

    const midX = (startX + endX) / 2;

    // Create a curved path
    const pathData = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
    path.setAttribute('d', pathData);
}

export function removeTempConnection() {
    const tempConnection = document.getElementById('temp-connection');
    if (tempConnection) {
        tempConnection.remove();
    }
}

export function addConnection(sourceId, targetId) {
    const connection = {
        id: `conn-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId
    };

    state.connections.push(connection);
    renderConnection(connection);
}

export function renderConnection(connection) {
    const canvasContent = document.getElementById('canvas-content');
    if (!canvasContent) return;

    const sourceNode = document.getElementById(connection.source);
    const targetNode = document.getElementById(connection.target);

    if (!sourceNode || !targetNode) return;

    const sourcePort = sourceNode.querySelector('.output-port');
    const targetPort = targetNode.querySelector('.input-port');

    const connElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connElement.id = connection.id;
    connElement.classList.add('connection');
    connElement.style.position = 'absolute';
    connElement.style.left = '0';
    connElement.style.top = '0';
    connElement.style.width = '100%';
    connElement.style.height = '100%';
    connElement.style.pointerEvents = 'none';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', '#9ca3af');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    connElement.appendChild(path);
    canvasContent.appendChild(connElement);

    // Aggiorna il percorso
    updateConnectionPath(connection);

    // Aggiungi un'area cliccabile per selezionare la connessione
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '10');
    hitArea.setAttribute('fill', 'none');
    hitArea.style.pointerEvents = 'all';
    hitArea.style.cursor = 'pointer';

    hitArea.addEventListener('click', function (e) {
        e.stopPropagation();
        selectConnection(connection);
    });

    connElement.appendChild(hitArea);

    // Aggiorna anche l'area cliccabile
    updateConnectionHitArea(connection);
}

export function selectConnection(connection) {
    Nodes.clearSelection();

    state.selectedConnection = connection;

    if (state.selectedConnection) {
        const connElement = document.getElementById(state.selectedConnection.id);
        if (connElement) {
            connElement.classList.add('selected');
        }
    }

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}

export function updateConnections() {
    state.connections.forEach(connection => {
        updateConnectionPath(connection);
        updateConnectionHitArea(connection);
    });
}

export function updateConnectionPath(connection) {
    const connElement = document.getElementById(connection.id);
    if (!connElement) return;

    const sourceNode = document.getElementById(connection.source);
    const targetNode = document.getElementById(connection.target);

    if (!sourceNode || !targetNode) return;

    const sourcePort = sourceNode.querySelector('.output-port');
    const targetPort = targetNode.querySelector('.input-port');

    if (!sourcePort || !targetPort) return;

    // Calcola le posizioni esatte dei connettori
    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();

    // Posizione iniziale (punto centrale del connettore di output)
    const startX = parseFloat(sourceNode.style.left) + sourceNode.offsetWidth;
    const startY = parseFloat(sourceNode.style.top) + (sourceNode.offsetHeight / 2);

    // Posizione finale (punto centrale del connettore di input)
    const endX = parseFloat(targetNode.style.left);
    const endY = parseFloat(targetNode.style.top) + (targetNode.offsetHeight / 2);

    const midX = (startX + endX) / 2;

    // Create a curved path
    const path = connElement.querySelector('path:first-child');
    const pathData = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
    path.setAttribute('d', pathData);
}

export function updateConnectionHitArea(connection) {
    const connElement = document.getElementById(connection.id);
    if (!connElement) return;

    const path = connElement.querySelector('path:first-child');
    const hitArea = connElement.querySelector('path:nth-child(2)');

    if (path && hitArea) {
        hitArea.setAttribute('d', path.getAttribute('d'));
    }
}

export function deleteConnection(connId) {
    // Trova la connessione
    const connIndex = state.connections.findIndex(c => c.id === connId);
    if (connIndex === -1) return;

    // Rimuovi la connessione dal DOM
    const connElement = document.getElementById(connId);
    if (connElement) {
        connElement.remove();
    }

    // Rimuovi la connessione dall'array
    state.connections.splice(connIndex, 1);

    // Reset della selezione
    state.selectedConnection = null;

    // Aggiorna il pulsante di eliminazione
    Ui.updateDeleteButton();
}
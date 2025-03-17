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
	let selectedNodes = []; // Cambiato da selectedNode a selectedNodes array
	let selectedConnection = null;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	// Salva gli offset individuali per ogni nodo durante il trascinamento
	let nodeOffsets = [];
	let isConnecting = false;
	let connectionStart = null;
	let connectionStartEl = null;
	let pendingAction = null;

	// NUOVE VARIABILI PER SELEZIONE MULTIPLA
	let isSelecting = false;
	let selectionBox = null;
	let selectionStartX = 0;
	let selectionStartY = 0;

	// NUOVE VARIABILI PER ZOOM E PAN
	let scale = 1;
	let panX = 0;
	let panY = 0;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;
	let spaceKeyPressed = false;
	let zoomLevelElement = null;

	// Configurazioni specifiche per tipo
	const typeConfigs = {
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

	// Funzione per mostrare il modale di conferma
	// MODIFICATA: Aggiunta l'opzione infoOnly per i messaggi informativi
	function showConfirmModal(title, message, callback, infoOnly = false) {
		modalTitle.textContent = title;
		modalMessage.textContent = message;
		confirmModal.classList.remove('hidden');

		// Per i messaggi informativi, nascondi il pulsante di cancellazione e rinomina "Confirm" in "OK"
		if (infoOnly) {
			cancelBtn.classList.add('hidden');
			confirmBtn.textContent = 'OK';
		} else {
			cancelBtn.classList.remove('hidden');
			confirmBtn.textContent = 'Confirm';
		}

		// Salva l'azione in sospeso
		pendingAction = callback;
	}

	// Gestione eventi del modale di conferma
	confirmBtn.addEventListener('click', function () {
		confirmModal.classList.add('hidden');
		if (pendingAction) {
			pendingAction();
			pendingAction = null;
		}
	});

	cancelBtn.addEventListener('click', function () {
		confirmModal.classList.add('hidden');
		pendingAction = null;
	});

	// Inizializzazione del tema dal localStorage
	function initTheme() {
		const darkMode = localStorage.getItem('darkMode') === 'true';
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

	// Inizializza il tema
	initTheme();

	// NUOVA FUNZIONE: Creazione dei controlli di zoom
	function createZoomControls() {
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
		zoomLevelElement = zoomControls.querySelector('#zoom-level');

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

	// NUOVA FUNZIONE: Inizializzazione dell'area di trasformazione per il canvas
	function initCanvasTransform() {
		// Crea un wrapper per trasformazione all'interno del canvas
		const canvasContent = document.createElement('div');
		canvasContent.id = 'canvas-content';
		canvasContent.style.position = 'absolute';
		canvasContent.style.width = '100%';
		canvasContent.style.height = '100%';
		canvasContent.style.transformOrigin = '0 0';
		canvasContent.style.transition = 'transform 0.1s ease';

		// Sposta tutti i figli esistenti del canvas al contenitore
		while (canvas.firstChild) {
			canvasContent.appendChild(canvas.firstChild);
		}

		canvas.appendChild(canvasContent);

		// Crea il rettangolo di selezione (nascosto inizialmente)
		selectionBox = document.createElement('div');
		selectionBox.id = 'selection-box';
		selectionBox.style.position = 'absolute';
		selectionBox.style.border = '1px dashed #1d74f5';
		selectionBox.style.backgroundColor = 'rgba(29, 116, 245, 0.1)';
		selectionBox.style.pointerEvents = 'none';
		selectionBox.style.display = 'none';
		selectionBox.style.zIndex = '10';
		canvasContent.appendChild(selectionBox);

		return canvasContent;
	}

	// NUOVA FUNZIONE: Aggiornamento della trasformazione del canvas
	function updateCanvasTransform() {
		const canvasContent = document.getElementById('canvas-content');
		if (canvasContent) {
			canvasContent.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

			// Aggiorna il testo dello zoom level se l'elemento esiste
			if (zoomLevelElement) {
				zoomLevelElement.textContent = `${Math.round(scale * 100)}%`;
			}
		}
	}

	// NUOVA FUNZIONE: Zoom del canvas
	function zoomCanvas(delta) {
		const oldScale = scale;
		scale = Math.max(0.1, Math.min(2, scale + delta));

		// Aggiorna la trasformazione
		updateCanvasTransform();

		// Aggiorna le connessioni per il nuovo scale
		updateConnections();
	}

	// NUOVA FUNZIONE: Reset della vista
	function resetView() {
		scale = 1;
		panX = 0;
		panY = 0;
		updateCanvasTransform();
		updateConnections();
	}

	// NUOVA FUNZIONE: Conversione da coordinate del mouse a coordinate del canvas
	function getCanvasCoordinates(clientX, clientY) {
		const rect = canvas.getBoundingClientRect();
		const x = (clientX - rect.left - panX) / scale;
		const y = (clientY - rect.top - panY) / scale;
		return { x, y };
	}

	// Drag and drop dalla palette al canvas
	const nodeItems = document.querySelectorAll('.node-item');
	nodeItems.forEach(item => {
		item.addEventListener('dragstart', function (e) {
			e.dataTransfer.setData('text/plain', JSON.stringify({
				type: this.dataset.type,
				name: this.dataset.name
			}));
		});
	});

	canvas.addEventListener('dragover', function (e) {
		e.preventDefault();
	});

	canvas.addEventListener('drop', function (e) {
		e.preventDefault();

		try {
			const data = JSON.parse(e.dataTransfer.getData('text/plain'));

			// Calcolare la posizione dentro il canvas con lo zoom
			const coords = getCanvasCoordinates(e.clientX, e.clientY);

			addNode(data.type, data.name, coords.x, coords.y);
		} catch (err) {
			console.error('Error adding node:', err);
		}
	});

	// Aggiungere un nuovo nodo
	function addNode(type, name, x, y) {
		const nodeId = 'node-' + nextNodeId++;

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

		nodes.push(node);
		renderNode(node);

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

	// Funzione per renderizzare un nodo
	function renderNode(node) {
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

			isDragging = true;

			// MODIFICATO: Selezione con shift premuto per selezione multipla
			if (!e.shiftKey && !selectedNodes.some(n => n.id === node.id)) {
				clearSelection();
			}

			selectNode(node, true); // true indica di non deselezionare gli altri nodi

			// Coordinate del mouse all'inizio del trascinamento
			dragStartX = e.clientX;
			dragStartY = e.clientY;

			// Memorizza gli offset di tutti i nodi selezionati
			nodeOffsets = [];
			selectedNodes.forEach(n => {
				nodeOffsets.push({
					id: n.id,
					offsetX: n.x,
					offsetY: n.y
				});
			});

			e.preventDefault();
		});

		// Cliccabile per mostrare il pannello di configurazione
		nodeElement.addEventListener('click', function (e) {
			if (!isDragging && !isConnecting) {
				if (!e.shiftKey) {
					clearSelection();
					selectNode(node, false);
					showConfigPanel(node);
				} else {
					// Toggle selezione con shift
					const index = selectedNodes.findIndex(n => n.id === node.id);
					if (index !== -1) {
						// Deseleziona
						nodeElement.classList.remove('selected');
						selectedNodes.splice(index, 1);
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

			isConnecting = true;
			connectionStart = node.id;
			connectionStartEl = this;

			this.classList.add('active');

			// Crea una connessione temporanea
			createTempConnection(e.clientX, e.clientY);
		});

		inputPort.addEventListener('mouseup', function (e) {
			e.stopPropagation();

			if (isConnecting && connectionStart) {
				const sourceId = connectionStart;
				const targetId = node.id;

				// Rimuovi la classe active
				document.querySelectorAll('.connector.active').forEach(el => {
					el.classList.remove('active');
				});

				// Evita connessioni a se stesso
				if (sourceId !== targetId) {
					// Evita connessioni duplicate
					const exists = connections.some(conn =>
						conn.source === sourceId && conn.target === targetId
					);

					if (!exists) {
						addConnection(sourceId, targetId);
					}
				}

				// Reset
				isConnecting = false;
				connectionStart = null;
				connectionStartEl = null;
				removeTempConnection();
			}
		});

		// Stop propagation per entrambi i connettori
		inputPort.addEventListener('click', (e) => e.stopPropagation());
		outputPort.addEventListener('click', (e) => e.stopPropagation());

		canvasContent.appendChild(nodeElement);
	}

	// NUOVA FUNZIONE: Pulisce tutte le selezioni
	function clearSelection() {
		// Deseleziona tutti i nodi
		document.querySelectorAll('.node').forEach(el => {
			el.classList.remove('selected');
		});

		// Deseleziona tutte le connessioni
		document.querySelectorAll('.connection').forEach(el => {
			el.classList.remove('selected');
		});

		selectedNodes = [];
		selectedConnection = null;
	}

	// MODIFICATA: Funzione per selezionare un nodo
	function selectNode(node, keepExisting = false) {
		if (!keepExisting) {
			clearSelection();
		}

		// Verifica se il nodo è già selezionato
		if (!selectedNodes.some(n => n.id === node.id)) {
			selectedNodes.push(node);

			const nodeElement = document.getElementById(node.id);
			if (nodeElement) {
				nodeElement.classList.add('selected');
			}
		}

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

	// MODIFICATA: Aggiorna il pulsante di eliminazione per supportare selezione multipla
	function updateDeleteButton() {
		if ((selectedNodes.length > 0 || selectedConnection) && !configPanel.classList.contains('hidden')) {
			// Mostra il pulsante se c'è qualcosa selezionato E il pannello configurazione è visibile
			deleteButtonContainer.classList.remove('hidden');

			// Aggiorna il testo del pulsante per riflettere il numero di elementi selezionati
			if (selectedNodes.length > 1) {
				deleteNodeBtn.title = `Delete ${selectedNodes.length} selected nodes`;
			} else if (selectedNodes.length === 1) {
				deleteNodeBtn.title = `Delete node`;
			} else if (selectedConnection) {
				deleteNodeBtn.title = `Delete connection`;
			}
		} else {
			// Nascondi il pulsante se non c'è nulla selezionato
			deleteButtonContainer.classList.add('hidden');
		}
	}

	// NUOVA FUNZIONE: Inizializza la selezione ad area
	function startSelection(e) {
		if (!selectionBox) return;

		// Verifica se il click non è su un nodo o su un altro elemento interattivo
		if (e.target === canvas || e.target.id === 'canvas-content') {
			isSelecting = true;

			// Converti le coordinate del mouse alle coordinate del canvas
			const coords = getCanvasCoordinates(e.clientX, e.clientY);
			selectionStartX = coords.x;
			selectionStartY = coords.y;

			// Posiziona e mostra il rettangolo di selezione
			selectionBox.style.left = `${selectionStartX}px`;
			selectionBox.style.top = `${selectionStartY}px`;
			selectionBox.style.width = '0px';
			selectionBox.style.height = '0px';
			selectionBox.style.display = 'block';

			// Se non è premuto shift, deseleziona tutto
			if (!e.shiftKey) {
				clearSelection();
			}
		}
	}

	// NUOVA FUNZIONE: Aggiorna l'area di selezione
	function updateSelection(e) {
		if (!isSelecting || !selectionBox) return;

		const coords = getCanvasCoordinates(e.clientX, e.clientY);
		const x = Math.min(selectionStartX, coords.x);
		const y = Math.min(selectionStartY, coords.y);
		const width = Math.abs(coords.x - selectionStartX);
		const height = Math.abs(coords.y - selectionStartY);

		selectionBox.style.left = `${x}px`;
		selectionBox.style.top = `${y}px`;
		selectionBox.style.width = `${width}px`;
		selectionBox.style.height = `${height}px`;
	}

	// NUOVA FUNZIONE: Completa la selezione ad area
	function endSelection() {
		if (!isSelecting || !selectionBox) return;

		// Calcola i limiti del rettangolo di selezione
		const boxLeft = parseFloat(selectionBox.style.left);
		const boxTop = parseFloat(selectionBox.style.top);
		const boxRight = boxLeft + parseFloat(selectionBox.style.width);
		const boxBottom = boxTop + parseFloat(selectionBox.style.height);

		// Seleziona i nodi all'interno del rettangolo
		nodes.forEach(node => {
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
				selectNode(node, true);
			}
		});

		// Nasconde il rettangolo di selezione
		selectionBox.style.display = 'none';
		isSelecting = false;

		updateDeleteButton();
	}

	// MODIFICATO: Mouse move per lo spostamento dei nodi e la selezione
	document.addEventListener('mousemove', function (e) {
		// Gestione dello spostamento dei nodi
		if (isDragging && selectedNodes.length > 0) {
			// Calcola lo spostamento del mouse
			const deltaX = (e.clientX - dragStartX) / scale;
			const deltaY = (e.clientY - dragStartY) / scale;

			// Per ogni nodo selezionato
			for (let i = 0; i < selectedNodes.length; i++) {
				const node = selectedNodes[i];
				const offset = nodeOffsets.find(o => o.id === node.id);

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
			updateConnections();
		}

		// Aggiorna la connessione temporanea
		if (isConnecting) {
			updateTempConnection(e.clientX, e.clientY);
		}

		// Aggiorna la selezione ad area
		if (isSelecting) {
			updateSelection(e);
		}

		// Gestione del pan
		if (isPanning) {
			const deltaX = e.clientX - panStartX;
			const deltaY = e.clientY - panStartY;

			panX += deltaX;
			panY += deltaY;

			panStartX = e.clientX;
			panStartY = e.clientY;

			updateCanvasTransform();
		}
	});

	// Mouse up per terminare lo spostamento e altre operazioni
	document.addEventListener('mouseup', function (e) {
		// Fine del trascinamento
		isDragging = false;

		// Fine della selezione ad area
		if (isSelecting) {
			endSelection();
		}

		// Fine del panning
		isPanning = false;
		if (canvas.classList.contains('panning')) {
			canvas.classList.remove('panning');
		}

		// Se stavamo creando una connessione ma non l'abbiamo completata
		if (isConnecting) {
			// Rimuovi la classe active
			document.querySelectorAll('.connector.active').forEach(el => {
				el.classList.remove('active');
			});

			isConnecting = false;
			connectionStart = null;
			connectionStartEl = null;
			removeTempConnection();
		}
	});

	// MODIFICATO: Mouse down sul canvas per iniziare la selezione ad area o il pan
	canvas.addEventListener('mousedown', function (e) {
		// Se è premuto il tasto centrale o space key è premuto, inizia il pan
		if (e.button === 1 || (e.button === 0 && spaceKeyPressed)) {
			e.preventDefault();
			isPanning = true;
			panStartX = e.clientX;
			panStartY = e.clientY;
			canvas.classList.add('panning');
			canvas.style.cursor = 'grabbing';
		}
		// Altrimenti se è premuto shift, inizia la selezione ad area
		else if (e.shiftKey && e.button === 0) {
			startSelection(e);
		}
	});

	// NUOVI EVENT LISTENER: Gestione della rotella del mouse per lo zoom
	canvas.addEventListener('wheel', function (e) {
		e.preventDefault();

		// Calcola il delta dello zoom
		const delta = -e.deltaY * 0.001;

		// Calcola le coordinate del mouse prima dello zoom
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Calcola le coordinate nel canvas prima dello zoom
		const oldX = (mouseX - panX) / scale;
		const oldY = (mouseY - panY) / scale;

		// Applica lo zoom
		const oldScale = scale;
		scale = Math.max(0.1, Math.min(2, scale + delta));

		// Calcola il nuovo pan per mantenere il punto sotto il mouse
		panX = mouseX - oldX * scale;
		panY = mouseY - oldY * scale;

		// Aggiorna la trasformazione
		updateCanvasTransform();

		// Aggiorna le connessioni per il nuovo scale
		updateConnections();
	});

	// NUOVI EVENT LISTENER: Gestione dei tasti per pan (spazio)
	document.addEventListener('keydown', function (e) {
		if (e.code === 'Space') {
			spaceKeyPressed = true;
			canvas.style.cursor = 'grab';
		}
	});

	document.addEventListener('keyup', function (e) {
		if (e.code === 'Space') {
			spaceKeyPressed = false;
			canvas.style.cursor = '';
		}
	});

	// Creazione connessione temporanea
	function createTempConnection(x, y) {
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

	// MODIFICATA: Aggiornamento connessione temporanea con supporto per zoom
	function updateTempConnection(mouseX, mouseY) {
		if (!connectionStartEl) return;

		const tempConnection = document.getElementById('temp-connection');
		if (!tempConnection) return;

		const path = tempConnection.querySelector('path');
		const rect = canvas.getBoundingClientRect();

		const startRect = connectionStartEl.getBoundingClientRect();
		const startX = (startRect.left - rect.left - panX) / scale + startRect.width / (2 * scale);
		const startY = (startRect.top - rect.top - panY) / scale + startRect.height / (2 * scale);

		const coords = getCanvasCoordinates(mouseX, mouseY);
		const endX = coords.x;
		const endY = coords.y;

		const midX = (startX + endX) / 2;

		// Create a curved path
		const pathData = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
		path.setAttribute('d', pathData);
	}

	// Rimozione connessione temporanea
	function removeTempConnection() {
		const tempConnection = document.getElementById('temp-connection');
		if (tempConnection) {
			tempConnection.remove();
		}
	}

	// Aggiungere una connessione
	function addConnection(sourceId, targetId) {
		const connection = {
			id: `conn-${sourceId}-${targetId}`,
			source: sourceId,
			target: targetId
		};

		connections.push(connection);
		renderConnection(connection);
	}

	// Renderizzare una connessione
	function renderConnection(connection) {
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

	// Seleziona una connessione
	function selectConnection(connection) {
		clearSelection();

		selectedConnection = connection;

		if (selectedConnection) {
			const connElement = document.getElementById(selectedConnection.id);
			if (connElement) {
				connElement.classList.add('selected');
			}
		}

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

	// Aggiornare tutte le connessioni
	function updateConnections() {
		connections.forEach(connection => {
			updateConnectionPath(connection);
			updateConnectionHitArea(connection);
		});
	}

	// MODIFICATA: Aggiornare il percorso di una connessione con supporto per zoom
	function updateConnectionPath(connection) {
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

	// Aggiorna l'area cliccabile di una connessione
	function updateConnectionHitArea(connection) {
		const connElement = document.getElementById(connection.id);
		if (!connElement) return;

		const path = connElement.querySelector('path:first-child');
		const hitArea = connElement.querySelector('path:nth-child(2)');

		if (path && hitArea) {
			hitArea.setAttribute('d', path.getAttribute('d'));
		}
	}

	// MODIFICATA: Eliminare i nodi selezionati
	function deleteSelectedNodes() {
		if (selectedNodes.length === 0) return;

		// Rimuovi tutti i nodi selezionati
		selectedNodes.forEach(node => {
			// Rimuovi il nodo dal DOM
			const nodeElement = document.getElementById(node.id);
			if (nodeElement) {
				nodeElement.remove();
			}

			// Rimuovi il nodo dall'array
			const nodeIndex = nodes.findIndex(n => n.id === node.id);
			if (nodeIndex !== -1) {
				nodes.splice(nodeIndex, 1);
			}

			// Rimuovi tutte le connessioni associate a questo nodo
			connections = connections.filter(conn => {
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
		selectedNodes = [];
		selectedConnection = null;

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

	// Eliminare una connessione
	function deleteConnection(connId) {
		// Trova la connessione
		const connIndex = connections.findIndex(c => c.id === connId);
		if (connIndex === -1) return;

		// Rimuovi la connessione dal DOM
		const connElement = document.getElementById(connId);
		if (connElement) {
			connElement.remove();
		}

		// Rimuovi la connessione dall'array
		connections.splice(connIndex, 1);

		// Reset della selezione
		selectedConnection = null;

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

	// MODIFICATA: Gestione eliminazione per supportare selezione multipla
	deleteNodeBtn.addEventListener('click', function () {
		if (selectedNodes.length > 0) {
			const message = selectedNodes.length === 1
				? `Are you sure you want to delete the "${selectedNodes[0].config.name || selectedNodes[0].name}" node?`
				: `Are you sure you want to delete ${selectedNodes.length} selected nodes?`;

			showConfirmModal(
				'Delete Node' + (selectedNodes.length > 1 ? 's' : ''),
				message,
				deleteSelectedNodes
			);
		} else if (selectedConnection) {
			showConfirmModal(
				'Delete Connection',
				'Are you sure you want to delete this connection?',
				() => deleteConnection(selectedConnection.id)
			);
		}
	});

	// Elimina tutto il workflow
	clearAllBtn.addEventListener('click', function () {
		if (nodes.length === 0 && connections.length === 0) return;

		showConfirmModal(
			'Clear Workflow',
			'Are you sure you want to clear the entire workflow? This action cannot be undone.',
			clearWorkflow
		);
	});

	// Funzione per eliminare l'intero workflow
	function clearWorkflow() {
		// Rimuovi tutti i nodi dal DOM
		nodes.forEach(node => {
			const nodeElement = document.getElementById(node.id);
			if (nodeElement) {
				nodeElement.remove();
			}
		});

		// Rimuovi tutte le connessioni dal DOM
		connections.forEach(conn => {
			const connElement = document.getElementById(conn.id);
			if (connElement) {
				connElement.remove();
			}
		});

		// Reset degli array
		nodes = [];
		connections = [];

		// Reset della selezione
		selectedNodes = [];
		selectedConnection = null;

		// Aggiorna il pulsante di eliminazione
		updateDeleteButton();
	}

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

	// Mostrare il pannello di configurazione
	function showConfigPanel(node) {
		configPanel.classList.remove('hidden');
		configTitle.textContent = `${node.config.name || node.name} Settings`;
		nodeNameInput.value = node.config.name || node.name;

		// Mostra il pulsante cestino
		deleteButtonContainer.classList.remove('hidden');

		// Aggiorna la configurazione specifica per tipo
		if (typeConfigs[node.type]) {
			typeSpecificConfig.innerHTML = typeConfigs[node.type]();

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
			typeSpecificConfig.innerHTML = '';
		}
	}

	// Chiudere il pannello di configurazione
	closeConfig.addEventListener('click', function () {
		configPanel.classList.add('hidden');
		// Nascondi il pulsante cestino quando chiudi il pannello
		deleteButtonContainer.classList.add('hidden');
		clearSelection();
	});

	// MODIFICATO: Click sul canvas per deselezionare (a meno che non stiamo facendo selezione multipla)
	canvas.addEventListener('click', function (e) {
		if (e.target === canvas || e.target.id === 'canvas-content') {
			if (!e.shiftKey) {
				clearSelection();
				updateDeleteButton();
				configPanel.classList.add('hidden');
				// Nascondi il pulsante cestino
				deleteButtonContainer.classList.add('hidden');
			}
		}
	});

	// Salvare la configurazione
	saveConfig.addEventListener('click', function () {
		if (selectedNodes.length !== 1) return;
		const selectedNode = selectedNodes[0];

		// Nome base
		selectedNode.config.name = nodeNameInput.value;

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

		configPanel.classList.add('hidden');
		// Nascondi il pulsante cestino quando chiudi il pannello
		deleteButtonContainer.classList.add('hidden');
	});

	// MODIFICATO: Salvataggio del workflow con verifica del canvas vuoto
	saveBtn.addEventListener('click', function () {
		// Verifica se ci sono nodi nel workflow
		if (nodes.length === 0) {
			showConfirmModal('Cannot Save', 'The canvas is empty. There is nothing to save.', null, true);
			return;
		}

		const workflow = {
			nodes: nodes.map(node => ({
				id: node.id,
				type: node.type,
				name: node.name,
				x: node.x,
				y: node.y,
				config: node.config
			})),
			connections: connections.map(conn => ({
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

	// Caricamento del workflow
	loadFile.addEventListener('change', function (e) {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();

		reader.onload = function (e) {
			try {
				const workflow = JSON.parse(e.target.result);

				// Chiedi conferma solo se ci sono nodi esistenti
				if (nodes.length > 0 || connections.length > 0) {
					showConfirmModal(
						'Load Workflow',
						'Loading a new workflow will replace the current one. Do you want to continue?',
						() => loadWorkflow(workflow)
					);
				} else {
					loadWorkflow(workflow);
				}
			} catch (err) {
				console.error('Error loading workflow:', err);
				alert('Invalid workflow file');
			}
		};

		reader.readAsText(file);
	});

	// Funzione per caricare un workflow
	function loadWorkflow(workflow) {
		// Pulisci il canvas
		clearWorkflow();

		// Aggiungi i nodi
		if (workflow.nodes && Array.isArray(workflow.nodes)) {
			nextNodeId = 1;

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

				nodes.push(newNode);
				renderNode(newNode);

				// Aggiorna nextNodeId se necessario
				const idParts = node.id.split('-');
				if (idParts.length > 1) {
					const id = parseInt(idParts[1]);
					if (!isNaN(id) && id >= nextNodeId) {
						nextNodeId = id + 1;
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

				connections.push(newConn);
				renderConnection(newConn);
			});
		}
	}

	// Aggiungi questo nella parte iniziale del tuo codice JavaScript
	document.addEventListener('selectstart', function (e) {
		if (isConnecting || isDragging || isSelecting || isPanning) {
			e.preventDefault();
		}
	});

	// MODIFICATO: Intercetta il tasto CANC per eliminare gli elementi selezionati
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (document.activeElement.tagName === 'INPUT' ||
				document.activeElement.tagName === 'TEXTAREA') {
				return; // Non fare nulla se siamo in un campo di input
			}

			if (selectedNodes.length > 0) {
				deleteSelectedNodes();
			} else if (selectedConnection) {
				deleteConnection(selectedConnection.id);
			}
		}

		// Supporto per selezionare tutti i nodi (Ctrl+A)
		if (e.ctrlKey && e.key === 'a') {
			e.preventDefault();
			clearSelection();
			nodes.forEach(node => selectNode(node, true));
		}

		// Aggiungi supporto per tasto Escape per annullare connessione
		if (e.key === 'Escape' && isConnecting) {
			isConnecting = false;
			if (connectionStartEl) {
				connectionStartEl.classList.remove('active');
				connectionStartEl = null;
			}
			connectionStart = null;
			removeTempConnection();
		}
	});

	// NUOVA FUNZIONE: Aggiungi istruzioni di utilizzo
	function addUsageInstructions() {
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
		canvas.appendChild(instructions);
	}

	// MODIFICATA: Funzione per validare il workflow con controllo canvas vuoto
	function validateWorkflow() {
		// Controlla se ci sono nodi nel workflow
		if (nodes.length === 0) {
			showConfirmModal('Validation Result', 'The canvas is empty. There are no elements to validate.', null, true);
			return false;
		}

		// Controlla se ci sono cicli nel workflow
		if (hasCycle()) {
			showConfirmModal('Validation Result', 'Warning: The workflow contains an infinite loop. Modify the connections to resolve it.', null, true);
			return false;
		}

		showConfirmModal('Validation Result', 'The workflow is valid! No infinite loops detected.', null, true);
		return true;
	}

	// Funzione per rilevare cicli nel workflow
	function hasCycle() {
		const visitedNodes = new Set();
		const currentPath = new Set();

		// Controlla ciascun nodo per verificare se è parte di un ciclo
		for (const node of nodes) {
			if (!visitedNodes.has(node.id)) {
				if (dfsCheckCycle(node.id, visitedNodes, currentPath)) {
					return true; // Ciclo trovato
				}
			}
		}

		return false; // Nessun ciclo trovato
	}

	// Depth-First Search per controllare cicli
	function dfsCheckCycle(nodeId, visitedNodes, currentPath) {
		currentPath.add(nodeId);

		// Trova tutte le connessioni in uscita da questo nodo
		const outgoingConnections = connections.filter(conn => conn.source === nodeId);

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

	// Funzione per evidenziare il ciclo trovato
	function highlightCycle(pathNodes, targetId) {
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

		validateWorkflow();
	});

	// Inizializza le nuove funzionalità nell'ordine corretto
	// 1. Crea il contenitore del canvas
	const canvasContent = initCanvasTransform();
	// 2. Crea i controlli di zoom
	const zoomControls = createZoomControls();
	// 3. Aggiorna la trasformazione iniziale
	updateCanvasTransform();
	// 4. Aggiungi le istruzioni d'uso
	addUsageInstructions();
});
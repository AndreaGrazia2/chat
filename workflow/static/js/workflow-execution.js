document.addEventListener('DOMContentLoaded', function() {
    // Elementi DOM
    const executionInfo = document.getElementById('execution-info');
    const executionLoading = document.getElementById('execution-loading');
    const executionId = window.executionId;
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    const refreshBtn = document.getElementById('refresh-btn');
    const logEntries = document.getElementById('log-entries');
    const logModal = document.getElementById('log-modal');
    const closeLogModal = document.getElementById('close-log-modal');
    
    // Stato dell'applicazione
    let state = {
        execution: null,
        logs: [],
        lastLogId: 0,
        autoRefreshInterval: null,
        workflowData: null
    };
    
    // Inizializzazione
    initTheme();
    loadExecutionDetails();
    
    // Event listeners
    refreshBtn.addEventListener('click', loadExecutionDetails);
    
    autoRefreshCheckbox.addEventListener('change', function() {
        if (this.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    
    closeLogModal.addEventListener('click', function() {
        logModal.classList.add('hidden');
    });
    
    // Inizializzazione del tema
    function initTheme() {
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
        
        // Toggle dark mode
        document.getElementById('theme-toggle').addEventListener('click', function() {
            document.documentElement.classList.toggle('dark');
            const isDarkMode = document.documentElement.classList.contains('dark');
            localStorage.setItem('workflow-theme', isDarkMode);
            
            const sunIcon = document.getElementById('sun-icon');
            const moonIcon = document.getElementById('moon-icon');
            
            if (isDarkMode) {
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
            } else {
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            }
        });
    }
    
    // Carica i dettagli dell'esecuzione
    async function loadExecutionDetails() {
        try {
            // Mostra loading
            executionLoading.classList.remove('hidden');
            executionInfo.classList.add('hidden');
            
            // Carica i dettagli dell'esecuzione
            const response = await fetch(`/workflow/api/executions/${executionId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load execution details: ${response.status} ${response.statusText}`);
            }
            
            const execution = await response.json();
            state.execution = execution;
            
            // Se i log sono cambiati, aggiorna lo stato dei log
            if (execution.logs && execution.logs.length > 0) {
                state.logs = execution.logs;
                state.lastLogId = Math.max(...execution.logs.map(log => log.id));
            }
            
            // Carica i dati del workflow se non sono già stati caricati
            if (!state.workflowData && execution.workflow_id) {
                try {
                    const workflowResponse = await fetch(`/workflow/api/workflows/${execution.workflow_id}`);
                    if (workflowResponse.ok) {
                        state.workflowData = await workflowResponse.json();
                    }
                } catch (error) {
                    console.error('Error loading workflow data:', error);
                }
            }
            
            // Aggiorna l'interfaccia
            updateExecutionUI(execution);
            updateExecutionFlow(execution);
            updateLogsTable(execution.logs);
            
            // Se l'esecuzione è completata, disabilita l'auto-refresh
            if (execution.status === 'completed' || execution.status === 'failed') {
                autoRefreshCheckbox.checked = false;
                stopAutoRefresh();
            }
            
            // Nascondi loading
            executionLoading.classList.add('hidden');
            executionInfo.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading execution details:', error);
            executionLoading.innerHTML = `
                <div class="text-center py-4 text-red-500">
                    <i class="fas fa-exclamation-triangle mr-2"></i> 
                    Error loading execution details: ${error.message}
                </div>
            `;
        }
    }
    
    // Avvia l'auto-refresh
    function startAutoRefresh() {
        if (state.autoRefreshInterval) {
            clearInterval(state.autoRefreshInterval);
        }
        
        // Aggiorna i log ogni 3 secondi
        state.autoRefreshInterval = setInterval(refreshLogs, 3000);
    }
    
    // Ferma l'auto-refresh
    function stopAutoRefresh() {
        if (state.autoRefreshInterval) {
            clearInterval(state.autoRefreshInterval);
            state.autoRefreshInterval = null;
        }
    }
    
    // Aggiorna solo i log
    async function refreshLogs() {
        try {
            // Non fare nulla se l'esecuzione è completata o fallita
            if (state.execution && (state.execution.status === 'completed' || state.execution.status === 'failed')) {
                stopAutoRefresh();
                autoRefreshCheckbox.checked = false;
                return;
            }
            
            const response = await fetch(`/workflow/api/executions/${executionId}/logs/stream?last_id=${state.lastLogId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load logs: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Se ci sono nuovi log, aggiornali
            if (data.logs && data.logs.length > 0) {
                // Aggiungi i nuovi log allo stato
                state.logs = [...state.logs, ...data.logs];
                state.lastLogId = Math.max(...data.logs.map(log => log.id), state.lastLogId);
                
                // Aggiorna la tabella dei log
                updateLogsTable(state.logs);
            }
            
            // Se lo stato dell'esecuzione è cambiato, ricarica tutti i dettagli
            if (data.execution_status !== state.execution.status) {
                loadExecutionDetails();
            }
            
            // Se l'esecuzione è completata, ferma l'auto-refresh
            if (data.is_completed) {
                stopAutoRefresh();
                autoRefreshCheckbox.checked = false;
            }
            
        } catch (error) {
            console.error('Error refreshing logs:', error);
            // Non fermare l'auto-refresh in caso di errore, potrebbe essere temporaneo
        }
    }
    
    // Aggiorna l'interfaccia utente con i dettagli dell'esecuzione
    function updateExecutionUI(execution) {
        // Info di base
        document.getElementById('execution-id').textContent = execution.id;
        document.getElementById('workflow-name').textContent = state.workflowData ? state.workflowData.name : `Workflow #${execution.workflow_id}`;
        
        // Date
        document.getElementById('started-at').textContent = formatDateTime(execution.started_at);
        document.getElementById('completed-at').textContent = execution.completed_at ? formatDateTime(execution.completed_at) : '-';
        
        // Status badge
        const statusElement = document.getElementById('execution-status');
        let statusClass = '';
        let statusText = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
        
        if (execution.status === 'running') {
            statusClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        } else if (execution.status === 'completed') {
            statusClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        } else if (execution.status === 'failed') {
            statusClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        }
        
        statusElement.className = `inline-block px-2 py-1 rounded text-sm ${statusClass}`;
        statusElement.textContent = statusText;
        
        // Durata
        let duration = 'In progress';
        if (execution.started_at && execution.completed_at) {
            const start = new Date(execution.started_at);
            const end = new Date(execution.completed_at);
            const diff = Math.round((end - start) / 1000); // in secondi
            
            if (diff < 60) {
                duration = `${diff} sec`;
            } else if (diff < 3600) {
                duration = `${Math.floor(diff / 60)} min ${diff % 60} sec`;
            } else {
                duration = `${Math.floor(diff / 3600)} h ${Math.floor((diff % 3600) / 60)} min`;
            }
        }
        document.getElementById('duration').textContent = duration;
        
        // Input e output
        document.getElementById('input-data').textContent = JSON.stringify(execution.input_data, null, 2);
        document.getElementById('output-data').textContent = JSON.stringify(execution.output_data, null, 2);
        
        // Errore (se presente)
        const errorContainer = document.getElementById('error-container');
        if (execution.error_message) {
            errorContainer.classList.remove('hidden');
            document.getElementById('error-message').textContent = execution.error_message;
        } else {
            errorContainer.classList.add('hidden');
        }
    }
    
    // Aggiorna la visualizzazione del flusso di esecuzione
    function updateExecutionFlow(execution) {
        const flowContainer = document.getElementById('execution-flow');
        
        // Se abbiamo i dati del workflow, possiamo visualizzare il flusso
        if (state.workflowData && state.workflowData.json_definition) {
            const workflow = state.workflowData.json_definition;
            const executionPath = execution.execution_path || [];
            
            // Crea un SVG per visualizzare il flusso
            let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '800');
            svg.setAttribute('height', '400');
            svg.style.overflow = 'visible';
            
            // Calcola le dimensioni del workflow
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            workflow.nodes.forEach(node => {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + 180); // Assumiamo una larghezza di 180px per i nodi
                maxY = Math.max(maxY, node.y + 80);  // Assumiamo un'altezza di 80px per i nodi
            });
            
            // Aggiungi un po' di padding
            minX -= 20;
            minY -= 20;
            maxX += 20;
            maxY += 20;
            
            // Imposta le dimensioni del SVG
            svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
            
            // Crea un dizionario dei nodi
            const nodesMap = {};
            workflow.nodes.forEach(node => {
                nodesMap[node.id] = node;
            });
            
            // Disegna le connessioni
            workflow.connections.forEach(conn => {
                const sourceNode = nodesMap[conn.source];
                const targetNode = nodesMap[conn.target];
                
                if (!sourceNode || !targetNode) return;
                
                // Calcola i punti delle connessioni
                const startX = sourceNode.x + 180; // Assumiamo che il connettore di output sia a destra
                const startY = sourceNode.y + 40;  // Metà dell'altezza del nodo
                const endX = targetNode.x;          // Assumiamo che il connettore di input sia a sinistra
                const endY = targetNode.y + 40;     // Metà dell'altezza del nodo
                
                // Crea il percorso della connessione (curva di Bezier)
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Punti di controllo per la curva
                const midX = (startX + endX) / 2;
                const pathData = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
                
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', '#9ca3af');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                
                // Verifica se questa connessione è stata eseguita
                const isExecuted = executionPath.some(step => {
                    return step.node_id === conn.source && 
                           executionPath.some(nextStep => nextStep.node_id === conn.target);
                });
                
                if (isExecuted) {
                    path.setAttribute('stroke', '#10b981'); // Verde per connessioni eseguite
                    path.setAttribute('stroke-width', '3');
                }
                
                svg.appendChild(path);
            });
            
            // Disegna i nodi
            workflow.nodes.forEach(node => {
                // Crea un gruppo per il nodo
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${node.x},${node.y})`);
                
                // Verifica se questo nodo è stato eseguito
                const nodeExecution = executionPath.find(step => step.node_id === node.id);
                let fillColor = '#f3f4f6'; // Grigio chiaro per nodi non eseguiti
                let strokeColor = '#9ca3af';
                
                if (nodeExecution) {
                    if (nodeExecution.status === 'completed') {
                        fillColor = '#d1fae5'; // Verde chiaro per nodi completati
                        strokeColor = '#10b981';
                    } else if (nodeExecution.status === 'failed') {
                        fillColor = '#fee2e2'; // Rosso chiaro per nodi falliti
                        strokeColor = '#ef4444';
                    } else if (nodeExecution.status === 'running') {
                        fillColor = '#dbeafe'; // Blu chiaro per nodi in esecuzione
                        strokeColor = '#3b82f6';
                    }
                }
                
                // Rettangolo del nodo
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('width', '180');
                rect.setAttribute('height', '80');
                rect.setAttribute('rx', '8');
                rect.setAttribute('ry', '8');
                rect.setAttribute('fill', fillColor);
                rect.setAttribute('stroke', strokeColor);
                rect.setAttribute('stroke-width', '2');
                
                // Testo del nodo
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', '90');
                text.setAttribute('y', '30');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#111827');
                text.setAttribute('font-size', '14');
                text.setAttribute('font-weight', 'bold');
                text.textContent = node.name || node.config.name || 'Unnamed Node';
                
                // Testo del tipo
                const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                typeText.setAttribute('x', '90');
                typeText.setAttribute('y', '50');
                typeText.setAttribute('text-anchor', 'middle');
                typeText.setAttribute('fill', '#6b7280');
                typeText.setAttribute('font-size', '12');
                typeText.textContent = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                
                // Aggiungi elementi al gruppo
                g.appendChild(rect);
                g.appendChild(text);
                g.appendChild(typeText);
                
                // Aggiungi il gruppo al SVG
                svg.appendChild(g);
            });
            
            // Aggiungi l'SVG al contenitore
            flowContainer.innerHTML = '';
            flowContainer.appendChild(svg);
        } else {
            // Se non abbiamo i dati del workflow, mostra un messaggio
            flowContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Workflow definition not available</p>';
        }
    }
    
    // Aggiorna la tabella dei log
    function updateLogsTable(logs) {
        if (!logs || logs.length === 0) {
            logEntries.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No logs available
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordina i log per timestamp
        logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Svuota la tabella
        logEntries.innerHTML = '';
        
        // Aggiungi le righe
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            
            // Formatta il badge dello stato
            let statusBadge = '';
            if (log.status === 'running') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                Running
                            </span>`;
            } else if (log.status === 'completed') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                Completed
                            </span>`;
            } else if (log.status === 'failed') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                Failed
                            </span>`;
            }
            
            // Formatta la durata
            let duration = 'N/A';
            if (log.duration_ms) {
                if (log.duration_ms < 1000) {
                    duration = `${log.duration_ms} ms`;
                } else {
                    duration = `${(log.duration_ms / 1000).toFixed(2)} s`;
                }
            }
            
            // Crea la riga
            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${formatDateTime(log.timestamp)}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    ${log.node_id}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">
                    ${statusBadge}
                </td>
                <td class="px-6 py-3 text-sm text-gray-900 dark:text-gray-300 max-w-xs truncate">
                    ${log.message || ''}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${duration}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 view-log-details" data-log-id="${log.id}">
                        <i class="fas fa-search"></i> View
                    </button>
                </td>
            `;
            
            logEntries.appendChild(row);
        });
        
        // Aggiungi listeners per i pulsanti di visualizzazione
        document.querySelectorAll('.view-log-details').forEach(btn => {
            btn.addEventListener('click', function() {
                const logId = parseInt(this.getAttribute('data-log-id'));
                const log = logs.find(l => l.id === logId);
                
                if (log) {
                    showLogDetails(log);
                }
            });
        });
    }
    
    // Mostra i dettagli di un log
    function showLogDetails(log) {
        // Imposta i dettagli del log nel modale
        document.getElementById('log-modal-title').textContent = `Log Details - Node ${log.node_id}`;
        document.getElementById('log-node-id').textContent = log.node_id;
        document.getElementById('log-time').textContent = formatDateTime(log.timestamp);
        
        // Status
        const statusElement = document.getElementById('log-status');
        let statusClass = '';
        let statusText = log.status.charAt(0).toUpperCase() + log.status.slice(1);
        
        if (log.status === 'running') {
            statusClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        } else if (log.status === 'completed') {
            statusClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        } else if (log.status === 'failed') {
            statusClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        }
        
        statusElement.className = `inline-block px-2 py-1 rounded text-sm ${statusClass}`;
        statusElement.textContent = statusText;
        
        // Durata
        let duration = 'N/A';
        if (log.duration_ms) {
            if (log.duration_ms < 1000) {
                duration = `${log.duration_ms} ms`;
            } else {
                duration = `${(log.duration_ms / 1000).toFixed(2)} s`;
            }
        }
        document.getElementById('log-duration').textContent = duration;
        
        // Messaggio
        document.getElementById('log-message').textContent = log.message || 'N/A';
        
        // Input e output
        document.getElementById('log-input').textContent = JSON.stringify(log.input_data, null, 2);
        document.getElementById('log-output').textContent = JSON.stringify(log.output_data, null, 2);
        
        // Mostra il modale
        logModal.classList.remove('hidden');
    }
    
    // Formatta data e ora
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        return date.toLocaleString();
    }
});
document.addEventListener('DOMContentLoaded', function() {
    // Elementi DOM
    const workflowFilter = document.getElementById('workflow-filter');
    const statusFilter = document.getElementById('status-filter');
    const executionsTable = document.getElementById('executions-table');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const refreshBtn = document.getElementById('refresh-btn');
    const executionModal = document.getElementById('execution-modal');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Stato dell'applicazione
    let state = {
        page: 1,
        perPage: 20,
        totalPages: 1,
        workflowId: '',
        status: '',
        workflows: [],
        executions: []
    };
    
    // Inizializzazione
    initTheme();
    loadWorkflows();
    loadExecutions();
    
    // Event listeners
    workflowFilter.addEventListener('change', function() {
        state.workflowId = this.value;
        state.page = 1;
        loadExecutions();
    });
    
    statusFilter.addEventListener('change', function() {
        state.status = this.value;
        state.page = 1;
        loadExecutions();
    });
    
    prevPageBtn.addEventListener('click', function() {
        if (state.page > 1) {
            state.page--;
            loadExecutions();
        }
    });
    
    nextPageBtn.addEventListener('click', function() {
        if (state.page < state.totalPages) {
            state.page++;
            loadExecutions();
        }
    });
    
    refreshBtn.addEventListener('click', loadExecutions);
    
    closeModalBtn.addEventListener('click', function() {
        executionModal.classList.add('hidden');
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
    
    // Carica i workflow per il filtro
    async function loadWorkflows() {
        try {
            const response = await fetch('/workflow/api/workflows');
            const workflows = await response.json();
            
            state.workflows = workflows;
            
            // Popola il select del filtro workflow
            workflowFilter.innerHTML = '<option value="">All Workflows</option>';
            workflows.forEach(workflow => {
                const option = document.createElement('option');
                option.value = workflow.id;
                option.textContent = workflow.name;
                workflowFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading workflows:', error);
        }
    }
    
    // Carica le esecuzioni dei workflow
    async function loadExecutions() {
        try {
            executionsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        <i class="fas fa-spinner fa-spin mr-2"></i> Loading executions...
                    </td>
                </tr>
            `;
            
            let url = `/workflow/api/executions?page=${state.page}&per_page=${state.perPage}`;
            
            if (state.workflowId) {
                url += `&workflow_id=${state.workflowId}`;
            }
            
            if (state.status) {
                url += `&status=${state.status}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            state.executions = data.executions;
            state.totalPages = data.pages;
            
            // Aggiorna paginazione
            pageInfo.textContent = `Page ${data.page} of ${data.pages}`;
            prevPageBtn.disabled = data.page <= 1;
            nextPageBtn.disabled = data.page >= data.pages;
            
            // Svuota la tabella
            executionsTable.innerHTML = '';
            
            // Nessun risultato?
            if (data.executions.length === 0) {
                executionsTable.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                            No executions found
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Genera le righe della tabella
            data.executions.forEach(execution => {
                const workflowName = state.workflows.find(w => w.id === execution.workflow_id)?.name || 'Unknown';
                
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                
                // Formatta status badge
                let statusBadge = '';
                if (execution.status === 'running') {
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    <svg class="mr-1.5 h-2 w-2 text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 8 8">
                                        <circle cx="4" cy="4" r="3" />
                                    </svg>
                                    Running
                                </span>`;
                } else if (execution.status === 'completed') {
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    Completed
                                </span>`;
                } else if (execution.status === 'failed') {
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                    Failed
                                </span>`;
                }
                
                // Calcola durata
                let duration = 'N/A';
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
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${execution.id}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${workflowName}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${statusBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${formatDateTime(execution.started_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${execution.completed_at ? formatDateTime(execution.completed_at) : '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 view-details" data-id="${execution.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <a href="/workflow/executions/${execution.id}/view" class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                            <i class="fas fa-external-link-alt"></i> Details
                        </a>
                    </td>
                `;
                
                executionsTable.appendChild(row);
            });
            
            // Aggiungi event listeners per i pulsanti di visualizzazione
            document.querySelectorAll('.view-details').forEach(btn => {
                btn.addEventListener('click', function() {
                    const executionId = this.getAttribute('data-id');
                    showExecutionDetails(executionId);
                });
            });
            
        } catch (error) {
            console.error('Error loading executions:', error);
            executionsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-red-500 dark:text-red-400">
                        Error loading executions. Please try again.
                    </td>
                </tr>
            `;
        }
    }
    
    // Mostra i dettagli di un'esecuzione
    async function showExecutionDetails(executionId) {
        try {
            // Mostra il modale
            executionModal.classList.remove('hidden');
            
            // Loading state
            document.getElementById('execution-id').textContent = executionId;
            document.getElementById('execution-workflow').textContent = 'Loading...';
            document.getElementById('execution-status').textContent = 'Loading...';
            document.getElementById('execution-started').textContent = 'Loading...';
            document.getElementById('execution-completed').textContent = 'Loading...';
            document.getElementById('execution-duration').textContent = 'Loading...';
            document.getElementById('execution-input').textContent = 'Loading...';
            document.getElementById('execution-output').textContent = 'Loading...';
            
            // Svuota i log
            document.getElementById('execution-logs').innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                        <i class="fas fa-spinner fa-spin mr-2"></i> Loading logs...
                    </td>
                </tr>
            `;
            
            // Nascondi errore
            document.getElementById('execution-error-container').classList.add('hidden');
            
            // Carica i dati dell'esecuzione
            const response = await fetch(`/workflow/api/executions/${executionId}`);
            const execution = await response.json();
            
            // Ottieni il nome del workflow
            const workflow = state.workflows.find(w => w.id === execution.workflow_id);
            const workflowName = workflow ? workflow.name : 'Unknown';
            
            // Aggiorna il modale con i dati
            document.getElementById('execution-id').textContent = execution.id;
            document.getElementById('execution-workflow').textContent = workflowName;
            
            // Status
            let statusClass = '';
            if (execution.status === 'running') {
                statusClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            } else if (execution.status === 'completed') {
                statusClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            } else if (execution.status === 'failed') {
                statusClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            }
            
            const statusEl = document.getElementById('execution-status');
            statusEl.textContent = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
            statusEl.className = `inline-block px-2 py-1 rounded text-sm ${statusClass}`;
            
            // Date e durata
            document.getElementById('execution-started').textContent = formatDateTime(execution.started_at);
            document.getElementById('execution-completed').textContent = execution.completed_at ? formatDateTime(execution.completed_at) : '-';
            
            // Calcola durata
            let duration = 'N/A';
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
            document.getElementById('execution-duration').textContent = duration;
            
            // Input/Output
            document.getElementById('execution-input').textContent = JSON.stringify(execution.input_data, null, 2);
            document.getElementById('execution-output').textContent = JSON.stringify(execution.output_data, null, 2);
            
            // Errore (se presente)
            if (execution.error_message) {
                document.getElementById('execution-error-container').classList.remove('hidden');
                document.getElementById('execution-error').textContent = execution.error_message;
            }
            
            // Popola i log
            const logsContainer = document.getElementById('execution-logs');
            logsContainer.innerHTML = '';
            
            if (execution.logs.length === 0) {
                logsContainer.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                            No logs available
                        </td>
                    </tr>
                `;
            } else {
                execution.logs.forEach(log => {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                    
                    // Status badge
                    let statusBadge = '';
                    if (log.status === 'running') {
                        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                        Running
                                    </span>`;
                    } else if (log.status === 'completed') {
                        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                        Completed
                                    </span>`;
                    } else if (log.status === 'failed') {
                        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                        Failed
                                    </span>`;
                    }
                    
                    // Formatta durata
                    let duration = 'N/A';
                    if (log.duration_ms) {
                        if (log.duration_ms < 1000) {
                            duration = `${log.duration_ms} ms`;
                        } else {
                            duration = `${(log.duration_ms / 1000).toFixed(2)} s`;
                        }
                    }
                    
                    row.innerHTML = `
                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                            ${formatTime(log.timestamp)}
                        </td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                            ${log.node_id}
                        </td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                            ${statusBadge}
                        </td>
                        <td class="px-4 py-2 text-sm max-w-xs truncate">
                            ${log.message || ''}
                        </td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                            ${duration}
                        </td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm">
                            <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 view-log-details" 
                                    data-log-id="${log.id}" data-execution-id="${execution.id}">
                                <i class="fas fa-search"></i> Details
                            </button>
                        </td>
                    `;
                    
                    logsContainer.appendChild(row);
                });
                
                // Aggiungi listener per la visualizzazione dei dettagli dei log
                document.querySelectorAll('.view-log-details').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const logId = this.getAttribute('data-log-id');
                        const executionId = this.getAttribute('data-execution-id');
                        
                        const log = execution.logs.find(l => l.id == logId);
                        if (log) {
                            showLogDetails(log);
                        }
                    });
                });
            }
            
        } catch (error) {
            console.error('Error loading execution details:', error);
            document.getElementById('execution-logs').innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-2 text-center text-red-500 dark:text-red-400">
                        Error loading logs. Please try again.
                    </td>
                </tr>
            `;
        }
    }
    
    // Mostra i dettagli di un log
    function showLogDetails(log) {
        const logModal = document.getElementById('log-modal');
        
        // Imposta i dettagli del log
        document.getElementById('log-node-id').textContent = log.node_id;
        document.getElementById('log-time').textContent = formatDateTime(log.timestamp);
        document.getElementById('log-status').textContent = log.status;
        
        // Formatta durata
        let duration = 'N/A';
        if (log.duration_ms) {
            if (log.duration_ms < 1000) {
                duration = `${log.duration_ms} ms`;
            } else {
                duration = `${(log.duration_ms / 1000).toFixed(2)} s`;
            }
        }
        document.getElementById('log-duration').textContent = duration;
        
        document.getElementById('log-message').textContent = log.message || 'N/A';
        document.getElementById('log-input').textContent = JSON.stringify(log.input_data, null, 2);
        document.getElementById('log-output').textContent = JSON.stringify(log.output_data, null, 2);
        
        // Mostra il modale
        logModal.classList.remove('hidden');
        
        // Chiudi il modale quando si clicca sul bottone di chiusura
        document.getElementById('close-log-modal').addEventListener('click', function() {
            logModal.classList.add('hidden');
        });
    }
    
    // Formatta data e ora
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    // Formatta ora
    function formatTime(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    }
});
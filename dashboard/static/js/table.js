// Modifica questa riga
import { createStatusBadge } from './ui.js';

// Filtra i dati della tabella in base al termine di ricerca
export function filterTableData(searchTerm, logData, setCurrentPage, updatePagination, renderLogTable) {
	const filteredData = logData.filter(log =>
		log.timestamp.toLowerCase().includes(searchTerm) ||
		log.type.toLowerCase().includes(searchTerm) ||
		log.user.toLowerCase().includes(searchTerm) ||
		log.action.toLowerCase().includes(searchTerm) ||
		log.status.toLowerCase().includes(searchTerm)
	);

	// Reset alla prima pagina quando si filtra
	setCurrentPage(1);
	updatePagination(filteredData);
	renderLogTable(filteredData);
	
	return filteredData;
}

// Renderizza tabella log
export function renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody) {
	// Svuota la tabella
	logTableBody.innerHTML = '';

	// Calcola l'indice degli elementi da visualizzare
	const startIndex = (currentPage - 1) * rowsPerPage;
	const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
	const currentRows = filteredData.slice(startIndex, endIndex);

	// Aggiungi righe
	currentRows.forEach(log => {
		const row = document.createElement('tr');

		// Timestamp
		const timestampCell = document.createElement('td');
		timestampCell.textContent = log.timestamp;
		row.appendChild(timestampCell);

		// Tipo
		const typeCell = document.createElement('td');
		typeCell.textContent = log.type;
		row.appendChild(typeCell);

		// Utente
		const userCell = document.createElement('td');
		userCell.textContent = log.user;
		row.appendChild(userCell);

		// Azione
		const actionCell = document.createElement('td');
		actionCell.textContent = log.action;
		row.appendChild(actionCell);

		// Stato
		const statusCell = document.createElement('td');
		statusCell.appendChild(createStatusBadge(log.status));
		row.appendChild(statusCell);

		logTableBody.appendChild(row);
	});
}
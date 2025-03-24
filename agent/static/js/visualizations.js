/**
 * visualizations.js
 * Script di supporto per le visualizzazioni generate dall'agente di database
 */

// Funzionalità attivate al caricamento della pagina
document.addEventListener('DOMContentLoaded', function () {
	// Inizializza la formattazione automatica delle celle
	initializeDataFormatting();

	// Inizializza la paginazione se presente
	initializePagination();

	// Aggiungi funzionalità di ordinamento alle tabelle
	initializeTableSorting();

	// Inizializza funzionalità di download dei dati
	initializeDataExport();

	// Inizializza tooltip avanzati
	initializeTooltips();
});

/**
 * Formatta automaticamente le celle della tabella in base al tipo di dato
 */
function initializeDataFormatting() {
	// Cerca tutte le tabelle di dati
	const tables = document.querySelectorAll('.data-table');

	tables.forEach(table => {
		// Trova tutte le celle
		const cells = table.querySelectorAll('td');

		cells.forEach(cell => {
			const text = cell.textContent.trim();

			// Formattazione numeri
			if (!isNaN(parseFloat(text)) && isFinite(text)) {
				cell.classList.add('numeric-cell');
				// Formatta i numeri con separatore delle migliaia
				if (text.indexOf('.') !== -1) {
					const num = parseFloat(text);
					if (num === Math.floor(num)) {
						cell.textContent = num.toLocaleString();
					} else {
						cell.textContent = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
					}
				} else {
					cell.textContent = parseInt(text).toLocaleString();
				}
			}

			// Formattazione date
			if (isDateString(text)) {
				cell.classList.add('date-cell');
				// Formatta le date in formato locale
				try {
					const date = new Date(text);
					if (!isNaN(date.getTime())) {
						cell.textContent = date.toLocaleDateString();
					}
				} catch (e) {
					// Mantieni il testo originale se la conversione fallisce
				}
			}

			// Formattazione booleani
			if (text.toLowerCase() === 'true' || text.toLowerCase() === 'false') {
				cell.classList.add(text.toLowerCase() === 'true' ? 'boolean-true' : 'boolean-false');
			}

			// Formattazione link
			if (text.startsWith('http://') || text.startsWith('https://')) {
				const link = document.createElement('a');
				link.href = text;
				link.textContent = text;
				link.target = '_blank';
				cell.textContent = '';
				cell.appendChild(link);
			}
		});
	});
}

/**
 * Determina se una stringa rappresenta una data
 */
function isDateString(text) {
	// Pattern comuni per le date (ISO, EU, US)
	const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
	const euPattern = /^\d{2}[\/\.-]\d{2}[\/\.-]\d{4}$/;
	const usPattern = /^\d{2}[\/\.-]\d{2}[\/\.-]\d{4}$/;

	return isoPattern.test(text) || euPattern.test(text) || usPattern.test(text);
}

/**
 * Inizializza la paginazione per tabelle grandi
 */
function initializePagination() {
	const paginationContainers = document.querySelectorAll('.pagination-container');

	paginationContainers.forEach(container => {
		const tableId = container.dataset.tableId;
		const table = document.getElementById(tableId);

		if (!table) return;

		const rows = table.querySelectorAll('tbody tr');
		const pageSize = parseInt(container.dataset.pageSize || '10');
		const pageCount = Math.ceil(rows.length / pageSize);

		// Crea gli elementi di paginazione
		const paginationList = document.createElement('ul');
		paginationList.className = 'pagination';

		for (let i = 1; i <= pageCount; i++) {
			const pageItem = document.createElement('li');
			pageItem.className = 'pagination-item';

			const pageLink = document.createElement('a');
			pageLink.className = 'pagination-link';
			pageLink.href = '#';
			pageLink.textContent = i;
			pageLink.dataset.page = i;

			if (i === 1) {
				pageLink.classList.add('active');
			}

			pageLink.addEventListener('click', function (e) {
				e.preventDefault();

				// Rimuovi la classe active da tutti i link
				document.querySelectorAll(`#${tableId}-pagination .pagination-link`).forEach(link => {
					link.classList.remove('active');
				});

				// Aggiungi la classe active al link corrente
				this.classList.add('active');

				// Mostra solo le righe della pagina corrente
				const page = parseInt(this.dataset.page);
				const start = (page - 1) * pageSize;
				const end = start + pageSize;

				rows.forEach((row, index) => {
					row.style.display = (index >= start && index < end) ? '' : 'none';
				});
			});

			pageItem.appendChild(pageLink);
			paginationList.appendChild(pageItem);
		}

		// Aggiungi la paginazione al container
		container.appendChild(paginationList);
		container.id = `${tableId}-pagination`;

		// Mostra solo la prima pagina
		if (rows.length > 0) {
			rows.forEach((row, index) => {
				row.style.display = (index < pageSize) ? '' : 'none';
			});
		}
	});
}

/**
 * Inizializza l'ordinamento delle tabelle
 */
function initializeTableSorting() {
	const tables = document.querySelectorAll('.data-table.sortable');

	tables.forEach(table => {
		const headers = table.querySelectorAll('th');

		headers.forEach((header, index) => {
			// Aggiungi indicatore di ordinamento
			const sortIndicator = document.createElement('span');
			sortIndicator.className = 'sort-indicator';
			sortIndicator.textContent = '⇅';
			sortIndicator.style.marginLeft = '5px';
			sortIndicator.style.fontSize = '0.8em';
			sortIndicator.style.opacity = '0.5';

			header.appendChild(sortIndicator);
			header.style.cursor = 'pointer';

			// Aggiungi evento click per l'ordinamento
			header.addEventListener('click', function () {
				const isAscending = this.dataset.sort !== 'asc';

				// Resetta altri indicatori
				headers.forEach(h => {
					h.querySelector('.sort-indicator').textContent = '⇅';
					h.querySelector('.sort-indicator').style.opacity = '0.5';
					h.dataset.sort = '';
				});

				// Imposta l'indicatore corrente
				this.dataset.sort = isAscending ? 'asc' : 'desc';
				sortIndicator.textContent = isAscending ? '↑' : '↓';
				sortIndicator.style.opacity = '1';

				// Ordina la tabella
				const tbody = table.querySelector('tbody');
				const rows = Array.from(tbody.querySelectorAll('tr'));

				rows.sort((a, b) => {
					const cellA = a.querySelectorAll('td')[index].textContent.trim();
					const cellB = b.querySelectorAll('td')[index].textContent.trim();

					// Determina il tipo di dato
					if (!isNaN(parseFloat(cellA)) && !isNaN(parseFloat(cellB))) {
						// Confronto numerico
						return isAscending
							? parseFloat(cellA) - parseFloat(cellB)
							: parseFloat(cellB) - parseFloat(cellA);
					} else {
						// Confronto di stringhe
						return isAscending
							? cellA.localeCompare(cellB)
							: cellB.localeCompare(cellA);
					}
				});

				// Ricostruisce la tabella con le righe ordinate
				rows.forEach(row => {
					tbody.appendChild(row);
				});
			});
		});
	});
}

/**
 * Inizializza l'esportazione dei dati
 */
function initializeDataExport() {
	const exportButtons = document.querySelectorAll('.export-button');

	exportButtons.forEach(button => {
		button.addEventListener('click', function () {
			const tableId = this.dataset.tableId;
			const table = document.getElementById(tableId);
			const format = this.dataset.format || 'csv';

			if (!table) return;

			if (format === 'csv') {
				exportTableToCSV(table, `export-${new Date().toISOString().slice(0, 10)}.csv`);
			} else if (format === 'json') {
				exportTableToJSON(table, `export-${new Date().toISOString().slice(0, 10)}.json`);
			}
		});
	});
}

/**
 * Esporta una tabella in formato CSV
 */
function exportTableToCSV(table, filename) {
	const rows = table.querySelectorAll('tr');
	let csv = [];

	for (let i = 0; i < rows.length; i++) {
		const row = [], cols = rows[i].querySelectorAll('td, th');

		for (let j = 0; j < cols.length; j++) {
			// Formatta il testo per CSV (gestisce virgolette e virgole)
			let text = cols[j].textContent.trim();
			text = text.replace(/"/g, '""');
			if (text.includes(',') || text.includes('"') || text.includes('\n')) {
				text = `"${text}"`;
			}
			row.push(text);
		}

		csv.push(row.join(','));
	}

	downloadFile(csv.join('\n'), filename, 'text/csv');
}

/**
 * Esporta una tabella in formato JSON
 */
function exportTableToJSON(table, filename) {
	const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
	const rows = table.querySelectorAll('tbody tr');
	const data = [];

	rows.forEach(row => {
		const rowData = {};
		const cols = row.querySelectorAll('td');

		headers.forEach((header, index) => {
			if (index < cols.length) {
				rowData[header] = cols[index].textContent.trim();
			}
		});

		data.push(rowData);
	});

	downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

/**
 * Helper per scaricare dati come file
 */
function downloadFile(content, filename, contentType) {
	const blob = new Blob([content], { type: contentType });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
}

/**
 * Inizializza tooltip avanzati
 */
function initializeTooltips() {
	const tooltipElements = document.querySelectorAll('[data-tooltip]');

	tooltipElements.forEach(element => {
		const tooltipText = element.dataset.tooltip;

		element.addEventListener('mouseenter', function (e) {
			const tooltip = document.createElement('div');
			tooltip.className = 'custom-tooltip';
			tooltip.textContent = tooltipText;
			document.body.appendChild(tooltip);

			// Posiziona il tooltip
			const rect = element.getBoundingClientRect();
			tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5 + window.scrollY}px`;
			tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + window.scrollX}px`;

			// Salva il riferimento al tooltip
			element.tooltip = tooltip;
		});

		element.addEventListener('mouseleave', function () {
			if (element.tooltip) {
				document.body.removeChild(element.tooltip);
				element.tooltip = null;
			}
		});
	});
}

/**
 * Utility per convertire colori da RGBA a HEX
 */
function rgbaToHex(rgba) {
	if (rgba.startsWith('#')) return rgba;

	const rgbaRegex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/;
	const match = rgba.match(rgbaRegex);

	if (!match) return rgba;

	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);

	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Resetta tutti i filtri applicati a una tabella
 */
function resetTableFilters(tableId) {
	const table = document.getElementById(tableId);
	if (!table) return;

	const rows = table.querySelectorAll('tbody tr');
	rows.forEach(row => {
		row.style.display = '';
	});

	// Resetta i campi di input dei filtri
	const filterInputs = document.querySelectorAll(`[data-filter-table="${tableId}"]`);
	filterInputs.forEach(input => {
		input.value = '';
	});
}

/**
 * Funzionalità per il ridimensionamento dinamico dei grafici
 */
function resizeCharts() {
    if (window.Chart && Chart.instances) {
        // Iterates over the instances object keys
        Object.keys(Chart.instances).forEach(key => {
            // Resizes each chart instance
            Chart.instances[key].resize();
        });
    }
}

// Aggiunge l'evento di resize per il ridimensionamento dei grafici
window.addEventListener('resize', debounce(resizeCharts, 250));

/**
 * Funzione di debounce per evitare chiamate eccessive
 */
function debounce(func, wait, immediate) {
	let timeout;
	return function () {
		const context = this, args = arguments;
		clearTimeout(timeout);
		timeout = setTimeout(function () {
			timeout = null;
			if (!immediate) func.apply(context, args);
		}, wait);
		if (immediate && !timeout) func.apply(context, args);
	};
}

// Espone le funzioni per utilizzo da parte di altri script
window.vizHelpers = {
	formatNumber: function (num, decimals = 2) {
		return Number(num).toLocaleString(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	},
	formatDate: function (dateStr, format = 'short') {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return dateStr;

		if (format === 'short') {
			return date.toLocaleDateString();
		} else if (format === 'long') {
			return date.toLocaleDateString(undefined, {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} else if (format === 'time') {
			return date.toLocaleTimeString();
		} else {
			return date.toLocaleString();
		}
	},
	truncateText: function (text, length = 50) {
		if (text.length <= length) return text;
		return text.substring(0, length) + '...';
	},
	filterTable: function (tableId, columnIndex, value) {
		const table = document.getElementById(tableId);
		if (!table) return;

		const rows = table.querySelectorAll('tbody tr');
		const searchText = value.toLowerCase();

		rows.forEach(row => {
			const cell = row.querySelectorAll('td')[columnIndex];
			if (!cell) return;

			const text = cell.textContent.toLowerCase();
			row.style.display = text.includes(searchText) ? '' : 'none';
		});
	}
};
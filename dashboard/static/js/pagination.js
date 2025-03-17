// Aggiorna la paginazione
export function updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, renderPaginationPages) {
	const totalPages = Math.ceil(filteredData.length / rowsPerPage);

	// Aggiorna info paginazione
	const start = filteredData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
	const end = Math.min(currentPage * rowsPerPage, filteredData.length);
	paginationInfo.textContent = `Visualizzazione ${start}-${end} di ${filteredData.length} elementi`;

	// Abilita/disabilita pulsanti di navigazione
	prevPageBtn.disabled = currentPage === 1;
	nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

	// Genera i pulsanti delle pagine
	renderPaginationPages(totalPages, currentPage);
}

// Pagina precedente
export function goToPrevPage(currentPage, setCurrentPage, updatePagination, renderLogTable, filteredData) {
	if (currentPage > 1) {
		const newPage = currentPage - 1;
		setCurrentPage(newPage);
		updatePagination(filteredData);
		renderLogTable(filteredData);
	}
}

// Pagina successiva
export function goToNextPage(currentPage, filteredData, rowsPerPage, setCurrentPage, updatePagination, renderLogTable) {
	const totalPages = Math.ceil(filteredData.length / rowsPerPage);
	if (currentPage < totalPages) {
		const newPage = currentPage + 1;
		setCurrentPage(newPage);
		updatePagination(filteredData);
		renderLogTable(filteredData);
	}
}

// Renderizza i pulsanti di paginazione
export function renderPaginationPages(totalPages, currentPage, paginationPages, goToPage) {
	paginationPages.innerHTML = '';

	// Determina quali numeri di pagina mostrare
	let startPage = Math.max(1, currentPage - 2);
	let endPage = Math.min(totalPages, startPage + 4);

	// Aggiusta se siamo vicini alla fine
	if (endPage - startPage < 4 && startPage > 1) {
		startPage = Math.max(1, endPage - 4);
	}

	// Aggiungi la prima pagina e '...' se necessario
	if (startPage > 1) {
		addPageButton(1, currentPage, goToPage, paginationPages);
		if (startPage > 2) {
			addEllipsis(paginationPages);
		}
	}

	// Aggiungi le pagine intermedie
	for (let i = startPage; i <= endPage; i++) {
		addPageButton(i, currentPage, goToPage, paginationPages);
	}

	// Aggiungi l'ultima pagina e '...' se necessario
	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			addEllipsis(paginationPages);
		}
		addPageButton(totalPages, currentPage, goToPage, paginationPages);
	}
}

// Aggiungi pulsante pagina
function addPageButton(pageNum, currentPage, goToPage, paginationPages) {
	const pageButton = document.createElement('div');
	pageButton.className = 'pagination-page';
	if (pageNum === currentPage) {
		pageButton.classList.add('active');
	}
	pageButton.textContent = pageNum;
	pageButton.addEventListener('click', () => {
		if (pageNum !== currentPage) {
			goToPage(pageNum);
		}
	});
	paginationPages.appendChild(pageButton);
}

// Aggiungi ellipsis
function addEllipsis(paginationPages) {
	const ellipsis = document.createElement('div');
	ellipsis.className = 'pagination-page';
	ellipsis.textContent = '...';
	ellipsis.style.cursor = 'default';
	paginationPages.appendChild(ellipsis);
}
// Gestione dell'interfaccia utente

// Toggle Dark Mode
export function toggleDarkMode(darkMode, body, darkModeToggle, updateChartTheme) {
	const newDarkMode = !darkMode;

	if (newDarkMode) {
		body.classList.add('dark');
		darkModeToggle.innerHTML = '☀️';
	} else {
		body.classList.remove('dark');
		darkModeToggle.innerHTML = '🌙';
	}

	// Salva preferenza
	localStorage.setItem('darkMode', newDarkMode ? 'enabled' : 'disabled');

	// Aggiorna i grafici per il tema scuro/chiaro
	updateChartTheme(newDarkMode);
	
	return newDarkMode;
}

// Toggle Sidebar
export function toggleSidebar(sidebar, overlay) {
	sidebar.classList.toggle('active');
	overlay.classList.toggle('active');
}

// Toggle User Menu
export function toggleUserMenu(event, userMenu) {
	event.stopPropagation();
	userMenu.classList.toggle('active');
}

// Chiudi User Menu quando si clicca altrove
export function closeUserMenu(event, userMenu, userProfileToggle) {
	if (userMenu.classList.contains('active') &&
		!userProfileToggle.contains(event.target)) {
		userMenu.classList.remove('active');
	}
}

// Crea badge di stato
export function createStatusBadge(status) {
	const badge = document.createElement('span');
	badge.className = 'badge';

	switch (status.toLowerCase()) {
		case 'success':
			badge.classList.add('badge-success');
			badge.textContent = 'Successo';
			break;
		case 'warning':
			badge.classList.add('badge-warning');
			badge.textContent = 'Attenzione';
			break;
		case 'failed':
			badge.classList.add('badge-error');
			badge.textContent = 'Fallito';
			break;
		default:
			badge.classList.add('badge-info');
			badge.textContent = status;
	}

	return badge;
}
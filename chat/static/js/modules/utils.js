/**
 * utils.js - Funzioni di utilità
 * 
 * Questo file è stato generato automaticamente dal tool di refactoring.
 */

function debug(message, ...args) {
	if (DEBUG) {
		console.log(`[DEBUG] ${message}`, ...args);
	}
}

function formatTime(timestamp) {
	if (typeof timestamp === 'string') {
		timestamp = new Date(timestamp);
	}
	return timestamp.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit'
	});
}

function formatDate(timestamp) {
	if (typeof timestamp === 'string') {
		timestamp = new Date(timestamp);
	}
	return timestamp.toLocaleDateString([], {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
}

function showLoader() {
    const loader = document.getElementById('messagesLoader');
    if (loader) {
        loader.classList.add('active');
        console.log("Loader attivato", new Date().toISOString());
    }
}

function hideLoader() {
    const loader = document.getElementById('messagesLoader');
    if (loader) {
        loader.classList.remove('active');
        console.log("Loader disattivato", new Date().toISOString());
    }
}

function linkifyText(text) {
    if (!text) return '';
    
    // Converti a stringa per sicurezza
    text = String(text);
    
    // Sanitizza il testo prima di processarlo (solo per testo non HTML)
    if (!text.includes('<span class="link-example">')) {
        text = text.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
    
    // Gestisce i link evidenziati personalizzati
    text = text.replace(/<span class="link-example">(https?:\/\/[^\s<]+)<\/span>/g,
        function (match, url) {
            return `<a href="${url}" target="_blank" rel="noopener" class="link-example">${url}</a>`;
        }
    );
    
    // Gestisce altri URL normali (evitando di match URL già linkificati)
    const urlRegex = /(?<!<a[^>]*>)(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g;
    return text.replace(urlRegex, function (url) {
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    });
}

function showNotification(message, isError = false) {
	const notification = document.createElement('div');
	notification.textContent = message;
	notification.style.position = 'fixed';
	notification.style.bottom = '20px';
	notification.style.left = '50%';
	notification.style.transform = 'translateX(-50%)';
	notification.style.padding = '8px 16px';
	notification.style.background = isError ? 'rgba(220,53,69,0.9)' : 'rgba(40,167,69,0.9)';
	notification.style.color = 'white';
	notification.style.borderRadius = '4px';
	notification.style.fontSize = '14px';
	notification.style.zIndex = '1000';
	notification.style.opacity = '1';
	notification.style.transition = 'opacity 0.3s ease';
	document.body.appendChild(notification);
	setTimeout(() => {
		notification.style.opacity = '0';
		setTimeout(() => {
			document.body.removeChild(notification);
		}, 300);
	}, 1500);
}

function showConfirmDialog(message, confirmCallback) {
	document.getElementById('confirmMessage').textContent = message;
	const confirmDialog = document.getElementById('confirmDialog');
	confirmDialog.style.display = 'flex';

	// Button event handlers
	const confirmBtn = document.getElementById('confirmAction');
	const cancelBtn = document.getElementById('cancelConfirm');

	// Remove old event listeners
	const confirmClone = confirmBtn.cloneNode(true);
	const cancelClone = cancelBtn.cloneNode(true);
	confirmBtn.parentNode.replaceChild(confirmClone, confirmBtn);
	cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

	// Add new event listeners
	confirmClone.addEventListener('click', function () {
		confirmDialog.style.display = 'none';
		confirmCallback();
	});

	cancelClone.addEventListener('click', function () {
		confirmDialog.style.display = 'none';
	});
}

function diagnoseChatIssues() {
    console.group("Diagnostica Chat");
    
    console.log("Socket.IO stato:", {
        socketExists: typeof socket !== 'undefined',
        connected: typeof socket !== 'undefined' ? socket.connected : false,
        currentlyConnected
    });
    
    console.log("Contesto chat:", {
        currentChannel,
        isDirectMessage,
        currentUser,
        historyScrollLock,
        loadingMore,
        isLoadingMessages
    });
    
    console.log("Messaggi:", {
        totalInMessages: typeof messages !== 'undefined' ? messages.length : 'N/A',
        totalDisplayed: typeof displayedMessages !== 'undefined' ? displayedMessages.length : 'N/A',
        messagesLoaded
    });
    
    // Controlla lo stato del loader
    const loader = document.getElementById('messagesLoader');
    console.log("Loader stato:", {
        element: loader,
        isActive: loader ? loader.classList.contains('active') : false
    });
    
    // Controlla le conversazioni canale nel DOM
    const channelItems = document.querySelectorAll('.channel-item');
    const channelsInfo = Array.from(channelItems).map(el => ({
        name: el.textContent.trim(),
        active: el.classList.contains('active')
    }));
    console.log("Canali UI:", channelsInfo);
    
    console.groupEnd();
    
    // Suggerimenti per il debug
    console.log("Per risolvere problemi comuni:");
    console.log("1. Forza reset loader: hideLoader()");
    console.log("2. Riconnetti socket: socket.connect()");
    console.log("3. Ricarica messaggi canale corrente: loadChannelMessages(currentChannel)");
    console.log("4. Genera nuovi dati di test: fetch('/chat/api/demo/generate', { method: 'POST' })");
}


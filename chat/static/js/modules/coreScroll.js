/**
 * coreScroll.js - Scroll handling functions
 * 
 * Contains functions for handling scroll events and navigation.
 */

function setupScrollHandlers() {
    const chatContainer = document.getElementById('chatMessages');
    let lastScrollHandleTime = 0;
    
    chatContainer.addEventListener('scroll', function() {
        const now = Date.now();
        if (now - lastScrollHandleTime > 30) {
            lastScrollHandleTime = now;
            handleScroll();
        }
    }, { passive: true });
}

function handleScroll() {
    if (historyScrollLock) {
        debug("Scroll handler skipped due to history lock");
        return;
    }
    
    const chatContainer = document.getElementById('chatMessages');
    const scrollHeight = chatContainer.scrollHeight;
    const scrollTop = chatContainer.scrollTop;
    const clientHeight = chatContainer.clientHeight;
    
    // Verifica se siamo in cima
    const isAtTop = scrollTop <= 5;
    if (isAtTop && !isLoadingMessages && hasMoreMessages && currentConversationId) {
        loadOlderMessages();
    }
    const isAtBottom = scrollHeight - clientHeight <= scrollTop + 50;
    
    // Pull-to-refresh
    if (isAtTop && lastScrollPosition > scrollTop) {
        const now = Date.now();
        pullAttempts++;
        debug("Pull attempt detected", pullAttempts);
        
        if (!loadingMore && messagesLoaded < messages.length) {
            const timeSinceLastLoad = now - lastPullToRefreshTime;
            if (timeSinceLastLoad >= 1000) {
                debug("Pull-to-refresh triggered, loading more messages...");
                lastPullToRefreshTime = now;
                pullAttempts = 0;
                loadMoreMessages();
            }
        } else {
            debug("Pull-to-refresh not triggered", {
                loadingMore,
                messagesLoaded,
                totalMessages: messages.length,
                allMessagesLoaded: messagesLoaded >= messages.length
            });
        }
    }
    
    // Salva l'ultima posizione
    lastScrollPosition = scrollTop;
    
    // Gestisci il pulsante di scroll
    toggleScrollBottomButton(!isAtBottom);
}

function toggleScrollBottomButton(show) {
    const btn = document.getElementById('scrollBottomBtn');
    
    if (show) {
        btn.classList.add('visible');
        // Se ci sono messaggi non letti, mostra il pallino
        if (unreadMessages > 0) {
            const badge = document.getElementById('newMessagesBadge');
            badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
            badge.style.display = 'flex';
        }
    } else {
        btn.classList.remove('visible');
        // Reset conteggio non letti
        unreadMessages = 0;
        updateUnreadBadge();
    }
}

function scrollToBottom(smooth = true) {
    if (historyScrollLock) {
        debug("Scroll to bottom prevented due to history lock");
        return;
    }
    
    const chatContainer = document.getElementById('chatMessages');
    
    // Forza un reflow del DOM per assicurare che scrollHeight sia aggiornato
    // eslint-disable-next-line no-unused-expressions
    chatContainer.scrollHeight;
    
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
    
    // Reset contatore messaggi non letti
    unreadMessages = 0;
    updateUnreadBadge();
    
    // Nascondi il pulsante scroll
    toggleScrollBottomButton(false);
    
    debug("Scrolled to bottom", { smooth });
}

// Export functions
export { 
    setupScrollHandlers, 
    handleScroll,
    scrollToBottom
};
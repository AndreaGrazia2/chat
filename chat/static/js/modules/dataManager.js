// Add this function to handle message deletion notifications from the server
function handleMessageDeleted(data) {
    const messageId = data.messageId;
    
    // Find the message in our arrays
    const messageIndex = displayedMessages.findIndex(m => m.id == messageId);
    if (messageIndex !== -1) {
        // Remove from displayed messages
        displayedMessages.splice(messageIndex, 1);
        
        // Also remove from global messages array if present
        const globalIndex = messages.findIndex(m => m.id == messageId);
        if (globalIndex !== -1) {
            messages.splice(globalIndex, 1);
        }
        
        // Find and remove the message element from DOM
        const messageEl = document.querySelector(`.message-container[data-message-id="${messageId}"]`);
        if (messageEl) {
            // Apply fade out animation
            messageEl.style.opacity = '0';
            messageEl.style.height = '0';
            messageEl.style.overflow = 'hidden';
            messageEl.style.marginBottom = '0';
            messageEl.style.padding = '0';
            
            // Remove after animation completes
            setTimeout(() => {
                messageEl.remove();
                
                // Clean up orphaned date dividers
                const dateDividers = document.querySelectorAll('.date-divider');
                for (let i = 0; i < dateDividers.length; i++) {
                    const divider = dateDividers[i];
                    let nextEl = divider.nextElementSibling;
                    
                    if (!nextEl || nextEl.classList.contains('date-divider')) {
                        divider.remove();
                    }
                }
            }, 300);
        }
    }
}

// Make sure to register this handler when setting up socket events
function setupSocketEvents() {
    // ... existing socket event handlers ...
    
    // Add handler for message deletion
    socket.on('messageDeleted', handleMessageDeleted);
    
    // ... other event handlers ...
}
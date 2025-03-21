document.addEventListener('DOMContentLoaded', function() {
    // Determine current page and highlight the appropriate nav link
    const currentPath = window.location.pathname;
    
    // Remove any existing active classes
    document.querySelectorAll('.navbar-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Set active class based on current path
    if (currentPath.includes('/chat/')) {
        document.getElementById('nav-chat')?.classList.add('active');
    } else if (currentPath.includes('/cal/')) {
        document.getElementById('nav-calendar')?.classList.add('active');
    } else if (currentPath.includes('/dashboard/')) {
        document.getElementById('nav-dashboard')?.classList.add('active');
    }
});
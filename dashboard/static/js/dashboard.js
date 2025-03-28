// Dashboard.js - Entry point
import { 
    performanceData, 
    deviceData, 
    salesData, 
    regionData, 
    logData 
} from './data.js';

import { 
    toggleDarkMode, 
    toggleSidebar, 
    toggleUserMenu, 
    closeUserMenu,
    createStatusBadge
} from './ui.js';

import { 
    filterTableData, 
    renderLogTable 
} from './table.js';

import { 
    updatePagination, 
    goToPrevPage, 
    goToNextPage, 
    renderPaginationPages 
} from './pagination.js';

import { 
    initCharts, 
    updateChartTheme 
} from './charts.js';

// Elementi DOM
const body = document.body;
const darkModeToggle = document.getElementById('darkModeToggle');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const userProfileToggle = document.getElementById('userProfileToggle');
const userMenu = document.getElementById('userMenu');
const searchInput = document.getElementById('searchInput');
const logTableBody = document.getElementById('logTableBody');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageEl = document.getElementById('currentPage');
const paginationInfo = document.getElementById('paginationInfo');
const paginationPages = document.getElementById('paginationPages');

// Stato
let darkMode = false;
let currentPage = 1;
const rowsPerPage = 5;
let filteredData = [...logData];
let dashboardCharts = null;

// Funzione per impostare la pagina corrente
function setCurrentPage(page) {
    currentPage = page;
    // Add null check before setting textContent
    if (currentPageEl) {
        currentPageEl.textContent = page;
    } else {
        console.warn('Element with ID "currentPage" not found in the DOM');
    }
}

// Funzione per andare a una pagina specifica
function goToPage(page) {
    setCurrentPage(page);
    updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, 
        (totalPages, currentPage) => renderPaginationPages(totalPages, currentPage, paginationPages, goToPage));
    renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody);
}

// Event Listeners
darkModeToggle.addEventListener('click', () => {
    darkMode = toggleDarkMode(darkMode, body, darkModeToggle, 
        (isDarkMode) => updateChartTheme(isDarkMode));
});

menuToggle.addEventListener('click', () => toggleSidebar(sidebar, overlay));
closeSidebar.addEventListener('click', () => toggleSidebar(sidebar, overlay));
overlay.addEventListener('click', () => toggleSidebar(sidebar, overlay));
userProfileToggle.addEventListener('click', (event) => toggleUserMenu(event, userMenu));
document.addEventListener('click', (event) => closeUserMenu(event, userMenu, userProfileToggle));

searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    filteredData = filterTableData(searchTerm, logData, setCurrentPage, 
        () => updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, 
            (totalPages, currentPage) => renderPaginationPages(totalPages, currentPage, paginationPages, goToPage)),
        () => renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody));
});

prevPageBtn.addEventListener('click', () => {
    goToPrevPage(currentPage, setCurrentPage, 
        () => updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, 
            (totalPages, currentPage) => renderPaginationPages(totalPages, currentPage, paginationPages, goToPage)),
        () => renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody),
        filteredData);
});

nextPageBtn.addEventListener('click', () => {
    goToNextPage(currentPage, filteredData, rowsPerPage, setCurrentPage, 
        () => updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, 
            (totalPages, currentPage) => renderPaginationPages(totalPages, currentPage, paginationPages, goToPage)),
        () => renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody));
});

// Inizializzazione
// Function to fetch dashboard stats
function fetchDashboardStats() {
    fetch('/dashboard/api/stats')  // Updated URL to match the blueprint prefix
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update the messages count in the dashboard
            const messagesCountElement = document.getElementById('messagesCount');
            if (messagesCountElement) {
                messagesCountElement.textContent = data.messages_count;
            } else {
                console.warn('Element with ID "messagesCount" not found in the DOM');
            }
        })
        .catch(error => {
            console.error('Error fetching dashboard stats:', error);
        });
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    // Carica preferenza Dark Mode all'avvio
    const savedDarkMode = localStorage.getItem('dashboardDarkMode');

    if (savedDarkMode === 'enabled') {
        darkMode = true;
        body.classList.add('dark');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>'; // Icona sole per tema scuro
    } else {
        darkMode = false;
        body.classList.remove('dark');
        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>'; // Icona luna per tema chiaro
    }

    // Inizializza i grafici
    dashboardCharts = initCharts(performanceData, deviceData, salesData, regionData);

    // Aggiorna il tema dei grafici
    updateChartTheme(darkMode);

    // Inizializza la tabella e la paginazione
    updatePagination(filteredData, currentPage, rowsPerPage, paginationInfo, prevPageBtn, nextPageBtn, 
        (totalPages, currentPage) => renderPaginationPages(totalPages, currentPage, paginationPages, goToPage));
    renderLogTable(filteredData, currentPage, rowsPerPage, logTableBody);
    
    // Fetch dashboard stats
    fetchDashboardStats();
});
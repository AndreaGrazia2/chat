// Inizializza e renderizza i grafici con Chart.js
// Modifica per non usare window.dashboardCharts
export function initCharts(performanceData, deviceData, salesData, regionData) {
	// Performance Chart (Line Chart)
	const performanceChartCtx = document.getElementById('performanceChart').getContext('2d');
	const performanceChart = new Chart(performanceChartCtx, {
		type: 'line',
		data: {
			labels: performanceData.map(d => d.name),
			datasets: [{
				label: 'Performance',
				data: performanceData.map(d => d.value),
				borderColor: '#6200ee',
				backgroundColor: 'rgba(98, 0, 238, 0.1)',
				tension: 0.4,
				fill: true
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				}
			},
			scales: {
				y: {
					beginAtZero: true
				}
			}
		}
	});

	// Device Chart (Donut Chart)
	const deviceChartCtx = document.getElementById('deviceChart').getContext('2d');
	const deviceChart = new Chart(deviceChartCtx, {
		type: 'doughnut',
		data: {
			labels: deviceData.map(d => d.name),
			datasets: [{
				data: deviceData.map(d => d.value),
				backgroundColor: deviceData.map(d => d.color),
				borderWidth: 0
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			cutout: '60%'
		}
	});

	// Sales Chart (Bar Chart)
	const salesChartCtx = document.getElementById('salesChart').getContext('2d');
	const salesChart = new Chart(salesChartCtx, {
		type: 'bar',
		data: {
			labels: salesData.map(d => d.day),
			datasets: [
				{
					label: 'Vendite',
					data: salesData.map(d => d.sales),
					backgroundColor: '#3b82f6'
				},
				{
					label: 'Resi',
					data: salesData.map(d => d.returns),
					backgroundColor: '#ef4444'
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					beginAtZero: true
				}
			}
		}
	});

	// Region Chart (Bar Chart)
	const regionChartCtx = document.getElementById('regionChart').getContext('2d');
	const regionChart = new Chart(regionChartCtx, {
		type: 'bar',
		data: {
			labels: regionData.map(d => d.name),
			datasets: [{
				label: 'Visite',
				data: regionData.map(d => d.visits),
				backgroundColor: '#8884d8'
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					beginAtZero: true
				}
			}
		}
	});

	// Salva i riferimenti ai grafici per poterli aggiornare con il tema scuro/chiaro
	// Invece di usare window.dashboardCharts, restituisci direttamente l'oggetto
	const charts = {
		performanceChart,
		deviceChart,
		salesChart,
		regionChart
	};
	
	return charts;
}

// Aggiorna i grafici in base al tema (scuro/chiaro)
export function updateChartTheme(darkMode, charts) {
	// Usa i grafici passati dal dashboard.js invece di window.dashboardCharts
	if (!charts) return;

	const textColor = darkMode ? '#e0e0e0' : '#333333';
	const gridColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

	// Aggiorna le opzioni per tutti i grafici
	Object.values(charts).forEach(chart => {
		if (chart.options.scales) {
			// Aggiorna colori per grafici con assi
			if (chart.options.scales.x) {
				chart.options.scales.x.ticks = { color: textColor };
				chart.options.scales.x.grid = { color: gridColor };
			}

			if (chart.options.scales.y) {
				chart.options.scales.y.ticks = { color: textColor };
				chart.options.scales.y.grid = { color: gridColor };
			}
		}

		// Aggiorna opzioni della legenda
		if (chart.options.plugins && chart.options.plugins.legend) {
			chart.options.plugins.legend.labels = { color: textColor };
		}

		chart.update();
	});
}
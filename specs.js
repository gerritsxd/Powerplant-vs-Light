// Global variables
let allPowerPlants = [];
let lightIntensityData = {};
let fuelColors = {
    'Hydro': '#3498db',
    'Wind': '#2ecc71',
    'Solar': '#f1c40f',
    'Nuclear': '#9b59b6',
    'Coal': '#7f8c8d',
    'Gas': '#e74c3c',
    'Oil': '#e67e22',
    'Biomass': '#27ae60',
    'Waste': '#8e44ad',
    'Geothermal': '#d35400',
    'Storage': '#16a085',
    'Wave and Tidal': '#2980b9',
    'Petcoke': '#c0392b',
    'Cogeneration': '#1abc9c',
    'Other': '#95a5a6'
};

// Theme handling
let isDarkTheme = false;

document.addEventListener('DOMContentLoaded', function() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        enableDarkTheme();
    }
    
    // Set up theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            if (document.body.classList.contains('dark-theme')) {
                disableDarkTheme();
            } else {
                enableDarkTheme();
            }
        });
    }
    
    // Load data
    loadPowerPlantData();
    loadLightIntensityData();
    
    // Set up event listeners
    setupEventListeners();
});

// Theme functions
function enableDarkTheme() {
    document.body.classList.add('dark-theme');
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    }
    isDarkTheme = true;
    localStorage.setItem('theme', 'dark');
    
    // Update chart themes if they exist
    updateChartThemes();
}

function disableDarkTheme() {
    document.body.classList.remove('dark-theme');
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
    }
    isDarkTheme = false;
    localStorage.setItem('theme', 'light');
    
    // Update chart themes if they exist
    updateChartThemes();
}

function updateChartThemes() {
    // Update chart themes if they exist
    const charts = [
        window.energyMixChart, 
        window.capacityDistChart, 
        window.comparisonFuelChart, 
        window.comparisonCapacityChart
    ];
    
    charts.forEach(chart => {
        if (chart) {
            const textColor = isDarkTheme ? '#f0f0f0' : '#666666';
            const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            
            if (chart.options.scales && chart.options.scales.x) {
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.x.grid.color = gridColor;
            }
            
            if (chart.options.scales && chart.options.scales.y) {
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            }
            
            if (chart.options.plugins && chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            
            chart.update();
        }
    });
}

// Data loading functions
function loadPowerPlantData() {
    showLoading();
    
    fetch('globalpowerplantdatabasev130/global_power_plant_database.csv')
        .then(response => {
            if (!response.ok) {
                console.error('Failed to load power plant data:', response.statusText);
                showError('Failed to load power plant data. File may not exist.');
                hideLoading();
                return Promise.reject('Failed to load CSV');
            }
            return response.text();
        })
        .then(data => {
            // Parse CSV data
            const lines = data.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Find column indices for the actual format in the database
            const countryIndex = headers.indexOf('country');
            const countryLongIndex = headers.indexOf('country_long');
            const nameIndex = headers.indexOf('name');
            const latIndex = headers.indexOf('latitude');
            const lonIndex = headers.indexOf('longitude');
            const capacityIndex = headers.indexOf('capacity_mw');
            const fuelIndex = headers.indexOf('primary_fuel');
            
            console.log('CSV Headers:', headers);
            console.log('Column indices:', { 
                country: countryIndex, 
                countryLong: countryLongIndex, 
                name: nameIndex, 
                latitude: latIndex, 
                longitude: lonIndex, 
                capacity: capacityIndex, 
                primaryFuel: fuelIndex 
            });
            
            if (latIndex === -1 || lonIndex === -1 || countryIndex === -1 || fuelIndex === -1 || capacityIndex === -1) {
                const missing = [
                    latIndex === -1 ? 'latitude' : '',
                    lonIndex === -1 ? 'longitude' : '',
                    countryIndex === -1 ? 'country' : '',
                    fuelIndex === -1 ? 'primary_fuel' : '',
                    capacityIndex === -1 ? 'capacity_mw' : ''
                ].filter(Boolean).join(', ');
                console.error(`Could not find required columns (${missing}) in CSV.`);
                showError(`Error: Could not find required columns (${missing}) in power plant data.`);
                hideLoading();
                return;
            }
            
            // Clear existing data
            allPowerPlants = [];
            
            // Debug information
            let countriesFound = new Set();
            let fuelTypesFound = new Set();
            let countryCodesMap = {}; // Map country codes to full names
            
            // Parse power plant data
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                // We need to properly handle CSV fields that might contain commas
                // This is a simple approach that might not handle all edge cases
                const values = parseCSVLine(lines[i]);
                
                if (values.length <= Math.max(latIndex, lonIndex, nameIndex, capacityIndex, countryIndex, fuelIndex)) {
                    // Skip lines with insufficient columns
                    continue;
                }
                
                const countryCode = values[countryIndex].trim();
                const countryName = countryLongIndex >= 0 && values[countryLongIndex] ? 
                    values[countryLongIndex].trim() : countryCode;
                
                // Save the country code to full name mapping
                if (countryCode && countryName && countryCode !== countryName) {
                    countryCodesMap[countryCode] = countryName;
                }
                
                const name = nameIndex >= 0 ? values[nameIndex].trim() : '';
                const lat = latIndex >= 0 ? parseFloat(values[latIndex]) : null;
                const lon = lonIndex >= 0 ? parseFloat(values[lonIndex]) : null;
                const capacityStr = capacityIndex >= 0 ? values[capacityIndex].trim() : '0';
                const capacity = parseFloat(capacityStr) || 0;
                const fuel = fuelIndex >= 0 ? values[fuelIndex].trim() : 'Unknown';
                
                if (!isNaN(lat) && !isNaN(lon) && lat !== null && lon !== null && capacity > 0) {
                    // Add plant data
                    const plant = {
                        name: name || 'Unknown',
                        latitude: lat,
                        longitude: lon,
                        country: countryName || countryCode, // Use full name if available
                        countryCode: countryCode,
                        capacity: capacity,
                        primary_fuel: fuel,
                        color: fuelColors[fuel] || '#cccccc'
                    };
                    
                    allPowerPlants.push(plant);
                    countriesFound.add(plant.country);
                    fuelTypesFound.add(fuel);
                }
            }
            
            console.log(`Loaded ${allPowerPlants.length} power plants`);
            console.log(`Countries found (${countriesFound.size}): ${[...countriesFound].sort().join(', ')}`);
            console.log(`Fuel types found (${fuelTypesFound.size}): ${[...fuelTypesFound].sort().join(', ')}`);
            
            // Initialize country dropdowns
            initializeCountryDropdowns();
            
            // Set default country and update view
            const primaryDropdown = document.getElementById('primary-country');
            if (primaryDropdown && primaryDropdown.options.length > 1) {
                // Try to set United States as default, otherwise Spain, otherwise first country
                const usOption = Array.from(primaryDropdown.options).find(option => option.value === 'United States of America');
                const spainOption = Array.from(primaryDropdown.options).find(option => option.value === 'Spain');
                
                if (usOption) {
                    usOption.selected = true;
                } else if (spainOption) {
                    spainOption.selected = true;
                } else if (primaryDropdown.options.length > 1) {
                    primaryDropdown.options[1].selected = true;
                }
                
                // Update the view with the selected country
                updateSpecifications();
            }
            
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading power plant data:', error);
            hideLoading();
            showError('Failed to load power plant data. Please try refreshing the page.');
        });
}

function loadLightIntensityData() {
    // This would typically load from a processed dataset
    // For now, we'll simulate by creating a grid of light intensity values
    
    // Create a 36x18 grid (10 degree resolution)
    for (let lat = -90; lat < 90; lat += 10) {
        for (let lon = -180; lon < 180; lon += 10) {
            const gridKey = `${lat},${lon}`;
            
            // Simulate light intensity based on latitude (more light in developed regions)
            // This is just a placeholder - real data would be loaded from a file
            let baseIntensity;
            
            if (lat >= 20 && lat <= 60) {
                // Northern developed regions (North America, Europe, parts of Asia)
                baseIntensity = 70 + Math.random() * 30;
            } else if (lat >= -40 && lat <= 0) {
                // Southern developed regions (parts of South America, Australia)
                baseIntensity = 50 + Math.random() * 30;
            } else {
                // Less developed or less populated regions
                baseIntensity = 10 + Math.random() * 40;
            }
            
            // Add some variation
            const intensity = Math.min(100, Math.max(0, baseIntensity + (Math.random() * 20 - 10)));
            
            lightIntensityData[gridKey] = intensity;
        }
    }
    
    console.log('Loaded simulated light intensity data');
}

// Helper function to parse CSV lines correctly (handling quoted fields)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            // Add character to current field
            current += char;
        }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
}

// UI setup functions
function setupEventListeners() {
    // Country selection change events
    const primaryDropdown = document.getElementById('primary-country');
    const comparisonDropdown = document.getElementById('comparison-country');
    
    if (primaryDropdown) {
        primaryDropdown.addEventListener('change', function() {
            updateSpecifications();
        });
    }
    
    if (comparisonDropdown) {
        comparisonDropdown.addEventListener('change', function() {
            updateSpecifications();
        });
    }
    
    // Update button click (keeping this as a fallback)
    const updateBtn = document.getElementById('update-specs');
    if (updateBtn) {
        updateBtn.addEventListener('click', updateSpecifications);
    }
    
    // Sort button click
    const sortBtn = document.getElementById('sort-by-capacity');
    if (sortBtn) {
        sortBtn.addEventListener('click', function() {
            const primaryCountry = document.getElementById('primary-country').value;
            if (primaryCountry) {
                populatePowerPlantsTable(primaryCountry, true);
            }
        });
    }
    
    // Export buttons
    const exportBtns = document.querySelectorAll('.export-btn');
    exportBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const chartType = this.dataset.chart;
            exportChart(chartType);
        });
    });
}

function initializeCountryDropdowns() {
    // Get unique countries - ensure we're getting ALL countries from the dataset
    const countries = [...new Set(allPowerPlants.map(plant => plant.country))].filter(Boolean).sort();
    
    // Populate primary country dropdown
    const primaryDropdown = document.getElementById('primary-country');
    const comparisonDropdown = document.getElementById('comparison-country');
    
    if (primaryDropdown && comparisonDropdown) {
        // Clear existing options (except the first one)
        primaryDropdown.innerHTML = '<option value="">Select a country</option>';
        comparisonDropdown.innerHTML = '<option value="">None (Single Country View)</option>';
        
        // Add country options - make sure ALL countries are included
        console.log(`Adding ${countries.length} countries to dropdowns`);
        countries.forEach(country => {
            const primaryOption = document.createElement('option');
            primaryOption.value = country;
            primaryOption.textContent = country;
            primaryDropdown.appendChild(primaryOption);
            
            const comparisonOption = document.createElement('option');
            comparisonOption.value = country;
            comparisonOption.textContent = country;
            comparisonDropdown.appendChild(comparisonOption);
        });
    }
}

function updateSpecifications() {
    const primaryCountry = document.getElementById('primary-country').value;
    const comparisonCountry = document.getElementById('comparison-country').value;
    
    if (!primaryCountry) {
        showError('Please select a primary country');
        return;
    }
    
    showLoading();
    
    // Update country summary
    updateCountrySummary(primaryCountry);
    
    // Update energy mix chart
    updateEnergyMixChart(primaryCountry);
    
    // Update capacity distribution chart
    updateCapacityDistributionChart(primaryCountry);
    
    // Update power plants table
    populatePowerPlantsTable(primaryCountry);
    
    // Update comparison panel if a comparison country is selected
    if (comparisonCountry) {
        document.getElementById('comparison-panel').style.display = 'block';
        updateCountryComparison(primaryCountry, comparisonCountry);
    } else {
        document.getElementById('comparison-panel').style.display = 'none';
    }
    
    hideLoading();
}

function getCountryData(country) {
    console.log(`Getting data for country: ${country}`);
    
    // Filter plants by country
    const countryPlants = allPowerPlants.filter(plant => plant.country === country);
    console.log(`Found ${countryPlants.length} plants for ${country}`);
    
    // Calculate total capacity
    const totalCapacity = countryPlants.reduce((sum, plant) => sum + plant.capacity, 0);
    
    // Count plants by fuel type
    const fuelCounts = {};
    const fuelCapacities = {};
    
    // Initialize with all possible fuel types to ensure we don't miss any
    const allFuelTypes = [...new Set(allPowerPlants.map(plant => plant.primary_fuel))];
    allFuelTypes.forEach(fuel => {
        fuelCounts[fuel] = 0;
        fuelCapacities[fuel] = 0;
    });
    
    // Now count the actual plants and capacities
    countryPlants.forEach(plant => {
        const fuel = plant.primary_fuel;
        fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
        fuelCapacities[fuel] = (fuelCapacities[fuel] || 0) + plant.capacity;
    });
    
    // Log the fuel capacities for debugging
    console.log(`Fuel capacities for ${country}:`, fuelCapacities);
    
    // Calculate average plant capacity
    const avgCapacity = countryPlants.length > 0 ? totalCapacity / countryPlants.length : 0;
    
    // Calculate average light intensity
    let totalLightIntensity = 0;
    let lightIntensityCount = 0;
    
    countryPlants.forEach(plant => {
        const latKey = Math.floor(plant.latitude / 10) * 10;
        const lonKey = Math.floor(plant.longitude / 10) * 10;
        const lightKey = `${latKey},${lonKey}`;
        
        if (lightIntensityData[lightKey]) {
            totalLightIntensity += lightIntensityData[lightKey];
            lightIntensityCount++;
        }
    });
    
    const avgLightIntensity = lightIntensityCount > 0 ? totalLightIntensity / lightIntensityCount : 0;
    
    // Find dominant fuel type (by capacity)
    let dominantFuel = '';
    let maxCapacity = 0;
    
    Object.entries(fuelCapacities).forEach(([fuel, capacity]) => {
        if (capacity > maxCapacity) {
            maxCapacity = capacity;
            dominantFuel = fuel;
        }
    });
    
    // Calculate capacity distribution
    const capacityRanges = [
        { min: 0, max: 100, label: '0-100 MW' },
        { min: 100, max: 500, label: '100-500 MW' },
        { min: 500, max: 1000, label: '500-1000 MW' },
        { min: 1000, max: 2000, label: '1-2 GW' },
        { min: 2000, max: 5000, label: '2-5 GW' },
        { min: 5000, max: Infinity, label: '5+ GW' }
    ];
    
    const capacityDistribution = capacityRanges.map(range => ({
        ...range,
        count: countryPlants.filter(plant => 
            plant.capacity >= range.min && plant.capacity < range.max
        ).length
    }));
    
    return {
        plants: countryPlants,
        totalCapacity: totalCapacity,
        plantCount: countryPlants.length,
        fuelCounts: fuelCounts,
        fuelCapacities: fuelCapacities,
        avgCapacity: avgCapacity,
        avgLightIntensity: avgLightIntensity,
        dominantFuel: dominantFuel,
        capacityDistribution: capacityDistribution
    };
}

function updateCountrySummary(country) {
    const summaryContainer = document.getElementById('country-summary');
    if (!summaryContainer) return;
    
    // Get country data
    const data = getCountryData(country);
    
    // Create summary HTML
    let html = `
        <div class="country-stat">
            <div class="country-stat-title">Total Power Plants</div>
            <div class="country-stat-value">${data.plantCount}</div>
        </div>
        
        <div class="country-stat">
            <div class="country-stat-title">Total Capacity</div>
            <div class="country-stat-value">${(data.totalCapacity / 1000).toFixed(2)} GW</div>
        </div>
        
        <div class="country-stat">
            <div class="country-stat-title">Average Plant Capacity</div>
            <div class="country-stat-value">${data.avgCapacity.toFixed(2)} MW</div>
        </div>
        
        <div class="country-stat">
            <div class="country-stat-title">Dominant Fuel Type</div>
            <div class="country-stat-value">
                <span class="fuel-indicator" style="background-color: ${fuelColors[data.dominantFuel] || '#cccccc'}"></span>
                ${data.dominantFuel}
            </div>
        </div>
        
        <div class="country-stat">
            <div class="country-stat-title">Average Light Intensity</div>
            <div class="country-stat-value">${data.avgLightIntensity.toFixed(2)}</div>
        </div>
    `;
    
    summaryContainer.innerHTML = html;
}

function updateEnergyMixChart(country) {
    const canvas = document.getElementById('energy-mix-chart');
    if (!canvas) return;
    
    // Get country data
    const data = getCountryData(country);
    
    // Prepare chart data - only include fuel types that actually have capacity
    const fuelEntries = Object.entries(data.fuelCapacities)
        .filter(([_, capacity]) => capacity > 0)
        .sort((a, b) => b[1] - a[1]); // Sort by capacity (descending)
    
    const labels = fuelEntries.map(([fuel, _]) => fuel);
    const capacities = fuelEntries.map(([_, capacity]) => capacity);
    const colors = labels.map(fuel => fuelColors[fuel] || '#cccccc');
    
    // Calculate percentages
    const percentages = capacities.map(capacity => 
        ((capacity / data.totalCapacity) * 100).toFixed(1)
    );
    
    console.log(`Energy mix for ${country}:`, labels, capacities, percentages);
    
    // Destroy existing chart if it exists
    if (window.energyMixChart) {
        window.energyMixChart.destroy();
    }
    
    // Create chart
    const ctx = canvas.getContext('2d');
    window.energyMixChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: capacities,
                backgroundColor: colors,
                borderWidth: isDarkTheme ? 0 : 1,
                borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    
                                    return {
                                        text: `${label} (${percentages[i]}%)`,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        hidden: !chart.getDataVisibility(i),
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Energy Mix for ${country}`,
                    color: isDarkTheme ? '#f0f0f0' : '#666666'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = ((value / data.totalCapacity) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(2)} MW (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateCapacityDistributionChart(country) {
    const canvas = document.getElementById('capacity-distribution-chart');
    if (!canvas) return;
    
    // Get country data
    const data = getCountryData(country);
    
    // Prepare chart data
    const labels = data.capacityDistribution.map(range => range.label);
    const counts = data.capacityDistribution.map(range => range.count);
    
    // Destroy existing chart if it exists
    if (window.capacityDistChart) {
        window.capacityDistChart.destroy();
    }
    
    // Create chart
    const ctx = canvas.getContext('2d');
    window.capacityDistChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Plants',
                data: counts,
                backgroundColor: '#4CAF50',
                borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Capacity Range',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Plants',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Capacity Distribution for ${country}`,
                    color: isDarkTheme ? '#f0f0f0' : '#666666'
                }
            }
        }
    });
}

function populatePowerPlantsTable(country, sortByCapacity = false) {
    const tableBody = document.querySelector('#power-plants-table tbody');
    if (!tableBody) return;
    
    // Get country data
    const data = getCountryData(country);
    
    // Sort plants by capacity if requested
    let plants = [...data.plants];
    if (sortByCapacity) {
        plants.sort((a, b) => b.capacity - a.capacity);
    }
    
    // Limit to top 10 plants
    plants = plants.slice(0, 10);
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Add rows for each plant
    plants.forEach(plant => {
        const row = document.createElement('tr');
        
        // Get light intensity for the plant
        const latKey = Math.floor(plant.latitude / 10) * 10;
        const lonKey = Math.floor(plant.longitude / 10) * 10;
        const lightKey = `${latKey},${lonKey}`;
        const lightIntensity = lightIntensityData[lightKey] || 0;
        
        row.innerHTML = `
            <td>${plant.name}</td>
            <td>
                <span class="fuel-indicator" style="background-color: ${plant.color}"></span>
                ${plant.primary_fuel}
            </td>
            <td>${plant.capacity.toFixed(2)}</td>
            <td>${plant.latitude.toFixed(4)}, ${plant.longitude.toFixed(4)}</td>
            <td>${lightIntensity.toFixed(2)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function updateCountryComparison(country1, country2) {
    // Get data for both countries
    const data1 = getCountryData(country1);
    const data2 = getCountryData(country2);
    
    // Update fuel comparison chart
    updateFuelComparisonChart(country1, country2, data1, data2);
    
    // Update capacity comparison chart
    updateCapacityComparisonChart(country1, country2, data1, data2);
}

function updateFuelComparisonChart(country1, country2, data1, data2) {
    const canvas = document.getElementById('comparison-fuel-chart');
    if (!canvas) return;
    
    // Get all unique fuel types from both countries
    const allFuels = [...new Set([
        ...Object.keys(data1.fuelCapacities),
        ...Object.keys(data2.fuelCapacities)
    ])].sort();
    
    // Calculate percentages for each country
    const percentages1 = allFuels.map(fuel => {
        const capacity = data1.fuelCapacities[fuel] || 0;
        return ((capacity / data1.totalCapacity) * 100);
    });
    
    const percentages2 = allFuels.map(fuel => {
        const capacity = data2.fuelCapacities[fuel] || 0;
        return ((capacity / data2.totalCapacity) * 100);
    });
    
    // Destroy existing chart if it exists
    if (window.comparisonFuelChart) {
        window.comparisonFuelChart.destroy();
    }
    
    // Create chart
    const ctx = canvas.getContext('2d');
    window.comparisonFuelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allFuels,
            datasets: [
                {
                    label: country1,
                    data: percentages1,
                    backgroundColor: '#4CAF50',
                    borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                    borderWidth: 1
                },
                {
                    label: country2,
                    data: percentages2,
                    backgroundColor: '#2196F3',
                    borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Fuel Type',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Percentage of Total Capacity',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    }
                },
                title: {
                    display: true,
                    text: 'Energy Mix Comparison',
                    color: isDarkTheme ? '#f0f0f0' : '#666666'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value.toFixed(2)}%`;
                        }
                    }
                }
            }
        }
    });
}

function updateCapacityComparisonChart(country1, country2, data1, data2) {
    const canvas = document.getElementById('comparison-capacity-chart');
    if (!canvas) return;
    
    // Prepare comparison metrics
    const metrics = [
        { label: 'Total Capacity (GW)', value1: data1.totalCapacity / 1000, value2: data2.totalCapacity / 1000 },
        { label: 'Avg Plant Size (MW)', value1: data1.avgCapacity, value2: data2.avgCapacity },
        { label: 'Plant Count', value1: data1.plantCount, value2: data2.plantCount },
        { label: 'Avg Light Intensity', value1: data1.avgLightIntensity, value2: data2.avgLightIntensity }
    ];
    
    // Destroy existing chart if it exists
    if (window.comparisonCapacityChart) {
        window.comparisonCapacityChart.destroy();
    }
    
    // Create chart
    const ctx = canvas.getContext('2d');
    window.comparisonCapacityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metrics.map(m => m.label),
            datasets: [
                {
                    label: country1,
                    data: metrics.map(m => m.value1),
                    backgroundColor: '#4CAF50',
                    borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                    borderWidth: 1
                },
                {
                    label: country2,
                    data: metrics.map(m => m.value2),
                    backgroundColor: '#2196F3',
                    borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Metric',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value',
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    }
                },
                title: {
                    display: true,
                    text: 'Key Metrics Comparison',
                    color: isDarkTheme ? '#f0f0f0' : '#666666'
                }
            }
        }
    });
}

// Utility functions for loading and error handling
function showLoading() {
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingOverlay);
    }
    
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-exclamation-circle me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function () {
        document.body.removeChild(toast);
    });
}

// Chart export functionality
function exportChart(chartType) {
    let chart;
    let filename;
    
    switch (chartType) {
        case 'energy-mix':
            chart = window.energyMixChart;
            filename = 'energy-mix-chart.png';
            break;
        case 'capacity-dist':
            chart = window.capacityDistChart;
            filename = 'capacity-distribution-chart.png';
            break;
        case 'comparison':
            // Create a combined image of both comparison charts
            const fuelChart = document.getElementById('comparison-fuel-chart');
            const capacityChart = document.getElementById('comparison-capacity-chart');
            
            if (fuelChart && capacityChart) {
                // Create a temporary canvas to combine both charts
                const tempCanvas = document.createElement('canvas');
                const ctx = tempCanvas.getContext('2d');
                
                // Set canvas size to fit both charts
                tempCanvas.width = Math.max(fuelChart.width, capacityChart.width);
                tempCanvas.height = fuelChart.height + capacityChart.height + 20; // 20px spacing
                
                // Fill background
                ctx.fillStyle = isDarkTheme ? '#1e1e1e' : '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Draw both charts
                ctx.drawImage(fuelChart, 0, 0);
                ctx.drawImage(capacityChart, 0, fuelChart.height + 20);
                
                // Export the combined image
                const dataUrl = tempCanvas.toDataURL('image/png');
                downloadImage(dataUrl, 'country-comparison.png');
                return;
            }
            break;
        case 'top-plants':
            // Export table as CSV
            exportTableToCSV('power-plants-table', 'top-power-plants.csv');
            return;
        default:
            showError('Unknown chart type for export');
            return;
    }
    
    if (chart) {
        const dataUrl = chart.toBase64Image();
        downloadImage(dataUrl, filename);
    } else {
        showError('Chart not available for export');
    }
}

function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        showError('Table not found for export');
        return;
    }
    
    let csv = [];
    
    // Get header row
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th'))
            .map(th => `"${th.textContent.trim()}"`);
        csv.push(headers.join(','));
    }
    
    // Get data rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td'))
            .map(cell => {
                // Remove any HTML and get just the text
                const text = cell.textContent.trim().replace(/"/g, '""');
                return `"${text}"`;
            });
        csv.push(rowData.join(','));
    });
    
    // Create and download CSV file
    const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

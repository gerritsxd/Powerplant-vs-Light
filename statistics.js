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
    if (window.mainChart) {
        const textColor = isDarkTheme ? '#f0f0f0' : '#666666';
        const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        window.mainChart.options.scales.x.ticks.color = textColor;
        window.mainChart.options.scales.y.ticks.color = textColor;
        window.mainChart.options.scales.x.grid.color = gridColor;
        window.mainChart.options.scales.y.grid.color = gridColor;
        window.mainChart.update();
    }
    
    if (window.distributionChart) {
        const textColor = isDarkTheme ? '#f0f0f0' : '#666666';
        const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        window.distributionChart.options.scales.x.ticks.color = textColor;
        window.distributionChart.options.scales.y.ticks.color = textColor;
        window.distributionChart.options.scales.x.grid.color = gridColor;
        window.distributionChart.options.scales.y.grid.color = gridColor;
        window.distributionChart.update();
    }
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
            
            // Initialize fuel type filters
            initializeFuelTypeFilters();
            
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
    
    // In a real implementation, we would load from a file:
    /*
    fetch('light_intensity_data.json')
        .then(response => response.json())
        .then(data => {
            lightIntensityData = data;
            console.log('Loaded light intensity data');
        })
        .catch(error => {
            console.error('Error loading light intensity data:', error);
            showError('Failed to load light intensity data. Please try refreshing the page.');
        });
    */
}

// Helper function to parse CSV lines correctly (handling quoted fields)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// UI setup functions
function setupEventListeners() {
    // Analysis form submission
    const runAnalysisBtn = document.getElementById('run-analysis');
    if (runAnalysisBtn) {
        runAnalysisBtn.addEventListener('click', runAnalysis);
    }
    
    // Region filter change
    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', function() {
            const regionSelectionContainer = document.getElementById('region-selection-container');
            const regionSelection = document.getElementById('region-selection');
            
            if (this.value === 'global') {
                regionSelectionContainer.style.display = 'none';
            } else {
                regionSelectionContainer.style.display = 'block';
                
                // Clear existing options
                regionSelection.innerHTML = '';
                
                // Add appropriate options based on selection
                if (this.value === 'continent') {
                    const continents = [...new Set(allPowerPlants.map(plant => getContinent(plant.country)))].filter(Boolean).sort();
                    
                    continents.forEach(continent => {
                        const option = document.createElement('option');
                        option.value = continent;
                        option.textContent = continent;
                        regionSelection.appendChild(option);
                    });
                } else if (this.value === 'country') {
                    const countries = [...new Set(allPowerPlants.map(plant => plant.country))].filter(Boolean).sort();
                    
                    countries.forEach(country => {
                        const option = document.createElement('option');
                        option.value = country;
                        option.textContent = country;
                        regionSelection.appendChild(option);
                    });
                }
            }
        });
    }
    
    // Export buttons
    const exportImageBtn = document.getElementById('export-image');
    if (exportImageBtn) {
        exportImageBtn.addEventListener('click', exportImage);
    }
    
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportData);
    }
}

function initializeFuelTypeFilters() {
    const fuelTypeFilters = document.getElementById('fuel-type-filters');
    if (!fuelTypeFilters) return;
    
    // Clear existing filters
    fuelTypeFilters.innerHTML = '';
    
    // Get unique fuel types
    const fuelTypes = [...new Set(allPowerPlants.map(plant => plant.primary_fuel))].filter(Boolean).sort();
    
    // Create filter pills for each fuel type
    fuelTypes.forEach(fuel => {
        const color = fuelColors[fuel] || '#cccccc';
        
        const filterPill = document.createElement('div');
        filterPill.className = 'fuel-filter active';
        filterPill.dataset.fuel = fuel;
        
        const indicator = document.createElement('span');
        indicator.className = 'fuel-indicator';
        indicator.style.backgroundColor = color;
        
        filterPill.appendChild(indicator);
        filterPill.appendChild(document.createTextNode(fuel));
        
        // Toggle active state on click
        filterPill.addEventListener('click', function() {
            this.classList.toggle('active');
        });
        
        fuelTypeFilters.appendChild(filterPill);
    });
}

// Analysis functions
function runAnalysis() {
    showLoading();
    
    // Get analysis parameters
    const analysisType = document.getElementById('analysis-type').value;
    const variableX = document.getElementById('variable-x').value;
    const variableY = document.getElementById('variable-y').value;
    const gridSize = parseInt(document.getElementById('grid-size').value);
    
    // Get selected fuel types
    const selectedFuels = Array.from(document.querySelectorAll('.fuel-filter.active'))
        .map(el => el.dataset.fuel);
    
    // Get region filter
    const regionType = document.getElementById('region-filter').value;
    let selectedRegion = '';
    
    if (regionType !== 'global') {
        selectedRegion = document.getElementById('region-selection').value;
    }
    
    // Filter power plants based on selections
    let filteredPlants = filterPowerPlants(selectedFuels, regionType, selectedRegion);
    
    // Run the appropriate analysis
    let analysisResult;
    let visualizationData;
    
    switch (analysisType) {
        case 'correlation':
            analysisResult = correlationAnalysis(filteredPlants, variableX, variableY, gridSize);
            visualizationData = prepareCorrelationVisualization(analysisResult, variableX, variableY);
            break;
        case 'comparison':
            analysisResult = groupComparisonAnalysis(filteredPlants, variableX, selectedFuels);
            visualizationData = prepareComparisonVisualization(analysisResult, variableX);
            break;
        case 'regression':
            analysisResult = regressionAnalysis(filteredPlants, variableX, variableY, gridSize);
            visualizationData = prepareRegressionVisualization(analysisResult, variableX, variableY);
            break;
        case 'distribution':
            analysisResult = distributionAnalysis(filteredPlants, variableX, selectedFuels);
            visualizationData = prepareDistributionVisualization(analysisResult, variableX);
            break;
        default:
            analysisResult = correlationAnalysis(filteredPlants, variableX, variableY, gridSize);
            visualizationData = prepareCorrelationVisualization(analysisResult, variableX, variableY);
    }
    
    // Update visualization
    updateVisualization(analysisType, visualizationData, variableX, variableY);
    
    // Update results summary
    updateResultsSummary(analysisType, analysisResult, variableX, variableY);
    
    // Update statistical details
    updateStatisticalDetails(analysisType, analysisResult, variableX, variableY);
    
    hideLoading();
}

function filterPowerPlants(selectedFuels, regionType, selectedRegion) {
    // Start with all power plants
    let filteredPlants = [...allPowerPlants];
    
    // Filter by fuel type
    if (selectedFuels && selectedFuels.length > 0) {
        filteredPlants = filteredPlants.filter(plant => 
            selectedFuels.includes(plant.primary_fuel)
        );
    }
    
    // Filter by region
    if (regionType === 'continent' && selectedRegion) {
        filteredPlants = filteredPlants.filter(plant => 
            getContinent(plant.country) === selectedRegion
        );
    } else if (regionType === 'country' && selectedRegion) {
        filteredPlants = filteredPlants.filter(plant => 
            plant.country === selectedRegion
        );
    }
    
    return filteredPlants;
}

// Helper function to get continent from country
function getContinent(country) {
    // This is a simplified mapping - a real implementation would use a more complete dataset
    const continentMap = {
        'United States': 'North America',
        'Canada': 'North America',
        'Mexico': 'North America',
        'Brazil': 'South America',
        'Argentina': 'South America',
        'Chile': 'South America',
        'United Kingdom': 'Europe',
        'Germany': 'Europe',
        'France': 'Europe',
        'Italy': 'Europe',
        'Spain': 'Europe',
        'China': 'Asia',
        'India': 'Asia',
        'Japan': 'Asia',
        'Australia': 'Oceania',
        'New Zealand': 'Oceania',
        'South Africa': 'Africa',
        'Egypt': 'Africa',
        'Nigeria': 'Africa'
    };
    
    return continentMap[country] || 'Unknown';
}

// Analysis implementations
function correlationAnalysis(plants, variableX, variableY, gridSize) {
    // Create a grid to aggregate data
    const grid = {};
    const dataPoints = [];
    
    // Group plants by grid cell and calculate metrics
    plants.forEach(plant => {
        // Calculate grid cell coordinates
        const gridX = Math.floor((plant.longitude + 180) / 360 * (180 / gridSize));
        const gridY = Math.floor((90 - plant.latitude) / 180 * (90 / gridSize));
        const gridKey = `${gridX},${gridY}`;
        
        // Initialize grid cell if it doesn't exist
        if (!grid[gridKey]) {
            grid[gridKey] = {
                plants: [],
                totalCapacity: 0,
                count: 0,
                fuelTypes: {},
                centerLat: 90 - (gridY + 0.5) * (180 / (90 / gridSize)),
                centerLon: (gridX + 0.5) * (360 / (180 / gridSize)) - 180
            };
        }
        
        // Add plant to grid cell
        grid[gridKey].plants.push(plant);
        grid[gridKey].totalCapacity += plant.capacity;
        grid[gridKey].count += 1;
        
        // Count fuel types
        const fuel = plant.primary_fuel;
        grid[gridKey].fuelTypes[fuel] = (grid[gridKey].fuelTypes[fuel] || 0) + 1;
    });
    
    // Calculate light intensity for each grid cell
    Object.keys(grid).forEach(gridKey => {
        const cell = grid[gridKey];
        
        // Find the closest light intensity data point
        const latKey = Math.floor(cell.centerLat / 10) * 10;
        const lonKey = Math.floor(cell.centerLon / 10) * 10;
        const lightKey = `${latKey},${lonKey}`;
        
        // Get light intensity (or default to 0)
        const lightIntensity = lightIntensityData[lightKey] || 0;
        cell.lightIntensity = lightIntensity;
        
        // Prepare data point for correlation
        const xValue = getVariableValue(cell, variableX);
        const yValue = getVariableValue(cell, variableY);
        
        if (xValue !== null && yValue !== null) {
            dataPoints.push({
                x: xValue,
                y: yValue,
                count: cell.count,
                capacity: cell.totalCapacity,
                lightIntensity: cell.lightIntensity,
                lat: cell.centerLat,
                lon: cell.centerLon,
                dominantFuel: getDominantFuel(cell.fuelTypes)
            });
        }
    });
    
    // Calculate correlation coefficient
    const correlation = calculateCorrelation(
        dataPoints.map(p => p.x),
        dataPoints.map(p => p.y)
    );
    
    return {
        correlation: correlation,
        dataPoints: dataPoints,
        sampleSize: dataPoints.length
    };
}

function getVariableValue(cell, variable) {
    switch (variable) {
        case 'light_intensity':
            return cell.lightIntensity;
        case 'capacity':
            return cell.totalCapacity;
        case 'count':
            return cell.count;
        default:
            return null;
    }
}

function getDominantFuel(fuelTypes) {
    let maxCount = 0;
    let dominantFuel = 'Unknown';
    
    Object.entries(fuelTypes).forEach(([fuel, count]) => {
        if (count > maxCount) {
            maxCount = count;
            dominantFuel = fuel;
        }
    });
    
    return dominantFuel;
}

function calculateCorrelation(xValues, yValues) {
    if (xValues.length !== yValues.length || xValues.length === 0) {
        return 0;
    }
    
    // Use simple-statistics library if available
    if (window.ss && window.ss.sampleCorrelation) {
        return window.ss.sampleCorrelation(xValues, yValues);
    }
    
    // Manual calculation if library not available
    const n = xValues.length;
    
    // Calculate means
    const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
    const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate covariance and variances
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;
    
    for (let i = 0; i < n; i++) {
        const xDiff = xValues[i] - xMean;
        const yDiff = yValues[i] - yMean;
        
        covariance += xDiff * yDiff;
        xVariance += xDiff * xDiff;
        yVariance += yDiff * yDiff;
    }
    
    // Calculate correlation coefficient
    if (xVariance === 0 || yVariance === 0) {
        return 0;
    }
    
    return covariance / Math.sqrt(xVariance * yVariance);
}

function groupComparisonAnalysis(plants, variable, selectedFuels) {
    // Group plants by fuel type
    const fuelGroups = {};
    
    // Initialize groups for each fuel type
    selectedFuels.forEach(fuel => {
        fuelGroups[fuel] = {
            plants: [],
            totalCapacity: 0,
            count: 0,
            lightIntensity: []
        };
    });
    
    // Assign plants to their fuel groups
    plants.forEach(plant => {
        const fuel = plant.primary_fuel;
        
        if (selectedFuels.includes(fuel)) {
            // Add plant to its fuel group
            fuelGroups[fuel].plants.push(plant);
            fuelGroups[fuel].totalCapacity += plant.capacity;
            fuelGroups[fuel].count += 1;
            
            // Find the closest light intensity data point
            const latKey = Math.floor(plant.latitude / 10) * 10;
            const lonKey = Math.floor(plant.longitude / 10) * 10;
            const lightKey = `${latKey},${lonKey}`;
            
            // Get light intensity (or default to 0)
            const lightIntensity = lightIntensityData[lightKey] || 0;
            fuelGroups[fuel].lightIntensity.push(lightIntensity);
        }
    });
    
    // Calculate statistics for each group
    const groupStats = {};
    
    Object.entries(fuelGroups).forEach(([fuel, group]) => {
        if (group.plants.length === 0) return;
        
        const variableValues = getGroupVariableValues(group, variable);
        
        groupStats[fuel] = {
            count: group.count,
            mean: calculateMean(variableValues),
            median: calculateMedian(variableValues),
            stdDev: calculateStdDev(variableValues),
            min: Math.min(...variableValues),
            max: Math.max(...variableValues),
            color: fuelColors[fuel] || '#cccccc'
        };
    });
    
    return {
        groupStats: groupStats,
        variable: variable
    };
}

function getGroupVariableValues(group, variable) {
    switch (variable) {
        case 'light_intensity':
            return group.lightIntensity;
        case 'capacity':
            return group.plants.map(plant => plant.capacity);
        case 'count':
            return [group.count]; // Not meaningful for comparison, but included for completeness
        default:
            return [];
    }
}

function calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
        return sorted[middle];
    }
}

function calculateStdDev(values) {
    if (values.length <= 1) return 0;
    
    const mean = calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    
    return Math.sqrt(variance);
}

function regressionAnalysis(plants, variableX, variableY, gridSize) {
    // Similar to correlation analysis, but we'll calculate regression line
    const correlationResult = correlationAnalysis(plants, variableX, variableY, gridSize);
    const dataPoints = correlationResult.dataPoints;
    
    // Calculate regression line using simple-statistics if available
    let slope, intercept, rSquared;
    
    if (window.ss && window.ss.linearRegression) {
        const xValues = dataPoints.map(p => p.x);
        const yValues = dataPoints.map(p => p.y);
        
        const regression = window.ss.linearRegression(
            xValues.map((x, i) => [x, yValues[i]])
        );
        
        slope = regression.m;
        intercept = regression.b;
        rSquared = Math.pow(correlationResult.correlation, 2);
    } else {
        // Manual calculation
        const xValues = dataPoints.map(p => p.x);
        const yValues = dataPoints.map(p => p.y);
        
        const n = xValues.length;
        const xMean = calculateMean(xValues);
        const yMean = calculateMean(yValues);
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
            numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
            denominator += Math.pow(xValues[i] - xMean, 2);
        }
        
        slope = denominator !== 0 ? numerator / denominator : 0;
        intercept = yMean - slope * xMean;
        rSquared = Math.pow(correlationResult.correlation, 2);
    }
    
    return {
        ...correlationResult,
        slope: slope,
        intercept: intercept,
        rSquared: rSquared
    };
}

function distributionAnalysis(plants, variable, selectedFuels) {
    // Group plants by fuel type
    const fuelGroups = {};
    
    // Initialize groups for each fuel type
    selectedFuels.forEach(fuel => {
        fuelGroups[fuel] = {
            plants: [],
            values: []
        };
    });
    
    // Assign plants to their fuel groups and calculate variable values
    plants.forEach(plant => {
        const fuel = plant.primary_fuel;
        
        if (selectedFuels.includes(fuel)) {
            fuelGroups[fuel].plants.push(plant);
            
            // Calculate variable value
            let value;
            
            if (variable === 'light_intensity') {
                const latKey = Math.floor(plant.latitude / 10) * 10;
                const lonKey = Math.floor(plant.longitude / 10) * 10;
                const lightKey = `${latKey},${lonKey}`;
                value = lightIntensityData[lightKey] || 0;
            } else if (variable === 'capacity') {
                value = plant.capacity;
            } else if (variable === 'count') {
                value = 1; // Each plant counts as 1 for distribution
            }
            
            if (value !== undefined) {
                fuelGroups[fuel].values.push(value);
            }
        }
    });
    
    // Calculate distribution statistics for each fuel type
    const distributions = {};
    
    Object.entries(fuelGroups).forEach(([fuel, group]) => {
        if (group.values.length === 0) return;
        
        // Sort values for percentile calculations
        const sortedValues = [...group.values].sort((a, b) => a - b);
        const n = sortedValues.length;
        
        distributions[fuel] = {
            count: n,
            mean: calculateMean(sortedValues),
            median: calculateMedian(sortedValues),
            stdDev: calculateStdDev(sortedValues),
            min: sortedValues[0],
            max: sortedValues[n - 1],
            q1: getPercentile(sortedValues, 25),
            q3: getPercentile(sortedValues, 75),
            color: fuelColors[fuel] || '#cccccc',
            // Create histogram data
            histogram: createHistogram(sortedValues, 10)
        };
    });
    
    return {
        distributions: distributions,
        variable: variable
    };
}

function getPercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * sortedValues.length;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
        return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function createHistogram(values, bins) {
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binWidth = range / bins;
    
    // Initialize bins
    const histogram = Array(bins).fill(0);
    
    // Count values in each bin
    values.forEach(value => {
        const binIndex = Math.min(bins - 1, Math.floor((value - min) / binWidth));
        histogram[binIndex]++;
    });
    
    // Create histogram data with bin ranges
    return histogram.map((count, i) => {
        const binStart = min + i * binWidth;
        const binEnd = min + (i + 1) * binWidth;
        
        return {
            binStart: binStart,
            binEnd: binEnd,
            count: count,
            percentage: (count / values.length) * 100
        };
    });
}

// Visualization preparation functions
function prepareCorrelationVisualization(result, variableX, variableY) {
    return {
        type: 'scatter',
        data: result.dataPoints.map(point => ({
            x: point.x,
            y: point.y,
            r: Math.sqrt(point.count) * 3, // Size based on count
            color: fuelColors[point.dominantFuel] || '#cccccc',
            tooltip: {
                fuel: point.dominantFuel,
                count: point.count,
                capacity: point.capacity.toFixed(2) + ' MW',
                lightIntensity: point.lightIntensity.toFixed(2),
                location: `${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}`
            }
        }))
    };
}

function prepareComparisonVisualization(result, variable) {
    const labels = Object.keys(result.groupStats);
    const means = labels.map(fuel => result.groupStats[fuel].mean);
    const stdDevs = labels.map(fuel => result.groupStats[fuel].stdDev);
    const colors = labels.map(fuel => result.groupStats[fuel].color);
    
    return {
        type: 'bar',
        labels: labels,
        data: means,
        errors: stdDevs,
        colors: colors
    };
}

function prepareRegressionVisualization(result, variableX, variableY) {
    // Similar to correlation but with regression line
    const scatterData = prepareCorrelationVisualization(result, variableX, variableY);
    
    // Add regression line data
    const xValues = result.dataPoints.map(p => p.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    
    const linePoints = [
        { x: minX, y: result.intercept + result.slope * minX },
        { x: maxX, y: result.intercept + result.slope * maxX }
    ];
    
    return {
        ...scatterData,
        regressionLine: linePoints
    };
}

function prepareDistributionVisualization(result, variable) {
    const datasets = [];
    
    Object.entries(result.distributions).forEach(([fuel, stats]) => {
        datasets.push({
            label: fuel,
            data: stats.histogram.map(bin => bin.count),
            backgroundColor: stats.color,
            borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
            borderWidth: 1
        });
    });
    
    return {
        type: 'histogram',
        datasets: datasets,
        bins: Object.values(result.distributions)[0]?.histogram.map(bin => 
            `${bin.binStart.toFixed(1)}-${bin.binEnd.toFixed(1)}`
        ) || []
    };
}

// Visualization rendering functions
function updateVisualization(analysisType, visualizationData, variableX, variableY) {
    const container = document.getElementById('visualization-container');
    const canvas = document.getElementById('main-chart');
    
    if (!container || !canvas) return;
    
    // Set visualization title
    const title = document.getElementById('visualization-title');
    if (title) {
        title.textContent = getVisualizationTitle(analysisType, variableX, variableY);
    }
    
    // Destroy existing chart if it exists
    if (window.mainChart) {
        window.mainChart.destroy();
    }
    
    // Create appropriate chart based on analysis type
    switch (analysisType) {
        case 'correlation':
            createScatterPlot(canvas, visualizationData, variableX, variableY);
            break;
        case 'comparison':
            createBarChart(canvas, visualizationData, variableX);
            break;
        case 'regression':
            createRegressionPlot(canvas, visualizationData, variableX, variableY);
            break;
        case 'distribution':
            createDistributionChart(canvas, visualizationData, variableX);
            break;
        default:
            createScatterPlot(canvas, visualizationData, variableX, variableY);
    }
    
    // Update distribution chart
    updateDistributionChart(analysisType, visualizationData, variableX, variableY);
}

function getVisualizationTitle(analysisType, variableX, variableY) {
    const xLabel = getVariableLabel(variableX);
    const yLabel = getVariableLabel(variableY);
    
    switch (analysisType) {
        case 'correlation':
            return `Correlation between ${xLabel} and ${yLabel}`;
        case 'comparison':
            return `Comparison of ${xLabel} by Fuel Type`;
        case 'regression':
            return `Regression Analysis: ${xLabel} vs ${yLabel}`;
        case 'distribution':
            return `Distribution of ${xLabel} by Fuel Type`;
        default:
            return 'Analysis Results';
    }
}

function getVariableLabel(variable) {
    switch (variable) {
        case 'light_intensity':
            return 'Light Intensity';
        case 'capacity':
            return 'Power Plant Capacity (MW)';
        case 'count':
            return 'Number of Power Plants';
        default:
            return variable;
    }
}

function getVariableUnit(variable) {
    switch (variable) {
        case 'light_intensity':
            return '';
        case 'capacity':
            return 'MW';
        case 'count':
            return '';
        default:
            return '';
    }
}

function createScatterPlot(canvas, visualizationData, variableX, variableY) {
    const ctx = canvas.getContext('2d');
    
    // Create scatter plot
    window.mainChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                data: visualizationData.data.map(point => ({
                    x: point.x,
                    y: point.y,
                    r: point.r
                })),
                backgroundColor: visualizationData.data.map(point => point.color),
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
                        text: getVariableLabel(variableX)
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: getVariableLabel(variableY)
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
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = visualizationData.data[context.dataIndex];
                            const tooltip = point.tooltip;
                            
                            return [
                                `Dominant Fuel: ${tooltip.fuel}`,
                                `Plants: ${tooltip.count}`,
                                `Capacity: ${tooltip.capacity}`,
                                `Light Intensity: ${tooltip.lightIntensity}`,
                                `Location: ${tooltip.location}`
                            ];
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

function createBarChart(canvas, visualizationData, variable) {
    const ctx = canvas.getContext('2d');
    
    // Create bar chart
    window.mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: visualizationData.labels,
            datasets: [{
                label: getVariableLabel(variable),
                data: visualizationData.data,
                backgroundColor: visualizationData.colors,
                borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                borderWidth: 1,
                // Add error bars
                errorBars: {
                    show: true,
                    color: isDarkTheme ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                    lineWidth: 1,
                    tipWidth: 6,
                    data: visualizationData.errors.map(e => ({plus: e, minus: e}))
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Fuel Type'
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
                        text: getVariableLabel(variable)
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
                }
            }
        }
    });
}

function createRegressionPlot(canvas, visualizationData, variableX, variableY) {
    const ctx = canvas.getContext('2d');
    
    // Create scatter plot with regression line
    window.mainChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [
                // Scatter points
                {
                    data: visualizationData.data.map(point => ({
                        x: point.x,
                        y: point.y,
                        r: point.r
                    })),
                    backgroundColor: visualizationData.data.map(point => point.color),
                    borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                    borderWidth: 1
                },
                // Regression line
                {
                    type: 'line',
                    data: visualizationData.regressionLine.map(point => ({
                        x: point.x,
                        y: point.y
                    })),
                    borderColor: '#ff6384',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
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
                        text: getVariableLabel(variableX)
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: getVariableLabel(variableY)
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
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                const point = visualizationData.data[context.dataIndex];
                                const tooltip = point.tooltip;
                                
                                return [
                                    `Dominant Fuel: ${tooltip.fuel}`,
                                    `Plants: ${tooltip.count}`,
                                    `Capacity: ${tooltip.capacity}`,
                                    `Light Intensity: ${tooltip.lightIntensity}`,
                                    `Location: ${tooltip.location}`
                                ];
                            }
                            return '';
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

function createDistributionChart(canvas, visualizationData, variable) {
    const ctx = canvas.getContext('2d');
    
    // Create histogram chart
    window.mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: visualizationData.bins,
            datasets: visualizationData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: getVariableLabel(variable)
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    },
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency'
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
                }
            }
        }
    });
}

// Update the distribution chart in the bottom panel
function updateDistributionChart(analysisType, visualizationData, variableX, variableY) {
    const canvas = document.getElementById('distribution-chart');
    if (!canvas) return;
    
    // Destroy existing chart if it exists
    if (window.distributionChart) {
        window.distributionChart.destroy();
    }
    
    // For distribution analysis, we already have the main chart as a distribution
    if (analysisType === 'distribution') {
        // Create a simplified version of the main chart
        window.distributionChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: visualizationData.bins,
                datasets: visualizationData.datasets.map(dataset => ({
                    ...dataset,
                    borderWidth: 0
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        return;
    }
    
    // For other analysis types, create a small distribution chart for the X variable
    const variable = variableX;
    let data;
    
    if (analysisType === 'correlation' || analysisType === 'regression') {
        // Create a histogram of X values
        const xValues = visualizationData.data.map(point => point.x);
        const histogram = createHistogram(xValues, 10);
        
        data = {
            labels: histogram.map(bin => `${bin.binStart.toFixed(1)}-${bin.binEnd.toFixed(1)}`),
            datasets: [{
                label: getVariableLabel(variable),
                data: histogram.map(bin => bin.count),
                backgroundColor: '#4CAF50',
                borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                borderWidth: 1
            }]
        };
    } else if (analysisType === 'comparison') {
        // Use the same data as the main chart but in a simplified form
        data = {
            labels: visualizationData.labels,
            datasets: [{
                label: getVariableLabel(variable),
                data: visualizationData.data,
                backgroundColor: visualizationData.colors,
                borderColor: isDarkTheme ? '#2a2a2a' : '#ffffff',
                borderWidth: 1
            }]
        };
    }
    
    // Create the chart
    window.distributionChart = new Chart(canvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Distribution of ${getVariableLabel(variable)}`,
                    color: isDarkTheme ? '#f0f0f0' : '#666666'
                }
            }
        }
    });
}

// Update the results summary panel
function updateResultsSummary(analysisType, result, variableX, variableY) {
    const resultsContainer = document.getElementById('analysis-results');
    if (!resultsContainer) return;
    
    // Clear existing results
    resultsContainer.innerHTML = '';
    
    // Create appropriate summary based on analysis type
    switch (analysisType) {
        case 'correlation':
            createCorrelationSummary(resultsContainer, result, variableX, variableY);
            break;
        case 'comparison':
            createComparisonSummary(resultsContainer, result, variableX);
            break;
        case 'regression':
            createRegressionSummary(resultsContainer, result, variableX, variableY);
            break;
        case 'distribution':
            createDistributionSummary(resultsContainer, result, variableX);
            break;
        default:
            createCorrelationSummary(resultsContainer, result, variableX, variableY);
    }
}

function getVisualizationTitle(analysisType, variableX, variableY) {
    const xLabel = getVariableLabel(variableX);
    const yLabel = getVariableLabel(variableY);
    
    switch (analysisType) {
        case 'correlation':
            return `Correlation between ${xLabel} and ${yLabel}`;
        case 'comparison':
            return `Comparison of ${xLabel} by Fuel Type`;
        case 'regression':
            return `Regression Analysis: ${xLabel} vs ${yLabel}`;
        case 'distribution':
            return `Distribution of ${xLabel} by Fuel Type`;
        default:
            return 'Analysis Results';
    }
}

function getVariableLabel(variable) {
    switch (variable) {
        case 'light_intensity':
            return 'Light Intensity';
        case 'capacity':
            return 'Power Plant Capacity (MW)';
        case 'count':
            return 'Number of Power Plants';
        default:
            return variable;
    }
}

function getVariableUnit(variable) {
    switch (variable) {
        case 'light_intensity':
            return '';
        case 'capacity':
            return 'MW';
        case 'count':
            return '';
        default:
            return '';
    }
}

function createCorrelationSummary(container, result, variableX, variableY) {
    const correlation = result.correlation;
    const sampleSize = result.sampleSize;
    
    // Create correlation result
    const correlationResult = document.createElement('div');
    correlationResult.className = 'stat-result';
    
    const correlationTitle = document.createElement('div');
    correlationTitle.className = 'stat-result-title';
    correlationTitle.textContent = 'Correlation Coefficient';
    
    const correlationValue = document.createElement('div');
    correlationValue.className = 'stat-result-value';
    correlationValue.textContent = correlation.toFixed(3);
    
    // Add color indicator based on correlation strength
    const indicator = document.createElement('span');
    indicator.className = 'correlation-indicator';
    
    if (correlation >= 0.7) {
        indicator.classList.add('correlation-strong-positive');
    } else if (correlation >= 0.5) {
        indicator.classList.add('correlation-moderate-positive');
    } else if (correlation >= 0.3) {
        indicator.classList.add('correlation-weak-positive');
    } else if (correlation > -0.3) {
        indicator.classList.add('correlation-negligible');
    } else if (correlation > -0.5) {
        indicator.classList.add('correlation-weak-negative');
    } else if (correlation > -0.7) {
        indicator.classList.add('correlation-moderate-negative');
    } else {
        indicator.classList.add('correlation-strong-negative');
    }
    
    correlationValue.prepend(indicator);
    
    const correlationDesc = document.createElement('div');
    correlationDesc.className = 'stat-result-description';
    
    // Describe the correlation strength
    let strengthText;
    if (Math.abs(correlation) >= 0.7) {
        strengthText = 'Strong';
    } else if (Math.abs(correlation) >= 0.5) {
        strengthText = 'Moderate';
    } else if (Math.abs(correlation) >= 0.3) {
        strengthText = 'Weak';
    } else {
        strengthText = 'Negligible';
    }
    
    const directionText = correlation >= 0 ? 'positive' : 'negative';
    
    correlationDesc.textContent = `${strengthText} ${directionText} correlation between ${getVariableLabel(variableX)} and ${getVariableLabel(variableY)}`;
    
    correlationResult.appendChild(correlationTitle);
    correlationResult.appendChild(correlationValue);
    correlationResult.appendChild(correlationDesc);
    
    // Create sample size result
    const sampleResult = document.createElement('div');
    sampleResult.className = 'stat-result';
    
    const sampleTitle = document.createElement('div');
    sampleTitle.className = 'stat-result-title';
    sampleTitle.textContent = 'Sample Size';
    
    const sampleValue = document.createElement('div');
    sampleValue.className = 'stat-result-value';
    sampleValue.textContent = sampleSize;
    
    const sampleDesc = document.createElement('div');
    sampleDesc.className = 'stat-result-description';
    sampleDesc.textContent = `Number of data points used in the analysis`;
    
    sampleResult.appendChild(sampleTitle);
    sampleResult.appendChild(sampleValue);
    sampleResult.appendChild(sampleDesc);
    
    // Add results to container
    container.appendChild(correlationResult);
    container.appendChild(sampleResult);
    
    // Add interpretation
    const interpretation = document.createElement('div');
    interpretation.className = 'stat-result';
    
    const interpretationTitle = document.createElement('div');
    interpretationTitle.className = 'stat-result-title';
    interpretationTitle.textContent = 'Interpretation';
    
    const interpretationDesc = document.createElement('div');
    interpretationDesc.className = 'stat-result-description';
    
    if (Math.abs(correlation) < 0.3) {
        interpretationDesc.textContent = `There is little to no relationship between ${getVariableLabel(variableX)} and ${getVariableLabel(variableY)}.`;
    } else if (correlation > 0) {
        interpretationDesc.textContent = `As ${getVariableLabel(variableX)} increases, ${getVariableLabel(variableY)} tends to increase as well.`;
    } else {
        interpretationDesc.textContent = `As ${getVariableLabel(variableX)} increases, ${getVariableLabel(variableY)} tends to decrease.`;
    }
    
    interpretation.appendChild(interpretationTitle);
    interpretation.appendChild(interpretationDesc);
    
    container.appendChild(interpretation);
}

function createComparisonSummary(container, result, variable) {
    const labels = Object.keys(result.groupStats);
    const means = labels.map(fuel => result.groupStats[fuel].mean);
    const stdDevs = labels.map(fuel => result.groupStats[fuel].stdDev);
    const colors = labels.map(fuel => result.groupStats[fuel].color);
    
    // Create summary for each fuel type
    labels.forEach((fuel, i) => {
        const summary = document.createElement('div');
        summary.className = 'stat-result';
        
        const title = document.createElement('div');
        title.className = 'stat-result-title';
        title.textContent = fuel;
        
        const meanValue = document.createElement('div');
        meanValue.className = 'stat-result-value';
        meanValue.textContent = means[i].toFixed(2);
        
        const stdDevValue = document.createElement('div');
        stdDevValue.className = 'stat-result-value';
        stdDevValue.textContent = `± ${stdDevs[i].toFixed(2)}`;
        
        const desc = document.createElement('div');
        desc.className = 'stat-result-description';
        desc.textContent = `Mean ${getVariableLabel(variable)} for ${fuel} power plants`;
        
        summary.appendChild(title);
        summary.appendChild(meanValue);
        summary.appendChild(stdDevValue);
        summary.appendChild(desc);
        
        container.appendChild(summary);
    });
}

function createRegressionSummary(container, result, variableX, variableY) {
    const slope = result.slope;
    const intercept = result.intercept;
    const rSquared = result.rSquared;
    
    // Create regression equation result
    const equationResult = document.createElement('div');
    equationResult.className = 'stat-result';
    
    const equationTitle = document.createElement('div');
    equationTitle.className = 'stat-result-title';
    equationTitle.textContent = 'Regression Equation';
    
    const equationValue = document.createElement('div');
    equationValue.className = 'stat-result-value';
    equationValue.textContent = `${getVariableLabel(variableY)} = ${intercept.toFixed(2)} + ${slope.toFixed(2)} × ${getVariableLabel(variableX)}`;
    
    const equationDesc = document.createElement('div');
    equationDesc.className = 'stat-result-description';
    equationDesc.textContent = 'Linear regression equation';
    
    equationResult.appendChild(equationTitle);
    equationResult.appendChild(equationValue);
    equationResult.appendChild(equationDesc);
    
    // Create R-squared result
    const rSquaredResult = document.createElement('div');
    rSquaredResult.className = 'stat-result';
    
    const rSquaredTitle = document.createElement('div');
    rSquaredTitle.className = 'stat-result-title';
    rSquaredTitle.textContent = 'R-squared';
    
    const rSquaredValue = document.createElement('div');
    rSquaredValue.className = 'stat-result-value';
    rSquaredValue.textContent = rSquared.toFixed(3);
    
    const rSquaredDesc = document.createElement('div');
    rSquaredDesc.className = 'stat-result-description';
    rSquaredDesc.textContent = 'Proportion of variance explained by the regression model';
    
    rSquaredResult.appendChild(rSquaredTitle);
    rSquaredResult.appendChild(rSquaredValue);
    rSquaredResult.appendChild(rSquaredDesc);
    
    // Add results to container
    container.appendChild(equationResult);
    container.appendChild(rSquaredResult);
}

function createDistributionSummary(container, result, variable) {
    const distributions = result.distributions;
    
    // Create summary for each fuel type
    Object.entries(distributions).forEach(([fuel, stats]) => {
        const summary = document.createElement('div');
        summary.className = 'stat-result';
        
        const title = document.createElement('div');
        title.className = 'stat-result-title';
        title.textContent = fuel;
        
        const meanValue = document.createElement('div');
        meanValue.className = 'stat-result-value';
        meanValue.textContent = stats.mean.toFixed(2);
        
        const stdDevValue = document.createElement('div');
        stdDevValue.className = 'stat-result-value';
        stdDevValue.textContent = `± ${stats.stdDev.toFixed(2)}`;
        
        const desc = document.createElement('div');
        desc.className = 'stat-result-description';
        desc.textContent = `Mean ${getVariableLabel(variable)} for ${fuel} power plants`;
        
        summary.appendChild(title);
        summary.appendChild(meanValue);
        summary.appendChild(stdDevValue);
        summary.appendChild(desc);
        
        container.appendChild(summary);
    });
}

function updateStatisticalDetails(analysisType, result, variableX, variableY) {
    const detailsContainer = document.getElementById('statistical-details');
    if (!detailsContainer) return;
    
    // Clear existing details
    detailsContainer.innerHTML = '';
    
    // Create appropriate details based on analysis type
    switch (analysisType) {
        case 'correlation':
            createCorrelationDetails(detailsContainer, result, variableX, variableY);
            break;
        case 'comparison':
            createComparisonDetails(detailsContainer, result, variableX);
            break;
        case 'regression':
            createRegressionDetails(detailsContainer, result, variableX, variableY);
            break;
        case 'distribution':
            createDistributionDetails(detailsContainer, result, variableX);
            break;
        default:
            createCorrelationDetails(detailsContainer, result, variableX, variableY);
    }
}

function createCorrelationDetails(container, result, variableX, variableY) {
    const correlation = result.correlation;
    const sampleSize = result.sampleSize;
    
    // Create correlation coefficient detail
    const correlationDetail = document.createElement('div');
    correlationDetail.className = 'stat-detail';
    
    const correlationTitle = document.createElement('div');
    correlationTitle.className = 'stat-detail-title';
    correlationTitle.textContent = 'Correlation Coefficient';
    
    const correlationValue = document.createElement('div');
    correlationValue.className = 'stat-detail-value';
    correlationValue.textContent = correlation.toFixed(3);
    
    correlationDetail.appendChild(correlationTitle);
    correlationDetail.appendChild(correlationValue);
    
    // Create sample size detail
    const sampleSizeDetail = document.createElement('div');
    sampleSizeDetail.className = 'stat-detail';
    
    const sampleSizeTitle = document.createElement('div');
    sampleSizeTitle.className = 'stat-detail-title';
    sampleSizeTitle.textContent = 'Sample Size';
    
    const sampleSizeValue = document.createElement('div');
    sampleSizeValue.className = 'stat-detail-value';
    sampleSizeValue.textContent = sampleSize;
    
    sampleSizeDetail.appendChild(sampleSizeTitle);
    sampleSizeDetail.appendChild(sampleSizeValue);
    
    // Add details to container
    container.appendChild(correlationDetail);
    container.appendChild(sampleSizeDetail);
}

function createComparisonDetails(container, result, variable) {
    const labels = Object.keys(result.groupStats);
    const means = labels.map(fuel => result.groupStats[fuel].mean);
    const stdDevs = labels.map(fuel => result.groupStats[fuel].stdDev);
    
    // Create mean detail for each fuel type
    labels.forEach((fuel, i) => {
        const meanDetail = document.createElement('div');
        meanDetail.className = 'stat-detail';
        
        const meanTitle = document.createElement('div');
        meanTitle.className = 'stat-detail-title';
        meanTitle.textContent = `Mean ${getVariableLabel(variable)} for ${fuel}`;
        
        const meanValue = document.createElement('div');
        meanValue.className = 'stat-detail-value';
        meanValue.textContent = means[i].toFixed(2);
        
        meanDetail.appendChild(meanTitle);
        meanDetail.appendChild(meanValue);
        
        container.appendChild(meanDetail);
    });
    
    // Create standard deviation detail for each fuel type
    labels.forEach((fuel, i) => {
        const stdDevDetail = document.createElement('div');
        stdDevDetail.className = 'stat-detail';
        
        const stdDevTitle = document.createElement('div');
        stdDevTitle.className = 'stat-detail-title';
        stdDevTitle.textContent = `Standard Deviation of ${getVariableLabel(variable)} for ${fuel}`;
        
        const stdDevValue = document.createElement('div');
        stdDevValue.className = 'stat-detail-value';
        stdDevValue.textContent = stdDevs[i].toFixed(2);
        
        stdDevDetail.appendChild(stdDevTitle);
        stdDevDetail.appendChild(stdDevValue);
        
        container.appendChild(stdDevDetail);
    });
}

function createRegressionDetails(container, result, variableX, variableY) {
    const slope = result.slope;
    const intercept = result.intercept;
    const rSquared = result.rSquared;
    
    // Create slope detail
    const slopeDetail = document.createElement('div');
    slopeDetail.className = 'stat-detail';
    
    const slopeTitle = document.createElement('div');
    slopeTitle.className = 'stat-detail-title';
    slopeTitle.textContent = 'Slope';
    
    const slopeValue = document.createElement('div');
    slopeValue.className = 'stat-detail-value';
    slopeValue.textContent = slope.toFixed(3);
    
    slopeDetail.appendChild(slopeTitle);
    slopeDetail.appendChild(slopeValue);
    
    // Create intercept detail
    const interceptDetail = document.createElement('div');
    interceptDetail.className = 'stat-detail';
    
    const interceptTitle = document.createElement('div');
    interceptTitle.className = 'stat-detail-title';
    interceptTitle.textContent = 'Intercept';
    
    const interceptValue = document.createElement('div');
    interceptValue.className = 'stat-detail-value';
    interceptValue.textContent = intercept.toFixed(3);
    
    interceptDetail.appendChild(interceptTitle);
    interceptDetail.appendChild(interceptValue);
    
    // Create R-squared detail
    const rSquaredDetail = document.createElement('div');
    rSquaredDetail.className = 'stat-detail';
    
    const rSquaredTitle = document.createElement('div');
    rSquaredTitle.className = 'stat-detail-title';
    rSquaredTitle.textContent = 'R-squared';
    
    const rSquaredValue = document.createElement('div');
    rSquaredValue.className = 'stat-detail-value';
    rSquaredValue.textContent = rSquared.toFixed(3);
    
    rSquaredDetail.appendChild(rSquaredTitle);
    rSquaredDetail.appendChild(rSquaredValue);
    
    // Add details to container
    container.appendChild(slopeDetail);
    container.appendChild(interceptDetail);
    container.appendChild(rSquaredDetail);
}

function createDistributionDetails(container, result, variable) {
    const distributions = result.distributions;
    
    // Create mean detail for each fuel type
    Object.entries(distributions).forEach(([fuel, stats]) => {
        const meanDetail = document.createElement('div');
        meanDetail.className = 'stat-detail';
        
        const meanTitle = document.createElement('div');
        meanTitle.className = 'stat-detail-title';
        meanTitle.textContent = `Mean ${getVariableLabel(variable)} for ${fuel}`;
        
        const meanValue = document.createElement('div');
        meanValue.className = 'stat-detail-value';
        meanValue.textContent = stats.mean.toFixed(2);
        
        meanDetail.appendChild(meanTitle);
        meanDetail.appendChild(meanValue);
        
        container.appendChild(meanDetail);
    });
    
    // Create standard deviation detail for each fuel type
    Object.entries(distributions).forEach(([fuel, stats]) => {
        const stdDevDetail = document.createElement('div');
        stdDevDetail.className = 'stat-detail';
        
        const stdDevTitle = document.createElement('div');
        stdDevTitle.className = 'stat-detail-title';
        stdDevTitle.textContent = `Standard Deviation of ${getVariableLabel(variable)} for ${fuel}`;
        
        const stdDevValue = document.createElement('div');
        stdDevValue.className = 'stat-detail-value';
        stdDevValue.textContent = stats.stdDev.toFixed(2);
        
        stdDevDetail.appendChild(stdDevTitle);
        stdDevDetail.appendChild(stdDevValue);
        
        container.appendChild(stdDevDetail);
    });
}

// Export functions
function exportImage() {
    if (!window.mainChart) {
        showError('No visualization to export');
        return;
    }
    
    // Get the canvas element
    const canvas = document.getElementById('main-chart');
    if (!canvas) return;
    
    // Create a download link
    const link = document.createElement('a');
    link.download = 'power_plant_analysis.png';
    link.href = canvas.toDataURL('image/png');
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportData() {
    // Get the current analysis type and data
    const analysisType = document.getElementById('analysis-type').value;
    const variableX = document.getElementById('variable-x').value;
    const variableY = document.getElementById('variable-y').value;
    
    // Get the data to export
    let data;
    let filename;
    
    switch (analysisType) {
        case 'correlation':
        case 'regression':
            if (!window.mainChart || !window.mainChart.data.datasets[0].data) {
                showError('No data to export');
                return;
            }
            
            // Get the scatter plot data
            const points = window.mainChart.data.datasets[0].data.map(point => ({
                [getVariableLabel(variableX)]: point.x,
                [getVariableLabel(variableY)]: point.y
            }));
            
            data = points;
            filename = `${analysisType}_analysis_${variableX}_vs_${variableY}.csv`;
            break;
            
        case 'comparison':
            if (!window.mainChart || !window.mainChart.data.labels) {
                showError('No data to export');
                return;
            }
            
            // Get the bar chart data
            const labels = window.mainChart.data.labels;
            const values = window.mainChart.data.datasets[0].data;
            
            data = labels.map((label, i) => ({
                'Fuel Type': label,
                [getVariableLabel(variableX)]: values[i]
            }));
            
            filename = `comparison_analysis_${variableX}.csv`;
            break;
            
        case 'distribution':
            if (!window.mainChart || !window.mainChart.data.labels) {
                showError('No data to export');
                return;
            }
            
            // Get the histogram data
            const bins = window.mainChart.data.labels;
            const datasets = window.mainChart.data.datasets;
            
            // Create a row for each bin
            data = bins.map((bin, i) => {
                const row = { 'Bin': bin };
                
                // Add a column for each fuel type
                datasets.forEach(dataset => {
                    row[dataset.label] = dataset.data[i];
                });
                
                return row;
            });
            
            filename = `distribution_analysis_${variableX}.csv`;
            break;
            
        default:
            showError('Unknown analysis type');
            return;
    }
    
    // Convert data to CSV
    const csv = convertToCSV(data);
    
    // Create a download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Get the headers
    const headers = Object.keys(data[0]);
    
    // Create the header row
    let csv = headers.join(',') + '\n';
    
    // Add the data rows
    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            
            // Handle strings with commas
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            
            return value;
        });
        
        csv += values.join(',') + '\n';
    });
    
    return csv;
}

// UI utility functions
function showLoading() {
    // Check if loading overlay already exists
    let loadingOverlay = document.querySelector('.loading-overlay');
    
    if (!loadingOverlay) {
        // Create loading overlay
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        loadingOverlay.appendChild(spinner);
        
        // Add to visualization container
        const container = document.getElementById('visualization-container');
        if (container) {
            container.appendChild(loadingOverlay);
        }
    }
}

function hideLoading() {
    // Remove loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Add a link to the statistics page in the main index.html
document.addEventListener('DOMContentLoaded', function() {
    // Add a link to the statistics page in the main index.html if we're on the map page
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
        const mapContainer = document.getElementById('map');
        
        if (mapContainer) {
            const statsLink = document.createElement('a');
            statsLink.href = 'statistics.html';
            statsLink.className = 'stats-link';
            statsLink.innerHTML = '<i class="fas fa-chart-bar"></i> Statistics';
            
            document.body.appendChild(statsLink);
            
            // Add styles for the link
            const style = document.createElement('style');
            style.textContent = `
                .stats-link {
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: white;
                    padding: 8px 15px;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                    text-decoration: none;
                    color: #333;
                    font-weight: 500;
                    z-index: 1000;
                }
                
                .stats-link:hover {
                    background-color: #f0f0f0;
                }
                
                body.dark-theme .stats-link {
                    background-color: #333;
                    color: #f0f0f0;
                }
                
                body.dark-theme .stats-link:hover {
                    background-color: #444;
                }
            `;
            
            document.head.appendChild(style);
        }
    }
});

// Initialize the map
const map = L.map('map', {
    preferCanvas: true, // Use Canvas renderer for better performance with many markers
    zoomSnap: 0.5, // Allow fractional zoom for smoother transitions
    zoomDelta: 0.5, // Smaller increments for smoother zoom
    wheelDebounceTime: 100, // Debounce wheel events
    wheelPxPerZoomLevel: 120 // More pixels per zoom level for smoother zoom with wheel
}).setView([70, -170], 4); // Centered on Alaska/Bering Strait region for night lights data

// Global theme state
let isDarkTheme = true; // Start with dark theme active

// --- Use CartoDB Dark Matter Base Map for better night lights visibility --- 
const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 20
}).addTo(map); // Add it to the map initially

// Keep the light basemap as an option
const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 20
});

// Define base map options
const baseMaps = {
    "Dark Theme": darkMatter,
    "Light Theme": positron
};

// Function to update the entire UI based on theme
function updateTheme(dark) {
    isDarkTheme = dark;
    
    // Add or remove dark-theme class from body
    if (dark) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
    
    // Update document title color
    const title = document.querySelector('h1');
    if (title) {
        title.style.color = dark ? '#f0f0f0' : '#333333';
    }
    
    // Update any open popups
    document.querySelectorAll('.leaflet-popup-content-wrapper, .leaflet-popup-tip').forEach(element => {
        if (dark) {
            element.style.backgroundColor = '#2a2a2a';
            element.style.color = '#f0f0f0';
        } else {
            element.style.backgroundColor = '#ffffff';
            element.style.color = '#333333';
        }
    });
    
    // Update popup content
    document.querySelectorAll('.power-plant-popup').forEach(popup => {
        if (dark) {
            popup.classList.add('dark-theme');
            
            // Update text colors
            popup.querySelectorAll('.title-container h3').forEach(el => el.style.color = '#f0f0f0');
            popup.querySelectorAll('.fuel-type').forEach(el => el.style.color = '#cccccc');
            popup.querySelectorAll('.info-label').forEach(el => el.style.color = '#cccccc');
            popup.querySelectorAll('.info-value').forEach(el => el.style.color = '#f0f0f0');
            popup.querySelectorAll('.capacity-indicator').forEach(el => el.style.backgroundColor = '#3a3a3a');
            popup.querySelectorAll('.capacity-bar:not(.active)').forEach(el => el.style.backgroundColor = '#555555');
            popup.querySelectorAll('.capacity-label').forEach(el => el.style.color = '#cccccc');
            popup.querySelectorAll('.fuel-info').forEach(el => {
                el.style.color = '#cccccc';
                el.style.borderTopColor = '#444444';
            });
        } else {
            popup.classList.remove('dark-theme');
            
            // Reset to light theme colors
            popup.querySelectorAll('.title-container h3').forEach(el => el.style.color = '#333333');
            popup.querySelectorAll('.fuel-type').forEach(el => el.style.color = '#666666');
            popup.querySelectorAll('.info-label').forEach(el => el.style.color = '#555555');
            popup.querySelectorAll('.info-value').forEach(el => el.style.color = '#333333');
            popup.querySelectorAll('.capacity-indicator').forEach(el => el.style.backgroundColor = '#f5f5f5');
            popup.querySelectorAll('.capacity-bar:not(.active)').forEach(el => el.style.backgroundColor = '#dddddd');
            popup.querySelectorAll('.capacity-label').forEach(el => el.style.color = '#777777');
            popup.querySelectorAll('.fuel-info').forEach(el => {
                el.style.color = '#666666';
                el.style.borderTopColor = '#eeeeee';
            });
        }
    });
    
    // Immediately apply dark theme to info box
    document.querySelectorAll('.data-coverage-info .info-box').forEach(box => {
        if (dark) {
            box.classList.add('dark-theme');
        } else {
            box.classList.remove('dark-theme');
        }
    });
    
    // Update leaflet controls
    document.querySelectorAll('.leaflet-control-layers, .leaflet-bar').forEach(control => {
        if (dark) {
            control.classList.add('dark-theme');
        } else {
            control.classList.remove('dark-theme');
        }
    });
}

// Listen for base layer change events
map.on('baselayerchange', function(e) {
    // Check if the dark layer is active
    const isDark = e.name === "Dark Theme";
    updateTheme(isDark);
});

// Initial theme setup
updateTheme(isDarkTheme);

// --- Color mapping for Fuel Types ---
const fuelColors = {
    'Hydro': '#0077be',       // Blue
    'Gas': '#f28c28',         // Orange
    'Oil': '#a0522d',         // Brown
    'Coal': '#36454f',         // Dark Gray/Charcoal
    'Nuclear': '#e60000',     // Red
    'Solar': '#ffda63',       // Yellow
    'Wind': '#66ccff',        // Light Blue
    'Geothermal': '#bf40bf',  // Purple
    'Biomass': '#50c878',     // Green
    'Waste': '#808080',       // Gray
    'Other': '#cccccc',       // Light Gray
    'Storage': '#c8a2c8',     // Lilac
    'Cogeneration': '#ffb3ba' // Light Pink
};

// Fuel type icons (Font Awesome classes)
const fuelIcons = {
    'Hydro': 'fa-water',
    'Gas': 'fa-fire',
    'Oil': 'fa-oil-can',
    'Coal': 'fa-industry',
    'Nuclear': 'fa-atom',
    'Solar': 'fa-sun',
    'Wind': 'fa-wind',
    'Geothermal': 'fa-temperature-high',
    'Biomass': 'fa-leaf',
    'Waste': 'fa-trash',
    'Other': 'fa-question',
    'Storage': 'fa-battery-full',
    'Cogeneration': 'fa-cogs'
};

// Fuel type descriptions for tooltips
const fuelDescriptions = {
    'Hydro': 'Hydroelectric power from flowing water',
    'Gas': 'Natural gas-fired power plant',
    'Oil': 'Oil-fired power plant',
    'Coal': 'Coal-fired power plant',
    'Nuclear': 'Nuclear fission power plant',
    'Solar': 'Solar photovoltaic or concentrated solar power',
    'Wind': 'Wind turbine power generation',
    'Geothermal': 'Geothermal heat-based power generation',
    'Biomass': 'Organic material combustion for power',
    'Waste': 'Waste incineration for power generation',
    'Other': 'Other or unspecified power generation type',
    'Storage': 'Energy storage facility',
    'Cogeneration': 'Combined heat and power generation'
};

function getFuelColor(fuelType) {
    return fuelColors[fuelType] || fuelColors['Other'];
}

function getFuelIcon(fuelType) {
    return fuelIcons[fuelType] || fuelIcons['Other'];
}

function getFuelDescription(fuelType) {
    return fuelDescriptions[fuelType] || 'Power generation facility';
}

// Create an enhanced popup with more information and visual elements
function createEnhancedPopup(plant) {
    // Calculate capacity indicator bars (5 bars max)
    let capacityBars = '';
    const maxBars = 5;
    
    // Determine number of bars based on capacity logarithmically
    let barCount = 1;
    if (plant.capacity > 0) {
        // Log scale: 1 bar for <10MW, 5 bars for >1000MW
        barCount = Math.min(maxBars, Math.ceil(Math.log10(plant.capacity) / 0.6));
    }
    
    // Create the capacity bars HTML
    for (let i = 0; i < maxBars; i++) {
        if (i < barCount) {
            capacityBars += `<div class="capacity-bar active" style="background-color: ${plant.color};"></div>`;
        } else {
            capacityBars += `<div class="capacity-bar"></div>`;
        }
    }
    
    // Get fuel icon and color
    const fuelIcon = getFuelIcon(plant.primary_fuel || plant.fuel);
    const fuelColor = getFuelColor(plant.primary_fuel || plant.fuel);
    const fuelDesc = getFuelDescription(plant.primary_fuel || plant.fuel);
    
    return `
    <div class="power-plant-popup">
        <div class="popup-header">
            <div class="icon-container" style="background-color: ${plant.color || fuelColor};">
                <i class="${fuelIcon}"></i>
            </div>
            <div class="title-container">
                <h3>${plant.name}</h3>
                <span class="fuel-type">${(plant.primary_fuel || plant.fuel).toUpperCase()}</span>
            </div>
        </div>
        <div class="popup-body">
            <div class="info-row">
                <div class="info-label">Capacity:</div>
                <div class="info-value">${plant.capacity.toFixed(1)} MW</div>
            </div>
            <div class="info-row">
                <div class="info-label">Country:</div>
                <div class="info-value">${plant.country}</div>
            </div>
            <div class="capacity-indicator">
                <div class="capacity-bars">
                    ${capacityBars}
                </div>
                <div class="capacity-label">Capacity: ${plant.capacity.toFixed(1)} MW</div>
            </div>
            <div class="fuel-info">
                <div class="fuel-description">${fuelDesc}</div>
            </div>
        </div>
    </div>
    `;
}

// --- Function to determine circle radius based on capacity and zoom level ---
// Using logarithmic scaling for better representation across different capacities
function calculateRadiusPixels(capacityMw, zoomLevel) {
    // Base size factors
    const minRadius = 1.5;  // Minimum radius in pixels (smaller base size)
    const maxRadius = 8;    // Maximum radius in pixels (reduced from 12)
    
    // Adjust radius based on zoom level
    let zoomFactor;
    if (zoomLevel <= 2) {
        // At lowest zoom levels, make dots much smaller
        zoomFactor = 0.6;
    } else if (zoomLevel <= 3) {
        zoomFactor = 0.8;
    } else if (zoomLevel <= 5) {
        zoomFactor = 1.0;
    } else if (zoomLevel <= 7) {
        zoomFactor = 1.2;
    } else {
        // At high zoom levels, slightly larger
        zoomFactor = 1.5;
    }
    
    // Calculate radius based on capacity (logarithmic scale)
    // This gives a more balanced visual representation across different capacities
    let radius;
    if (capacityMw <= 0) {
        radius = minRadius; // Minimum size for plants with unknown capacity
    } else {
        // Logarithmic scaling to handle wide range of capacities
        const logCapacity = Math.log10(Math.max(1, capacityMw));
        const normalizedCapacity = logCapacity / Math.log10(10000); // Normalize to 0-1 range (1-10000 MW)
        radius = minRadius + normalizedCapacity * (maxRadius - minRadius);
    }
    
    return radius * zoomFactor;
}

// --- Initialize Layer Group for Power Plants ---
const powerPlantLayer = L.layerGroup(); 
let allPowerPlants = []; // Store all power plants for filtering by zoom
let gridCells = {}; // For storing representative dots in grid cells
let markersCache = {}; // Cache for markers to reduce recreation
let isRendering = false; // Flag to track ongoing rendering
let pendingRenderRequest = null; // Store pending render request
let lastZoom = 2; // Track last zoom level to optimize transitions

// --- Efficient throttle/debounce functions ---
function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

function debounce(func, wait, immediate = false) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// --- Load Power Plant Data (CSV) ---
async function loadPowerPlants() {
    try {
        // Relative path to the CSV file
        const response = await fetch('globalpowerplantdatabasev130/global_power_plant_database.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvData = await response.text();

        // Basic CSV parsing
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const latIndex = headers.indexOf('latitude');
        const lonIndex = headers.indexOf('longitude');
        const nameIndex = headers.indexOf('name');
        const capacityIndex = headers.indexOf('capacity_mw');
        const countryIndex = headers.indexOf('country');
        const fuelIndex = headers.indexOf('primary_fuel'); // Find fuel column index

        if (latIndex === -1 || lonIndex === -1 || fuelIndex === -1) {
            const missing = [latIndex === -1 ? 'latitude' : '', lonIndex === -1 ? 'longitude' : '', fuelIndex === -1 ? 'primary_fuel' : ''].filter(Boolean).join(', ');
            console.error(`Could not find required columns (${missing}) in CSV.`);
            alert(`Error: Could not find required columns (${missing}) in power plant data.`);
            return;
        }
        // Note: countryIndex check removed as it's not strictly required for this visualization

        console.log(`Found ${lines.length - 1} records. Processing...`);

        let markerCount = 0;
        
        // Process all plants but don't add to map yet
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            // Check if line has enough columns
            if (values.length > Math.max(latIndex, lonIndex, nameIndex, capacityIndex, countryIndex, fuelIndex)) { 
                const lat = parseFloat(values[latIndex]);
                const lon = parseFloat(values[lonIndex]);
                const name = values[nameIndex].trim();
                const capacityStr = values[capacityIndex].trim();
                const capacity = parseFloat(capacityStr) || 0;
                const country = countryIndex > -1 ? values[countryIndex].trim() : 'N/A'; 
                const fuel = values[fuelIndex].trim();

                if (!isNaN(lat) && !isNaN(lon)) {
                    // Store the plant data for later filtering
                    allPowerPlants.push({
                        latitude: lat,
                        longitude: lon,
                        name,
                        capacity,
                        capacityStr,
                        country,
                        fuel,
                        color: getFuelColor(fuel)
                    });
                    markerCount++;
                }
            }
            // Provide feedback every 5000 markers processed
            if (i % 5000 === 0) {
                console.log(`Processed ${i} records...`);
            }
        }

        console.log(`Processed ${markerCount} power plants. Ready for display based on zoom level.`);
        
        // Initial render based on current zoom
        updateVisiblePlants();
        
        // Add the layer to the map
        map.addLayer(powerPlantLayer);

    } catch (error) {
        console.error('Error loading or parsing power plant data:', error);
        alert('Failed to load power plant data. Check console for details.');
    }
}

// Function to update visible plants based on zoom level
function updateVisiblePlants() {
    const currentZoom = map.getZoom();
    
    // Cancel any ongoing rendering
    if (pendingRenderRequest) {
        clearTimeout(pendingRenderRequest);
        pendingRenderRequest = null;
    }
    
    // During zoom transitions, use a lightweight update
    if (isRendering && Math.abs(currentZoom - lastZoom) < 1) {
        // Skip full update during small zoom changes while already rendering
        console.log("Skipping render during zoom transition");
        return;
    }
    
    // Set rendering flag
    isRendering = true;
    
    // Use a short delay to batch rapid zoom/pan changes
    pendingRenderRequest = setTimeout(() => {
        // Clear the layer in a deferred way for better performance
        requestAnimationFrame(() => {
            powerPlantLayer.clearLayers();
            
            // Track the zoom level we're rendering for
            lastZoom = currentZoom;
            
            // Perform appropriate rendering based on zoom level
            if (currentZoom <= 3) {
                displayGridRepresentatives(currentZoom);
            } else {
                displayFilteredPlants(currentZoom);
            }
            
            // Reset rendering flag when done
            isRendering = false;
        });
    }, 150); // Short delay to batch changes
}

// Generate a unique key for a marker based on its properties
function getMarkerKey(plant, zoomLevel) {
    return `${plant.latitude.toFixed(3)}:${plant.longitude.toFixed(3)}:${zoomLevel <= 3 ? 'grid' : 'direct'}`;
}

// Display plants using a grid-based approach to reduce overlap
function displayGridRepresentatives(zoomLevel) {
    // Use Set for faster lookups and to track markers to keep
    const activeMarkerKeys = new Set();
    
    // Clear previous grid but keep the object to avoid garbage collection
    const newGridCells = {};
    
    // Determine grid size based on zoom level
    // Lower zoom = larger grid cells = less dots
    const gridSize = zoomLevel <= 2 ? 8 : 5; // In degrees
    
    // Group plants by grid cell and find representatives
    allPowerPlants.forEach(plant => {
        // Skip very small plants at low zoom levels
        if (zoomLevel <= 2 && plant.capacity < 500) return;
        if (zoomLevel === 3 && plant.capacity < 200) return;
        
        // Calculate grid cell coordinates (using efficient math operations)
        const cellX = Math.floor(plant.longitude / gridSize);
        const cellY = Math.floor(plant.latitude / gridSize);
        const cellKey = `${cellX}:${cellY}`;
        
        // Add to cell or update if higher capacity
        if (!newGridCells[cellKey] || newGridCells[cellKey].capacity < plant.capacity) {
            newGridCells[cellKey] = plant;
        }
    });
    
    // Update grid cells reference
    gridCells = newGridCells;
    
    // Batch DOM operations by collecting all markers first
    const markersToAdd = [];
    
    // Create markers for each cell's representative plant or reuse existing ones
    Object.values(gridCells).forEach(plant => {
        const markerKey = getMarkerKey(plant, zoomLevel);
        activeMarkerKeys.add(markerKey);
        
        let circle;
        if (markersCache[markerKey]) {
            // Reuse existing marker
            circle = markersCache[markerKey];
            // Update radius if needed
            const newRadius = calculateRadiusPixels(plant.capacity, zoomLevel);
            if (circle.options.radius !== newRadius) {
                circle.setRadius(newRadius);
            }
        } else {
            // Create new marker
            const radiusPixels = calculateRadiusPixels(plant.capacity, zoomLevel);
            circle = L.circleMarker([plant.latitude, plant.longitude], {
                radius: radiusPixels,
                fillColor: plant.color,
                color: plant.color,
                weight: 1,
                opacity: 0.95,
                fillOpacity: 0.8
            });
            
            // Add enhanced popup
            circle.bindPopup(createEnhancedPopup(plant), {
                maxWidth: 300,
                className: 'power-plant-popup-container'
            });
            
            // Cache the marker
            markersCache[markerKey] = circle;
        }
        
        markersToAdd.push(circle);
    });
    
    // Batch add all markers at once
    if (markersToAdd.length > 0) {
        // Use a document fragment-like approach by adding to layer group in one operation
        const tempGroup = L.layerGroup(markersToAdd);
        powerPlantLayer.addLayer(tempGroup);
    }
    
    // Clean up unused markers from cache (memory optimization)
    // But only do this periodically to avoid excessive garbage collection
    if (Math.random() < 0.1) { // 10% chance to run cleanup
        Object.keys(markersCache).forEach(key => {
            if (!activeMarkerKeys.has(key)) {
                delete markersCache[key];
            }
        });
    }
    
    console.log(`Showing ${markersToAdd.length} representative plants at zoom level ${zoomLevel}`);
}

// Display filtered plants based on capacity thresholds
function displayFilteredPlants(zoomLevel) {
    // Clear existing markers
    powerPlantLayer.clearLayers();
    
    // Determine capacity threshold based on zoom level
    let capacityThreshold;
    if (zoomLevel <= 2) {
        capacityThreshold = 1000; // Only very large plants at global view
    } else if (zoomLevel <= 3) {
        capacityThreshold = 500; // Large plants at continental view
    } else if (zoomLevel <= 4) {
        capacityThreshold = 200; // Medium-large plants at country view
    } else if (zoomLevel <= 5) {
        capacityThreshold = 100;  // Medium plants at regional view
    } else if (zoomLevel <= 6) {
        capacityThreshold = 50;  // Medium-small plants at state view
    } else {
        capacityThreshold = 0;   // All plants at local view
    }
    
    // Filter plants based on capacity threshold
    const filteredPlants = allPowerPlants.filter(plant => plant.capacity >= capacityThreshold);
    
    // Get the current theme state for marker styling
    const isDark = document.body.classList.contains('dark-theme');
    
    // Create markers for filtered plants
    filteredPlants.forEach(plant => {
        // Calculate marker radius based on capacity and zoom level
        const radius = calculateRadiusPixels(plant.capacity, zoomLevel);
        
        // Create circle marker with appropriate styling
        const marker = L.circleMarker([plant.latitude, plant.longitude], {
            radius: radius,
            fillColor: plant.color,
            color: isDark ? 'rgba(0,0,0,0)' : '#ffffff', // No stroke in dark mode, white in light mode
            weight: isDark ? 0 : 1,                      // No stroke weight in dark mode
            opacity: isDark ? 0 : 0.8,                   // No stroke opacity in dark mode
            fillOpacity: 0.9                             // High fill opacity for better visibility
        });
        
        // Add popup with plant information
        const popupContent = createEnhancedPopup(plant);
        const popup = L.popup({
            className: 'power-plant-popup-container',
            closeButton: true,
            closeOnClick: true,
            autoClose: true,
            minWidth: 280,
            maxWidth: 320
        }).setContent(popupContent);
        
        marker.bindPopup(popup);
        
        // Add event listeners for hover effects
        marker.on('mouseover', function() {
            this.setStyle({
                fillOpacity: 1.0,
                radius: radius * 1.2  // Increase size slightly on hover
            });
        });
        
        marker.on('mouseout', function() {
            this.setStyle({
                fillOpacity: 0.9,
                radius: radius
            });
        });
        
        // Add marker to layer
        powerPlantLayer.addLayer(marker);
    });
    
    // Log the number of plants displayed
    console.debug(`Displaying ${filteredPlants.length} power plants (zoom level ${zoomLevel})`);
}

// Define the overlays map with just power plants
const overlayMaps = {
    "Power Plants": powerPlantLayer,
    "Light Pollution": L.tileLayer('http://127.0.0.1:8081/tiles/{z}/{x}/{y}.png?color=true&min=0.1&max=100&opacity=0.7', {
        attribution: 'VIIRS 2024 Night Lights',
        opacity: 0.7,
        maxZoom: 10,
        updateWhenIdle: true,     // Update tiles only when panning is done
        updateWhenZooming: false, // Don't update while zooming
        keepBuffer: 2,            // Reduced buffer size for better performance
        maxNativeZoom: 7,         // Limit maximum native zoom for performance
        crossOrigin: 'anonymous',
        detectRetina: false       // Disable retina detection for better performance
    })
};

// Add both base maps and overlay controls
L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

// Center the map on a more global view since we're only showing power plants
map.setView([30, 0], 3);

// --- Add efficient event handling ---
// Optimize map event handling for performance
// Use throttle for moveend which fires very frequently during panning
map.on('moveend', throttle(function() {
    if (!map.getZoom) return; // Safety check
    updateVisiblePlants();
}, 200));

// Use debounce for zoomend to ensure we only update after zoom settles
map.on('zoomend', debounce(updateVisiblePlants, 200));

// Add a handler for when map is moving to reduce rendering during active interaction
map.on('zoomanim', function() {
    // Cancel pending renders during active zoom
    if (pendingRenderRequest) {
        clearTimeout(pendingRenderRequest);
        pendingRenderRequest = null;
    }
});

// Trigger an initial update to ensure everything is visible
updateVisiblePlants();

// --- Control Panel Implementation ---
// Create a control panel for filtering and statistics
function createControlPanel() {
    // Create the control panel container
    const controlPanel = document.createElement('div');
    controlPanel.className = `control-panel ${isDarkTheme ? 'dark-theme' : ''}`;
    controlPanel.id = 'control-panel';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'control-panel-header';
    
    const title = document.createElement('h2');
    title.className = 'control-panel-title';
    title.textContent = 'Power Plant Dashboard';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'control-panel-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    toggleBtn.title = 'Toggle Panel';
    toggleBtn.onclick = function() {
        toggleControlPanel();
        return false; // Prevent event propagation
    };
    
    header.appendChild(title);
    header.appendChild(toggleBtn);
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'control-panel-content';
    
    // Add filtering section
    const filterSection = createFilterSection();
    content.appendChild(filterSection);
    
    // Add statistics section
    const statsSection = createStatsSection();
    content.appendChild(statsSection);
    
    // Add graphs section
    const graphsSection = createGraphsSection();
    content.appendChild(graphsSection);
    
    // Assemble the panel
    controlPanel.appendChild(header);
    controlPanel.appendChild(content);
    
    // Add to document
    document.body.appendChild(controlPanel);
    
    // Initialize the filter values
    initializeFilters();
    
    // Update statistics and graphs
    updateStatistics();
}

// Toggle the control panel open/closed
function toggleControlPanel() {
    const panel = document.getElementById('control-panel');
    const isCollapsed = panel.classList.contains('control-panel-collapsed');
    
    // Toggle the collapsed state
    if (isCollapsed) {
        // If it's collapsed, expand it
        panel.classList.remove('control-panel-collapsed');
        panel.style.width = '320px';
        
        // Change the icon to point right (indicating it can be collapsed)
        const toggleBtn = panel.querySelector('.control-panel-toggle i');
        toggleBtn.className = 'fas fa-chevron-right';
    } else {
        // If it's expanded, collapse it
        panel.classList.add('control-panel-collapsed');
        panel.style.width = '50px';
        
        // Change the icon to point left (indicating it can be expanded)
        const toggleBtn = panel.querySelector('.control-panel-toggle i');
        toggleBtn.className = 'fas fa-chevron-left';
    }
}

// Create the filtering section
function createFilterSection() {
    const section = document.createElement('div');
    section.className = 'control-panel-section';
    
    const title = document.createElement('h3');
    title.className = 'control-panel-section-title';
    title.textContent = 'Filters';
    section.appendChild(title);
    
    // Fuel type filter
    const fuelGroup = document.createElement('div');
    fuelGroup.className = 'filter-group';
    
    const fuelLabel = document.createElement('label');
    fuelLabel.className = 'filter-label';
    fuelLabel.textContent = 'Fuel Type';
    fuelGroup.appendChild(fuelLabel);
    
    const fuelOptions = document.createElement('div');
    fuelOptions.className = 'filter-options';
    
    // Add checkbox for each fuel type
    Object.entries(fuelColors).forEach(([fuel, color]) => {
        const checkbox = document.createElement('div');
        checkbox.className = 'filter-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `filter-${fuel.toLowerCase()}`;
        input.value = fuel;
        input.checked = true;
        input.dataset.filterType = 'fuel';
        
        const label = document.createElement('label');
        label.htmlFor = `filter-${fuel.toLowerCase()}`;
        
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'fuel-indicator';
        colorIndicator.style.backgroundColor = color;
        
        label.appendChild(colorIndicator);
        label.appendChild(document.createTextNode(fuel));
        
        checkbox.appendChild(input);
        checkbox.appendChild(label);
        fuelOptions.appendChild(checkbox);
    });
    
    fuelGroup.appendChild(fuelOptions);
    section.appendChild(fuelGroup);
    
    // Capacity range filter
    const capacityGroup = document.createElement('div');
    capacityGroup.className = 'filter-group';
    
    const capacityLabel = document.createElement('label');
    capacityLabel.className = 'filter-label';
    capacityLabel.textContent = 'Capacity Range (MW)';
    capacityGroup.appendChild(capacityLabel);
    
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'capacity-slider';
    sliderContainer.className = 'range-slider';
    capacityGroup.appendChild(sliderContainer);
    
    const rangeValues = document.createElement('div');
    rangeValues.className = 'range-filter-values';
    
    const minValue = document.createElement('span');
    minValue.id = 'capacity-min';
    minValue.textContent = '0 MW';
    
    const maxValue = document.createElement('span');
    maxValue.id = 'capacity-max';
    maxValue.textContent = '10,000+ MW';
    
    rangeValues.appendChild(minValue);
    rangeValues.appendChild(maxValue);
    capacityGroup.appendChild(rangeValues);
    
    section.appendChild(capacityGroup);
    
    // Country filter (dropdown)
    const countryGroup = document.createElement('div');
    countryGroup.className = 'filter-group';
    
    const countryLabel = document.createElement('label');
    countryLabel.className = 'filter-label';
    countryLabel.textContent = 'Country';
    countryGroup.appendChild(countryLabel);
    
    const countrySelect = document.createElement('select');
    countrySelect.id = 'country-filter';
    countrySelect.style.width = '100%';
    countrySelect.style.padding = '5px';
    
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Countries';
    countrySelect.appendChild(allOption);
    
    countryGroup.appendChild(countrySelect);
    section.appendChild(countryGroup);
    
    // Apply filters button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'apply-filters-btn';
    applyBtn.textContent = 'Apply Filters';
    applyBtn.onclick = applyFilters;
    section.appendChild(applyBtn);
    
    return section;
}

// Create the statistics section
function createStatsSection() {
    const section = document.createElement('div');
    section.className = 'control-panel-section';
    
    const title = document.createElement('h3');
    title.className = 'control-panel-section-title';
    title.textContent = 'Statistics';
    section.appendChild(title);
    
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    
    // Total plants stat
    const totalBox = createStatBox('total-plants', 'Total Plants', '0');
    statsContainer.appendChild(totalBox);
    
    // Total capacity stat
    const capacityBox = createStatBox('total-capacity', 'Total Capacity', '0 GW');
    statsContainer.appendChild(capacityBox);
    
    // Most common fuel type
    const fuelBox = createStatBox('common-fuel', 'Most Common Fuel', '-');
    statsContainer.appendChild(fuelBox);
    
    // Average plant size
    const avgBox = createStatBox('avg-capacity', 'Avg. Capacity', '0 MW');
    statsContainer.appendChild(avgBox);
    
    section.appendChild(statsContainer);
    return section;
}

// Create a stat box
function createStatBox(id, label, value) {
    const box = document.createElement('div');
    box.className = 'stat-box';
    
    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.id = id;
    valueEl.textContent = value;
    
    const labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    
    box.appendChild(valueEl);
    box.appendChild(labelEl);
    
    return box;
}

// Create the graphs section
function createGraphsSection() {
    const section = document.createElement('div');
    section.className = 'control-panel-section';
    
    const title = document.createElement('h3');
    title.className = 'control-panel-section-title';
    title.textContent = 'Graphs';
    section.appendChild(title);
    
    // Fuel type distribution graph
    const fuelGraphTitle = document.createElement('div');
    fuelGraphTitle.className = 'filter-label';
    fuelGraphTitle.textContent = 'Power Plants by Fuel Type';
    section.appendChild(fuelGraphTitle);
    
    const fuelGraphContainer = document.createElement('div');
    fuelGraphContainer.className = 'graph-container';
    
    const fuelCanvas = document.createElement('canvas');
    fuelCanvas.id = 'fuel-chart';
    fuelGraphContainer.appendChild(fuelCanvas);
    section.appendChild(fuelGraphContainer);
    
    // Capacity distribution graph
    const capacityGraphTitle = document.createElement('div');
    capacityGraphTitle.className = 'filter-label';
    capacityGraphTitle.textContent = 'Capacity Distribution';
    section.appendChild(capacityGraphTitle);
    
    const capacityGraphContainer = document.createElement('div');
    capacityGraphContainer.className = 'graph-container';
    
    const capacityCanvas = document.createElement('canvas');
    capacityCanvas.id = 'capacity-chart';
    capacityGraphContainer.appendChild(capacityCanvas);
    section.appendChild(capacityGraphContainer);
    
    return section;
}

// Initialize filters with data from the power plants
function initializeFilters() {
    // Wait for power plant data to be loaded
    if (allPowerPlants.length === 0) {
        setTimeout(initializeFilters, 500);
        return;
    }
    
    // Get min and max capacity for the slider
    let minCapacity = Infinity;
    let maxCapacity = 0;
    const countries = new Set();
    
    allPowerPlants.forEach(plant => {
        if (plant.capacity > 0 && plant.capacity < minCapacity) {
            minCapacity = plant.capacity;
        }
        if (plant.capacity > maxCapacity) {
            maxCapacity = plant.capacity;
        }
        if (plant.country) {
            countries.add(plant.country);
        }
    });
    
    // Round values for better UX
    minCapacity = Math.max(1, Math.floor(minCapacity));
    maxCapacity = Math.ceil(maxCapacity / 1000) * 1000;
    
    // Initialize capacity slider
    const slider = document.getElementById('capacity-slider');
    if (slider && window.noUiSlider) {
        noUiSlider.create(slider, {
            start: [minCapacity, maxCapacity],
            connect: true,
            range: {
                'min': minCapacity,
                '25%': 100,
                '50%': 500,
                '75%': 1000,
                'max': maxCapacity
            },
            format: {
                to: value => Math.round(value),
                from: value => Math.round(value)
            }
        });
        
        // Update the displayed values
        slider.noUiSlider.on('update', (values, handle) => {
            const minDisplay = document.getElementById('capacity-min');
            const maxDisplay = document.getElementById('capacity-max');
            
            if (minDisplay && maxDisplay) {
                minDisplay.textContent = `${values[0]} MW`;
                maxDisplay.textContent = `${values[1]} MW`;
            }
        });
    }
    
    // Populate country dropdown
    const countrySelect = document.getElementById('country-filter');
    if (countrySelect) {
        // Sort countries alphabetically
        const sortedCountries = Array.from(countries).sort();
        
        sortedCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }
    
    // Initialize charts
    initializeCharts();
}

// Initialize the charts
function initializeCharts() {
    createFuelTypeChart();
    createCapacityChart();
}

// Create the fuel type distribution chart
function createFuelTypeChart() {
    const ctx = document.getElementById('fuel-chart');
    if (!ctx || !window.Chart) return;
    
    // Count plants by fuel type
    const fuelCounts = {};
    allPowerPlants.forEach(plant => {
        const fuel = plant.primary_fuel || plant.fuel;
        fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
    });
    
    // Prepare data for chart
    const labels = Object.keys(fuelCounts);
    const data = labels.map(fuel => fuelCounts[fuel]);
    const colors = labels.map(fuel => fuelColors[fuel] || '#cccccc');
    
    // Create chart
    window.fuelChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
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
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = Math.round((value / allPowerPlants.length) * 100);
                            return `${label}: ${value} plants (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Create the capacity distribution chart
function createCapacityChart() {
    const ctx = document.getElementById('capacity-chart');
    if (!ctx || !window.Chart) return;
    
    // Define capacity ranges
    const ranges = [
        { min: 0, max: 100, label: '0-100 MW' },
        { min: 100, max: 500, label: '100-500 MW' },
        { min: 500, max: 1000, label: '500-1000 MW' },
        { min: 1000, max: 2000, label: '1-2 GW' },
        { min: 2000, max: 5000, label: '2-5 GW' },
        { min: 5000, max: Infinity, label: '5+ GW' }
    ];
    
    // Count plants in each range
    const rangeCounts = ranges.map(range => ({
        ...range,
        count: allPowerPlants.filter(plant => 
            plant.capacity >= range.min && plant.capacity < range.max
        ).length
    }));
    
    // Prepare data for chart
    const labels = rangeCounts.map(range => range.label);
    const data = rangeCounts.map(range => range.count);
    
    // Create chart
    window.capacityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Plants',
                data: data,
                backgroundColor: isDarkTheme ? '#4CAF50' : '#4CAF50',
                borderColor: isDarkTheme ? '#388E3C' : '#388E3C',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: isDarkTheme ? '#f0f0f0' : '#666666'
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

// Apply the selected filters
function applyFilters() {
    // Get selected fuel types
    const selectedFuels = Array.from(document.querySelectorAll('input[data-filter-type="fuel"]:checked'))
        .map(input => input.value);
    
    // Get capacity range
    const slider = document.getElementById('capacity-slider');
    const capacityRange = slider && slider.noUiSlider ? 
        slider.noUiSlider.get() : [0, Infinity];
    
    // Get selected country
    const countrySelect = document.getElementById('country-filter');
    const selectedCountry = countrySelect ? countrySelect.value : '';
    
    // Apply filters to the map
    filterPowerPlants(selectedFuels, capacityRange, selectedCountry);
    
    // Update statistics based on filtered plants
    updateStatistics(selectedFuels, capacityRange, selectedCountry);
}

// Filter power plants based on selected criteria
function filterPowerPlants(fuels, capacityRange, country) {
    // Store the filter criteria for use in updateVisiblePlants
    window.activeFilters = {
        fuels: fuels,
        minCapacity: parseFloat(capacityRange[0]),
        maxCapacity: parseFloat(capacityRange[1]),
        country: country
    };
    
    // Update the map
    updateVisiblePlants();
}

// Update the statistics based on filtered plants
function updateStatistics(fuels, capacityRange, country) {
    // Get filtered plants
    let filteredPlants = allPowerPlants;
    
    if (fuels && fuels.length > 0) {
        filteredPlants = filteredPlants.filter(plant => 
            fuels.includes(plant.primary_fuel || plant.fuel)
        );
    }
    
    if (capacityRange) {
        filteredPlants = filteredPlants.filter(plant => 
            plant.capacity >= capacityRange[0] && plant.capacity <= capacityRange[1]
        );
    }
    
    if (country) {
        filteredPlants = filteredPlants.filter(plant => 
            plant.country === country
        );
    }
    
    // Update statistics
    const totalPlants = document.getElementById('total-plants');
    if (totalPlants) {
        totalPlants.textContent = filteredPlants.length.toLocaleString();
    }
    
    const totalCapacity = document.getElementById('total-capacity');
    if (totalCapacity) {
        const sum = filteredPlants.reduce((acc, plant) => acc + plant.capacity, 0);
        totalCapacity.textContent = (sum / 1000).toFixed(1) + ' GW';
    }
    
    const commonFuel = document.getElementById('common-fuel');
    if (commonFuel) {
        const fuelCounts = {};
        filteredPlants.forEach(plant => {
            const fuel = plant.primary_fuel || plant.fuel;
            fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
        });
        
        let maxFuel = '-';
        let maxCount = 0;
        
        Object.entries(fuelCounts).forEach(([fuel, count]) => {
            if (count > maxCount) {
                maxFuel = fuel;
                maxCount = count;
            }
        });
        
        commonFuel.textContent = maxFuel;
    }
    
    const avgCapacity = document.getElementById('avg-capacity');
    if (avgCapacity) {
        const validPlants = filteredPlants.filter(plant => plant.capacity > 0);
        const avg = validPlants.length > 0 ? 
            validPlants.reduce((acc, plant) => acc + plant.capacity, 0) / validPlants.length : 0;
        avgCapacity.textContent = Math.round(avg) + ' MW';
    }
    
    // Update charts if they exist
    updateCharts(filteredPlants);
}

// Update the charts with filtered data
function updateCharts(filteredPlants) {
    // Update fuel type chart
    if (window.fuelChart) {
        const fuelCounts = {};
        filteredPlants.forEach(plant => {
            const fuel = plant.primary_fuel || plant.fuel;
            fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
        });
        
        const labels = Object.keys(fuelCounts);
        const data = labels.map(fuel => fuelCounts[fuel]);
        const colors = labels.map(fuel => fuelColors[fuel] || '#cccccc');
        
        window.fuelChart.data.labels = labels;
        window.fuelChart.data.datasets[0].data = data;
        window.fuelChart.data.datasets[0].backgroundColor = colors;
        window.fuelChart.update();
    }
    
    // Update capacity chart
    if (window.capacityChart) {
        const ranges = [
            { min: 0, max: 100, label: '0-100 MW' },
            { min: 100, max: 500, label: '100-500 MW' },
            { min: 500, max: 1000, label: '500-1000 MW' },
            { min: 1000, max: 2000, label: '1-2 GW' },
            { min: 2000, max: 5000, label: '2-5 GW' },
            { min: 5000, max: Infinity, label: '5+ GW' }
        ];
        
        const rangeCounts = ranges.map(range => ({
            ...range,
            count: filteredPlants.filter(plant => 
                plant.capacity >= range.min && plant.capacity < range.max
            ).length
        }));
        
        window.capacityChart.data.datasets[0].data = rangeCounts.map(range => range.count);
        window.capacityChart.update();
    }
}

// Update the visible plants based on zoom level and active filters
function updateVisiblePlants() {
    const zoomLevel = map.getZoom();
    
    // Clear existing markers first
    powerPlantLayer.clearLayers();
    
    // Use grid-based approach for low zoom levels
    if (zoomLevel <= 3) {
        displayGridRepresentatives(zoomLevel);
    } else {
        // Use direct filtering for higher zoom levels
        displayFilteredPlants(zoomLevel);
    }
}

// Update the displayFilteredPlants function to apply active filters
const originalDisplayFilteredPlants = displayFilteredPlants;
displayFilteredPlants = function(zoomLevel) {
    // Clear existing markers
    powerPlantLayer.clearLayers();
    
    // Determine capacity threshold based on zoom level
    let capacityThreshold;
    if (zoomLevel <= 2) {
        capacityThreshold = 1000; // Only very large plants at global view
    } else if (zoomLevel <= 3) {
        capacityThreshold = 500; // Large plants at continental view
    } else if (zoomLevel <= 4) {
        capacityThreshold = 200; // Medium-large plants at country view
    } else if (zoomLevel <= 5) {
        capacityThreshold = 100;  // Medium plants at regional view
    } else if (zoomLevel <= 6) {
        capacityThreshold = 50;  // Medium-small plants at state view
    } else {
        capacityThreshold = 0;   // All plants at local view
    }
    
    // Apply zoom-based threshold and active filters
    let filteredPlants = allPowerPlants.filter(plant => plant.capacity >= capacityThreshold);
    
    // Apply active filters if they exist
    if (window.activeFilters) {
        if (window.activeFilters.fuels && window.activeFilters.fuels.length > 0) {
            filteredPlants = filteredPlants.filter(plant => 
                window.activeFilters.fuels.includes(plant.primary_fuel || plant.fuel)
            );
        }
        
        if (window.activeFilters.minCapacity !== undefined && window.activeFilters.maxCapacity !== undefined) {
            filteredPlants = filteredPlants.filter(plant => 
                plant.capacity >= window.activeFilters.minCapacity && 
                plant.capacity <= window.activeFilters.maxCapacity
            );
        }
        
        if (window.activeFilters.country) {
            filteredPlants = filteredPlants.filter(plant => 
                plant.country === window.activeFilters.country
            );
        }
    }
    
    // Get the current theme state for marker styling
    const isDark = document.body.classList.contains('dark-theme');
    
    // Create markers for filtered plants
    filteredPlants.forEach(plant => {
        // Calculate marker radius based on capacity and zoom level
        const radius = calculateRadiusPixels(plant.capacity, zoomLevel);
        
        // Create circle marker with appropriate styling
        const marker = L.circleMarker([plant.latitude, plant.longitude], {
            radius: radius,
            fillColor: plant.color,
            color: isDark ? 'rgba(0,0,0,0)' : '#ffffff', // No stroke in dark mode, white in light mode
            weight: isDark ? 0 : 1,                      // No stroke weight in dark mode
            opacity: isDark ? 0 : 0.8,                   // No stroke opacity in dark mode
            fillOpacity: 0.9                             // High fill opacity for better visibility
        });
        
        // Add popup with plant information
        const popupContent = createEnhancedPopup(plant);
        const popup = L.popup({
            className: 'power-plant-popup-container',
            closeButton: true,
            closeOnClick: true,
            autoClose: true,
            minWidth: 280,
            maxWidth: 320
        }).setContent(popupContent);
        
        marker.bindPopup(popup);
        
        // Add event listeners for hover effects
        marker.on('mouseover', function() {
            this.setStyle({
                fillOpacity: 1.0,
                radius: radius * 1.2  // Increase size slightly on hover
            });
        });
        
        marker.on('mouseout', function() {
            this.setStyle({
                fillOpacity: 0.9,
                radius: radius
            });
        });
        
        // Add marker to layer
        powerPlantLayer.addLayer(marker);
    });
    
    // Log the number of plants displayed
    console.debug(`Displaying ${filteredPlants.length} power plants (zoom level ${zoomLevel})`);
};

// Update the displayGridRepresentatives function to apply active filters
const originalDisplayGridRepresentatives = displayGridRepresentatives;
displayGridRepresentatives = function(zoomLevel) {
    // Clear existing markers
    powerPlantLayer.clearLayers();
    
    // Define grid size based on zoom level
    const gridSize = zoomLevel <= 2 ? 10 : 5; // Larger grid cells for lower zoom levels
    
    // Create a grid to group plants
    const grid = {};
    
    // Define capacity threshold for grid representation
    let capacityThreshold;
    if (zoomLevel <= 2) {
        capacityThreshold = 500; // Only very large plants at global view
    } else if (zoomLevel <= 3) {
        capacityThreshold = 200; // Large plants at continental view
    } else {
        capacityThreshold = 100; // Medium plants at country view
    }
    
    // Get filtered plants based on capacity threshold
    let eligiblePlants = allPowerPlants.filter(plant => plant.capacity >= capacityThreshold);
    
    // Apply active filters if they exist
    if (window.activeFilters) {
        if (window.activeFilters.fuels && window.activeFilters.fuels.length > 0) {
            eligiblePlants = eligiblePlants.filter(plant => 
                window.activeFilters.fuels.includes(plant.primary_fuel || plant.fuel)
            );
        }
        
        if (window.activeFilters.minCapacity !== undefined && window.activeFilters.maxCapacity !== undefined) {
            eligiblePlants = eligiblePlants.filter(plant => 
                plant.capacity >= window.activeFilters.minCapacity && 
                plant.capacity <= window.activeFilters.maxCapacity
            );
        }
        
        if (window.activeFilters.country) {
            eligiblePlants = eligiblePlants.filter(plant => 
                plant.country === window.activeFilters.country
            );
        }
    }
    
    // Group plants by grid cell
    eligiblePlants.forEach(plant => {
        // Calculate grid cell coordinates
        const gridX = Math.floor((plant.longitude + 180) / 360 * (180 / gridSize));
        const gridY = Math.floor((90 - plant.latitude) / 180 * (90 / gridSize));
        const gridKey = `${gridX},${gridY}`;
        
        // Initialize grid cell if it doesn't exist
        if (!grid[gridKey]) {
            grid[gridKey] = {
                plants: [],
                totalCapacity: 0,
                fuelTypes: {},
                representativeLocation: null
            };
        }
        
        // Add plant to grid cell
        grid[gridKey].plants.push(plant);
        grid[gridKey].totalCapacity += plant.capacity;
        
        // Count fuel types
        const fuel = plant.primary_fuel || plant.fuel;
        grid[gridKey].fuelTypes[fuel] = (grid[gridKey].fuelTypes[fuel] || 0) + 1;
        
        // Update representative location (weighted by capacity)
        if (!grid[gridKey].representativeLocation || plant.capacity > grid[gridKey].representativeCapacity) {
            grid[gridKey].representativeLocation = [plant.latitude, plant.longitude];
            grid[gridKey].representativeCapacity = plant.capacity;
            grid[gridKey].representativeFuel = fuel;
        }
    });
    
    // Create markers for grid representatives
    Object.values(grid).forEach(cell => {
        if (cell.plants.length === 0) return;
        
        // Determine dominant fuel type
        let dominantFuel = '';
        let maxCount = 0;
        
        Object.entries(cell.fuelTypes).forEach(([fuel, count]) => {
            if (count > maxCount) {
                dominantFuel = fuel;
                maxCount = count;
            }
        });
        
        // Get color for dominant fuel
        const color = fuelColors[dominantFuel] || '#cccccc';
        
        // Calculate radius based on total capacity and zoom level
        // Use a larger base size for grid representatives to make them more visible
        const baseRadius = zoomLevel <= 2 ? 3 : 4;
        const capacityFactor = Math.log10(Math.max(1, cell.totalCapacity)) / Math.log10(10000);
        const radius = baseRadius + capacityFactor * 4;
        
        // Get the current theme state for marker styling
        const isDark = document.body.classList.contains('dark-theme');
        
        // Create circle marker
        const marker = L.circleMarker(cell.representativeLocation, {
            radius: radius,
            fillColor: color,
            color: isDark ? 'rgba(0,0,0,0)' : '#ffffff',
            weight: isDark ? 0 : 1,
            opacity: isDark ? 0 : 0.8,
            fillOpacity: 0.9
        });
        
        // Create popup with grid cell information
        const popupContent = `
            <div class="grid-popup ${isDark ? 'dark-theme' : ''}">
                <h3>Power Plant Cluster</h3>
                <p><strong>Plants in area:</strong> ${cell.plants.length}</p>
                <p><strong>Total capacity:</strong> ${(cell.totalCapacity / 1000).toFixed(2)} GW</p>
                <p><strong>Dominant fuel type:</strong> ${dominantFuel}</p>
                <p><small>Zoom in to see individual plants</small></p>
            </div>
        `;
        
        const popup = L.popup({
            className: 'power-plant-popup-container',
            closeButton: true,
            closeOnClick: true,
            autoClose: true
        }).setContent(popupContent);
        
        marker.bindPopup(popup);
        
        // Add hover effects
        marker.on('mouseover', function() {
            this.setStyle({
                fillOpacity: 1.0,
                radius: radius * 1.2
            });
        });
        
        marker.on('mouseout', function() {
            this.setStyle({
                fillOpacity: 0.9,
                radius: radius
            });
        });
        
        // Add marker to layer
        powerPlantLayer.addLayer(marker);
    });
    
    // Log the number of grid cells displayed
    console.debug(`Displaying ${Object.keys(grid).length} grid cells (zoom level ${zoomLevel})`);
};

// Create and add the control panel when the map is ready
map.whenReady(() => {
    // Add a slight delay to ensure all data is loaded
    setTimeout(createControlPanel, 1000);
});

// --- Add a data coverage information notice ---
const DataCoverageInfo = L.Control.extend({
    options: {
        position: 'bottomleft'
    },
    
    onAdd: function() {
        const container = L.DomUtil.create('div', 'data-coverage-info');
        container.innerHTML = `
            <div class="info-box ${isDarkTheme ? 'dark-theme' : ''}">
                <h4>Power Plant Data Coverage</h4>
                <p>The power plant data is available globally.</p>
            </div>
        `;
        
        // Prevent propagation of mouse events to the map
        L.DomEvent.disableClickPropagation(container);
        
        return container;
    }
});

// Add the coverage information control
map.addControl(new DataCoverageInfo());

// Add CSS for the coverage information box and theme support
document.head.insertAdjacentHTML('beforeend', `
<style>
/* Base styles for the info box */
.data-coverage-info .info-box {
    padding: 10px 15px;
    border-radius: 5px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    max-width: 250px;
    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
    transition: all 0.3s ease;
}

/* Light theme for info box */
.data-coverage-info .info-box:not(.dark-theme) {
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    border: 1px solid #ddd;
}

/* Dark theme for info box */
.data-coverage-info .info-box.dark-theme {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: 1px solid #444;
}

.data-coverage-info h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
}

/* Light theme headings */
.data-coverage-info:not(.dark-theme) h4 {
    color: #2c3e50;
}

/* Dark theme headings */
.data-coverage-info .dark-theme h4 {
    color: #ffcc00;
}

.data-coverage-info p {
    margin: 0 0 8px 0;
    line-height: 1.4;
}

/* Dark theme for leaflet controls */
.leaflet-control.dark-theme {
    background: #333;
    color: #fff;
    border-color: #555;
}

.leaflet-control.dark-theme a {
    background-color: #333;
    color: #fff;
    border-color: #555;
}

.leaflet-control-layers.dark-theme .leaflet-control-layers-list {
    background: #333;
    color: #fff;
}

/* Dark theme for popups */
.leaflet-popup.dark-theme .leaflet-popup-content-wrapper {
    background: #333;
    color: #fff;
}

.leaflet-popup.dark-theme .leaflet-popup-tip {
    background: #333;
}

/* Add theme classes to body for global CSS support */
body.dark-theme {
    background-color: #1a1a1a;
    color: #f0f0f0;
}

body.light-theme {
    background-color: #f8f9fa;
    color: #333333;
}

/* Dark theme popup styles */
body.dark-theme .popup-header {
    border-bottom: 1px solid #444;
}

body.dark-theme .title-container h3 {
    color: #f0f0f0;
}

body.dark-theme .fuel-type {
    color: #aaa;
}

body.dark-theme .info-label {
    color: #ddd;
}

body.dark-theme .info-value {
    color: #f0f0f0;
}

body.dark-theme .capacity-indicator {
    background-color: #222;
}

body.dark-theme .capacity-bar {
    background-color: #444;
}

body.dark-theme .capacity-label {
    color: #aaa;
}

body.dark-theme .fuel-info {
    color: #aaa;
    border-top: 1px solid #444;
}

/* Light theme popup styles */
body.light-theme .popup-header {
    border-bottom: 1px solid #eee;
}

body.light-theme .title-container h3 {
    color: #333;
}

body.light-theme .fuel-type {
    color: #666;
}

body.light-theme .info-label {
    color: #555;
}

body.light-theme .info-value {
    color: #333;
}

body.light-theme .capacity-indicator {
    background-color: #f5f5f5;
}

body.light-theme .capacity-bar {
    background-color: #ddd;
}

body.light-theme .capacity-label {
    color: #777;
}

body.light-theme .fuel-info {
    color: #666;
    border-top: 1px solid #eee;
}
</style>
`);

loadPowerPlants();

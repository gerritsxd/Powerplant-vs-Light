/**
 * Enhanced Analytics System
 * Comprehensive user interaction tracking for the Power Plant Visualization Project
 */

const EnhancedAnalytics = {
    sessionId: null,
    initialized: false,
    startTime: null,
    lastActivity: null,
    interactionCount: 0,
    heatmapData: [],
    logQueue: [],
    processingInterval: null,
    debugMode: true, // Set to true to see logs in console
    
    /**
     * Initialize the analytics system
     */
    init: function() {
        if (this.initialized) return;
        
        // Generate or retrieve session ID
        this.sessionId = this.getSessionId();
        this.startTime = new Date();
        this.lastActivity = this.startTime;
        
        // Create log storage if it doesn't exist
        if (!localStorage.getItem('ppv_logs')) {
            localStorage.setItem('ppv_logs', JSON.stringify([]));
        }
        
        // Set up all event tracking
        this.setupGeneralTracking();
        this.setupMouseTracking();
        this.setupFormTracking();
        this.setupMapTracking();
        this.setupMediaTracking();
        this.setupPerformanceTracking();
        
        // Set up log processing
        this.processingInterval = setInterval(() => this.processLogQueue(), 5000);
        
        // Log session start
        this.logEvent('session_start', {
            referrer: document.referrer,
            landing_page: window.location.href
        });
        
        // Set up session tracking
        this.setupSessionTracking();
        
        // Log initial page view
        this.logPageView();
        
        this.initialized = true;
        this.debugLog('Analytics initialized. Session ID:', this.sessionId);
    },
    
    /**
     * Debug logging function
     */
    debugLog: function(...args) {
        if (this.debugMode) {
            console.log('[Analytics]', ...args);
        }
    },
    
    /**
     * Get or create a session ID
     */
    getSessionId: function() {
        let sessionId = sessionStorage.getItem('ppv_session_id');
        if (!sessionId) {
            sessionId = this.generateUUID();
            sessionStorage.setItem('ppv_session_id', sessionId);
            
            // Also store user ID in local storage for returning users
            let userId = localStorage.getItem('ppv_user_id');
            if (!userId) {
                userId = this.generateUUID();
                localStorage.setItem('ppv_user_id', userId);
            }
        }
        return sessionId;
    },
    
    /**
     * Generate a UUID
     */
    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    /**
     * Track general user interactions
     */
    setupGeneralTracking: function() {
        // Track clicks
        document.addEventListener('click', (e) => {
            this.lastActivity = new Date();
            const target = e.target;
            const path = this.getElementPath(target);
            
            let elementType = target.tagName.toLowerCase();
            let elementId = target.id || '';
            let elementClass = Array.from(target.classList).join(' ') || '';
            let elementText = target.innerText || target.textContent || '';
            let elementHref = target.href || '';
            
            this.logEvent('click', {
                elementType,
                elementId,
                elementClass,
                elementText: elementText.substring(0, 100),
                elementHref: elementHref.substring(0, 100),
                path,
                x: e.clientX,
                y: e.clientY,
                pageX: e.pageX,
                pageY: e.pageY
            });
            
            // Add to heatmap data
            this.heatmapData.push({
                x: e.pageX, 
                y: e.pageY,
                time: new Date().getTime()
            });
        });
        
        // Track element visibility
        this.setupVisibilityTracking();
        
        // Track scrolling
        let scrollTimeout;
        window.addEventListener('scroll', (e) => {
            this.lastActivity = new Date();
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollPercent = this.getScrollPercent();
                this.logEvent('scroll', {
                    scrollTop: window.scrollY,
                    scrollLeft: window.scrollX,
                    scrollPercent,
                    viewportHeight: window.innerHeight,
                    pageHeight: document.documentElement.scrollHeight
                });
            }, 300); // Throttle scroll events
        });
        
        // Track page unload
        window.addEventListener('beforeunload', () => {
            const duration = new Date() - this.startTime;
            this.logEvent('page_exit', {
                duration,
                interactionCount: this.interactionCount
            }, true); // Synchronous log for exit events
        });
    },
    
    /**
     * Track mouse movements for heat mapping
     */
    setupMouseTracking: function() {
        let moveTimeout;
        window.addEventListener('mousemove', (e) => {
            this.lastActivity = new Date();
            // Throttle mousemove events to prevent too many logs
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(() => {
                // Only log every 10th movement to reduce data
                if (Math.random() < 0.1) {
                    this.heatmapData.push({
                        x: e.pageX, 
                        y: e.pageY,
                        time: new Date().getTime()
                    });
                    
                    // Check if we should flush heatmap data
                    if (this.heatmapData.length > 50) {
                        this.flushHeatmapData();
                    }
                }
            }, 200);
        });
    },
    
    /**
     * Track form interactions
     */
    setupFormTracking: function() {
        // Track form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            this.logEvent('form_submit', {
                formId: form.id || '',
                formAction: form.action || '',
                formMethod: form.method || '',
                formElements: this.getFormElements(form)
            });
        });
        
        // Track form field interactions
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                let value = '';
                // Don't log actual values for privacy, just log that a change occurred
                if (target.type === 'password') {
                    value = '********';
                } else if (target.type === 'checkbox' || target.type === 'radio') {
                    value = target.checked ? 'checked' : 'unchecked';
                } else {
                    value = target.value ? 'filled' : 'empty';
                }
                
                this.logEvent('form_field_change', {
                    fieldType: target.type,
                    fieldName: target.name || '',
                    fieldId: target.id || '',
                    value: value
                });
            }
        });
        
        // Track form field focus/blur
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                this.logEvent('form_field_focus', {
                    fieldType: target.type,
                    fieldName: target.name || '',
                    fieldId: target.id || ''
                });
            }
        }, true);
        
        document.addEventListener('blur', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                let timeSpent = 0;
                if (target.dataset.focusTime) {
                    timeSpent = new Date() - new Date(parseInt(target.dataset.focusTime));
                    delete target.dataset.focusTime;
                }
                
                this.logEvent('form_field_blur', {
                    fieldType: target.type,
                    fieldName: target.name || '',
                    fieldId: target.id || '',
                    timeSpent
                });
            }
        }, true);
    },
    
    /**
     * Track map interactions if Leaflet is available
     */
    setupMapTracking: function() {
        window.addEventListener('load', () => {
            if (window.L && window.map) {
                // Log map zoom events
                window.map.on('zoomend', () => {
                    this.logEvent('map_zoom', {
                        zoomLevel: window.map.getZoom(),
                        center: window.map.getCenter()
                    });
                });
                
                // Log map move events (throttled)
                let moveTimeout;
                window.map.on('moveend', () => {
                    clearTimeout(moveTimeout);
                    moveTimeout = setTimeout(() => {
                        this.logEvent('map_move', {
                            center: window.map.getCenter(),
                            bounds: window.map.getBounds()
                        });
                    }, 500);
                });
                
                // Log marker clicks
                window.map.on('popupopen', (e) => {
                    if (e.popup && e.popup._source) {
                        const marker = e.popup._source;
                        let markerData = {};
                        
                        if (marker.options && marker.options.title) {
                            markerData.title = marker.options.title;
                        }
                        
                        if (marker.feature && marker.feature.properties) {
                            markerData.properties = marker.feature.properties;
                        }
                        
                        this.logEvent('marker_click', markerData);
                    }
                });
                
                // Log layer control interactions
                if (window.layerControl) {
                    window.map.on('baselayerchange', (e) => {
                        this.logEvent('map_layer_change', {
                            layerName: e.name,
                            layerType: 'base'
                        });
                    });
                    
                    window.map.on('overlayadd', (e) => {
                        this.logEvent('map_layer_change', {
                            layerName: e.name,
                            layerType: 'overlay',
                            action: 'add'
                        });
                    });
                    
                    window.map.on('overlayremove', (e) => {
                        this.logEvent('map_layer_change', {
                            layerName: e.name,
                            layerType: 'overlay',
                            action: 'remove'
                        });
                    });
                }
                
                // Track drawing if draw control is used
                if (window.L.Draw && window.drawControl) {
                    window.map.on('draw:created', (e) => {
                        this.logEvent('map_draw', {
                            layerType: e.layerType,
                            action: 'created'
                        });
                    });
                    
                    window.map.on('draw:edited', (e) => {
                        this.logEvent('map_draw', {
                            layerCount: e.layers.getLayers().length,
                            action: 'edited'
                        });
                    });
                    
                    window.map.on('draw:deleted', (e) => {
                        this.logEvent('map_draw', {
                            layerCount: e.layers.getLayers().length,
                            action: 'deleted'
                        });
                    });
                }
            }
        });
    },
    
    /**
     * Track media interactions (videos, audio, etc)
     */
    setupMediaTracking: function() {
        // Function to attach media event listeners
        const attachMediaListeners = (media) => {
            const mediaType = media.tagName.toLowerCase();
            const mediaId = media.id || '';
            const mediaSrc = media.currentSrc || media.src || '';
            
            media.addEventListener('play', () => {
                this.logEvent('media_play', {
                    mediaType,
                    mediaId,
                    mediaSrc
                });
            });
            
            media.addEventListener('pause', () => {
                this.logEvent('media_pause', {
                    mediaType,
                    mediaId,
                    mediaSrc,
                    currentTime: media.currentTime,
                    duration: media.duration
                });
            });
            
            media.addEventListener('ended', () => {
                this.logEvent('media_ended', {
                    mediaType,
                    mediaId,
                    mediaSrc,
                    duration: media.duration
                });
            });
            
            media.addEventListener('seeked', () => {
                this.logEvent('media_seek', {
                    mediaType,
                    mediaId,
                    mediaSrc,
                    currentTime: media.currentTime,
                    duration: media.duration
                });
            });
        };
        
        // Attach listeners to existing media elements
        document.querySelectorAll('video, audio').forEach(attachMediaListeners);
        
        // Use MutationObserver to track dynamically added media elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                                attachMediaListeners(node);
                            } else {
                                node.querySelectorAll('video, audio').forEach(attachMediaListeners);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    
    /**
     * Track performance metrics
     */
    setupPerformanceTracking: function() {
        // Log performance data when page is fully loaded
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (window.performance && window.performance.timing) {
                    const timing = window.performance.timing;
                    const performanceData = {
                        loadTime: timing.loadEventEnd - timing.navigationStart,
                        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                        firstPaint: timing.responseEnd - timing.navigationStart,
                        dns: timing.domainLookupEnd - timing.domainLookupStart,
                        tcp: timing.connectEnd - timing.connectStart,
                        ttfb: timing.responseStart - timing.requestStart,
                        domInteractive: timing.domInteractive - timing.navigationStart,
                        domComplete: timing.domComplete - timing.navigationStart
                    };
                    
                    this.logEvent('performance', performanceData);
                }
                
                // Track resource loading performance
                if (window.performance && window.performance.getEntriesByType) {
                    const resources = window.performance.getEntriesByType('resource');
                    const resourceStats = {
                        totalResources: resources.length,
                        totalSize: 0,
                        slowestResource: null,
                        slowestTime: 0
                    };
                    
                    resources.forEach(resource => {
                        resourceStats.totalSize += resource.encodedBodySize || 0;
                        if (resource.duration > resourceStats.slowestTime) {
                            resourceStats.slowestTime = resource.duration;
                            resourceStats.slowestResource = resource.name;
                        }
                    });
                    
                    this.logEvent('resource_performance', resourceStats);
                }
            }, 0);
        });
    },
    
    /**
     * Track element visibility
     */
    setupVisibilityTracking: function() {
        // Check if Intersection Observer is available
        if ('IntersectionObserver' in window) {
            const visibilityObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Element has become visible
                        const element = entry.target;
                        const elementInfo = {
                            id: element.id || '',
                            tag: element.tagName.toLowerCase(),
                            classes: Array.from(element.classList).join(' '),
                            visiblePercent: Math.round(entry.intersectionRatio * 100),
                            path: this.getElementPath(element)
                        };
                        
                        this.logEvent('element_visible', elementInfo);
                        
                        // Start tracking time spent on element
                        element.dataset.visibleSince = new Date().getTime();
                    } else if (entry.target.dataset.visibleSince) {
                        // Element is no longer visible, calculate time spent
                        const element = entry.target;
                        const startTime = parseInt(element.dataset.visibleSince);
                        const timeVisible = new Date().getTime() - startTime;
                        
                        if (timeVisible > 1000) { // Only log if visible for more than 1 second
                            const elementInfo = {
                                id: element.id || '',
                                tag: element.tagName.toLowerCase(),
                                classes: Array.from(element.classList).join(' '),
                                timeVisible: timeVisible,
                                path: this.getElementPath(element)
                            };
                            
                            this.logEvent('element_view_time', elementInfo);
                        }
                        
                        delete element.dataset.visibleSince;
                    }
                });
            }, {
                threshold: [0, 0.25, 0.5, 0.75, 1]
            });
            
            // Observe important elements
            document.querySelectorAll('h1, h2, h3, img, video, .card, .feature, [data-track-visibility]')
                .forEach(element => {
                    visibilityObserver.observe(element);
                });
        }
    },
    
    /**
     * Set up session tracking
     */
    setupSessionTracking: function() {
        // Track tab visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.logEvent('tab_hidden', {
                    time: new Date().toISOString()
                });
            } else {
                this.logEvent('tab_visible', {
                    time: new Date().toISOString()
                });
            }
        });
        
        // Track user inactivity
        setInterval(() => {
            const inactiveTime = new Date() - this.lastActivity;
            // If inactive for more than 2 minutes, log it
            if (inactiveTime > 120000) {
                this.logEvent('user_inactive', {
                    inactiveTime
                });
            }
        }, 60000); // Check every minute
        
        // Log session duration periodically
        setInterval(() => {
            const duration = new Date() - this.startTime;
            this.logEvent('session_duration', {
                duration,
                interactionCount: this.interactionCount
            });
        }, 300000); // Every 5 minutes
    },
    
    /**
     * Flush heatmap data to storage
     */
    flushHeatmapData: function() {
        if (this.heatmapData.length > 0) {
            this.logEvent('heatmap_data', {
                points: this.heatmapData,
                url: window.location.href
            });
            this.heatmapData = [];
        }
    },
    
    /**
     * Log a page view
     */
    logPageView: function() {
        const url = window.location.href;
        const path = window.location.pathname;
        const title = document.title;
        
        this.logEvent('page_view', {
            url,
            path,
            title,
            referrer: document.referrer,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        });
        
        // Also track page render time
        setTimeout(() => {
            if (window.performance && window.performance.timing) {
                const timing = window.performance.timing;
                this.logEvent('page_load_time', {
                    url,
                    path,
                    loadTime: timing.loadEventEnd - timing.navigationStart,
                    readyTime: timing.domContentLoadedEventEnd - timing.navigationStart
                });
            }
        }, 0);
    },
    
    /**
     * Process the log queue and save to storage and server
     */
    processLogQueue: function() {
        if (this.logQueue.length === 0) return;
        
        this.debugLog(`Processing ${this.logQueue.length} log entries`);
        
        // Get existing logs for local backup
        let logs = JSON.parse(localStorage.getItem('ppv_logs') || '[]');
        
        // Add new logs to local storage for backup
        logs = logs.concat(this.logQueue);
        
        // Limit storage to last 1000 events to prevent localStorage from filling up
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        
        // Save back to local storage as backup
        localStorage.setItem('ppv_logs', JSON.stringify(logs));
        
        // Send each log entry to the server immediately
        this.logQueue.forEach(logEntry => {
            this.sendLogToServer(logEntry);
        });
        
        // Clear the queue
        this.logQueue = [];
    },
    
    /**
     * Send a single log entry to the server
     */
    sendLogToServer: function(logEntry) {
        try {
            // Send log data to server endpoint
            fetch('http://localhost:8888/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry),
                // Use keepalive to ensure the request completes even if page is unloading
                keepalive: true
            }).then(response => {
                if (!response.ok) {
                    this.debugLog('Error sending log to server:', response.statusText);
                }
            }).catch(error => {
                this.debugLog('Failed to send log to server:', error);
            });
        } catch (error) {
            this.debugLog('Exception sending log to server:', error);
        }
    },
    
    /**
     * Upload logs to server
     */
    uploadLogs: function() {
        if (!navigator.onLine) return; // Don't attempt if offline
        
        const logs = JSON.parse(localStorage.getItem('ppv_logs') || '[]');
        if (logs.length === 0) return;
        
        this.debugLog(`Uploading ${logs.length} logs to server`);
        
        // In a real implementation, we would upload to a server endpoint
        // For now, we'll just clear the logs from localStorage
        // This would be replaced with an actual server upload in production
        
        // Simulate server upload
        console.log('UPLOADING LOGS TO SERVER:', logs);
        
        // Clear logs after successful upload
        localStorage.setItem('ppv_logs', JSON.stringify([]));
    },
    
    /**
     * Log a user event
     * @param {string} eventType - Type of event
     * @param {object} eventData - Additional event data
     * @param {boolean} immediate - Whether to log immediately (for exit events)
     */
    logEvent: function(eventType, eventData = {}, immediate = false) {
        this.interactionCount++;
        this.lastActivity = new Date();
        
        const data = {
            type: eventType,
            sessionId: this.sessionId,
            userId: localStorage.getItem('ppv_user_id'),
            timestamp: new Date().toISOString(),
            url: window.location.href,
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            ...eventData
        };
        
        // Add to queue for processing
        this.logQueue.push(data);
        
        // If immediate, process right away (for exit events)
        if (immediate) {
            this.processLogQueue();
        }
        
        // Log to console in debug mode
        this.debugLog('Event:', eventType, data);
    },
    
    /**
     * Get the DOM path for an element
     */
    getElementPath: function(element) {
        if (!element) return '';
        
        let path = [];
        let currentElement = element;
        
        while (currentElement && currentElement !== document.body) {
            let selector = currentElement.tagName.toLowerCase();
            
            if (currentElement.id) {
                selector += `#${currentElement.id}`;
            } else if (currentElement.className) {
                selector += `.${Array.from(currentElement.classList).join('.')}`;
            }
            
            path.unshift(selector);
            currentElement = currentElement.parentElement;
        }
        
        return path.join(' > ');
    },
    
    /**
     * Get form elements as a structured object
     */
    getFormElements: function(form) {
        const elements = {};
        Array.from(form.elements).forEach(element => {
            if (element.name) {
                let value;
                
                // Don't log actual values for privacy
                if (element.type === 'password') {
                    value = '********';
                } else if (element.type === 'checkbox' || element.type === 'radio') {
                    value = element.checked ? 'checked' : 'unchecked';
                } else {
                    value = element.value ? 'filled' : 'empty';
                }
                
                elements[element.name] = {
                    type: element.type,
                    value: value
                };
            }
        });
        return elements;
    },
    
    /**
     * Get the current scroll percentage
     */
    getScrollPercent: function() {
        const h = document.documentElement;
        const b = document.body;
        const st = 'scrollTop';
        const sh = 'scrollHeight';
        
        return (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight) * 100;
    },
    
    /**
     * Export logs for analysis
     */
    exportLogs: function(format = 'json') {
        const logs = JSON.parse(localStorage.getItem('ppv_logs') || '[]');
        
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(logs, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ppv_logs_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } else if (format === 'csv') {
            // Convert to CSV
            if (logs.length === 0) return '';
            
            const columns = Object.keys(logs[0]);
            let csv = columns.join(',') + '\n';
            
            logs.forEach(log => {
                const row = columns.map(column => {
                    const value = log[column];
                    if (typeof value === 'object') {
                        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                    }
                    return `"${value}"`;
                }).join(',');
                csv += row + '\n';
            });
            
            const blob = new Blob([csv], {type: 'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ppv_logs_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        }
    }
};

// Initialize analytics when the script loads
document.addEventListener('DOMContentLoaded', () => {
    EnhancedAnalytics.init();
});

// Export for external use
window.EnhancedAnalytics = EnhancedAnalytics;

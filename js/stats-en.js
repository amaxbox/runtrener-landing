// Function to get Grafana data through CORS proxy
async function fetchGrafanaData() {
    try {
        // Use local proxy to get data
        const fullUrl = '/stats-proxy.php';
        
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            athletes: data.athletes || 1056
        };
        
    } catch (error) {
        // Fallback to current data
        return {
            athletes: 1056 // Last known value
        };
    }
}

// Update statistics
async function updateStats() {
    const statsInfo = document.querySelector('.stats-info');
    
    // Show loading indicator
    if (statsInfo) {
        statsInfo.style.opacity = '0.7';
        statsInfo.textContent = `🏃‍♂️ Updating data...`;
    }
    
    const grafanaData = await fetchGrafanaData();
    
    // Update statistics text with new format
    if (statsInfo) {
        statsInfo.style.opacity = '1';
        statsInfo.textContent = `${grafanaData.athletes} 🏃‍♂️ already with us`;
    }
    
}
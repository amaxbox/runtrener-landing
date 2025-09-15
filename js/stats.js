// Функция для получения данных из Grafana через CORS прокси
async function fetchGrafanaData() {
    try {
        // Используем локальный прокси для получения данных
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
        // Fallback к актуальным данным
        return {
            athletes: 1056 // Последнее известное значение
        };
    }
}

// Обновление статистики
async function updateStats() {
    const statsInfo = document.querySelector('.stats-info');
    
    // Показываем индикатор загрузки
    if (statsInfo) {
        statsInfo.style.opacity = '0.7';
        statsInfo.textContent = `🏃‍♂️ Обновление данных...`;
    }
    
    const grafanaData = await fetchGrafanaData();
    
    // Обновляем текст со статистикой с новым форматом
    if (statsInfo) {
        statsInfo.style.opacity = '1';
        statsInfo.textContent = `${grafanaData.athletes} 🏃‍♂️ уже с нами`;
    }
    
}
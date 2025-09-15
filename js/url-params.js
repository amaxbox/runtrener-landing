// URL parameters handler for running coach landing
(function() {
    try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        // Detect language based on page URL or HTML lang attribute
        function getLanguage() {
            const htmlLang = document.documentElement.lang;
            if (htmlLang === 'en') return 'landeng';
            return 'landru'; // default to Russian
        }
        
        // Convert all URL parameters to a single start parameter
        function getStartParameter() {
            // Check if there's already a start parameter in URL
            const existingStart = urlParams.get('start');
            if (existingStart) {
                return '?start=' + encodeURIComponent(existingStart);
            }
            
            // Otherwise, combine all parameters or use default
            const params = [];
            for (const [key, value] of urlParams.entries()) {
                // Skip start parameter if it exists (already handled above)
                if (key !== 'start') {
                    params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
                }
            }
            
            let startParam;
            if (params.length > 0) {
                startParam = '?start=' + encodeURIComponent(params.join('&'));
            } else {
                // Use default based on language
                startParam = '?start=' + getLanguage();
            }
            return startParam;
        }
        
        // Update buttons function
        function updateTelegramButtons() {
            const telegramButtons = document.querySelectorAll('a[href*="t.me/runtrener_bot"]');
            const startParam = getStartParameter();
            
            telegramButtons.forEach(function(button) {
                const originalHref = button.getAttribute('href');
                
                // Only add start param if not already present
                if (!originalHref.includes('?start=')) {
                    const newHref = originalHref + startParam;
                    button.setAttribute('href', newHref);
                }
            });
        }
        
        // Run on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateTelegramButtons);
        } else {
            updateTelegramButtons();
        }
        
        // Also run after delays to catch any dynamically added buttons
        setTimeout(updateTelegramButtons, 100);
        setTimeout(updateTelegramButtons, 500);
        
    } catch (error) {
        // Silent error handling - script continues to work
    }
})();
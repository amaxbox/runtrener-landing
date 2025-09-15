// Language detection and redirect (English version)
function detectLanguageAndRedirect() {
    // Check if we are already on the needed page
    if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        return; // Already on Russian version
    }
    
    // Check localStorage for saved choice
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage === 'ru') {
        window.location.href = '/';
        return;
    }
    
    // If language was already chosen, don't redirect
    if (savedLanguage) {
        return;
    }
    
    // Get browser languages
    const browserLanguage = navigator.language || navigator.languages[0];
    
    // If Russian is the primary language, redirect
    if (browserLanguage.startsWith('ru')) {
        // Save choice
        localStorage.setItem('preferredLanguage', 'ru');
        window.location.href = '/';
    } else {
        // Save English as preference
        localStorage.setItem('preferredLanguage', 'en');
    }
}

// Language switcher handlers
function setupLanguageSwitchers() {
    const languageLinks = document.querySelectorAll('.language-switch a');
    languageLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            const language = href === '/en/' ? 'en' : 'ru';
            
            // Save user choice
            localStorage.setItem('preferredLanguage', language);
            
            // Go to selected version
            window.location.href = href;
        });
    });
}

// Initialization on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check language only if this is the English page
    if (window.location.pathname === '/en/' || window.location.pathname.includes('index-en')) {
        detectLanguageAndRedirect();
    }
    
    // Set up language switchers
    setupLanguageSwitchers();
    
    // Update statistics and testimonials
    updateStats();
    updateTestimonials();
    
    // Start demo automatically
    setTimeout(() => {
        startDemo();
    }, 2000);
});

// Periodic updates
setInterval(updateStats, 120000); // Statistics every 2 minutes
setInterval(updateTestimonials, 10000); // Testimonials every 10 seconds
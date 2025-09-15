// Определение языка пользователя и редирект
function detectLanguageAndRedirect() {
    // Проверяем, не находимся ли мы уже на нужной странице
    if (window.location.pathname === '/en/' || window.location.pathname.includes('index-en')) {
        return; // Уже на английской версии
    }
    
    // Проверяем localStorage для сохраненного выбора
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage === 'en') {
        window.location.href = '/en/';
        return;
    }
    
    // Если язык уже был выбран, не перенаправляем
    if (savedLanguage) {
        return;
    }
    
    // Получаем языки браузера
    const browserLanguage = navigator.language || navigator.languages[0];
    
    // Если английский является основным языком, перенаправляем
    if (browserLanguage.startsWith('en')) {
        // Сохраняем выбор
        localStorage.setItem('preferredLanguage', 'en');
        window.location.href = '/en/';
    } else {
        // Сохраняем русский как предпочтение
        localStorage.setItem('preferredLanguage', 'ru');
    }
}

// Обработчики переключения языка
function setupLanguageSwitchers() {
    const languageLinks = document.querySelectorAll('.language-switch a');
    languageLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            const language = href === '/en/' ? 'en' : 'ru';
            
            // Сохраняем выбор пользователя
            localStorage.setItem('preferredLanguage', language);
            
            // Переходим на выбранную версию
            window.location.href = href;
        });
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем язык только если это главная страница
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        detectLanguageAndRedirect();
    }
    
    // Настраиваем переключатели языков
    setupLanguageSwitchers();
    
    // Обновляем статистику и отзывы
    updateStats();
    updateTestimonials();
    
    // Запускаем демо автоматически
    setTimeout(() => {
        startDemo();
    }, 2000);
});

// Периодические обновления
setInterval(updateStats, 120000); // Статистика каждые 2 минуты
setInterval(updateTestimonials, 10000); // Отзывы каждые 10 секунд
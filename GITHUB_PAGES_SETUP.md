# Настройка GitHub Pages

## 1. Создание репозитория на GitHub

1. Перейдите на https://github.com
2. Нажмите "New repository"
3. Название: `running-coach-landing`
4. Описание: `Landing page for running coach Telegram bot with Grafana integration`
5. Сделайте репозиторий публичным
6. Не добавляйте README, .gitignore, license (у нас уже есть)

## 2. Загрузка кода

```bash
cd /Users/amax/Lab/running-coach-landing

# Добавить remote origin (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/running-coach-landing.git

# Загрузить код
git branch -M main
git push -u origin main
```

## 3. Настройка GitHub Pages

1. Перейдите в репозиторий на GitHub
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: main
5. Folder: / (root)
6. Save

## 4. Проверка деплоя

Через несколько минут сайт будет доступен по адресу:
`https://YOUR_USERNAME.github.io/running-coach-landing/`

## 5. Обновление сайта

Каждый раз когда вы хотите обновить сайт:

```bash
git add .
git commit -m "Update landing page"
git push
```

GitHub Pages автоматически обновит сайт через несколько минут.

## Важные моменты

### CORS для GitHub Pages
На GitHub Pages может быть проблема с CORS для запросов к `http://89.110.65.155:8083`. 

**Решение 1:** Добавить HTTPS к прокси сервер
**Решение 2:** Использовать fallback значения для GitHub Pages

### Обновление для GitHub Pages

В `index.html` можно добавить проверку домена:

```javascript
// Проверяем, запущен ли сайт на GitHub Pages
const isGitHubPages = window.location.hostname.includes('github.io');

// Используем разные URL для API
const API_BASE_URL = isGitHubPages 
    ? 'https://89.110.65.155:8083'  // Нужен HTTPS для GitHub Pages
    : 'http://89.110.65.155:8083';   // HTTP для локальной разработки
```

## Альтернативные платформы

Если GitHub Pages не подходит из-за CORS:

- **Netlify:** https://netlify.com
- **Vercel:** https://vercel.com  
- **Surge.sh:** https://surge.sh

Все они поддерживают custom headers для CORS.
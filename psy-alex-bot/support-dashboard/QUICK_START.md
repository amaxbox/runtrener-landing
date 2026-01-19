# 🚀 Быстрый старт Support Dashboard

## 1. Установка

```bash
cd support-dashboard
npm install
```

## 2. Настройка

Создайте файл `.env`:

```bash
# PostgreSQL (скопируйте из ya-direct/.env)
PGUSER=your_username
PGPASSWORD=your_password
PGHOST=your_host.mdb.yandexcloud.net
PGPORT=6432
PGDATABASE=your_database

# Server
PORT=3005

# Пароль для входа в дашборд
SUPPORT_PASSWORD=SecurePassword123
```

## 3. Запуск локально

```bash
npm start
```

Откройте: http://localhost:3005

## 4. Деплой на сервер

```bash
# Скопируйте папку на сервер
scp -r support-dashboard user@server:/path/to/

# На сервере
cd /path/to/support-dashboard
npm install
pm2 start ecosystem.config.js
pm2 save
```

## 5. Nginx конфигурация

Создайте файл `/etc/nginx/sites-available/support-dashboard`:

```nginx
server {
    listen 80;
    server_name support.psy-alex.ru;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте:

```bash
sudo ln -s /etc/nginx/sites-available/support-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. SSL (опционально)

```bash
sudo certbot --nginx -d support.psy-alex.ru
```

## ✅ Готово!

Теперь страница доступна по адресу:
- Локально: http://localhost:3005
- На сервере: http://support.psy-alex.ru (или ваш домен)

**Пароль для входа:** тот что указали в `SUPPORT_PASSWORD`

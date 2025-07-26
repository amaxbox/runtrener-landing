# Инструкция по деплою

## Быстрый деплой

### 1. Grafana Proxy

```bash
cd grafana-proxy
chmod +x deploy.sh
./deploy.sh
```

Прокси будет доступен на `http://89.110.65.155:8083`

### 2. Лендинг на веб-сервер

#### Nginx
```bash
# Скопировать файлы
scp -i /Users/amax/.ssh/pdf_generator_ed25519 index.html root@89.110.65.155:/var/www/html/

# Настроить Nginx
sudo nano /etc/nginx/sites-available/running-coach
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # CORS для API запросов
    location /api/ {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
    }
}
```

#### Apache
```bash
# .htaccess файл
cat > .htaccess << 'EOF'
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^.*$ / [L,QSA]

# CORS headers
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header always set Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range"
EOF
```

### 3. Проверка деплоя

```bash
# Проверить прокси
curl http://89.110.65.155:8083/api/stats

# Проверить лендинг
curl http://your-domain.com

# Проверить интеграцию
# Откройте лендинг в браузере и проверьте консоль (F12)
```

## Структура на сервере

```
/var/www/
├── html/
│   └── index.html          # Лендинг
└── grafana-proxy/          # Прокси приложение
    ├── app.py
    ├── docker-compose.yml
    └── ...
```

## Мониторинг

### Логи прокси
```bash
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'cd /var/www/grafana-proxy && docker-compose logs -f grafana-proxy'
```

### Статус контейнеров
```bash
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'docker ps'
```

### Перезапуск сервисов
```bash
# Перезапуск прокси
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'cd /var/www/grafana-proxy && docker-compose restart'

# Перезапуск Nginx
sudo systemctl restart nginx
```

## SSL/HTTPS (рекомендуется)

```bash
# Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Обновление

### Обновить лендинг
```bash
scp -i /Users/amax/.ssh/pdf_generator_ed25519 index.html root@89.110.65.155:/var/www/html/
```

### Обновить прокси
```bash
cd grafana-proxy
./deploy.sh
```

## Backup

### Создание резервной копии
```bash
# Локально
tar -czf running-coach-landing-$(date +%Y%m%d).tar.gz running-coach-landing/

# На сервере
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'tar -czf /backup/running-coach-$(date +%Y%m%d).tar.gz /var/www/html/index.html /var/www/grafana-proxy/'
```

### Восстановление
```bash
# Распаковать и загрузить
tar -xzf running-coach-landing-20250126.tar.gz
cd running-coach-landing/grafana-proxy
./deploy.sh
```
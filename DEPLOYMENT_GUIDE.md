# Руководство по развертыванию лендинга

## 🚀 Шаги для развертывания

### 1. Настройка DNS записей

В панели управления вашего регистратора домена создайте следующие DNS записи:

```
A запись: @ → IP-адрес вашего сервера
A запись: www → IP-адрес вашего сервера
```

Или используйте CNAME для www:
```
A запись: @ → IP-адрес вашего сервера  
CNAME запись: www → ваш-домен.com
```

### 2. Подготовка сервера

Убедитесь, что на сервере установлены:
- Nginx
- Certbot (для SSL)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx
```

### 3. Редактирование конфигурации

Перед развертыванием отредактируйте файлы:

**deploy.sh:**
- `DOMAIN="ваш-домен.com"`
- `SERVER_HOST="IP-адрес-сервера"`

**nginx.conf:**
- Замените `your-domain.com` на ваш домен
- Замените `your-server-ip` на IP-адрес сервера

### 4. Развертывание

```bash
./deploy.sh
```

### 5. Настройка SSL сертификата

После успешного развертывания на сервере выполните:

```bash
sudo certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
```

### 6. Проверка

Откройте в браузере:
- `https://ваш-домен.com`
- `https://www.ваш-домен.com`

## 🔧 Структура проекта

```
running-coach-landing/
├── index.html              # Основной файл лендинга
├── nginx.conf              # Конфигурация Nginx
├── deploy.sh               # Скрипт развертывания
└── DEPLOYMENT_GUIDE.md     # Это руководство
```

## 📋 Системные требования

- **Сервер:** Ubuntu 20.04+ / CentOS 8+
- **RAM:** 1GB минимум
- **Диск:** 10GB свободного места
- **Сеть:** Публичный IP-адрес

## 🛠 Полезные команды

```bash
# Проверка статуса Nginx
sudo systemctl status nginx

# Перезагрузка Nginx
sudo systemctl reload nginx

# Просмотр логов
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Продление SSL сертификата
sudo certbot renew --dry-run
```

## 🚨 Troubleshooting

**Проблема:** Сайт не открывается
- Проверьте DNS записи (может занять до 24 часов)
- Убедитесь, что порты 80 и 443 открыты на сервере
- Проверьте конфигурацию Nginx: `sudo nginx -t`

**Проблема:** SSL ошибки
- Проверьте, что домен правильно настроен в DNS
- Убедитесь, что Certbot успешно создал сертификат

**Проблема:** 502/503 ошибки
- Проверьте логи Nginx
- Убедитесь, что все пути в конфигурации корректны
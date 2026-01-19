# Деплой Support Dashboard

## Статус проекта

**🟢 В продакшне**

- **URL**: https://psy-alex.ru/support
- **Сервер**: root@89.110.65.155
- **Директория**: /root/support-dashboard
- **PM2 процесс**: support-dashboard
- **Порт**: 3005 (локальный)
- **Пароль входа**: Of1UP7Pv0holE3bY

---

## Быстрый деплой

### 1. Создать архив (локально)

```bash
cd /Users/amax/Lab/psy-alex-bot/support-dashboard
tar -czf ../support-dashboard-deploy.tar.gz --exclude='node_modules' --exclude='.DS_Store' --exclude='logs' .
```

### 2. Загрузить на сервер

```bash
cd /Users/amax/Lab/psy-alex-bot
scp -i ~/.ssh/vds-youtube-bot support-dashboard-deploy.tar.gz root@89.110.65.155:/root/
```

### 3. Развернуть на сервере

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "
  cd /root/support-dashboard &&
  tar -xzf /root/support-dashboard-deploy.tar.gz &&
  npm install --production &&
  pm2 restart support-dashboard
"
```

---

## Полный деплой с нуля

### 1. Загрузить файлы

```bash
cd /Users/amax/Lab/psy-alex-bot
tar -czf support-dashboard-deploy.tar.gz --exclude='node_modules' --exclude='.DS_Store' --exclude='logs' support-dashboard/
scp -i ~/.ssh/vds-youtube-bot support-dashboard-deploy.tar.gz root@89.110.65.155:/root/
```

### 2. Развернуть

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155
cd /root
mkdir -p support-dashboard
cd support-dashboard
tar -xzf /root/support-dashboard-deploy.tar.gz
npm install --production
```

### 3. Проверить .env

```bash
cat /root/support-dashboard/.env
```

Должен содержать:
- PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE - данные PostgreSQL
- PORT=3005
- SUPPORT_PASSWORD=Of1UP7Pv0holE3bY

### 4. Запустить через PM2

```bash
cd /root/support-dashboard
pm2 start ecosystem.config.js
pm2 save
pm2 list
```

### 5. Проверить логи

```bash
pm2 logs support-dashboard --lines 20
```

---

## Nginx конфигурация

Добавлено в `/etc/nginx/sites-enabled/psy-alex.ru`:

```nginx
# Support Dashboard для psy-alex-bot
location /support {
    proxy_pass http://127.0.0.1:3005;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Rewrite для корректной работы SPA
    rewrite ^/support/?(.*)$ /$1 break;
}
```

После изменения конфигурации:

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "nginx -t && systemctl reload nginx"
```

---

## Проверка работы

### Health check

```bash
curl https://psy-alex.ru/support/health
```

Ожидается:
```json
{"status":"ok","database":"connected","timestamp":"..."}
```

### Открыть в браузере

https://psy-alex.ru/support

Должна открыться страница входа с полем для пароля.

### Проверить логи PM2

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 logs support-dashboard --lines 20"
```

### Проверить статус PM2

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 status"
```

---

## Управление процессом

### Рестарт

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 restart support-dashboard"
```

### Остановка

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 stop support-dashboard"
```

### Запуск

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 start support-dashboard"
```

### Удаление из PM2

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 delete support-dashboard"
```

---

## Обновление пароля

### 1. Отредактировать .env на сервере

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "nano /root/support-dashboard/.env"
```

Изменить: `SUPPORT_PASSWORD=новый_пароль`

### 2. Перезапустить приложение

```bash
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 restart support-dashboard"
```

---

## Troubleshooting

### Приложение не запускается

```bash
# Проверить логи
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 logs support-dashboard --err --lines 50"

# Проверить что PostgreSQL сертификат на месте
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "ls -la ~/.postgresql/root.crt"

# Проверить .env
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "cat /root/support-dashboard/.env"
```

### Страница не открывается (502/504)

```bash
# Проверить что приложение запущено
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 status"

# Проверить nginx
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "nginx -t"

# Проверить логи nginx
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "tail -50 /var/log/nginx/psy-alex.ru.error.log"
```

### База данных не подключается

```bash
# Проверить что сертификат корректный
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "cat ~/.postgresql/root.crt"

# Проверить настройки БД
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "cat /root/support-dashboard/.env | grep PG"

# Проверить логи приложения
ssh -i ~/.ssh/vds-youtube-bot root@89.110.65.155 "pm2 logs support-dashboard --lines 50"
```

---

## История изменений

### 2026-01-18 (вечер) - Мобильная версия и UX улучшения
- ✅ Мобильная верстка: добавлен card view для таблицы пользователей (< 768px)
- ✅ Реорганизация хедера: табы и кнопка "Назад" перенесены в фиксированный хедер
- ✅ Фильтр подписок: заменен dropdown на tab buttons (Все | Free | Pro)
- ✅ Таблица пользователей:
  - Заменено "ID" на "Telegram User ID" с иконкой копирования
  - Добавлена колонка "Активность" (updated_at) с сортировкой
  - Добавлена колонка "Сообщений/день" (daily_message_count + daily_message_count_date)
  - Добавлена сортировка по регистрации (created_at) и активности (updated_at)
  - Показывается количество пользователей в выборке
- ✅ Copy-to-clipboard: добавлена функция копирования для Telegram ID и карточек данных
- ✅ БД: добавлены поля daily_message_count_date, поддержка динамической сортировки
- ✅ API: добавлены параметры sortBy и sortOrder в /api/users

### 2026-01-18 (утро)
- ✅ Изменено отображение статуса: теперь простой текст вместо цветного badge
- ✅ Добавлено выделение подписки PRO синим лейблом
- ✅ Добавлено отображение даты окончания PRO подписки (берется из alex_payments)
- ✅ Обновлен SQL запрос с JOIN к таблице платежей для получения pro_before

### 2026-01-17
- ✅ Добавлено время регистрации в таблицу пользователей
- ✅ Обновлен пароль входа: Of1UP7Pv0holE3bY
- ✅ Первый деплой на сервер
- ✅ Настроен nginx для /support
- ✅ Приложение запущено через PM2

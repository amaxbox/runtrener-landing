# Автоматизация бэкапов n8n

## Концепция автоматического бэкапа

### Цели
- Регулярные бэкапы БД PostgreSQL и данных n8n
- Ротация старых бэкапов (хранить последние N штук)
- Уведомления об успехе/ошибках в Telegram
- Опционально: выгрузка в облако (S3/Yandex Object Storage)

---

## Вариант 1: Cron + скрипт на сервере

### Структура

```
/opt/n8n/
├── backups/
│   ├── daily/          # ежедневные бэкапы (хранить 7 дней)
│   ├── weekly/         # еженедельные (хранить 4 недели)
│   └── monthly/        # ежемесячные (хранить 3 месяца)
├── scripts/
│   ├── backup.sh       # основной скрипт
│   └── rotate.sh       # ротация старых бэкапов
└── .env
```

### Скрипт: `/opt/n8n/scripts/backup.sh`

```bash
#!/bin/bash
set -euo pipefail

# Конфигурация
BACKUP_DIR="/opt/n8n/backups"
RETENTION_DAYS=7
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
DATE=$(date +%Y%m%d_%H%M%S)
TYPE=${1:-daily}  # daily/weekly/monthly

# Директории
BACKUP_PATH="$BACKUP_DIR/$TYPE"
mkdir -p "$BACKUP_PATH"

# Функция отправки в Telegram
send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" > /dev/null
}

# Начало бэкапа
send_telegram "🔄 <b>Бэкап n8n запущен</b>%0AТип: $TYPE%0AДата: $(date +'%Y-%m-%d %H:%M:%S')"

# 1. Бэкап PostgreSQL
echo "Creating PostgreSQL backup..."
DB_BACKUP="$BACKUP_PATH/postgres_${DATE}.sql.gz"
docker compose -f /opt/n8n/docker-compose.yml exec -T postgres \
    pg_dump -U n8n n8n | gzip > "$DB_BACKUP"

DB_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
echo "PostgreSQL backup created: $DB_SIZE"

# 2. Бэкап данных n8n
echo "Creating n8n data backup..."
DATA_BACKUP="$BACKUP_PATH/data_${DATE}.tar.gz"
tar -czf "$DATA_BACKUP" -C /opt/n8n data/

DATA_SIZE=$(du -h "$DATA_BACKUP" | cut -f1)
echo "Data backup created: $DATA_SIZE"

# 3. Бэкап конфигурации
echo "Creating config backup..."
CONFIG_BACKUP="$BACKUP_PATH/config_${DATE}.tar.gz"
tar -czf "$CONFIG_BACKUP" -C /opt/n8n \
    docker-compose.yml \
    .env \
    monitoring/ \
    nginx-n8n.conf 2>/dev/null || true

CONFIG_SIZE=$(du -h "$CONFIG_BACKUP" | cut -f1)
echo "Config backup created: $CONFIG_SIZE"

# 4. Ротация старых бэкапов
echo "Rotating old backups..."
find "$BACKUP_PATH" -name "postgres_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_PATH" -name "data_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_PATH" -name "config_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

BACKUP_COUNT=$(ls -1 "$BACKUP_PATH"/postgres_*.sql.gz 2>/dev/null | wc -l)

# 5. Опционально: отправка в S3
if [ "${S3_ENABLED:-false}" = "true" ]; then
    echo "Uploading to S3..."
    aws s3 cp "$DB_BACKUP" "s3://${S3_BUCKET}/n8n/backups/${TYPE}/" || true
    aws s3 cp "$DATA_BACKUP" "s3://${S3_BUCKET}/n8n/backups/${TYPE}/" || true
fi

# Успех
send_telegram "✅ <b>Бэкап n8n завершён</b>%0A%0A<b>Размеры:</b>%0A• БД: $DB_SIZE%0A• Данные: $DATA_SIZE%0A• Конфиг: $CONFIG_SIZE%0A%0A<b>Хранится бэкапов:</b> $BACKUP_COUNT%0A<b>Путь:</b> $BACKUP_PATH"

echo "Backup completed successfully!"
```

### Настройка cron

```bash
# /etc/cron.d/n8n-backup

# Ежедневный бэкап в 03:00
0 3 * * * root /opt/n8n/scripts/backup.sh daily 2>&1 | logger -t n8n-backup

# Еженедельный бэкап в воскресенье в 04:00
0 4 * * 0 root /opt/n8n/scripts/backup.sh weekly 2>&1 | logger -t n8n-backup

# Ежемесячный бэкап 1-го числа в 05:00
0 5 1 * * root /opt/n8n/scripts/backup.sh monthly 2>&1 | logger -t n8n-backup
```

### Установка

```bash
# 1. Создать директории
mkdir -p /opt/n8n/{backups/{daily,weekly,monthly},scripts}

# 2. Создать скрипт
nano /opt/n8n/scripts/backup.sh
# (вставить содержимое выше)

# 3. Сделать исполняемым
chmod +x /opt/n8n/scripts/backup.sh

# 4. Настроить переменные в .env
echo "S3_ENABLED=false" >> /opt/n8n/.env
echo "S3_BUCKET=your-bucket-name" >> /opt/n8n/.env

# 5. Настроить cron
nano /etc/cron.d/n8n-backup

# 6. Проверить работу
/opt/n8n/scripts/backup.sh daily
```

---

## Вариант 2: n8n workflow (рекурсия!)

### Идея
Использовать сам n8n для автоматизации своих бэкапов

### Workflow: "n8n Self-Backup"

```yaml
Nodes:
1. Schedule Trigger (каждый день в 03:00)
   ↓
2. Execute Command (SSH на хост или Execute в контейнере)
   Command: docker compose exec -T postgres pg_dump -U n8n n8n | gzip > /tmp/backup.sql.gz
   ↓
3. Read Binary File
   Path: /tmp/backup.sql.gz
   ↓
4. Yandex Disk / Google Drive / S3 (загрузка файла)
   ↓
5. Telegram (уведомление об успехе)
   ↓
6. [On Error] Telegram (уведомление об ошибке)
```

### Преимущества
- ✅ Визуальная настройка через UI
- ✅ Встроенная интеграция с облаками
- ✅ История выполнений в n8n
- ✅ Легко менять расписание

### Недостатки
- ❌ Если n8n упал, бэкап не сработает
- ❌ Сложно бэкапить сам n8n изнутри

---

## Вариант 3: Docker-контейнер для бэкапов

### Концепция
Отдельный легковесный контейнер с cron внутри

### docker-compose.yml

```yaml
services:
  # ... существующие сервисы ...

  n8n-backup:
    image: alpine:latest
    restart: unless-stopped
    volumes:
      - /opt/n8n:/opt/n8n:ro
      - /opt/n8n/backups:/backups
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - POSTGRES_CONTAINER=n8n-postgres-1
      - POSTGRES_USER=n8n
      - POSTGRES_DB=n8n
      - RETENTION_DAYS=7
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    command: |
      sh -c "
        apk add --no-cache docker-cli postgresql-client bash curl dcron &&
        echo '0 3 * * * /usr/local/bin/backup.sh' > /etc/crontabs/root &&
        crond -f -l 2
      "
```

---

## Вариант 4: Managed backup service (внешний)

### Инструменты
- **Borg Backup** - дедупликация, шифрование, компрессия
- **Restic** - современный, простой, поддержка S3/B2/Azure
- **pgBackRest** - специализированный для PostgreSQL

### Пример: Restic + Yandex Object Storage

```bash
# Установка
wget https://github.com/restic/restic/releases/download/v0.16.0/restic_0.16.0_linux_amd64.bz2
bunzip2 restic_0.16.0_linux_amd64.bz2
chmod +x restic_0.16.0_linux_amd64
mv restic_0.16.0_linux_amd64 /usr/local/bin/restic

# Инициализация репозитория
export RESTIC_REPOSITORY=s3:https://storage.yandexcloud.net/your-bucket/n8n
export RESTIC_PASSWORD=your-strong-password
export AWS_ACCESS_KEY_ID=your-yandex-key
export AWS_SECRET_ACCESS_KEY=your-yandex-secret

restic init

# Бэкап
restic backup /opt/n8n/backups/daily

# Восстановление
restic restore latest --target /opt/n8n/restore

# Автоматическая очистка (оставить последние 7 дневных, 4 недельных)
restic forget --keep-daily 7 --keep-weekly 4 --prune
```

---

## Рекомендуемая архитектура (гибрид)

```
┌─────────────────────────────────────────────────────┐
│  Сервер vds-n8n                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cron (03:00 daily)                                │
│    ↓                                               │
│  /opt/n8n/scripts/backup.sh                        │
│    ├─ PostgreSQL dump → /opt/n8n/backups/daily/   │
│    ├─ n8n data archive → /opt/n8n/backups/daily/  │
│    └─ Config archive → /opt/n8n/backups/daily/    │
│                                                     │
│  Ротация: хранить 7 дней                          │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   ├─ Уведомление → Telegram
                   │
                   └─ (опционально) → Yandex Object Storage
                                       (долгосрочное хранение)
```

### Этапы внедрения

**Этап 1 (MVP):**
1. Создать скрипт `backup.sh`
2. Настроить cron для ежедневных бэкапов
3. Добавить Telegram уведомления

**Этап 2:**
4. Добавить недельные/месячные бэкапы
5. Настроить ротацию (хранить 7 дней/4 недели/3 месяца)

**Этап 3:**
6. Интегрировать Yandex Object Storage
7. Долгосрочное хранение месячных бэкапов в облаке

**Этап 4:**
8. Протестировать восстановление из бэкапа
9. Документировать процедуру восстановления

---

## Мониторинг бэкапов

### Prometheus + Alertmanager

Добавить метрику "время последнего успешного бэкапа":

```bash
# В конце backup.sh
echo "n8n_backup_last_success_timestamp $(date +%s)" > /var/lib/node_exporter/textfile_collector/n8n_backup.prom
```

### Алерт в Prometheus

```yaml
# /opt/n8n/monitoring/rules/backup_alerts.yml
groups:
  - name: backup_alerts
    rules:
      - alert: N8NBackupTooOld
        expr: (time() - n8n_backup_last_success_timestamp) > 86400 * 2  # 2 дня
        labels:
          severity: warning
        annotations:
          summary: "n8n бэкап не выполнялся более 2 дней"
          description: "Последний успешный бэкап был {{ $value | humanizeDuration }} назад"
```

---

## Восстановление из бэкапа

### Сценарий 1: Восстановление БД

```bash
# 1. Остановить n8n
cd /opt/n8n && docker compose stop n8n-main n8n-worker

# 2. Восстановить БД
gunzip < backups/daily/postgres_20251014_030000.sql.gz | \
    docker compose exec -T postgres psql -U n8n -d n8n

# 3. Запустить n8n
docker compose up -d
```

### Сценарий 2: Полное восстановление

```bash
# 1. Остановить все
cd /opt/n8n && docker compose down

# 2. Восстановить данные
rm -rf data/
tar -xzf backups/daily/data_20251014_030000.tar.gz

# 3. Восстановить конфиг
tar -xzf backups/daily/config_20251014_030000.tar.gz

# 4. Восстановить БД
docker compose up -d postgres
sleep 5
gunzip < backups/daily/postgres_20251014_030000.sql.gz | \
    docker compose exec -T postgres psql -U n8n -d n8n

# 5. Запустить всё
docker compose up -d
```

---

## Стоимость хранения

### Локальное хранение (на VDS)
- Daily: 7 дней × 3 GB = ~21 GB
- Weekly: 4 недели × 3 GB = ~12 GB
- Monthly: 3 месяца × 3 GB = ~9 GB
- **Итого:** ~42 GB на диске

### Yandex Object Storage (холодное хранение)
- Стоимость: ~0.8 ₽/GB/месяц (холодное хранение)
- 42 GB × 0.8 ₽ = **~34 ₽/месяц**

---

## Чеклист внедрения

- [ ] Создать структуру директорий
- [ ] Написать скрипт backup.sh
- [ ] Протестировать скрипт вручную
- [ ] Настроить Telegram уведомления
- [ ] Настроить cron
- [ ] Протестировать восстановление из бэкапа (!)
- [ ] Добавить мониторинг в Prometheus
- [ ] Опционально: настроить S3/Object Storage
- [ ] Документировать процедуру восстановления

---

## Следующие шаги

1. **Немедленно:** Создать скрипт и запустить первый тестовый бэкап
2. **На этой неделе:** Настроить cron и Telegram уведомления
3. **В течение месяца:** Протестировать полное восстановление
4. **При необходимости:** Добавить облачное хранилище

**Готов помочь с реализацией любого из вариантов!**

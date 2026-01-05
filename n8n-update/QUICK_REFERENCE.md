# n8n Quick Reference

Быстрая справка по управлению n8n инфраструктурой.

## Текущая конфигурация

- **Версия**: n8n-yc:1.123.5 (кастомный образ)
- **Архитектура**: 1 main + 6 workers
- **БД**: PostgreSQL 16 (локальная)
- **Очередь**: Redis 7
- **SSL**: Yandex Cloud CA встроен
- **Домен**: https://n8n.amaxbox.me

## Быстрые команды

### Проверка статуса

```bash
# Статус контейнеров
ssh vds-n8n "docker ps --filter 'name=n8n'"

# Здоровье n8n
curl https://n8n.amaxbox.me/healthz

# Логи main
ssh vds-n8n "docker logs n8n-n8n-main-1 --tail 50"

# Логи всех воркеров
ssh vds-n8n "docker logs n8n-n8n-worker-23 --tail 20"
```

### Управление

```bash
# Перезапуск main
ssh vds-n8n "cd /opt/n8n && docker compose restart n8n-main"

# Перезапуск всех воркеров
ssh vds-n8n "cd /opt/n8n && docker compose restart n8n-worker"

# Масштабирование воркеров
ssh vds-n8n "cd /opt/n8n && docker compose up -d --scale n8n-worker=6"

# Остановка всех сервисов
ssh vds-n8n "cd /opt/n8n && docker compose down"

# Запуск всех сервисов
ssh vds-n8n "cd /opt/n8n && docker compose up -d"
```

### Бэкап

```bash
# Создать бэкап БД (сжатый)
ssh vds-n8n "cd /opt/n8n && docker compose exec -T postgres pg_dump -U n8n n8n | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Список бэкапов
ssh vds-n8n "ls -lh /opt/n8n/backup_*.sql.gz"

# Восстановление из бэкапа
ssh vds-n8n "gunzip -c /opt/n8n/backup_FILE.sql.gz | docker compose exec -T postgres psql -U n8n n8n"
```

### Обновление

```bash
# 1. Создать бэкап
ssh vds-n8n "cd /opt/n8n && docker compose exec -T postgres pg_dump -U n8n n8n | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# 2. Обновить Dockerfile (изменить версию FROM)
ssh vds-n8n "nano /opt/n8n/Dockerfile"

# 3. Пересобрать образ
ssh vds-n8n "cd /opt/n8n && docker build -t n8n-yc:НОВАЯ_ВЕРСИЯ ."

# 4. Обновить docker-compose.yml локально и скопировать
scp docker-compose.yml vds-n8n:/opt/n8n/

# 5. Перезапустить
ssh vds-n8n "cd /opt/n8n && docker compose up -d --force-recreate"
```

### Мониторинг

```bash
# Grafana
open http://89.110.65.155:3000

# Prometheus
ssh vds-n8n "curl localhost:9090/api/v1/targets"

# Метрики n8n
ssh vds-n8n "curl localhost:5678/metrics"

# Alertmanager
ssh vds-n8n "curl localhost:9093/api/v2/alerts"
```

### Проблемы и решения

#### n8n не запускается

```bash
# Проверить логи
ssh vds-n8n "docker logs n8n-n8n-main-1"

# Проверить БД
ssh vds-n8n "docker compose exec postgres psql -U n8n -c 'SELECT version();'"

# Проверить Redis
ssh vds-n8n "docker compose exec redis redis-cli ping"
```

#### Ошибка SSL с Yandex PostgreSQL

```bash
# Проверить сертификат в контейнере
ssh vds-n8n "docker exec n8n-n8n-main-1 tail /etc/ssl/certs/ca-certificates.crt"

# Проверить переменную NODE_EXTRA_CA_CERTS
ssh vds-n8n "docker exec n8n-n8n-main-1 env | grep NODE_EXTRA_CA_CERTS"

# Должен быть: NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

#### Воркеры не работают

```bash
# Проверить количество воркеров
ssh vds-n8n "docker ps --filter 'name=n8n-worker' --format '{{.Names}}'"

# Восстановить 6 воркеров
ssh vds-n8n "cd /opt/n8n && docker compose up -d --scale n8n-worker=6"

# Проверить Redis очередь
ssh vds-n8n "docker compose exec redis redis-cli info | grep connected_clients"
```

## Важные файлы и пути

### На сервере (vds-n8n)

```
/opt/n8n/
├── docker-compose.yml      # Основная конфигурация
├── Dockerfile              # Образ с Yandex CA
├── .env                    # Переменные окружения
├── data/                   # Данные n8n
├── db/                     # База данных PostgreSQL
├── certs/                  # SSL сертификаты
│   └── yandex-ca.crt
├── monitoring/             # Конфигурация мониторинга
└── backup_*.sql.gz         # Бэкапы

/etc/nginx/sites-available/n8n    # Конфигурация nginx
/etc/letsencrypt/live/n8n.amaxbox.me/  # SSL сертификаты Let's Encrypt
```

### Локально

```
~/Lab/n8n-update/
├── docker-compose.yml
├── Dockerfile
├── README.md
├── UPDATE_INFO.md
├── YANDEX_CLOUD_SSL.md
└── QUICK_REFERENCE.md (этот файл)
```

## Переменные окружения

```bash
# Просмотр всех переменных
ssh vds-n8n "cat /opt/n8n/.env"

# Критические переменные:
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis
N8N_METRICS=true
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt  # в Dockerfile
```

## Порты

- **5678**: n8n main (127.0.0.1 only, через nginx)
- **3000**: Grafana
- **9090**: Prometheus (internal)
- **9093**: Alertmanager (internal)
- **9100**: Node Exporter
- **8080**: cAdvisor
- **9187**: Postgres Exporter
- **9121**: Redis Exporter
- **9115**: Blackbox Exporter

## Полезные ссылки

- **n8n UI**: https://n8n.amaxbox.me
- **Grafana**: http://89.110.65.155:3000
- **Документация проекта**: [README.md](README.md)
- **История обновлений**: [UPDATE_INFO.md](UPDATE_INFO.md)
- **Yandex Cloud SSL**: [YANDEX_CLOUD_SSL.md](YANDEX_CLOUD_SSL.md)

## Контакты и алерты

- **Telegram Chat ID**: -4982304484
- **Alertmanager** шлёт уведомления о проблемах
- **Heartbeat** каждые 2 часа (всё работает)

## Чеклист при проблемах

- [ ] Проверить логи: `docker logs n8n-n8n-main-1`
- [ ] Проверить статус: `docker ps --filter 'name=n8n'`
- [ ] Проверить health: `curl https://n8n.amaxbox.me/healthz`
- [ ] Проверить БД: `docker compose exec postgres psql -U n8n -c 'SELECT 1'`
- [ ] Проверить Redis: `docker compose exec redis redis-cli ping`
- [ ] Проверить воркеры: должно быть 6 штук
- [ ] Проверить мониторинг: Grafana должна показывать метрики
- [ ] Проверить алерты: в Telegram должны приходить heartbeat'ы

## SSH алиасы (опционально)

Добавьте в `~/.ssh/config`:

```
Host vds-n8n
    HostName 89.110.65.155
    User root
    IdentityFile ~/.ssh/vds-outline
```

Тогда можно использовать просто: `ssh vds-n8n`

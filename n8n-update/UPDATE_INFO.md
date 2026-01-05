# n8n Update Information

## Текущая версия
**n8n-yc:1.123.5** (кастомный образ с Yandex Cloud CA, обновлено 12 декабря 2025)

Базовый образ: **n8nio/n8n:1.123.5**

---

## История обновлений

### 2025-12-12: Обновление до 1.123.5 + добавление Yandex Cloud SSL

#### Выполненные работы

1. **Обновление n8n**: 1.122.4 → 1.123.5
2. **Создан кастомный Docker образ** `n8n-yc:1.123.5` с встроенным Yandex Cloud CA
3. **Добавлен SSL сертификат** для подключения к Managed PostgreSQL в Yandex Cloud
4. **Настроена переменная** `NODE_EXTRA_CA_CERTS` для Node.js

#### Технические детали

**Бэкап:**
- Файл: `/opt/n8n/backup_20251212_093546.sql.gz`
- Размер: 3.3 GB (сжатый)
- Исходный размер БД: 14 GB

**Новый образ:**
```dockerfile
FROM n8nio/n8n:1.123.5

USER root
COPY certs/yandex-ca.crt /etc/ssl/certs/yandex-ca.pem
RUN cat /etc/ssl/certs/yandex-ca.pem >> /etc/ssl/certs/ca-certificates.crt
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

USER node
```

**Изменения в docker-compose.yml:**
- `n8n-main`: image изменён на `n8n-yc:1.123.5`
- `n8n-worker`: image изменён на `n8n-yc:1.123.5`
- Удалены volume монтирования сертификатов (встроены в образ)

**Проверка:**
```bash
# Версия
docker ps --filter 'name=n8n-main' --format '{{.Image}}'
# Output: n8n-yc:1.123.5

# Переменная окружения
docker exec n8n-n8n-main-1 env | grep NODE_EXTRA_CA_CERTS
# Output: NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Сертификат в системе
docker exec n8n-n8n-main-1 tail -5 /etc/ssl/certs/ca-certificates.crt
# Содержит Yandex CA
```

#### Решённые проблемы

1. ✅ Ошибка "self-signed certificate in certificate chain" при подключении к Yandex PostgreSQL
2. ✅ Восстановлено количество воркеров (6 штук)
3. ✅ Обновлена документация с процессом обновления

#### Конфигурация после обновления

- **Main инстанс**: 1 × n8n-yc:1.123.5
- **Воркеры**: 6 × n8n-yc:1.123.5 (workers 23-28)
- **PostgreSQL**: 16 (локальный)
- **Redis**: 7
- **Мониторинг**: Prometheus, Grafana, Alertmanager - работают
- **SSL сертификат Yandex**: валиден до 2027-06-20

#### Время выполнения

- Бэкап БД: ~10 минут (14 GB → 3.3 GB)
- Обновление образов: ~2 минуты
- Пересоздание контейнеров: ~1 минута
- **Общее время**: ~13 минут

#### Примечания

- Сертификат Yandex Cloud теперь **встроен** в образ, не требуется монтирование
- При следующем обновлении нужно пересобрать образ с новой версией базового n8n
- Dockerfile хранится в `/opt/n8n/Dockerfile` на сервере
- Сертификат хранится в `/opt/n8n/certs/yandex-ca.crt`

---

## Следующее обновление

### Процесс обновления до новой версии

1. **Проверить доступные версии:**
   ```bash
   # Проверить последнюю версию на GitHub
   curl -s https://api.github.com/repos/n8n-io/n8n/releases/latest | grep tag_name
   ```

2. **Создать бэкап:**
   ```bash
   ssh vds-n8n
   cd /opt/n8n
   docker compose exec -T postgres pg_dump -U n8n n8n | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
   ```

3. **Обновить Dockerfile:**
   ```bash
   ssh vds-n8n
   cd /opt/n8n
   # Изменить FROM n8nio/n8n:1.123.5 на новую версию
   nano Dockerfile
   ```

4. **Пересобрать образ:**
   ```bash
   cd /opt/n8n
   docker build -t n8n-yc:НОВАЯ_ВЕРСИЯ .
   ```

5. **Обновить docker-compose.yml локально:**
   - Изменить версию в image для n8n-main и n8n-worker
   - Скопировать на сервер: `scp docker-compose.yml vds-n8n:/opt/n8n/`

6. **Перезапустить контейнеры:**
   ```bash
   ssh vds-n8n
   cd /opt/n8n
   docker compose up -d --force-recreate n8n-main
   docker compose up -d --force-recreate --scale n8n-worker=6 n8n-worker
   ```

7. **Проверить:**
   ```bash
   docker ps --filter 'name=n8n'
   curl https://n8n.amaxbox.me/healthz
   docker logs n8n-n8n-main-1
   ```

### Важно помнить

- ⚠️ **Всегда пересобирайте образ** с Yandex CA сертификатом
- ⚠️ **Не используйте стандартный** образ n8nio/n8n напрямую
- ⚠️ **Проверяйте** что `NODE_EXTRA_CA_CERTS` установлен в образе
- ⚠️ **Делайте бэкап** перед каждым обновлением

---

## Проверка совместимости

### Текущий стек
- ✅ PostgreSQL 16 - совместима
- ✅ Redis 7 - совместим
- ✅ Queue mode (Bull/Redis) - совместим
- ✅ Nginx proxy - без изменений
- ✅ Docker Compose v2

### Критические компоненты
- Yandex Cloud CA сертификат (валиден до 2027-06-20)
- NODE_EXTRA_CA_CERTS переменная
- Мониторинг: Prometheus, Grafana, Alertmanager

---

## Откат на предыдущую версию

Если после обновления возникли проблемы:

```bash
# 1. Остановить контейнеры
ssh vds-n8n "cd /opt/n8n && docker compose down"

# 2. Восстановить бэкап БД (если нужно)
ssh vds-n8n "cd /opt/n8n && gunzip -c backup_20251212_093546.sql.gz | docker compose exec -T postgres psql -U n8n n8n"

# 3. Откатить docker-compose.yml на предыдущую версию
# Изменить image: n8n-yc:НОВАЯ_ВЕРСИЯ на n8n-yc:1.123.5

# 4. Запустить контейнеры
ssh vds-n8n "cd /opt/n8n && docker compose up -d"
```

---

## Ссылки

- [Процесс обновления](README.md#процесс-обновления-n8n)
- [Настройка Yandex Cloud SSL](YANDEX_CLOUD_SSL.md)
- [n8n Release Notes](https://docs.n8n.io/release-notes/)
- [n8n GitHub Releases](https://github.com/n8n-io/n8n/releases)
- [n8n Docker Hub](https://hub.docker.com/r/n8nio/n8n/tags)

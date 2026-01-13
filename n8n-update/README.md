# n8n Infrastructure Context

## Текущее состояние системы

### Версия n8n
- **Образ**: n8n-yc:2.4.0-moy-nalog (кастомный с Yandex Cloud CA + внешние пакеты)
- **Базовый образ**: n8nio/n8n:2.4.0
- **Обновлено**: 13 января 2026
- **Архитектура**: 1 main инстанс + 6 workers
- **База данных**: PostgreSQL 16 (локальный контейнер)
- **Очередь задач**: Redis 7
- **SSL сертификат**: Yandex Cloud CA встроен в образ (валиден до 2027-06-20)
- **Внешние npm пакеты**: moy-nalog@1.0.6
- **Task Runners**: Internal mode (enabled by default в n8n 2.0)

### Контейнеры
```
n8n-n8n-main-1 - основной инстанс, порт 127.0.0.1:5678
n8n-n8n-worker-24,25,26 (3 штуки) - обработка задач
n8n-postgres-1 - база данных PostgreSQL 16
n8n-redis-1 - очередь задач Redis 7
n8n-moy-nalog-api-1 - HTTP API для создания чеков "Мой налог"
```

### Домен и nginx
- **Домен**: n8n.amaxbox.me
- **SSL**: Let's Encrypt
- **Прокси**: nginx 1.24.0
- **Upstream**: http://172.19.0.7:5678 (IP контейнера в Docker сети)
- **WebSocket**: включен
- **Таймауты**: read 86400s, send 600s

### Мониторинг и алертинг

#### История миграции
- **13 января 2026**: Конфигурации мониторинга интегрированы из n8n-alerting
- **Источник**: production сервер `/opt/n8n/monitoring/`
- **Добавлены**: disk space alerts, улучшенные Telegram шаблоны, alertmanager.yml.tpl
- **n8n-alerting помечен как deprecated** - используйте n8n-update как единственный источник правды

#### Стек мониторинга
- **Prometheus** - сбор метрик (порт 9090)
- **Alertmanager** - отправка уведомлений (порт 9093)
- **Grafana** - визуализация (порт 3000)

#### Экспортёры
- Node Exporter - метрики хоста
- cAdvisor - метрики Docker контейнеров
- Postgres Exporter - метрики PostgreSQL
- Redis Exporter - метрики Redis
- Blackbox Exporter - проверка доступности (внешний и внутренний endpoints)
- N8N встроенные метрики - event loop lag и др.

#### Структура файлов мониторинга
```
monitoring/
├── prometheus.yml              # Конфигурация Prometheus
├── rules/
│   └── n8n_alerts.yml         # Правила алертинга и recording rules
├── alertmanager/
│   ├── alertmanager.yml.tpl   # Шаблон конфига (с плейсхолдерами)
│   ├── alertmanager.yml       # Итоговый конфиг (генерируется из .tpl)
│   ├── templates/
│   │   └── telegram.tmpl      # Шаблоны сообщений в Telegram
│   └── data/                  # Данные Alertmanager (silences, notification log)
├── prom_data/                 # Данные Prometheus
├── grafana/                   # Данные Grafana
└── targets/
    └── n8n.json              # File-based service discovery для n8n метрик
```

#### Recording Rules Prometheus
Автоматически вычисляемые метрики для использования в алертах:

- `n8n:workers_up` - текущее количество работающих воркеров
- `n8n:workers_expected` - ожидаемое количество воркеров (max за последний час)
- `n8n:main_up` - статус основного инстанса (0/1)
- `n8n:public_probe_success` - доступность публичного endpoint (0/1)
- `n8n:http_internal_success` - доступность внутреннего endpoint (0/1)
- `node:load1_avg` - средняя нагрузка (load average 1m)
- `node:cpu_utilization_5m` - утилизация CPU за 5 минут (%)

**Примечание**: Норматив по воркерам (`n8n:workers_expected`) определяется как максимум за последний час. После изменения масштаба воркеров требуется ~1 час, чтобы новый порог стал нормой.

#### Настроенные алерты

1. **N8NHeartbeat** (severity: info, каждые 30 минут)
   - Регулярное уведомление что система работает
   - Показывает: количество воркеров, CPU утилизацию, Load average
   - Не отправляет resolved-сообщения

2. **N8NMainInstanceDown** (severity: critical)
   - Срабатывает: основной инстанс недоступен >2 мин
   - Влияет на: доступ к UI, обработку новых workflow

3. **N8NPublicEndpointDown** (severity: critical)
   - Срабатывает: публичный URL (https://n8n.amaxbox.me) не отвечает >2 мин
   - Проверяется: blackbox exporter с внешним запросом

4. **N8NWorkersReduced** (severity: warning)
   - Срабатывает: количество воркеров меньше ожидаемого >5 мин
   - Влияет на: производительность обработки задач

5. **N8NNodeHighCpu** (severity: warning)
   - Срабатывает: CPU >80% в течение 10 мин
   - Может указывать на: зацикленный workflow, утечку ресурсов

6. **N8NEventLoopLagHigh** (severity: warning)
   - Срабатывает: event loop lag >0.5 сек в течение 5 мин
   - Влияет на: отзывчивость системы

7. **N8NDiskSpaceLow** (severity: warning)
   - Срабатывает: свободное место на диске <20%

8. **N8NDiskSpaceCritical** (severity: critical)
   - Срабатывает: свободное место на диске <10%

#### Уведомления
- **Канал**: Telegram
- **Chat ID**: -4982304484
- **Формат**: HTML с эмодзи (✅/🚨)
- **Группировка**: по имени алерта
- **Интервалы**:
  - Heartbeat (info): каждый час, без resolved
  - Warning: повтор каждый час
  - Critical: повтор каждый час

#### Настройка секретов мониторинга

Секреты хранятся в `/opt/n8n/.env`:
```bash
ALERTMANAGER_TELEGRAM_BOT_TOKEN=<токен_бота>
ALERTMANAGER_TELEGRAM_CHAT_ID=<id_чата>
```

После изменения секретов необходимо регенерировать конфиг:
```bash
cd /opt/n8n
bash -lc 'set -a && source .env && envsubst < monitoring/alertmanager/alertmanager.yml.tpl > monitoring/alertmanager/alertmanager.yml'
docker compose restart alertmanager
```

#### Деплой конфигураций мониторинга

```bash
# Обновить конфигурации Prometheus
scp monitoring/prometheus.yml vds-n8n:/opt/n8n/monitoring/prometheus.yml
scp monitoring/rules/n8n_alerts.yml vds-n8n:/opt/n8n/monitoring/rules/n8n_alerts.yml

# Обновить конфигурации Alertmanager
scp monitoring/alertmanager/alertmanager.yml.tpl vds-n8n:/opt/n8n/monitoring/alertmanager/alertmanager.yml.tpl
scp monitoring/alertmanager/templates/telegram.tmpl vds-n8n:/opt/n8n/monitoring/alertmanager/templates/telegram.tmpl

# Регенерировать конфиг Alertmanager на сервере
ssh vds-n8n "cd /opt/n8n && bash -lc 'set -a && source .env && envsubst < monitoring/alertmanager/alertmanager.yml.tpl > monitoring/alertmanager/alertmanager.yml'"

# Перезапустить сервисы
ssh vds-n8n "cd /opt/n8n && docker compose up -d alertmanager prometheus"
```

#### Проверка работы мониторинга

```bash
# Статус контейнеров
ssh vds-n8n "docker compose ps alertmanager prometheus"

# Применённые правила Prometheus
ssh vds-n8n "docker exec n8n-prometheus-1 wget -qO- http://localhost:9090/api/v1/rules"

# Тестовый алерт (проверка доставки в Telegram)
ssh vds-n8n "curl -XPOST http://127.0.0.1:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{\"labels\":{\"alertname\":\"Test\",\"severity\":\"critical\"},
       \"annotations\":{\"summary\":\"Тест\",\"description\":\"Проверка канала\"},
       \"startsAt\":\"'"\$(date -Iseconds)"'\"}]'"
```

#### Автоматические бэкапы

**Стратегия бэкапов:**
- Ежедневный автоматический бэкап через cron: `15 3 * * *`
- Скрипт: `/usr/local/bin/n8n-backup.sh`
- Retention: 1 день (старые бэкапы удаляются перед созданием новых)

**Что включается в бэкап:**
- PostgreSQL dump: сжатый gzip (`n8n.sql.gz`, ~8GB из ~29GB raw)
- n8n data directory: tar.gz архив (`n8n-data.tgz`, ~1.7MB)

**Место хранения:** `/opt/n8n/backups/YYYY-MM-DD_HH-MM/`

**История оптимизации:**
- 05.01.2026: Внедрено сжатие SQL дампов (gzip), экономия ~3.6x
- Старый метод: `pg_dump > n8n.sql` (29GB)
- Новый метод: `pg_dump | gzip > n8n.sql.gz` (8GB)

#### Управление дисковым пространством

**Текущее состояние сервера:**
- Диск: 79GB total, ~39GB free (49% используется)
- Основные потребители:
  - `/opt/n8n/db`: 15GB (PostgreSQL база)
  - `/opt/n8n/backups`: ~8GB (ежедневный бэкап)
  - `/opt/n8n/monitoring`: 1.6GB (данные Prometheus + Grafana)

**Выполненная очистка (05.01.2026):**
- Сжатие SQL дампов: освобождено ~21GB
- Удаление старых дампов: ~855MB
- Очистка journald (7 дней retention): ~2.1GB
- Очистка btmp (failed logins): ~160MB
- Docker cleanup: 87MB
- **Всего освобождено: ~24GB**

**Мониторинг дискового пространства:**
- Warning: <20% свободного места
- Critical: <10% свободного места

## Файлы в этой папке

```
n8n-update/
├── docker-compose.yml              # Docker Compose конфигурация
├── Dockerfile                      # Кастомный образ с Yandex Cloud CA
├── .dockerignore                   # Исключения для Docker build
├── .env.example                    # Переменные окружения
├── nginx-n8n.conf                  # Конфигурация nginx
├── README.md                       # Общая информация и процесс обновления
├── QUICK_START.md                  # Быстрый старт: использование moy-nalog API
├── UPDATE_CHEATSHEET.md            # Шпаргалка по обновлению n8n
├── UPDATE_HISTORY.md               # История всех обновлений с деталями
├── UPDATE_INFO.md                  # История обновлений и детали (старый)
├── YANDEX_CLOUD_SSL.md            # Инструкция по настройке SSL для Yandex Cloud
├── MOY_NALOG_API.md               # Техническая документация moy-nalog-api сервиса
├── certs/
│   └── yandex-ca.crt              # Yandex Cloud CA сертификат
├── moy-nalog-api/                 # HTTP API для работы с "Мой налог"
│   ├── Dockerfile                 # Образ с moy-nalog + undici + прокси
│   ├── package.json               # Зависимости (express, moy-nalog, undici)
│   └── server.js                  # Express сервер с /receipt endpoint
└── monitoring/
    ├── prometheus.yml              # Конфигурация Prometheus
    ├── rules/
    │   └── n8n_alerts.yml         # Правила алертинга
    └── alertmanager/
        ├── alertmanager.yml       # Конфигурация Alertmanager
        └── templates/
            └── telegram.tmpl      # Шаблоны сообщений в Telegram
```

## Процесс обновления n8n

**Что обновляется**:
- ✅ n8n-main контейнер
- ✅ n8n-worker контейнеры (3 штуки)

**Что НЕ трогаем**:
- ❌ moy-nalog-api (независимый сервис, не требует обновления)
- ❌ PostgreSQL, Redis
- ❌ Monitoring стек (Prometheus, Grafana, и тд)

### 1. Подготовка
```bash
# Подключиться к серверу
ssh vds-n8n

# Проверить текущую версию
docker ps --filter 'name=n8n-main' --format '{{.Image}}'
# Текущая: n8n-yc:2.4.0-moy-nalog

# Создать бэкап БД (14GB несжатый, ~3.3GB сжатый)
cd /opt/n8n
docker compose exec -T postgres pg_dump -U n8n n8n | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2. Обновить Dockerfile (локально)

**ВАЖНО**: n8n использует кастомный образ с:
- Yandex Cloud CA сертификатом
- Глобальными npm пакетами (moy-nalog, undici)
- Патчем moy-nalog для работы через прокси

**Примечание для n8n 2.4.0+**: Путь к глобальным пакетам изменился с `/usr/local/lib/node_modules` на `/opt/nodejs/node-v22.21.1/lib/node_modules`

```bash
# В локальной директории /Users/amax/Lab/n8n-update/Dockerfile
# Изменить первую строку на новую версию:
FROM n8nio/n8n:2.1.0  # новая версия

# Остальное оставить без изменений
```

### 3. Собрать новый образ

```bash
# Локально обновить версию в Dockerfile
vim /Users/amax/Lab/n8n-update/Dockerfile

# Скопировать на сервер
scp Dockerfile vds-n8n:/opt/n8n/

# Собрать образ на сервере
ssh vds-n8n "cd /opt/n8n && docker build -t n8n-yc:2.1.0-moy-nalog ."
```

### 4. Обновить docker-compose.yml

```bash
# Локально изменить image tag:
# n8n-main:
#   image: n8n-yc:2.1.0-moy-nalog
#
# n8n-worker:
#   image: n8n-yc:2.1.0-moy-nalog

# Скопировать на сервер
scp docker-compose.yml vds-n8n:/opt/n8n/
```

### 5. Деплой (только n8n контейнеры)

```bash
ssh vds-n8n "cd /opt/n8n && \
  docker compose up -d --force-recreate n8n-main && \
  docker compose up -d --force-recreate --scale n8n-worker=3 n8n-worker"
```

**Важно**:
- ✅ **moy-nalog-api НЕ нужно пересобирать** - это независимый сервис
- ✅ Postgres, Redis, monitoring - не трогаем
- ✅ Обновляются только n8n-main и n8n-worker

### 6. Проверка после обновления

```bash
# Статус контейнеров
ssh vds-n8n "docker ps --filter 'name=n8n'"

# Версия n8n
ssh vds-n8n "docker exec n8n-n8n-main-1 n8n --version"

# Healthcheck
curl https://n8n.amaxbox.me/healthz

# Проверить moy-nalog API (не должен перезапускаться)
ssh vds-n8n "docker exec n8n-n8n-main-1 wget -qO- http://moy-nalog-api:3100/health"

# Логи
ssh vds-n8n "docker logs n8n-n8n-main-1 --tail 50"
```

**Чеклист**:
- ✅ n8n-main работает на новой версии
- ✅ 3 воркера запущены на новой версии
- ✅ Публичный endpoint доступен (https://n8n.amaxbox.me)
- ✅ moy-nalog-api отвечает (не перезапускался)
- ✅ Workflows продолжают работать

## Подключение к Yandex Cloud PostgreSQL из n8n

В n8n workflow при настройке PostgreSQL credentials:
- **Host**: `c-xxxxx.rw.mdb.yandexcloud.net`
- **Port**: `6432`
- **SSL Mode**: `require` или `verify-full`
- **SSL Certificate**: не требуется - сертификат встроен в образ

Или через Connection String:
```
postgresql://user:password@c-xxxxx.rw.mdb.yandexcloud.net:6432/dbname?sslmode=verify-full
```

## Использование "Мой налог" API в n8n

### moy-nalog-api сервис

**Назначение**: Создание чеков для самозанятых через API "Мой налог" (lknpd.nalog.ru)

**Архитектура**:
- Отдельный HTTP API сервис на Node.js + Express
- Работает в контейнере Docker (порт 3100)
- Использует библиотеку moy-nalog v1.0.6 с патчем для undici
- Прокси через Yandex Cloud (51.250.1.144:8888) для доступа к российскому API

**Почему не Code node?**
n8n 2.0 использует Task Runners для изоляции Code nodes. Task Runner работает в песочнице без сетевого доступа, поэтому прямые HTTP запросы к внешним API невозможны. Решение - отдельный API-сервис внутри Docker сети.

**Использование в n8n:**

Используйте **HTTP Request node** со следующими параметрами:

- **Method**: POST
- **URL**: `http://moy-nalog-api:3100/receipt`
- **Authentication**: None
- **Body Content Type**: JSON
- **JSON Body**:
```json
{
  "login": "780622251627",
  "password": "ваш_пароль",
  "name": "Услуги доступа к сервису (PRO версия «Алекс» на 7 дней)",
  "amount": 990,
  "quantity": 1
}
```

**Ответ API:**
```json
{
  "success": true,
  "receiptUrl": "https://lknpd.nalog.ru/api/v1/receipt/780622251627/201xxxxx/print",
  "receiptId": "201xxxxx",
  "amount": 990,
  "serviceName": "Услуги доступа к сервису..."
}
```

**Файлы сервиса:**
- `/opt/n8n/moy-nalog-api/server.js` - Express сервер
- `/opt/n8n/moy-nalog-api/Dockerfile` - образ с патченым moy-nalog
- `/opt/n8n/moy-nalog-api/package.json` - зависимости

**Проверка работы:**
```bash
# Healthcheck
curl http://127.0.0.1:3100/health

# Тест создания чека
curl -X POST http://127.0.0.1:3100/receipt \
  -H 'Content-Type: application/json' \
  -d '{"login":"780622251627","password":"xxx","name":"Тест","amount":100}'
```

### Добавление новых npm пакетов

**Требования для n8n 2.0 с Task Runners:**
- Пакеты устанавливаются глобально (`npm install -g`)
- Требуется добавление в `NODE_FUNCTION_ALLOW_EXTERNAL`

**Процедура:**

1. **Обновить Dockerfile** (локально):
```dockerfile
# Добавить установку пакета
RUN npm install -g package-name --legacy-peer-deps
```

2. **Обновить docker-compose.yml** (локально):
```yaml
# В n8n-main и n8n-worker environment:
- NODE_FUNCTION_ALLOW_EXTERNAL=moy-nalog,package-name
```

3. **Деплой**:
```bash
# Скопировать файлы на сервер
scp Dockerfile docker-compose.yml vds-n8n:/opt/n8n/

# Собрать новый образ
ssh vds-n8n "cd /opt/n8n && docker build -t n8n-yc:2.0.3-custom ."

# Обновить image tag в docker-compose.yml на сервере
ssh vds-n8n "cd /opt/n8n && sed -i 's/n8n-yc:2.0.3-moy-nalog/n8n-yc:2.0.3-custom/g' docker-compose.yml"

# Пересоздать контейнеры
ssh vds-n8n "cd /opt/n8n && docker compose up -d --force-recreate"
```

**Проверка:**
```bash
# Healthcheck
curl https://n8n.amaxbox.me/healthz

# Проверить установку пакета
ssh vds-n8n "docker exec n8n-n8n-main-1 npm list -g package-name"
```

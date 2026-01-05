# n8n Infrastructure Context

## Текущее состояние системы

### Версия n8n
- **Образ**: n8n-yc:2.0.3-moy-nalog (кастомный с Yandex Cloud CA + внешние пакеты)
- **Базовый образ**: n8nio/n8n:2.0.3
- **Архитектура**: 1 main инстанс + 6 workers
- **База данных**: PostgreSQL 16 (локальный контейнер)
- **Очередь задач**: Redis 7
- **SSL сертификат**: Yandex Cloud CA встроен в образ (валиден до 2027-06-20)
- **Внешние npm пакеты**: moy-nalog@1.0.6
- **Task Runners**: Internal mode (enabled by default в n8n 2.0)

### Контейнеры
```
n8n-n8n-main-1 (b776a74646fc) - основной инстанс, порт 127.0.0.1:5678
n8n-n8n-worker-5..10 (6 штук) - обработка задач
n8n-postgres-1 - база данных
n8n-redis-1 - очередь задач
```

### Домен и nginx
- **Домен**: n8n.amaxbox.me
- **SSL**: Let's Encrypt
- **Прокси**: nginx 1.24.0
- **Upstream**: http://172.19.0.7:5678 (IP контейнера в Docker сети)
- **WebSocket**: включен
- **Таймауты**: read 86400s, send 600s

### Мониторинг и алертинг

#### Стек мониторинга
- **Prometheus** - сбор метрик
- **Alertmanager** - отправка уведомлений
- **Grafana** - визуализация (порт 3000)

#### Экспортёры
- Node Exporter - метрики хоста
- cAdvisor - метрики Docker контейнеров
- Postgres Exporter - метрики PostgreSQL
- Redis Exporter - метрики Redis
- Blackbox Exporter - проверка доступности
- N8N встроенные метрики - event loop lag и др.

#### Настроенные алерты

1. **N8NHeartbeat** (info, каждые 2 часа)
   - Проверка что всё работает
   - Показывает: воркеры, CPU, Load

2. **N8NMainInstanceDown** (critical)
   - Срабатывает: основной инстанс недоступен >2 мин

3. **N8NPublicEndpointDown** (critical)
   - Срабатывает: публичный URL не отвечает >2 мин

4. **N8NNodeHighCpu** (warning)
   - Срабатывает: CPU >80% в течение 10 мин

5. **N8NEventLoopLagHigh** (warning)
   - Срабатывает: event loop lag >0.5 сек в течение 5 мин

#### Уведомления
- **Канал**: Telegram
- **Chat ID**: -4982304484
- **Формат**: HTML с эмодзи (✅/🚨)
- **Группировка**: по имени алерта
- **Повтор**: каждые 4 часа (critical), 2 часа (heartbeat)

## Файлы в этой папке

```
n8n-update/
├── docker-compose.yml              # Docker Compose конфигурация
├── Dockerfile                      # Кастомный образ с Yandex Cloud CA
├── .dockerignore                   # Исключения для Docker build
├── .env.example                    # Переменные окружения
├── nginx-n8n.conf                  # Конфигурация nginx
├── README.md                       # Общая информация и процесс обновления
├── UPDATE_INFO.md                  # История обновлений и детали
├── YANDEX_CLOUD_SSL.md            # Инструкция по настройке SSL для Yandex Cloud
├── certs/
│   └── yandex-ca.crt              # Yandex Cloud CA сертификат
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

### 1. Подготовка
```bash
# Подключиться к серверу
ssh vds-n8n

# Проверить текущую версию
docker ps --filter 'name=n8n-main' --format '{{.Image}}'

# Создать бэкап БД (14GB несжатый, ~3.3GB сжатый)
cd /opt/n8n
docker compose exec -T postgres pg_dump -U n8n n8n | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2. Обновление образа с Yandex Cloud CA

**ВАЖНО**: n8n использует кастомный образ с встроенным сертификатом Yandex Cloud для подключения к Managed PostgreSQL.

```bash
# Обновить Dockerfile
cat > /opt/n8n/Dockerfile << 'EOF'
FROM n8nio/n8n:1.123.5

USER root

# Добавляем Yandex CA сертификат в системное хранилище
COPY certs/yandex-ca.crt /etc/ssl/certs/yandex-ca.pem
RUN cat /etc/ssl/certs/yandex-ca.pem >> /etc/ssl/certs/ca-certificates.crt

# Указываем Node.js использовать системный trust store
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

USER node
EOF

# Собрать образ
cd /opt/n8n
docker build -t n8n-yc:1.123.5 .
```

### 3. Обновление docker-compose.yml

Изменить версию в локальном файле:
```yaml
services:
  n8n-main:
    image: n8n-yc:1.123.5  # вместо n8nio/n8n:X.X.X

  n8n-worker:
    image: n8n-yc:1.123.5  # вместо n8nio/n8n:X.X.X
```

### 4. Деплой и перезапуск

```bash
# Скопировать docker-compose.yml на сервер
scp docker-compose.yml vds-n8n:/opt/n8n/

# Пересоздать контейнеры
cd /opt/n8n
docker compose up -d --force-recreate n8n-main
docker compose up -d --force-recreate --scale n8n-worker=6 n8n-worker

# Проверить статус
docker ps --filter 'name=n8n'
curl https://n8n.amaxbox.me/healthz
```

### 5. Проверка

- ✅ n8n main работает
- ✅ 6 воркеров запущены
- ✅ Публичный endpoint доступен
- ✅ Сертификат Yandex Cloud в образе
- ✅ NODE_EXTRA_CA_CERTS установлен

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

## Использование внешних npm пакетов в n8n

### Установленные пакеты

#### moy-nalog v1.0.6
**Назначение**: API клиент для сервиса "Мой налог" (самозанятые)

**Использование в Code node:**
```javascript
const moyNalog = require('moy-nalog');

const nalogAPI = new moyNalog({
  username: 'ИНН или телефон',
  password: 'пароль'
});

// Создать чек
const result = await nalogAPI.addIncome({
  amount: 15000,
  service: 'Консультация',
  client_name: 'Иван Иванов'
});

return { result };
```

**Документация**: https://github.com/alexstep/moy-nalog

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

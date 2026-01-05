# Контекст проекта n8n-update

## Последнее обновление: 5 января 2026

### Выполненные обновления

#### 2026-01-05: Включение автоматической очистки executions
**Дата**: 2026-01-05
**Время выполнения**: ~5 минут
**Downtime**: ~30 секунд (перезапуск контейнеров)
**Статус**: ✅ Успешно завершено

**Проблема:**
- База данных содержала 78,772 executions
- Автоочистка была отключена (`EXECUTIONS_DATA_PRUNE=false`)
- Рост размера БД PostgreSQL без ограничений

**Изменения:**
- Включена автоочистка: `EXECUTIONS_DATA_PRUNE=true`
- Установлен лимит по возрасту: `EXECUTIONS_DATA_MAX_AGE=168` (7 дней)
- Установлен лимит по количеству: `EXECUTIONS_DATA_PRUNE_MAX_COUNT=10000`
- Обновлены `.env`, `.env.example`, `docker-compose.yml` (локально и на сервере)
- Пересозданы контейнеры n8n-main и 6 workers

**Результаты:**
- ✅ Первая очистка выполнена автоматически сразу после перезапуска
- ✅ Удалено: **~69,033 executions** (87.6% от исходного объема)
- ✅ Осталось: **9,739 executions** (самые свежие)
- ✅ Soft-deleted (в очереди): 142 executions (permanent delete через 1 час)
- ✅ Автоочистка работает на постоянной основе

#### 2025-12-29: Установка внешнего пакета moy-nalog
**Дата**: 2025-12-29
**Время выполнения**: ~20 минут
**Downtime**: ~30 секунд
**Статус**: ✅ Успешно завершено

**Изменения:**
- Установлен npm пакет `moy-nalog@1.0.6` (глобально)
- Добавлена переменная `NODE_FUNCTION_ALLOW_EXTERNAL=moy-nalog`
- Новый образ: `n8n-yc:2.0.3-moy-nalog`

#### 2025-12-22: Обновление 1.123.5 → 2.0.3
**Время выполнения**: ~15 минут
**Downtime**: ~15 секунд
**Статус**: ✅ Успешно завершено

---

## Текущее состояние системы

### Версия n8n
- **Образ**: n8n-yc:2.0.3-moy-nalog (кастомный с Yandex Cloud CA + внешние пакеты)
- **Базовый образ**: n8nio/n8n:2.0.3
- **Предыдущая версия**: n8n-yc:2.0.3
- **Архитектура**: 1 main instance + 6 workers
- **База данных**: PostgreSQL 16 (локальный контейнер)
- **Очередь задач**: Redis 7
- **SSL сертификат**: Yandex Cloud CA встроен в образ (валиден до 2027-06-20)
- **Внешние npm пакеты**: moy-nalog@1.0.6
- **Автоочистка executions**: ✅ Включена (с 2026-01-05)
  - `EXECUTIONS_DATA_PRUNE=true`
  - `EXECUTIONS_DATA_MAX_AGE=168` (7 дней)
  - `EXECUTIONS_DATA_PRUNE_MAX_COUNT=10000`
  - Текущее количество в БД: ~9,739 executions

### Контейнеры (текущее состояние)
```
n8n-n8n-main-1          n8n-yc:2.0.3-moy-nalog   Up (с 2026-01-05)
n8n-n8n-worker-24..29   n8n-yc:2.0.3-moy-nalog   Up (6 штук, с 2026-01-05)
n8n-postgres-1          postgres:16              Up 3+ weeks
n8n-redis-1             redis:7                  Up 3+ weeks
```

### Домен и nginx
- **Домен**: n8n.amaxbox.me
- **SSL**: Let's Encrypt
- **Прокси**: nginx 1.24.0
- **WebSocket**: включен
- **Healthcheck**: https://n8n.amaxbox.me/healthz → `{"status":"ok"}`

---

## Ключевые изменения в n8n 2.0

### Breaking Changes

1. **Task Runners enabled by default**
   - Code nodes теперь выполняются в изолированных окружениях
   - Task Broker запущен на порту 5679
   - Повышенная безопасность выполнения кода
   - Логи показывают: "n8n Task Broker ready on 127.0.0.1, port 5679"

2. **Environment Variables блокировка**
   - `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` установлен в docker-compose.yml
   - Доступ к `$env` из Code nodes теперь заблокирован по умолчанию
   - Повышение безопасности (предотвращение утечки секретов)

3. **Новая система публикации workflow**
   - **Save** != **Publish**
   - Save сохраняет изменения без публикации
   - Publish явно публикует workflow в production
   - Требует привыкания к новому workflow

4. **Python Code Node**
   - Требует external task runners с native Python
   - Pyodide-based версия удалена

5. **OAuth Callbacks**
   - Теперь требуют n8n user authentication по умолчанию
   - Могут потребоваться повторная аутентификация в OAuth-workflows

### Новые environment variables (добавлены)

```yaml
# В n8n-main environment:
- OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true  # разгрузка main instance
- N8N_BLOCK_ENV_ACCESS_IN_NODE=true          # security hardening
```

**Источник**: DEPRECATION_WARNINGS.md

---

## Процесс обновления (выполненные шаги)

### 1. Pre-upgrade проверки

#### Migration Report (версия 1.123.5)
- ✅ **45 из 45 workflows** совместимы с версией 2.0.0
- ✅ **0 Workflow Issues** - все workflow готовы к миграции
- ⚠️ **8 Instance Issues** (все автоматически обрабатываются):
  - OAuth callbacks require auth (Medium)
  - Task Runners enabled by default (Medium)
  - Task runner docker image separation (Medium)
  - 5 Low-priority issues (CLI commands, hooks, permissions)

**Вывод**: Прямое обновление до 2.0.3 без промежуточных шагов было безопасным.

#### Backup
- **Файл**: `/opt/n8n/backup_20251222_170532.sql.gz`
- **Размер**: 5.0 GB (сжатый)
- **Время создания**: ~10 минут
- **Статус**: ✅ Создан успешно

### 2. Build & Deploy

#### Обновлённые файлы
1. **Dockerfile** (локально: `/Users/amax/Lab/n8n-update/Dockerfile`)
   ```dockerfile
   FROM n8nio/n8n:2.0.3  # было: 1.123.5
   ```

2. **docker-compose.yml** (локально: `/Users/amax/Lab/n8n-update/docker-compose.yml`)
   - Изменены image tags: `n8n-yc:1.123.5` → `n8n-yc:2.0.3`
   - Добавлены env vars: `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS`, `N8N_BLOCK_ENV_ACCESS_IN_NODE`

#### Сборка образа
```bash
# На сервере vds-n8n
cd /opt/n8n
docker build -t n8n-yc:2.0.3 .
```
- **Время**: ~80 секунд
- **Размер образа**: 1.08 GB

#### Deployment
```bash
# Пересоздание контейнеров
docker compose up -d --force-recreate n8n-main
docker compose up -d --force-recreate --scale n8n-worker=6 n8n-worker
```
- **Downtime**: ~15 секунд
- **Результат**: ✅ Все контейнеры запустились успешно

### 3. Verification

#### Проверки после обновления
- ✅ Все n8n контейнеры работают на n8n-yc:2.0.3
- ✅ Healthcheck: `{"status":"ok"}`
- ✅ Логи main: "n8n ready on ::, port 5678"
- ✅ **Task Broker**: "n8n Task Broker ready on 127.0.0.1, port 5679" (новое!)
- ✅ Workers: "n8n worker is now ready" (все 6 штук)
- ✅ Нет SSL certificate errors
- ✅ Нет connection errors к PostgreSQL/Redis

#### Мониторинг (Prometheus)
- ✅ `n8n:workers_up = 6`
- ✅ `n8n:main_up = 1`
- ✅ Heartbeat alerts отправляются в Telegram
- ✅ Последнее уведомление: 2025-12-22 14:13:54 UTC (message_id: 2625)

---

## Архитектура после обновления

### Docker Images на сервере
```
n8n-yc:2.0.3    1.08GB   (текущий, активный)
n8n-yc:1.123.5  1.04GB   (для отката при необходимости)
```

### Структура файлов на сервере `/opt/n8n/`
```
/opt/n8n/
├── docker-compose.yml          # обновлён до 2.0.3
├── Dockerfile                  # обновлён до 2.0.3
├── .env                        # секреты (не изменялся)
├── certs/
│   └── yandex-ca.crt          # Yandex Cloud CA (не изменялся)
├── data/                       # n8n workflow data
├── db/                         # PostgreSQL data
├── backup_20251222_170532.sql.gz  # бэкап перед обновлением (5.0 GB)
└── monitoring/                 # Prometheus, Alertmanager configs
    ├── prometheus.yml
    ├── rules/
    │   └── n8n-alerts.yml
    └── alertmanager/
        ├── alertmanager.yml
        └── templates/
```

### Новые компоненты в n8n 2.0

**Task Broker** (новый сервис):
- Порт: 5679 (внутренний)
- Назначение: Управление изолированным выполнением Code nodes
- Логи: "n8n Task Broker ready on 127.0.0.1, port 5679"
- Режим: Internal mode (по умолчанию)

---

## Мониторинг и алертинг

### Система мониторинга (Prometheus + Alertmanager)
- **Статус**: ✅ Работает корректно с n8n 2.0.3
- **Конфигурации**: Совместимы, обновление не требовалось
- **Telegram бот**: Уведомления работают
- **Chat ID**: -4982304484

### Активные алерты
1. **N8NHeartbeat** (info) - каждый час
2. **N8NMainInstanceDown** (critical) - если main down >2 мин
3. **N8NPublicEndpointDown** (critical) - если URL не отвечает >2 мин
4. **N8NWorkersReduced** (warning) - если workers < expected
5. **N8NNodeHighCpu** (warning) - CPU >80% в течение 10 мин
6. **N8NEventLoopLagHigh** (warning) - lag >0.5s в течение 5 мин
7. **N8NDiskSpaceLow** (warning) - <20% свободного места
8. **N8NDiskSpaceCritical** (critical) - <10% свободного места

### Метрики (recording rules)
- `n8n:workers_up` = 6
- `n8n:main_up` = 1
- `n8n:public_probe_success` = 1
- `node:load1_avg`, `node:cpu_utilization_5m`
- `postgres:up`, `redis:up`, `grafana:up`, `prometheus:up`

---

## Процедура отката (если понадобится)

### Быстрый откат на 1.123.5

```bash
# 1. Остановить контейнеры
ssh vds-n8n "cd /opt/n8n && docker compose down"

# 2. Восстановить БД из бэкапа (если нужно)
ssh vds-n8n "cd /opt/n8n && gunzip -c backup_20251222_170532.sql.gz | \
    docker compose exec -T postgres psql -U n8n n8n"

# 3. Вернуть docker-compose.yml на 1.123.5
ssh vds-n8n "cd /opt/n8n && sed -i 's/n8n-yc:2.0.3/n8n-yc:1.123.5/g' docker-compose.yml"

# 4. Удалить новые env переменные (если нужно)
ssh vds-n8n "cd /opt/n8n && sed -i '/OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS/d' docker-compose.yml"
ssh vds-n8n "cd /opt/n8n && sed -i '/N8N_BLOCK_ENV_ACCESS_IN_NODE/d' docker-compose.yml"

# 5. Запустить контейнеры
ssh vds-n8n "cd /opt/n8n && docker compose up -d"
```

**Время отката**: ~5 минут (без восстановления БД) / ~15 минут (с восстановлением БД)

---

## Рекомендации и мониторинг после обновления

### Что проверить в ближайшие дни

1. **Code nodes в workflows**
   - Проверить, что Code nodes работают корректно в новом Task Runner режиме
   - Если используется `$env` - потребуется рефакторинг (блокируется по умолчанию)

2. **OAuth workflows**
   - Проверить OAuth-based workflows
   - Может потребоваться повторная аутентификация

3. **Manual executions**
   - Проверить, что ручные запуски workflow корректно выполняются на workers
   - Благодаря `OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true`

4. **Workflow publishing**
   - Привыкнуть к новой системе Save/Publish
   - Теперь нужно явно публиковать изменения

### Ожидаемые уведомления

- **Telegram heartbeat**: каждый час
- **Alertmanager**: критические алерты при инцидентах
- **Мониторинг**: проверять Grafana (порт 3000) или Prometheus (порт 9090)

---

## Полезные команды

### Проверка состояния
```bash
# Статус контейнеров
ssh vds-n8n "docker ps --filter 'name=n8n'"

# Версия образов
ssh vds-n8n "docker images | grep n8n-yc"

# Healthcheck
ssh vds-n8n "curl -s https://n8n.amaxbox.me/healthz"

# Логи main instance
ssh vds-n8n "docker logs n8n-n8n-main-1 --tail 50"

# Логи worker
ssh vds-n8n "docker logs n8n-n8n-worker-25 --tail 30"
```

### Prometheus метрики
```bash
# Проверка workers
ssh vds-n8n "docker exec n8n-prometheus-1 wget -qO- \
    'http://localhost:9090/api/v1/query?query=n8n:workers_up'"

# Проверка main
ssh vds-n8n "docker exec n8n-prometheus-1 wget -qO- \
    'http://localhost:9090/api/v1/query?query=n8n:main_up'"
```

### Управление workers
```bash
# Изменить количество workers (например, на 8)
ssh vds-n8n "cd /opt/n8n && docker compose up -d --scale n8n-worker=8"

# Через ~1 час Prometheus обновит n8n:workers_expected
```

---

## Следующие шаги (рекомендации)

### Краткосрочные (1-2 недели)

1. **Мониторинг стабильности**
   - Следить за Telegram alerts
   - Проверить выполнение критичных workflows
   - Мониторить CPU/RAM usage (task runners могут увеличить потребление)

2. **Тестирование новых возможностей**
   - Протестировать новую систему Save/Publish
   - Оценить производительность Task Runners
   - Проверить все OAuth integrations

### Среднесрочные (1-2 месяца)

3. **Настроить автоматические бэкапы** (HIGH PRIORITY из FUTURE_FEATURES.md)
   - Cron + скрипт для daily/weekly/monthly бэкапов
   - Telegram уведомления о статусе бэкапов
   - Опционально: загрузка в Yandex Object Storage

4. **Обновить документацию**
   - Обновить README.md с версией 2.0.3
   - Дополнить UPDATE_INFO.md деталями обновления
   - Документировать новые особенности 2.0

### Долгосрочные (3-6 месяцев)

5. **Оптимизация и улучшения**
   - Grafana дашборды на основе recording rules
   - Расширить метрики (очереди Bull, ошибки workflow)
   - Внешний watchdog для мониторинга доступности
   - CI/CD pipeline для автоматических обновлений

6. **Мониторинг будущих релизов**
   - n8n 2.0.x патчи (следить за changelog)
   - n8n 2.1.0 и далее (оценивать breaking changes)

---

## Внешние npm пакеты

### Установленные пакеты

#### moy-nalog v1.0.6
**Дата установки**: 2025-12-29
**Назначение**: API клиент для сервиса "Мой налог" (lknpd.nalog.ru) - работа с самозанятыми

**Ссылки:**
- npm: https://www.npmjs.com/package/moy-nalog
- GitHub: https://github.com/alexstep/moy-nalog
- Документация API: https://github.com/alexstep/moy-nalog/blob/main/docs/nalogAPIClass.md

**Использование в Code node:**
```javascript
const moyNalog = require('moy-nalog');

const nalogAPI = new moyNalog({
  username: 'ИНН или телефон',
  password: 'пароль'
});

// Добавить доход
await nalogAPI.addIncome({
  amount: 15000,
  service: 'Консультация',
  client_name: 'Иван Иванов'
});

// Произвольный вызов API
await nalogAPI.call('incomes/summary');
```

**Особенности установки:**
- Установлен глобально (`npm install -g`) для совместимости с Task Runners
- Требует `NODE_FUNCTION_ALLOW_EXTERNAL=moy-nalog` в environment variables
- Совместим с n8n 2.0 Task Runners (Internal mode)

### Процедура добавления новых пакетов

**1. Обновить Dockerfile:**
```dockerfile
# Добавить в секцию установки пакетов
RUN npm install -g package-name --legacy-peer-deps
```

**2. Обновить docker-compose.yml:**
```yaml
# В n8n-main и n8n-worker environment:
- NODE_FUNCTION_ALLOW_EXTERNAL=moy-nalog,package-name  # через запятую
```

**3. Пересобрать и задеплоить:**
```bash
# Локально
scp Dockerfile docker-compose.yml vds-n8n:/opt/n8n/

# На сервере
ssh vds-n8n "cd /opt/n8n && docker build -t n8n-yc:2.0.3-custom ."
ssh vds-n8n "cd /opt/n8n && docker compose up -d --force-recreate"
```

---

## Источники и документация

### n8n
- [n8n Release Notes](https://docs.n8n.io/release-notes/)
- [n8n v2.0 breaking changes](https://docs.n8n.io/2-0-breaking-changes/)
- [v2.0 Migration Tool](https://docs.n8n.io/migration-tool-v2/)
- [Introducing n8n 2.0 Blog](https://blog.n8n.io/introducing-n8n-2-0/)
- [GitHub Releases](https://github.com/n8n-io/n8n/releases)
- [How to Update n8n (Self-Hosted)](https://community.n8n.io/t/solved-how-to-update-to-2-0-self-hosted/234231)

### Внешние пакеты
- [moy-nalog npm](https://www.npmjs.com/package/moy-nalog)
- [moy-nalog GitHub](https://github.com/alexstep/moy-nalog)

---

## История обновлений

| Дата | Версия | Статус | Примечания |
|------|--------|--------|------------|
| 2025-12-12 | 1.123.5 | ✅ Работает | Стабильная версия 10+ дней |
| 2025-12-22 | 2.0.3 | ✅ Работает | Major upgrade, task runners enabled |
| 2025-12-29 | 2.0.3-moy-nalog | ✅ Работает | Добавлен внешний пакет moy-nalog@1.0.6 |
| 2026-01-05 | 2.0.3-moy-nalog | ✅ **Текущая** | Включена автоочистка executions (удалено ~69k записей) |

---

**Последнее обновление контекста**: 2026-01-05
**Автор обновления**: Claude Code (automated update)
**Сервер**: vds-n8n (89.110.65.155)

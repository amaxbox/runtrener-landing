# Deprecation Warnings для следующего обновления

**Дата обновления до 1.116.0:** 14 октября 2025

## Рекомендуемые изменения для следующей версии (1.117+)

### ✅ Приоритет: ВЫСОКИЙ (добавить при следующем обновлении)

#### 1. OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS
**Статус:** Переменная есть в `.env`, но НЕ добавлена в `docker-compose.yml`

**Что сделать:**
Добавить в `docker-compose.yml` под `n8n-main` → `environment`:
```yaml
- OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=${OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS}
```

**Эффект:**
- Ручные запуски workflows (через UI) будут выполняться на workers
- Main инстанс разгрузится
- Единообразие: все выполнения через workers

---

#### 2. N8N_BLOCK_ENV_ACCESS_IN_NODE
**Будущее изменение:** `false` (сейчас) → `true` (по умолчанию)

**Что сделать:**
1. Проверить workflows: используется ли `$env.VARIABLE_NAME` в Code Node или выражениях
2. Если **НЕ используется** → добавить `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` (рекомендуется для безопасности)
3. Если **используется** → добавить `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (сохранить текущее поведение)

**Зачем:**
- Предотвращение утечки секретов (DB_PASSWORD, API_KEYS) через workflows

---

#### 3. N8N_GIT_NODE_DISABLE_BARE_REPOS
**Будущее изменение:** Bare git репозитории будут запрещены

**Что сделать:**
1. Проверить workflows: используется ли Git Node с bare репозиториями
2. Если **НЕТ** → добавить `N8N_GIT_NODE_DISABLE_BARE_REPOS=true` (рекомендуется)
3. Если **ДА** → изучить альтернативы

**Зачем:**
- Закрытие уязвимостей безопасности в Git Node

---

### ⏳ Приоритет: СРЕДНИЙ (подождать стабилизации)

#### 4. N8N_RUNNERS_ENABLED
**Статус:** Новая архитектура, пока опциональная

**Что это:**
- Task Runners = изолированное выполнение Code Node в отдельных процессах
- Песочница для пользовательского кода

**Когда включать:**
- Дождаться версии **1.117-1.118** для стабилизации
- Проверить отзывы сообщества

**Требования:**
- Больше RAM (каждый runner = отдельный процесс)
- Возможна несовместимость со старыми workflows

**Эффект:**
- ✅ Безопасность: изоляция кода
- ✅ Стабильность: сбой в коде не уронит n8n
- ❌ Больше ресурсов

---

## Итоговый план для следующего обновления

### В .env добавить:
```bash
# Безопасность
N8N_BLOCK_ENV_ACCESS_IN_NODE=true
N8N_GIT_NODE_DISABLE_BARE_REPOS=true

# Task Runners (опционально, если стабильно)
# N8N_RUNNERS_ENABLED=true
```

### В docker-compose.yml добавить под n8n-main → environment:
```yaml
- OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=${OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS}
- N8N_BLOCK_ENV_ACCESS_IN_NODE=${N8N_BLOCK_ENV_ACCESS_IN_NODE}
- N8N_GIT_NODE_DISABLE_BARE_REPOS=${N8N_GIT_NODE_DISABLE_BARE_REPOS}
# - N8N_RUNNERS_ENABLED=${N8N_RUNNERS_ENABLED}  # включить после тестирования
```

---

## Текущие активные workflows (проверить перед изменениями):
1. Михалыч 1.5 — Саппорт (ID: nWS36F9rjRit0qUL)
2. [draft] Михалыч 2 Судный дед (ID: d8HQpnzi7xefmxie)
3. Михалыч 1.5 — Форма NPS (ID: cKOyQBr6LPGDpgEV)
4. Главред ATI.SU (ID: yKiBk5Sw6aXOjn38)
5. Михалыч 1.5 — Управление админкой (ID: NceaBW06H7hH4GGM)
6. Михалыч 1.5 — Сбор профиля атлета (00:10) (ID: W1IIqDx8Rd9LHSCg)
7. Михалыч 1.5 — Strava – Авторизация (ID: gcHLym5BI5UDb8iY)
8. Михалыч 1.5 — Шедуллер (ID: DKMwQqbdzSXmYgRU)
9. Михалыч 1.5 — Основной процесс (ID: mT8gLRUItCyvIssF)

**Действие:** Проверить эти workflows на использование `$env` перед включением `N8N_BLOCK_ENV_ACCESS_IN_NODE=true`

---

## Исправлено в версии 1.116.0

### N8N_TRUST_PROXY
**Проблема:** ValidationError для X-Forwarded-For header при работе за nginx proxy

**Решение:** Добавлена переменная `N8N_TRUST_PROXY=true` в docker-compose.yml

**Статус:** ✅ Исправлено

---

## Полезные ссылки
- [n8n Release Notes](https://docs.n8n.io/release-notes/)
- [Task Runners Documentation](https://docs.n8n.io/hosting/configuration/task-runners/)
- [Security Environment Variables](https://docs.n8n.io/hosting/configuration/environment-variables/security/)

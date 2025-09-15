# Лендинг "Твой тренер по бегу"

Лендинг-страница для Telegram-бота тренера по бегу с интеграцией Grafana для отображения реальной статистики пользователей.

## Структура проекта

```
running-coach-landing/
├── index.html              # Русская версия лендинга
├── index-en.html           # Английская версия лендинга
├── js/
│   ├── url-params.js       # Обработка URL параметров
│   ├── stats.js           # Статистика (RU)
│   ├── stats-en.js        # Статистика (EN)
│   └── ...                # Другие JS файлы
├── css/
│   ├── main.css           # Стили (RU)
│   ├── main-en.css        # Стили (EN)
│   └── ...
├── grafana-proxy/         # Backend прокси для Grafana
│   ├── app.py            # Flask приложение
│   ├── requirements.txt   # Python зависимости
│   ├── Dockerfile        # Docker образ
│   ├── docker-compose.yml # Docker Compose конфигурация
│   └── deploy.sh         # Скрипт деплоя
├── URL_PARAMETERS.md      # Документация по URL параметрам
└── README.md             # Этот файл
```

## Функциональность

### Лендинг (index.html & index-en.html)
- ✅ Адаптивный дизайн в стиле Apple
- ✅ Двуязычная поддержка (русский/английский)
- ✅ Секции: Hero, Возможности, Отзывы, CTA
- ✅ Интеграция с Grafana для отображения статистики
- ✅ Автообновление данных каждые 5 минут
- ✅ Fallback значения при недоступности API
- ✅ **Автоматическая передача URL параметров в Telegram бот**

### URL Parameters Feature (js/url-params.js)
- ✅ Автоматическая передача всех URL параметров в Telegram бот
- ✅ Приоритет для существующего параметра `start`
- ✅ Дефолтные значения по языку (`landru`/`landeng`)
- ✅ Поддержка маркетинговых кампаний и реферальных ссылок
- ✅ Тихая работа без отладочных сообщений

### Grafana Proxy (grafana-proxy/)
- ✅ Flask API для обхода CORS ограничений
- ✅ Интеграция с публичным дашбордом Grafana
- ✅ Docker контейнеризация
- ✅ Автоматический деплой на сервер
- ✅ Health checks и логирование

## Быстрый старт

### 1. Локальная разработка

Откройте `index.html` в браузере. По умолчанию будут показаны fallback значения.

### 2. Деплой Grafana Proxy

```bash
cd grafana-proxy
./deploy.sh
```

Прокси будет развернут на `http://89.110.65.155:8083`

### 3. API Endpoints

- **Health Check:** `GET /`
- **Статистика:** `GET /api/stats`
- **Отладка:** `GET /api/debug`

## Конфигурация

### Grafana настройки (grafana-proxy/app.py)
```python
GRAFANA_BASE_URL = "https://amaxbox.grafana.net"
DASHBOARD_ID = "bbdd3fee2ecc44d89810db8c83bf8ba3"
```

### Сервер настройки (grafana-proxy/deploy.sh)
```bash
SERVER_USER="root"
SERVER_HOST="89.110.65.155" 
SERVER_PATH="/var/www/grafana-proxy"
SSH_KEY="/Users/amax/.ssh/pdf_generator_ed25519"
```

## Технологии

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Адаптивный дизайн без фреймворков
- Fetch API для получения данных

### Backend
- Python 3.11
- Flask + Flask-CORS
- Requests для HTTP запросов
- Gunicorn WSGI сервер

### Инфраструктура  
- Docker + Docker Compose
- Nginx reverse proxy (опционально)
- SSH деплой с rsync

## Мониторинг

### Проверка статуса
```bash
# Статус контейнера
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'cd /var/www/grafana-proxy && docker-compose ps'

# Логи
ssh -i /Users/amax/.ssh/pdf_generator_ed25519 root@89.110.65.155 \
  'cd /var/www/grafana-proxy && docker-compose logs -f'
```

### API тестирование
```bash
# Health check
curl http://89.110.65.155:8083/

# Получение статистики
curl http://89.110.65.155:8083/api/stats

# Отладочная информация
curl http://89.110.65.155:8083/api/debug

# Тестирование URL параметров
# Откройте в браузере и проверьте кнопки:
https://runtrener.ru/?utm_source=test&utm_campaign=docs
https://runtrener.ru/en/?start=welcome_bonus
```

## Структура данных Grafana

Данные извлекаются по пути: `results.A.frames[0].data.values[0][0]`

Пример ответа API:
```json
{
  "athletes": 83,
  "timestamp": "python-requests/2.31.0",
  "source": "grafana"
}
```

## Безопасность

- ✅ CORS настроен для cross-origin запросов
- ✅ Публичный дашборд без API ключей
- ✅ Fallback значения при ошибках
- ✅ Логирование всех запросов

## Обновление

### Лендинг
Просто замените `index.html` на сервере

### Grafana Proxy
```bash
cd grafana-proxy
./deploy.sh
```

## Troubleshooting

### Не загружаются данные
1. Проверьте статус прокси: `curl http://89.110.65.155:8083/`
2. Проверьте логи: `docker-compose logs`
3. Проверьте Grafana дашборд: `curl http://89.110.65.155:8083/api/debug`

### CORS ошибки
Убедитесь что прокси запущен и доступен. Браузер должен делать запросы через прокси, а не напрямую к Grafana.

### Порт занят
Измените порт в `docker-compose.yml` и перезапустите:
```yaml
ports:
  - "8084:8082"  # внешний:внутренний
```

## Автор

Создано для проекта "Твой тренер по бегу" с интеграцией Grafana метрик.

## История изменений

- **v1.0** - Базовый лендинг со статичными данными
- **v1.1** - Добавлена интеграция с Grafana через прокси
- **v1.2** - Улучшен дизайн и добавлены fallback значения
- **v2.0** - Двуязычная поддержка (RU/EN)
- **v2.1** - Автоматическая передача URL параметров в Telegram бот
- **v2.2** - Переупорядочены фичи (Plan тренировок на первое место)
- **v2.3** - Удалены отладочные console.log из URL parameters скрипта
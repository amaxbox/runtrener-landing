# Настройка SSL для Yandex Cloud PostgreSQL в n8n

## Проблема

При подключении к Managed PostgreSQL в Yandex Cloud из n8n возникает ошибка:
```
self-signed certificate in certificate chain
```

## Причина

Node.js (на котором работает n8n) использует встроенный набор root certificates и не доверяет сертификату Yandex Cloud по умолчанию.

## Решение

### 1. Скачать официальный CA сертификат Yandex Cloud

```bash
ssh vds-n8n
cd /opt/n8n/certs
wget https://storage.yandexcloud.net/cloud-certs/CA.pem -O yandex-ca.crt
```

**Важно**: расширение `.crt` обязательно для Alpine Linux.

### 2. Создать Dockerfile с встроенным сертификатом

```bash
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
```

**Критически важно**: переменная `NODE_EXTRA_CA_CERTS` заставляет Node.js добавить системные сертификаты к встроенным.

### 3. Собрать кастомный образ

```bash
cd /opt/n8n
docker build -t n8n-yc:1.123.5 .
```

### 4. Обновить docker-compose.yml

Заменить стандартный образ на кастомный:

```yaml
services:
  n8n-main:
    image: n8n-yc:1.123.5  # было: n8nio/n8n:1.123.5
    # ... остальные настройки

  n8n-worker:
    image: n8n-yc:1.123.5  # было: n8nio/n8n:1.123.5
    # ... остальные настройки
```

### 5. Перезапустить сервисы

```bash
cd /opt/n8n
docker compose up -d --force-recreate n8n-main
docker compose up -d --force-recreate --scale n8n-worker=6 n8n-worker
```

### 6. Проверить установку

```bash
# Проверить переменную окружения
docker exec n8n-n8n-main-1 env | grep NODE_EXTRA_CA_CERTS
# Output: NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Проверить что сертификат в системном store
docker exec n8n-n8n-main-1 tail -20 /etc/ssl/certs/ca-certificates.crt
# Должен содержать сертификат Yandex
```

## Использование в n8n

### Вариант 1: PostgreSQL Credentials

В n8n UI создайте PostgreSQL credentials:
- **Host**: `c-xxxxx.rw.mdb.yandexcloud.net` (ваш кластер)
- **Port**: `6432`
- **Database**: имя вашей БД
- **User**: имя пользователя
- **Password**: пароль
- **SSL**: **Enable**
- **SSL Mode**: `require` или `verify-full`
- **SSL Certificate**: оставьте пустым (сертификат уже в системе)

### Вариант 2: Connection String

```
postgresql://user:password@c-xxxxx.rw.mdb.yandexcloud.net:6432/dbname?sslmode=verify-full
```

## Типичные ошибки

### ❌ "self-signed certificate" - всё ещё появляется

**Причина**: не установлена переменная `NODE_EXTRA_CA_CERTS`

**Решение**: проверьте что в Dockerfile есть строка:
```dockerfile
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

### ❌ "unable to get local issuer certificate"

**Причина**: сертификат не добавлен в `/etc/ssl/certs/ca-certificates.crt`

**Решение**: проверьте что в Dockerfile выполняется:
```dockerfile
RUN cat /etc/ssl/certs/yandex-ca.pem >> /etc/ssl/certs/ca-certificates.crt
```

### ❌ Сертификат не монтируется

**Причина**: неправильный путь в COPY или файл не существует

**Решение**: убедитесь что файл существует:
```bash
ls -la /opt/n8n/certs/yandex-ca.crt
```

## Обновление n8n в будущем

При обновлении до новой версии n8n:

1. Обновите Dockerfile:
   ```dockerfile
   FROM n8nio/n8n:НОВАЯ_ВЕРСИЯ
   ```

2. Пересоберите образ:
   ```bash
   docker build -t n8n-yc:НОВАЯ_ВЕРСИЯ .
   ```

3. Обновите docker-compose.yml с новой версией

4. Перезапустите контейнеры

## Проверка срока действия сертификата

```bash
docker exec n8n-n8n-main-1 openssl x509 -in /etc/ssl/certs/yandex-ca.pem -noout -dates
```

**Текущий сертификат валиден до**: 2027-06-20

## Альтернативные подходы (НЕ рекомендуется)

### ❌ Отключение проверки SSL

```javascript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
```

**Почему плохо**: открывает уязвимость для MITM атак, не подходит для продакшена.

### ❌ Монтирование сертификата как volume

```yaml
volumes:
  - ./certs/yandex-ca.crt:/usr/local/share/ca-certificates/yandex-ca.crt:ro
```

**Почему плохо**: Alpine Linux требует запуск `update-ca-certificates` от root, что невозможно в работающем контейнере n8n.

## Best Practices

1. ✅ Используйте кастомный Docker образ с встроенным сертификатом
2. ✅ Устанавливайте `NODE_EXTRA_CA_CERTS`
3. ✅ Храните Dockerfile в Git
4. ✅ Автоматизируйте сборку образа через CI/CD
5. ✅ Проверяйте срок действия сертификата
6. ✅ Используйте `sslmode=verify-full` для максимальной безопасности

## Ссылки

- [Yandex Cloud CA сертификат](https://storage.yandexcloud.net/cloud-certs/CA.pem)
- [Node.js TLS документация](https://nodejs.org/api/tls.html)
- [PostgreSQL SSL modes](https://www.postgresql.org/docs/current/libpq-ssl.html)

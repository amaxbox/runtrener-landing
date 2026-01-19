#!/bin/bash

# Скрипт для быстрой настройки .env файла
# Копирует настройки БД из ya-direct/.env

echo "🔧 Настройка Support Dashboard"
echo ""

# Проверяем есть ли .env в ya-direct
if [ -f "../ya-direct/.env" ]; then
    echo "✅ Найден файл ya-direct/.env"

    # Копируем настройки БД
    PGUSER=$(grep PGUSER ../ya-direct/.env | cut -d '=' -f2)
    PGPASSWORD=$(grep PGPASSWORD ../ya-direct/.env | cut -d '=' -f2)
    PGHOST=$(grep PGHOST ../ya-direct/.env | cut -d '=' -f2)
    PGPORT=$(grep PGPORT ../ya-direct/.env | cut -d '=' -f2)
    PGDATABASE=$(grep PGDATABASE ../ya-direct/.env | cut -d '=' -f2)

    # Создаем .env файл
    cat > .env << EOF
# PostgreSQL Connection (Yandex Cloud Managed PostgreSQL)
PGUSER=$PGUSER
PGPASSWORD=$PGPASSWORD
PGHOST=$PGHOST
PGPORT=$PGPORT
PGDATABASE=$PGDATABASE

# Server
PORT=3005

# Support Dashboard Password
SUPPORT_PASSWORD=support2025
EOF

    echo "✅ Файл .env создан"
    echo ""
    echo "⚠️  ВАЖНО: Измените SUPPORT_PASSWORD на свой пароль!"
    echo "   Отредактируйте файл .env и установите надежный пароль"
    echo ""
else
    echo "❌ Файл ya-direct/.env не найден"
    echo "   Скопируйте .env.example в .env и заполните вручную:"
    echo "   cp .env.example .env"
    echo "   nano .env"
fi

echo ""
echo "Следующие шаги:"
echo "1. npm install"
echo "2. npm start"
echo "3. Откройте http://localhost:3005"

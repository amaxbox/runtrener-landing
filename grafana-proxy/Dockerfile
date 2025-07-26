FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование приложения
COPY app.py .

# Создание пользователя для безопасности
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Порт приложения
EXPOSE 8082

# Запуск приложения
CMD ["gunicorn", "--bind", "0.0.0.0:8082", "--workers", "2", "app:app"]
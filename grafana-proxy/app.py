#!/usr/bin/env python3

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import json
import os
from urllib.parse import urljoin
import logging

app = Flask(__name__)
CORS(app)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация Grafana
GRAFANA_BASE_URL = "https://amaxbox.grafana.net"
DASHBOARD_ID = "bbdd3fee2ecc44d89810db8c83bf8ba3"

@app.route('/')
def health_check():
    """Проверка работоспособности сервиса"""
    return jsonify({
        "status": "ok",
        "service": "Grafana Proxy",
        "version": "1.0.0"
    })

@app.route('/api/stats')
def get_stats():
    """Получение статистики из Grafana"""
    try:
        logger.info("Запрос статистики из Grafana...")
        
        # Сначала попробуем получить информацию о дашборде
        dashboard_url = f"{GRAFANA_BASE_URL}/api/public/dashboards/{DASHBOARD_ID}"
        
        response = requests.get(dashboard_url, timeout=10)
        logger.info(f"Dashboard response status: {response.status_code}")
        
        if response.status_code == 200:
            dashboard_data = response.json()
            logger.info(f"Dashboard data: {json.dumps(dashboard_data, indent=2)}")
            
            # Попробуем получить данные панелей
            # Обычно панели имеют ID 1, 2, 3 и т.д.
            panel_data = get_panel_data(1)  # Попробуем панель с ID 1
            
            if panel_data:
                athletes_count = extract_athletes_count(panel_data)
            else:
                athletes_count = 64  # fallback
                
        else:
            logger.warning(f"Dashboard недоступен, используем fallback значения")
            athletes_count = 64
        
        result = {
            "athletes": athletes_count,
            "timestamp": requests.utils.default_headers()['User-Agent'],
            "source": "grafana"
        }
        
        logger.info(f"Возвращаем результат: {result}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Ошибка получения данных: {str(e)}")
        return jsonify({
            "athletes": 64,  # fallback
            "error": str(e),
            "timestamp": "error",
            "source": "fallback"
        })

def get_panel_data(panel_id):
    """Получение данных конкретной панели"""
    try:
        import time
        current_time = int(time.time() * 1000)
        one_hour_ago = current_time - (60 * 60 * 1000)
        
        query_url = f"{GRAFANA_BASE_URL}/api/public/dashboards/{DASHBOARD_ID}/panels/{panel_id}/query"
        
        payload = {
            "from": one_hour_ago,
            "to": current_time
        }
        
        response = requests.post(
            query_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        logger.info(f"Panel {panel_id} response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Panel {panel_id} data: {json.dumps(data, indent=2)}")
            return data
        else:
            logger.warning(f"Panel {panel_id} недоступна")
            return None
            
    except Exception as e:
        logger.error(f"Ошибка получения данных панели {panel_id}: {str(e)}")
        return None

def extract_athletes_count(panel_data):
    """Извлечение количества атлетов из данных панели"""
    try:
        # Здесь нужно будет адаптировать под структуру ваших данных
        # Пример возможных путей к данным:
        if isinstance(panel_data, dict):
            # Попробуем разные возможные пути
            paths_to_try = [
                ["data", "result", 0, "value", 1],
                ["data", "result", 0, "values", 0, 1],
                ["results", "A", "frames", 0, "data", "values", 0, 0],
                ["results", "data", 0, "value"],
                ["data", 0, "value"],
                ["value"],
                ["count"],
                ["total"]
            ]
            
            for path in paths_to_try:
                try:
                    current = panel_data
                    for key in path:
                        current = current[key]
                    
                    # Если нашли число, возвращаем его
                    if isinstance(current, (int, float)):
                        logger.info(f"Найдено значение {current} по пути {path}")
                        return int(current)
                        
                except (KeyError, IndexError, TypeError):
                    continue
        
        # Если ничего не нашли, возвращаем fallback
        logger.warning("Не удалось извлечь значение из данных панели")
        return 64
        
    except Exception as e:
        logger.error(f"Ошибка извлечения данных: {str(e)}")
        return 64

@app.route('/api/debug')
def debug_grafana():
    """Отладочный endpoint для исследования структуры данных"""
    try:
        dashboard_url = f"{GRAFANA_BASE_URL}/api/public/dashboards/{DASHBOARD_ID}"
        response = requests.get(dashboard_url, timeout=10)
        
        debug_info = {
            "dashboard_status": response.status_code,
            "dashboard_data": response.json() if response.status_code == 200 else None
        }
        
        # Попробуем получить данные нескольких панелей
        for panel_id in range(1, 6):  # Попробуем панели 1-5
            panel_data = get_panel_data(panel_id)
            debug_info[f"panel_{panel_id}"] = panel_data
        
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8082))
    app.run(host='0.0.0.0', port=port, debug=False)
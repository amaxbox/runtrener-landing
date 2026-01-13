global:
  resolve_timeout: 5m

route:
  receiver: telegram-detailed
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 30m
  repeat_interval: 30m
  routes:
    - receiver: telegram-heartbeat
      matchers:
        - severity="info"
      group_wait: 0s
      group_interval: 5m
      repeat_interval: 5m
      continue: false

receivers:
  - name: telegram-heartbeat
    telegram_configs:
      - api_url: https://api.telegram.org
        bot_token: $ALERTMANAGER_TELEGRAM_BOT_TOKEN
        chat_id: $ALERTMANAGER_TELEGRAM_CHAT_ID
        parse_mode: HTML
        message: '{{ template "telegram.heartbeat" . }}'
        send_resolved: false
  - name: telegram-detailed
    telegram_configs:
      - api_url: https://api.telegram.org
        bot_token: $ALERTMANAGER_TELEGRAM_BOT_TOKEN
        chat_id: $ALERTMANAGER_TELEGRAM_CHAT_ID
        parse_mode: HTML
        message: '{{ template "telegram.detailed" . }}'

templates:
  - /etc/alertmanager/templates/*.tmpl

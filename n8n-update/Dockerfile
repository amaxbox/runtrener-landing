FROM n8nio/n8n:2.0.3

USER root

# Добавляем Yandex CA сертификат в системное хранилище
COPY certs/yandex-ca.crt /etc/ssl/certs/yandex-ca.pem
RUN cat /etc/ssl/certs/yandex-ca.pem >> /etc/ssl/certs/ca-certificates.crt

# Указываем Node.js использовать системный trust store
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Установка внешних npm пакетов для n8n Code nodes
# Устанавливаем глобально, чтобы Task Runner мог найти
RUN npm install -g moy-nalog --legacy-peer-deps

USER node

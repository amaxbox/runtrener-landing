#!/bin/bash

# Grafana Proxy Deployment Script

set -e

echo "🚀 Starting Grafana Proxy deployment..."

# Configuration (используем те же настройки что и для pdf-generator)
SERVER_USER="root"
SERVER_HOST="89.110.65.155"
SERVER_PATH="/var/www/grafana-proxy"
SSH_KEY="/Users/amax/.ssh/pdf_generator_ed25519"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found at $SSH_KEY"
    exit 1
fi

# Upload files to server
print_status "Uploading files to server..."
rsync -avz -e "ssh -i ${SSH_KEY}" --exclude='.git' --exclude='*.pyc' --exclude='__pycache__' \
    ./ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/

# Deploy on server
print_status "Deploying on server..."
ssh -i ${SSH_KEY} ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

cd /var/www/grafana-proxy

# Stop existing container
docker-compose down || true

# Build and start new container
docker-compose build
docker-compose up -d

# Check if container is running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Grafana Proxy is running!"
else
    echo "❌ Failed to start Grafana Proxy"
    docker-compose logs
    exit 1
fi

ENDSSH

print_status "Deployment completed!"
print_status "Your Grafana Proxy should be available at: http://${SERVER_HOST}:8083"

# Test the deployment
print_status "Testing the deployment..."
sleep 10
if curl -f http://${SERVER_HOST}:8083 > /dev/null 2>&1; then
    print_status "✅ Service is responding!"
else
    print_warning "⚠️  Service might not be fully ready yet. Check manually."
fi

echo ""
echo "🔗 Access your Grafana Proxy:"
echo "   Health Check:  http://${SERVER_HOST}:8083"
echo "   Stats API:     http://${SERVER_HOST}:8083/api/stats"
echo "   Debug API:     http://${SERVER_HOST}:8083/api/debug"
echo ""
echo "📋 To check logs: ssh -i ${SSH_KEY} ${SERVER_USER}@${SERVER_HOST} 'cd ${SERVER_PATH} && docker-compose logs'"
#!/bin/bash

# Deployment script for Running Coach Landing Page
set -e

# Configuration
DOMAIN="runtrener.ru"
SERVER_USER="root"
SERVER_HOST="195.200.26.158"
REMOTE_PATH="/var/www/running-coach-landing"
NGINX_CONF="/etc/nginx/sites-available/running-coach-landing"

echo "🚀 Deploying Running Coach Landing Page..."

# Check if required files exist
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found!"
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p ./deploy-temp
cp index.html ./deploy-temp/
cp nginx-http.conf ./deploy-temp/nginx.conf
cp robots.txt ./deploy-temp/ 2>/dev/null || echo "robots.txt not found, skipping"
cp sitemap.xml ./deploy-temp/ 2>/dev/null || echo "sitemap.xml not found, skipping"
cp favicon.svg ./deploy-temp/ 2>/dev/null || echo "favicon.svg not found, skipping"

# Upload files to server
echo "⬆️  Uploading files to server..."
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}"
scp ./deploy-temp/index.html ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/
scp ./deploy-temp/nginx.conf ${SERVER_USER}@${SERVER_HOST}:/tmp/
scp ./deploy-temp/robots.txt ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/ 2>/dev/null || echo "robots.txt upload skipped"
scp ./deploy-temp/sitemap.xml ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/ 2>/dev/null || echo "sitemap.xml upload skipped"
scp ./deploy-temp/favicon.svg ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/ 2>/dev/null || echo "favicon.svg upload skipped"

# Configure Nginx on server
echo "⚙️  Installing and configuring Nginx..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    # Install nginx and certbot if not installed
    if ! command -v nginx &> /dev/null; then
        echo "Installing nginx..."
        apt update
        apt install -y nginx certbot python3-certbot-nginx
        systemctl enable nginx
        systemctl start nginx
    fi
    
    # Copy nginx config
    cp /tmp/nginx.conf /etc/nginx/sites-available/running-coach-landing
    
    # Enable site
    ln -sf /etc/nginx/sites-available/running-coach-landing /etc/nginx/sites-enabled/
    
    # Remove default nginx site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    # Set proper permissions
    chown -R www-data:www-data /var/www/running-coach-landing
    chmod -R 755 /var/www/running-coach-landing
EOF

# Clean up
rm -rf ./deploy-temp

echo "✅ Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Update DNS records to point to your server IP"
echo "2. Install SSL certificate with: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo "3. Update nginx.conf with your actual domain name"
echo ""
echo "Your site will be available at: https://${DOMAIN}"
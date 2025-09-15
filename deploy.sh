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

if [ ! -f "index-en.html" ]; then
    echo "❌ Error: index-en.html not found!"
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p ./deploy-temp
mkdir -p ./deploy-temp/en

# Copy Russian version (main)
cp index.html ./deploy-temp/

# Copy English version
cp index-en.html ./deploy-temp/en/index.html

# Copy presentation files if they exist
if [ -d "keynote" ]; then
    cp -r keynote ./deploy-temp/
    echo "Keynote presentations copied"
else
    echo "keynote/ folder not found, skipping presentations"
fi

# Copy shared assets
cp nginx-http.conf ./deploy-temp/nginx.conf

# Copy CSS and JS folders with all assets
if [ -d "css" ]; then
    cp -r css ./deploy-temp/
    echo "CSS files copied"
else
    echo "css/ folder not found, skipping"
fi

if [ -d "js" ]; then
    cp -r js ./deploy-temp/
    echo "JS files copied" 
else
    echo "js/ folder not found, skipping"
fi

# Copy individual assets
cp stats-proxy.php ./deploy-temp/ 2>/dev/null || echo "stats-proxy.php not found, skipping"
cp robots.txt ./deploy-temp/ 2>/dev/null || echo "robots.txt not found, skipping"
cp sitemap.xml ./deploy-temp/ 2>/dev/null || echo "sitemap.xml not found, skipping"
cp favicon.svg ./deploy-temp/ 2>/dev/null || echo "favicon.svg not found, skipping"
cp telegram.svg ./deploy-temp/ 2>/dev/null || echo "telegram.svg not found, skipping"
cp telegram-svgrepo-com.svg ./deploy-temp/ 2>/dev/null || echo "telegram-svgrepo-com.svg not found, skipping"
cp generated-image.jpg ./deploy-temp/ 2>/dev/null || echo "generated-image.jpg not found, skipping"

# Upload files to server
echo "⬆️  Uploading files to server..."
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}/en"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}/css"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}/js"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}/keynote"
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_PATH}/keynote/en"

# Upload all files using rsync for better performance
rsync -avz --progress ./deploy-temp/ ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/

# Move nginx config to temp location for server setup
scp ./deploy-temp/nginx.conf ${SERVER_USER}@${SERVER_HOST}:/tmp/

# Configure Nginx on server
echo "⚙️  Installing and configuring Nginx..."
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
    # Install nginx, php and certbot if not installed
    if ! command -v nginx &> /dev/null; then
        echo "Installing nginx..."
        apt update
        apt install -y nginx php-fpm certbot python3-certbot-nginx
        systemctl enable nginx
        systemctl start nginx
        systemctl enable php8.3-fpm
        systemctl start php8.3-fpm
    fi
    
    # Install PHP if not present
    if ! command -v php &> /dev/null; then
        echo "Installing PHP..."
        apt update
        apt install -y php-fpm
        systemctl enable php8.3-fpm
        systemctl start php8.3-fpm
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
echo "Deployed versions:"
echo "🇷🇺 Russian: https://${DOMAIN}/"
echo "🇺🇸 English: https://${DOMAIN}/en/"
echo "📊 Presentation RU: https://${DOMAIN}/keynote/"
echo "📊 Presentation EN: https://${DOMAIN}/keynote/en/"
echo ""
echo "Next steps:"
echo "1. Update DNS records to point to your server IP"
echo "2. Install SSL certificate with: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo "3. Update nginx.conf with your actual domain name"
echo ""
echo "Both language versions are now live with automatic locale detection!"
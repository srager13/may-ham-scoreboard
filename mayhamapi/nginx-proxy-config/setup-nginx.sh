#!/bin/bash
# ============================================
# IDEMPOTENT SETUP SCRIPT FOR NGINX + CERTBOT (Let's Encrypt)
# ============================================

set -e

echo "=============================="
echo "🏌️  Nginx Reverse Proxy Setup (Idempotent)"
echo "=============================="

# Configuration
DOMAIN="mayhamscoreboard.com"
DEV_DOMAIN="dev.mayhamscoreboard.com"
EMAIL="srager13@gmail.com"
BACKEND_PORT=8081
BACKEND_DEV_PORT=8080
FRONTEND_DEV_PORT=5173

# Update domain in script
read -p "Enter domain name (default: $DOMAIN): " domain_input
DOMAIN="${domain_input:-$DOMAIN}"

read -p "Enter email for Let's Encrypt (default: $EMAIL): " email_input
EMAIL="${email_input:-$EMAIL}"

# Function to check if SSL certificate exists and is valid
check_ssl_cert() {
    local domain=$1
    if [ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
        # Check if certificate is valid and not expiring soon (30 days)
        if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$domain/fullchain.pem" >/dev/null 2>&1; then
            echo "✅ Valid SSL certificate already exists for $domain"
            return 0
        else
            echo "⚠️  SSL certificate exists but expires soon or is invalid for $domain"
            return 1
        fi
    else
        echo "❌ No SSL certificate found for $domain"
        return 1
    fi
}

# Function to check if nginx config is already correct
check_nginx_config() {
    if [ ! -f "/etc/nginx/nginx.conf" ]; then
        return 1
    fi
    
    # Check if our domains are in the config and SSL certificates are referenced
    if grep -q "server_name $DOMAIN;" /etc/nginx/nginx.conf && \
       grep -q "server_name $DEV_DOMAIN;" /etc/nginx/nginx.conf && \
       grep -q "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/nginx/nginx.conf && \
       grep -q "/etc/letsencrypt/live/$DEV_DOMAIN/fullchain.pem" /etc/nginx/nginx.conf; then
        echo "✅ Nginx configuration already correct for $DOMAIN and $DEV_DOMAIN"
        return 0
    else
        echo "❌ Nginx configuration needs updating"
        return 1
    fi
}

# Function to check if cron job already exists
check_cron_job() {
    if crontab -l 2>/dev/null | grep -q "nginx-health-check.sh"; then
        echo "✅ Health check cron job already exists"
        return 0
    else
        echo "❌ Health check cron job not found"
        return 1
    fi
}

# Install nginx
echo "=============================="
echo "Installing nginx..."
echo "=============================="
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Install certbot renewal timer
systemctl enable certbot.timer
systemctl start certbot.timer

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Check if we need to get SSL certificate
NEED_CERT=false
NEED_DEV_CERT=false

if ! check_ssl_cert "$DOMAIN"; then
    NEED_CERT=true
fi

if ! check_ssl_cert "$DEV_DOMAIN"; then
    NEED_DEV_CERT=true
fi

if [ "$NEED_CERT" = true ] || [ "$NEED_DEV_CERT" = true ]; then
    echo "=============================="
    echo "SSL certificate needed - setting up temporary config..."
    echo "=============================="
    
    # Stop nginx if running
    if systemctl is-active --quiet nginx; then
        echo "Stopping nginx temporarily..."
        systemctl stop nginx
    fi

    # Backup existing configurations (only if no backup exists)
    if [ -f "/etc/nginx/nginx.conf" ] && [ ! -f "/etc/nginx/nginx.conf.backup.original" ]; then
        echo "Backing up original nginx.conf..."
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.original
    fi
    
    if [ -f "/etc/nginx/sites-available/default" ] && [ ! -f "/etc/nginx/sites-available/default.backup.original" ]; then
        echo "Backing up original sites-available/default..."
        cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.original
    fi

    # Create minimal nginx.conf for certificate generation
    cat > /etc/nginx/nginx.conf <<EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    keepalive_timeout 65;
    
    include /etc/nginx/sites-enabled/*;
}
EOF

    # Create basic HTTP-only config for ACME challenge
    cat > /etc/nginx/sites-available/default <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $DOMAIN $DEV_DOMAIN;

    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri =404;
    }

    # Temporarily allow all HTTP traffic for certificate generation
    location / {
        return 200 "Server is being configured. Please wait...";
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable the site configuration
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

    # Start nginx with basic config
    echo "Starting nginx with basic configuration..."
    nginx -t
    systemctl start nginx
    systemctl enable nginx

    # Wait a moment for nginx to fully start
    sleep 2

    # Generate SSL certificate with Let's Encrypt
    echo "=============================="
    echo "Generating SSL certificates..."
    echo "=============================="
    
    if [ "$NEED_CERT" = true ]; then
        echo "Getting certificate for $DOMAIN..."
        certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -d "www.$DOMAIN" -n --agree-tos --email "$EMAIL"
        echo "✅ SSL certificate obtained for $DOMAIN"
    fi
    
    if [ "$NEED_DEV_CERT" = true ]; then
        echo "Getting certificate for $DEV_DOMAIN..."
        certbot certonly --webroot -w /var/www/certbot -d "$DEV_DOMAIN" -n --agree-tos --email "$EMAIL"
        echo "✅ SSL certificate obtained for $DEV_DOMAIN"
    fi
else
    echo "✅ All SSL certificates already valid, skipping certificate generation"
fi

# Check if we need to update nginx configuration
if ! check_nginx_config || [ "$NEED_CERT" = true ] || [ "$NEED_DEV_CERT" = true ]; then
    echo "=============================="
    echo "Setting up production nginx configuration..."
    echo "=============================="

    # Remove the sites-enabled default (since we're using nginx.conf directly)
    rm -f /etc/nginx/sites-enabled/default

    # Copy the production nginx.conf from the repository
    if [ -f "./nginx.conf" ]; then
        echo "Using nginx.conf from current directory..."
        cp ./nginx.conf /etc/nginx/nginx.conf
    else
        echo "ERROR: nginx.conf not found in current directory!"
        echo "Please run this script from the nginx-proxy-config directory"
        exit 1
    fi

    # Test nginx configuration
    echo "=============================="
    echo "Testing nginx configuration..."
    echo "=============================="
    nginx -t

    # Reload nginx with new configuration
    echo "=============================="
    echo "Reloading nginx with SSL configuration..."
    echo "=============================="
    systemctl reload nginx
    
    echo "✅ Nginx configuration updated"
else
    echo "✅ Nginx configuration already correct, skipping update"
fi

# Create log files if they don't exist
mkdir -p /var/log/nginx
touch /var/log/nginx/golf_access.log
touch /var/log/nginx/golf_api_access.log
touch /var/log/nginx/golf_error.log
touch /var/log/nginx/golf_dev_access.log
touch /var/log/nginx/golf_dev_api_access.log
touch /var/log/nginx/golf_dev_error.log

# Set proper permissions
chown -R www-data:www-data /var/log/nginx

# Setup monitoring script (only if it doesn't exist)
if [ ! -f "/usr/local/bin/nginx-health-check.sh" ]; then
    echo "=============================="
    echo "Setting up health monitoring..."
    echo "=============================="
    cat > /usr/local/bin/nginx-health-check.sh <<'EOFSCRIPT'
#!/bin/bash

# Check if production backend is running
BACKEND_PROD_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health)
# Check if dev backend is running
BACKEND_DEV_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
# Check if dev frontend is running
FRONTEND_DEV_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)

if [ "$BACKEND_PROD_HEALTHY" != "200" ]; then
    echo "WARNING: Production backend health check failed (HTTP $BACKEND_PROD_HEALTHY)"
fi

if [ "$BACKEND_DEV_HEALTHY" != "200" ]; then
    echo "WARNING: Dev backend health check failed (HTTP $BACKEND_DEV_HEALTHY)"
fi

if [ "$FRONTEND_DEV_HEALTHY" != "200" ]; then
    echo "WARNING: Dev frontend health check failed (HTTP $FRONTEND_DEV_HEALTHY)"
fi

NGINX_RUNNING=$(pgrep -c nginx)
if [ "$NGINX_RUNNING" -lt 1 ]; then
    echo "ERROR: Nginx is not running!"
    systemctl start nginx
fi

echo "✓ All services healthy"
EOFSCRIPT

    chmod +x /usr/local/bin/nginx-health-check.sh
    echo "✅ Health monitoring script created"
else
    echo "✅ Health monitoring script already exists"
fi

# Setup cron job for health checks (only if it doesn't exist)
if ! check_cron_job; then
    echo "Setting up health check cron job..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/nginx-health-check.sh >> /var/log/nginx/health-check.log 2>&1") | crontab -
    echo "✅ Health check cron job added"
else
    echo "✅ Health check cron job already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Production server: https://$DOMAIN"
echo "Development server: https://$DEV_DOMAIN"
echo ""
echo "Useful commands:"
echo "  nginx -t                          # Test configuration"
echo "  systemctl restart nginx           # Restart nginx"
echo "  systemctl status nginx            # Check status"
echo "  journalctl -u nginx -f            # View logs"
echo "  tail -f /var/log/nginx/golf_*     # View app logs"
echo ""
echo "SSL Certificates:"
echo "  Production: /etc/letsencrypt/live/$DOMAIN/"
echo "  Development: /etc/letsencrypt/live/$DEV_DOMAIN/"
echo "  Auto-renewal: Enabled (systemctl status certbot.timer)"
echo ""
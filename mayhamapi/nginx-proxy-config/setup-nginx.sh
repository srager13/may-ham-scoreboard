
# ============================================
# SETUP SCRIPT FOR NGINX + CERTBOT (Let's Encrypt)
# ============================================

#!/bin/bash
# File: setup-nginx.sh
# Usage: sudo bash setup-nginx.sh

set -e

echo "🏌️  Nginx Reverse Proxy Setup"
echo "=============================="

# Configuration
DOMAIN="mayhamscoreboard.com"
EMAIL="srager13@gmail.com"
BACKEND_PORT=8080
FRONTEND_PORT=5173

# Update domain in script
read -p "Enter domain name (default: $DOMAIN): " domain_input
DOMAIN="${domain_input:-$DOMAIN}"

read -p "Enter email for Let's Encrypt (default: $EMAIL): " email_input
EMAIL="${email_input:-$EMAIL}"

# Install nginx
echo "Installing nginx..."
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Install certbot renewal timer
systemctl enable certbot.timer
systemctl start certbot.timer

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Generate SSL certificate with Let's Encrypt
echo "Generating SSL certificate..."
certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -n --agree-tos --email "$EMAIL"

# Update nginx configuration
echo "Updating nginx configuration..."
sed -i "s/golf.example.com/$DOMAIN/g" /etc/nginx/nginx.conf

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Enable and start nginx
echo "Enabling nginx..."
systemctl enable nginx
systemctl start nginx

# Create log files
mkdir -p /var/log/nginx
touch /var/log/nginx/golf_access.log
touch /var/log/nginx/golf_api_access.log
touch /var/log/nginx/golf_error.log

# Set proper permissions
chown -R www-data:www-data /var/log/nginx

# Setup automatic certificate renewal
echo "Setting up automatic certificate renewal..."
cat > /etc/nginx/snippets/ssl-certbot-renew.conf <<EOF
# Certbot renewal endpoint
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
EOF

# Create monitoring script
cat > /usr/local/bin/nginx-health-check.sh <<'EOFSCRIPT'
#!/bin/bash

# Check if backend is running
BACKEND_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
FRONTEND_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)

if [ "$BACKEND_HEALTHY" != "200" ]; then
    echo "WARNING: Backend health check failed (HTTP $BACKEND_HEALTHY)"
fi

if [ "$FRONTEND_HEALTHY" != "200" ]; then
    echo "WARNING: Frontend health check failed (HTTP $FRONTEND_HEALTHY)"
fi

NGINX_RUNNING=$(pgrep -c nginx)
if [ "$NGINX_RUNNING" -lt 1 ]; then
    echo "ERROR: Nginx is not running!"
    systemctl start nginx
fi

echo "✓ All services healthy"
EOFSCRIPT

chmod +x /usr/local/bin/nginx-health-check.sh

# Setup cron job for health checks
echo "*/5 * * * * /usr/local/bin/nginx-health-check.sh >> /var/log/nginx/health-check.log 2>&1" | crontab -

echo "✅ Setup complete!"
echo ""
echo "Server is running at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  nginx -t                          # Test configuration"
echo "  systemctl restart nginx           # Restart nginx"
echo "  systemctl status nginx            # Check status"
echo "  journalctl -u nginx -f            # View logs"
echo "  tail -f /var/log/nginx/golf_*     # View app logs"
echo ""
echo "SSL Certificate:"
echo "  Location: /etc/letsencrypt/live/$DOMAIN/"
echo "  Valid until: $(certbot certificates 2>/dev/null | grep Expiry || echo 'Check certbot certificates')"
echo "  Auto-renewal: Enabled (systemctl status certbot.timer)"
echo ""

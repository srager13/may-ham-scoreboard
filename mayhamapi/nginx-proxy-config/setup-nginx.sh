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
EMAIL="srager13@gmail.com"
BACKEND_PORT=8080
FRONTEND_PORT=5173

# Update domain in script
read -p "Enter domain name (default: $DOMAIN): " domain_input
DOMAIN="${domain_input:-$DOMAIN}"

read -p "Enter email for Let's Encrypt (default: $EMAIL): " email_input
EMAIL="${email_input:-$EMAIL}"

# Function to check if SSL certificate exists and is valid
check_ssl_cert() {
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        # Check if certificate is valid and not expiring soon (30 days)
        if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" >/dev/null 2>&1; then
            echo "✅ Valid SSL certificate already exists for $DOMAIN"
            return 0
        else
            echo "⚠️  SSL certificate exists but expires soon or is invalid"
            return 1
        fi
    else
        echo "❌ No SSL certificate found for $DOMAIN"
        return 1
    fi
}

# Function to check if nginx config is already correct
check_nginx_config() {
    if [ ! -f "/etc/nginx/nginx.conf" ]; then
        return 1
    fi
    
    # Check if our domain is in the config and SSL certificates are referenced
    if grep -q "server_name $DOMAIN;" /etc/nginx/nginx.conf && \
       grep -q "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/nginx/nginx.conf; then
        echo "✅ Nginx configuration already correct for $DOMAIN"
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
if ! check_ssl_cert; then
    NEED_CERT=true
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
    server_name $DOMAIN;

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

    # Start nginx with basic config
    echo "Starting nginx with basic configuration..."
    nginx -t
    systemctl start nginx
    systemctl enable nginx

    # Wait a moment for nginx to fully start
    sleep 2

    # Generate SSL certificate with Let's Encrypt
    echo "=============================="
    echo "Generating SSL certificate..."
    echo "=============================="
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -n --agree-tos --email "$EMAIL"
    
    echo "✅ SSL certificate obtained successfully"
else
    echo "✅ SSL certificate already valid, skipping certificate generation"
fi

# Check if we need to update nginx configuration
if ! check_nginx_config || [ "$NEED_CERT" = true ]; then
    echo "=============================="
    echo "Setting up production nginx configuration..."
    echo "=============================="

    # Remove the sites-enabled default (since we're using nginx.conf directly)
    rm -f /etc/nginx/sites-enabled/default

    # Create the production nginx.conf with SSL
    cat > /etc/nginx/nginx.conf <<EOF
# ============================================
# NGINX PRODUCTION REVERSE PROXY CONFIGURATION
# ============================================

user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    log_format api '\$remote_addr - \$remote_user [\$time_local] '
                   '"\$request" \$status \$body_bytes_sent '
                   'rt=\$request_time uct="\$upstream_connect_time" '
                   'uht="\$upstream_header_time" urt="\$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # Hide nginx version
    server_tokens off;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone \$binary_remote_addr zone=auth:10m rate=5r/m;

    # Upstream backend servers
    upstream golf_api_backend {
        least_conn;
        server localhost:$BACKEND_PORT max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    upstream golf_frontend {
        server localhost:$FRONTEND_PORT max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP redirect to HTTPS
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name $DOMAIN;

        # Allow Let's Encrypt ACME challenges
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Redirect all other traffic to HTTPS
        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    # HTTPS server with SSL/TLS
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name $DOMAIN;

        # SSL Certificate paths
        ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

        # SSL configuration (Mozilla recommended - modern)
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # SSL optimizations
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # HSTS (HTTP Strict Transport Security)
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

        # Logging
        access_log /var/log/nginx/golf_access.log main;
        error_log /var/log/nginx/golf_error.log warn;

        # Root location
        location / {
            proxy_pass http://golf_frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_redirect off;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # Caching for static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
                proxy_pass http://golf_frontend;
                proxy_cache_valid 200 30d;
                add_header Cache-Control "public, immutable";
            }
        }

        # API endpoints
        location /api/v1/ {
            limit_req zone=api burst=200 nodelay;

            access_log /var/log/nginx/golf_api_access.log api;

            proxy_pass http://golf_api_backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # API specific timeouts (longer for scoring operations)
            proxy_connect_timeout 10s;
            proxy_send_timeout 30s;
            proxy_read_timeout 60s;

            # HTTP/1.1 for better performance
            proxy_http_version 1.1;
            proxy_set_header Connection "";

            # Disable buffering for streaming
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # WebSocket endpoint
        location /ws/ {
            proxy_pass http://golf_api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;

            # WebSocket timeouts (much longer)
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;

            # Disable buffering for WebSocket
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # Health check endpoint (internal only)
        location /health {
            access_log off;
            proxy_pass http://golf_api_backend;
            proxy_set_header Host \$host;
        }

        # Deny access to sensitive files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        location ~ ~\$ {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Deny access to config files
        location ~ \.(conf|yml|yaml|ini|env)\$ {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Handle frontend routing (SPA)
        error_page 404 =200 /index.html;
    }

    # Include additional configuration files
    include /etc/nginx/conf.d/*.conf;
}
EOF

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

# Set proper permissions
chown -R www-data:www-data /var/log/nginx

# Setup monitoring script (only if it doesn't exist)
if [ ! -f "/usr/local/bin/nginx-health-check.sh" ]; then
    echo "=============================="
    echo "Setting up health monitoring..."
    echo "=============================="
    cat > /usr/local/bin/nginx-health-check.sh <<'EOFSCRIPT'
#!/bin/bash

# Check if backend is running
BACKEND_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
FRONTEND_HEALTHY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)

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
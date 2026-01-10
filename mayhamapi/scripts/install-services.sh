#!/bin/bash
# Install and configure systemd services
# Must be run as root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Require root
require_root

log_info "=== Golf Tournament Service Installation ==="

# Configuration
DEPLOY_DIR="/opt/golf-tournament"
SERVICE_USER="golftournament"
SERVICE_GROUP="golftournament"

# Step 1: Create service user
log_info "Step 1: Creating service user..."
if id "$SERVICE_USER" &>/dev/null; then
    log_info "User $SERVICE_USER already exists"
else
    useradd -r -s /bin/bash -d "$DEPLOY_DIR" "$SERVICE_USER"
    log_success "Created user: $SERVICE_USER"
fi

# Step 2: Create directories
log_info "Step 2: Creating directories..."
mkdir -p "$DEPLOY_DIR/backend"
mkdir -p "$DEPLOY_DIR/logs"
mkdir -p /var/log/golf-tournament
mkdir -p /var/backups/golf-tournament/{daily,weekly,monthly,deployments}

chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOY_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/log/golf-tournament
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/backups/golf-tournament

log_success "Directories created"

# Step 3: Copy and configure systemd service file
log_info "Step 3: Installing systemd service..."
cp "$PROJECT_ROOT/system-service/golf-api.service" /etc/systemd/system/

log_success "Systemd service installed"

# Step 4: Reload systemd
log_info "Step 4: Reloading systemd..."
systemctl daemon-reload
log_success "Systemd reloaded"

# Step 5: Enable service
log_info "Step 5: Enabling service..."
systemctl enable golf-api.service
log_success "Service enabled (will start on boot)"

# Step 6: Set up log rotation
log_info "Step 6: Setting up log rotation..."
cat > /etc/logrotate.d/golf-tournament <<EOF
/var/log/golf-tournament/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $SERVICE_USER $SERVICE_GROUP
    sharedscripts
    postrotate
        systemctl reload golf-api > /dev/null 2>&1 || true
    endscript
}
EOF
log_success "Log rotation configured"

# Step 7: Set up backup cron job
log_info "Step 7: Setting up automated backups..."
CRON_FILE="/etc/cron.d/golf-tournament-backup"
cat > "$CRON_FILE" <<EOF
# Golf Tournament automated database backup
# Runs daily at 2 AM
0 2 * * * $SERVICE_USER $SCRIPT_DIR/backup-database.sh production >> /var/log/golf-tournament/backup.log 2>&1
EOF
chmod 644 "$CRON_FILE"
log_success "Backup cron job installed"

# Summary
echo ""
log_success "=== Installation Complete ==="
echo ""
log_info "Service Installation Summary:"
echo "  Service user: $SERVICE_USER"
echo "  Deploy directory: $DEPLOY_DIR"
echo "  Log directory: /var/log/golf-tournament"
echo "  Backup directory: /var/backups/golf-tournament"
echo ""
log_info "Next steps:"
echo "  1. Ensure .env.production is configured in: $PROJECT_ROOT/.env.production"
echo "  2. Run initial deployment: cd $PROJECT_ROOT/scripts && ./deploy.sh v1.0.0"
echo ""
log_info "Useful commands:"
echo "  Start service:   systemctl start golf-api"
echo "  Stop service:    systemctl stop golf-api"
echo "  Service status:  systemctl status golf-api"
echo "  View logs:       journalctl -u golf-api -f"

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
# Mode: prod (default), dev, or both
MODE="${1:-prod}"
case "$MODE" in
  prod)
    INSTALL_PROD=1
    INSTALL_DEV=0
    ;;
  dev)
    INSTALL_PROD=0
    INSTALL_DEV=1
    ;;
  both)
    INSTALL_PROD=1
    INSTALL_DEV=1
    ;;
  *)
    log_error "Usage: $0 [prod|dev|both]"
    exit 2
    ;;
esac

DEPLOY_DIR="/opt/golf-tournament"
SERVICE_USER="golftournament"
SERVICE_GROUP="golftournament"

# Development (dev) service user and paths
DEV_SERVICE_USER="golftournament-dev"
DEV_SERVICE_GROUP="golftournament-dev"
DEV_WORKING_DIR="$PROJECT_ROOT"
DEV_LOG_DIR="/var/log/golf-tournament-dev"
DEV_BACKUP_DIR="/var/backups/golf-tournament-dev"

# Step 1: Create service users
log_info "Step 1: Creating service users..."
if [ "$INSTALL_PROD" -eq 1 ]; then
  if id "$SERVICE_USER" &>/dev/null; then
      log_info "User $SERVICE_USER already exists"
  else
      useradd -r -s /bin/bash -d "$DEPLOY_DIR" "$SERVICE_USER"
      log_success "Created user: $SERVICE_USER"
  fi
fi

if [ "$INSTALL_DEV" -eq 1 ]; then
  if id "$DEV_SERVICE_USER" &>/dev/null; then
      log_info "User $DEV_SERVICE_USER already exists"
  else
      useradd -r -s /bin/bash -d "$DEV_WORKING_DIR" "$DEV_SERVICE_USER"
      log_success "Created user: $DEV_SERVICE_USER"
  fi
fi

# Step 2: Create directories
log_info "Step 2: Creating directories..."
if [ "$INSTALL_PROD" -eq 1 ]; then
  mkdir -p "$DEPLOY_DIR/backend/db"
  mkdir -p "$DEPLOY_DIR/logs"
  mkdir -p /var/log/golf-tournament
  mkdir -p /var/backups/golf-tournament/{daily,weekly,monthly,deployments}
  mkdir -p /srv/golf-api/uploads
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOY_DIR"
  chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/log/golf-tournament
  chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/backups/golf-tournament
  chown -R "$SERVICE_USER:$SERVICE_GROUP" /srv/golf-api
fi

if [ "$INSTALL_DEV" -eq 1 ]; then
  mkdir -p "$DEV_WORKING_DIR"
  mkdir -p "$DEV_LOG_DIR"
  mkdir -p "$DEV_BACKUP_DIR"
  mkdir -p /srv/golf-api-dev/uploads
  chown -R "$DEV_SERVICE_USER:$DEV_SERVICE_GROUP" "$DEV_WORKING_DIR" || true
  chown -R "$DEV_SERVICE_USER:$DEV_SERVICE_GROUP" "$DEV_LOG_DIR" || true
  chown -R "$DEV_SERVICE_USER:$DEV_SERVICE_GROUP" "$DEV_BACKUP_DIR" || true
  chown -R "$DEV_SERVICE_USER:$DEV_SERVICE_GROUP" /srv/golf-api-dev || true
fi

log_success "Directories created"

# Step 3: Copy and configure systemd service file(s)
log_info "Step 3: Installing systemd service(s)..."
if [ "$INSTALL_PROD" -eq 1 ]; then
  cp "$PROJECT_ROOT/system-service/golf-api.service" /etc/systemd/system/
  log_success "Installed production service: golf-api.service"
fi
if [ "$INSTALL_DEV" -eq 1 ]; then
  cp "$PROJECT_ROOT/system-service/dev/golf-api-dev.service" /etc/systemd/system/
  cp "$PROJECT_ROOT/system-service/dev/golf-frontend-dev.service" /etc/systemd/system/ || true
  log_success "Installed development service(s): golf-api-dev.service"
fi

# If we have tmpfiles configuration, install it so systemd can create the
# persistent /srv directories before starting services (avoids NAMESPACE errors
# when ReadWritePaths reference those locations).
if [ -f "$PROJECT_ROOT/system-service/tmpfiles.d/golf-api.conf" ]; then
  log_info "Installing tmpfiles configuration..."
  cp "$PROJECT_ROOT/system-service/tmpfiles.d/golf-api.conf" /etc/tmpfiles.d/
  log_success "Installed /etc/tmpfiles.d/golf-api.conf"
  if command -v systemd-tmpfiles >/dev/null 2>&1; then
    log_info "Creating tmpfiles-managed paths..."
    systemd-tmpfiles --create /etc/tmpfiles.d/golf-api.conf || true
    log_success "tmpfiles entries created"
  else
    log_warning "systemd-tmpfiles not available; creating directories manually"
    mkdir -p /srv/golf-api /srv/golf-api/uploads /srv/golf-api-dev /srv/golf-api-dev/uploads
    chown -R "$SERVICE_USER:$SERVICE_GROUP" /srv/golf-api || true
    chown -R "$DEV_SERVICE_USER:$DEV_SERVICE_GROUP" /srv/golf-api-dev || true
    chmod -R 0755 /srv/golf-api /srv/golf-api-dev || true
  fi
fi

# Step 4: Reload systemd
log_info "Step 4: Reloading systemd..."
systemctl daemon-reload
log_success "Systemd reloaded"

# Step 5: Enable service(s)
log_info "Step 5: Enabling service(s)..."
if [ "$INSTALL_PROD" -eq 1 ]; then
  systemctl enable golf-api.service
  log_success "Enabled golf-api.service"
fi
if [ "$INSTALL_DEV" -eq 1 ]; then
  systemctl enable golf-api-dev.service || true
  log_success "Enabled golf-api-dev.service"
fi

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

#!/bin/bash
# Rollback deployment to previous version
# Usage: ./rollback.sh <backup-timestamp>
# Example: ./rollback.sh 20260110_143022

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Configuration
BACKUP_TIMESTAMP="$1"
DEPLOY_DIR="/opt/golf-tournament"
SERVICE_NAME="golf-api"
BACKUP_DIR="/var/backups/golf-tournament/deployments"

if [ -z "$BACKUP_TIMESTAMP" ]; then
    log_error "Usage: $0 <backup-timestamp>"
    log_error "Example: $0 20260110_143022"
    echo ""
    log_info "Available backups:"
    ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_TIMESTAMP"

log_warning "=== DEPLOYMENT ROLLBACK ==="
log_warning "This will restore the application to a previous state"
log_info "Backup: $BACKUP_TIMESTAMP"
echo ""

# Check if backup exists
if [ ! -d "$BACKUP_PATH" ]; then
    log_error "Backup not found: $BACKUP_PATH"
    log_info "Available backups:"
    ls -1 "$BACKUP_DIR"
    exit 1
fi

# Check if backup has required files
if [ ! -f "$BACKUP_PATH/mayhamapi.backup" ]; then
    log_error "Backup is incomplete - missing binary"
    exit 1
fi

# Confirm action
confirm_action "Are you sure you want to rollback to backup $BACKUP_TIMESTAMP?"

# Load production environment
load_env_file "$PROJECT_ROOT/.env.production"

# Step 1: Backup current state before rollback
log_info "Step 1: Creating safety backup of current state..."
SAFETY_TIMESTAMP=$(get_timestamp)
SAFETY_BACKUP="$BACKUP_DIR/rollback_safety_$SAFETY_TIMESTAMP"
sudo mkdir -p "$SAFETY_BACKUP"
sudo cp "$DEPLOY_DIR/backend/mayhamapi" "$SAFETY_BACKUP/mayhamapi.backup" 2>/dev/null || true
sudo cp -r "$DEPLOY_DIR/backend/static" "$SAFETY_BACKUP/static.backup" 2>/dev/null || true
log_success "Safety backup created: $SAFETY_BACKUP"

# Step 2: Stop service
log_info "Step 2: Stopping service..."
if sudo systemctl stop "$SERVICE_NAME"; then
    log_success "Service stopped"
else
    log_error "Failed to stop service"
    exit 1
fi

# Step 3: Restore binary
log_info "Step 3: Restoring backend binary..."
sudo cp "$BACKUP_PATH/mayhamapi.backup" "$DEPLOY_DIR/backend/mayhamapi"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/mayhamapi"
sudo chmod +x "$DEPLOY_DIR/backend/mayhamapi"
log_success "Backend binary restored"

# Step 4: Restore static files
log_info "Step 4: Restoring static files..."
if [ -d "$BACKUP_PATH/static.backup" ]; then
    sudo rm -rf "$DEPLOY_DIR/backend/static"
    sudo cp -r "$BACKUP_PATH/static.backup" "$DEPLOY_DIR/backend/static"
    sudo chown -R golftournament:golftournament "$DEPLOY_DIR/backend/static"
    log_success "Static files restored"
else
    log_warning "No static files in backup, skipping..."
fi

# Step 5: Start service
log_info "Step 5: Starting service..."
if sudo systemctl start "$SERVICE_NAME"; then
    log_success "Service started"
else
    log_error "Failed to start service"
    log_error "Check logs with: sudo journalctl -u $SERVICE_NAME -n 100"
    exit 1
fi

# Step 6: Wait for service
log_info "Step 6: Waiting for service to be ready..."
if wait_for_service "http://localhost:${PORT}/health"; then
    log_success "Service is ready"
else
    log_error "Service failed to become ready"
    log_error "Check logs with: sudo journalctl -u $SERVICE_NAME -n 100"
    exit 1
fi

# Step 7: Verify deployment
log_info "Step 7: Running verification checks..."
cd "$SCRIPT_DIR"
if ./verify-deployment.sh production; then
    log_success "Verification passed"
else
    log_warning "Verification checks failed - review manually"
fi

# Success
echo ""
log_success "=== ROLLBACK SUCCESSFUL ==="
echo ""
log_info "Rollback Summary:"
echo "  Restored from: $BACKUP_TIMESTAMP"
echo "  Service: $SERVICE_NAME (running)"
echo "  Safety backup: $SAFETY_BACKUP"
echo ""
log_info "Monitor with: sudo journalctl -u $SERVICE_NAME -f"
echo ""
log_warning "Note: This rollback only restored the application code."
log_warning "If you need to restore the database, use: ./restore-database.sh <backup-file>"

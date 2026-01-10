#!/bin/bash
# Main deployment script
# Usage: ./deploy.sh [version-tag]
# Example: ./deploy.sh v1.2.3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Configuration
VERSION_TAG="${1:-$(get_git_commit)}"
DEPLOY_DIR="/opt/golf-tournament"
SERVICE_NAME="golf-api"
BACKUP_DIR="/var/backups/golf-tournament/deployments"

log_info "=== Golf Tournament Deployment ==="
log_info "Version: $VERSION_TAG"
log_info "Branch: $(get_git_branch)"
log_info "Commit: $(get_git_commit)"
echo ""

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/go.mod" ]; then
    log_error "Not in the correct project directory"
    exit 1
fi

# Check if .env.production exists
if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
    log_error "File .env.production not found"
    exit 1
fi

# Load production environment
load_env_file "$PROJECT_ROOT/.env.production"

# Warn if git working directory is dirty
if ! is_git_clean; then
    log_warning "Git working directory has uncommitted changes"
    confirm_action "Continue with deployment anyway?"
fi

# Step 1: Run tests
log_info "Step 1: Running tests..."
cd "$PROJECT_ROOT"

if make test-integration; then
    log_success "Tests passed"
else
    log_error "Tests failed - aborting deployment"
    exit 1
fi

# Step 2: Create git tag if it doesn't exist
log_info "Step 2: Creating git tag..."
if git rev-parse "$VERSION_TAG" >/dev/null 2>&1; then
    log_info "Tag $VERSION_TAG already exists"
else
    git tag -a "$VERSION_TAG" -m "Release $VERSION_TAG"
    log_success "Created tag: $VERSION_TAG"
fi

# Step 3: Build backend
log_info "Step 3: Building backend..."
cd "$PROJECT_ROOT"

if go build -o mayhamapi-${VERSION_TAG}; then
    log_success "Backend built successfully"
else
    log_error "Backend build failed"
    exit 1
fi

# Step 4: Build frontend
log_info "Step 4: Building frontend..."
cd "$PROJECT_ROOT/frontend"

if npm run build; then
    log_success "Frontend built successfully"
else
    log_error "Frontend build failed"
    exit 1
fi

# Step 5: Backup database
log_info "Step 5: Backing up database..."
cd "$SCRIPT_DIR"
if ./backup-database.sh production; then
    log_success "Database backup completed"
else
    log_error "Database backup failed - aborting deployment"
    exit 1
fi

# Step 6: Create deployment backup
log_info "Step 6: Creating deployment backup..."
ensure_backup_dir "$BACKUP_DIR"
TIMESTAMP=$(get_timestamp)

if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo mkdir -p "$BACKUP_DIR/$TIMESTAMP"
    sudo cp "$DEPLOY_DIR/backend/mayhamapi" "$BACKUP_DIR/$TIMESTAMP/mayhamapi.backup" 2>/dev/null || true
    sudo cp -r "$DEPLOY_DIR/backend/static" "$BACKUP_DIR/$TIMESTAMP/static.backup" 2>/dev/null || true
    log_success "Current deployment backed up to $BACKUP_DIR/$TIMESTAMP"
fi

# Step 7: Stop service
log_info "Step 7: Stopping service..."
if sudo systemctl stop "$SERVICE_NAME"; then
    log_success "Service stopped"
else
    log_error "Failed to stop service"
    exit 1
fi

# Step 8: Deploy backend
log_info "Step 8: Deploying backend binary and db schema..."
cd "$PROJECT_ROOT"
sudo cp "mayhamapi-${VERSION_TAG}" "$DEPLOY_DIR/backend/mayhamapi"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/mayhamapi"
sudo chmod +x "$DEPLOY_DIR/backend/mayhamapi"

cd "$PROJECT_ROOT"
sudo mkdir "$DEPLOY_DIR/backend/mayhamapi/db"
sudo cp "db/golf_db_schema.sql $DEPLOY_DIR/backend/mayhamapi/db/"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/mayhamapi/db/golf_db_schema.sql"
log_success "Backend binary and DB schema deployed"

# Step 9: Deploy frontend
log_info "Step 9: Deploying frontend static files..."
sudo rm -rf "$DEPLOY_DIR/backend/static"
sudo cp -r "$PROJECT_ROOT/static" "$DEPLOY_DIR/backend/"
sudo chown -R golftournament:golftournament "$DEPLOY_DIR/backend/static"
log_success "Frontend static files deployed"

# Step 10: Deploy configuration
log_info "Step 10: Deploying configuration..."
sudo cp "$PROJECT_ROOT/.env.production" "$DEPLOY_DIR/backend/.env.production"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/.env.production"
sudo chmod 600 "$DEPLOY_DIR/backend/.env.production"
log_success "Configuration deployed"

# Step 11: Start service
log_info "Step 11: Starting service..."
if sudo systemctl start "$SERVICE_NAME"; then
    log_success "Service started"
else
    log_error "Failed to start service"
    log_error "Check logs with: sudo journalctl -u $SERVICE_NAME -n 100"
    
    # Attempt rollback
    log_warning "Attempting to restore previous version..."
    if [ -f "$BACKUP_DIR/$TIMESTAMP/mayhamapi.backup" ]; then
        sudo cp "$BACKUP_DIR/$TIMESTAMP/mayhamapi.backup" "$DEPLOY_DIR/backend/mayhamapi"
        sudo cp -r "$BACKUP_DIR/$TIMESTAMP/static.backup" "$DEPLOY_DIR/backend/static"
        sudo systemctl start "$SERVICE_NAME"
        log_warning "Rolled back to previous version"
    fi
    exit 1
fi

# Step 12: Wait for service to be ready
log_info "Step 12: Waiting for service to be ready..."
if wait_for_service "http://localhost:${PORT}/health"; then
    log_success "Service is ready"
else
    log_error "Service failed to become ready"
    log_error "Check logs with: sudo journalctl -u $SERVICE_NAME -n 100"
    exit 1
fi

# Step 13: Run verification
log_info "Step 13: Running verification checks..."
cd "$SCRIPT_DIR"
if ./verify-deployment.sh production; then
    log_success "Verification passed"
else
    log_error "Verification failed"
    exit 1
fi

# Step 14: Cleanup
log_info "Step 14: Cleaning up..."
cd "$PROJECT_ROOT"
rm -f "mayhamapi-${VERSION_TAG}"
log_success "Cleanup completed"

# Success!
echo ""
log_success "=== DEPLOYMENT SUCCESSFUL ==="
echo ""
log_info "Deployment Summary:"
echo "  Version: $VERSION_TAG"
echo "  Timestamp: $TIMESTAMP"
echo "  Service: $SERVICE_NAME (running)"
echo "  Health: http://localhost:${PORT}/health"
echo "  Backup: $BACKUP_DIR/$TIMESTAMP"
echo ""
log_info "Monitor with: sudo journalctl -u $SERVICE_NAME -f"
log_info "Status: sudo systemctl status $SERVICE_NAME"
echo ""
log_info "If issues occur, rollback with: ./rollback.sh $TIMESTAMP"

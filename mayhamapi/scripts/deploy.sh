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

# Run integration tests in a clean DB environment so production .env values
# (sourced above) don't leak into the test process. We unset DB-related
# variables and force ENV_FILE to .env.test so the test binary loads the
# intended test credentials.
if env -u DB_HOST -u DB_PORT -u DB_USER -u DB_PASSWORD -u DB_NAME -u DB_SSL_MODE \
    ENV_FILE=.env.test make test-integration; then
    log_success "Tests passed"
else
    log_error "Tests failed - aborting deployment"
    exit 1
fi

# Step 2: Build backend
log_info "Step 2: Building backend..."
cd "$PROJECT_ROOT"

if go build -o mayhamapi-${VERSION_TAG}; then
    log_success "Backend built successfully"
else
    log_error "Backend build failed"
    exit 1
fi

# Step 3: Build frontend
log_info "Step 3: Building frontend..."
cd "$PROJECT_ROOT/frontend"

if npm run build; then
    log_success "Frontend built successfully"
else
    log_error "Frontend build failed"
    exit 1
fi

# Step 4: Commit frontend build changes if any
log_info "Step 4: Checking for frontend build changes..."
cd "$PROJECT_ROOT"

if ! git diff --quiet; then
    log_info "Frontend build changes detected, committing..."
    git add static/
    git commit -m "chore: update frontend build assets for $VERSION_TAG"
    
    if git push; then
        log_success "Build changes committed and pushed"
    else
        log_error "Failed to push changes"
        exit 1
    fi
else
    log_info "No frontend build changes"
fi

# Step 5: Create git tag if it doesn't exist
log_info "Step 5: Creating git tag..."
if git rev-parse "$VERSION_TAG" >/dev/null 2>&1; then
    log_info "Tag $VERSION_TAG already exists"
else
    git tag -a "$VERSION_TAG" -m "Release $VERSION_TAG"
    git push origin "$VERSION_TAG"
    log_success "Created tag: $VERSION_TAG and pushed to remote"
fi

# Step 6: Backup database
log_info "Step 6: Backing up database..."
cd "$SCRIPT_DIR"
if ./backup-database.sh production; then
    log_success "Database backup completed"
else
    log_error "Database backup failed - aborting deployment"
    exit 1
fi

# Step 7: Create deployment backup
log_info "Step 7: Creating deployment backup..."
ensure_backup_dir "$BACKUP_DIR"
TIMESTAMP=$(get_timestamp)

if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo mkdir -p "$BACKUP_DIR/$TIMESTAMP"
    sudo cp "$DEPLOY_DIR/backend/mayhamapi" "$BACKUP_DIR/$TIMESTAMP/mayhamapi.backup" 2>/dev/null || true
    sudo cp -r "$DEPLOY_DIR/backend/static" "$BACKUP_DIR/$TIMESTAMP/static.backup" 2>/dev/null || true
    log_success "Current deployment backed up to $BACKUP_DIR/$TIMESTAMP"
fi

# Step 8: Stop service
log_info "Step 8: Stopping service..."
if sudo systemctl stop "$SERVICE_NAME"; then
    log_success "Service stopped"
else
    log_error "Failed to stop service"
    exit 1
fi

# Step 9: Deploy backend
log_info "Step 9: Deploying backend binary and db schema..."
cd "$PROJECT_ROOT"
sudo cp "mayhamapi-${VERSION_TAG}" "$DEPLOY_DIR/backend/mayhamapi"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/mayhamapi"
sudo chmod +x "$DEPLOY_DIR/backend/mayhamapi"

cd "$PROJECT_ROOT"
# Ensure the backend db directory exists before copying the schema and migrations
sudo rm -rf "$DEPLOY_DIR/backend/db" || true
sudo mkdir -p "$DEPLOY_DIR/backend/db"
# Copy the whole db directory so migrations are available to the running binary
sudo cp -a "db/." "$DEPLOY_DIR/backend/db/"
sudo chown -R golftournament:golftournament "$DEPLOY_DIR/backend/db"
log_success "Backend binary and DB schema deployed"

# Step 10: Deploy frontend
log_info "Step 10: Deploying frontend static files..."
sudo rm -rf "$DEPLOY_DIR/backend/static"
sudo cp -r "$PROJECT_ROOT/static" "$DEPLOY_DIR/backend/"
sudo chown -R golftournament:golftournament "$DEPLOY_DIR/backend/static"
log_success "Frontend static files deployed"

# Step 11: Deploy configuration
log_info "Step 11: Deploying configuration..."
sudo cp "$PROJECT_ROOT/.env.production" "$DEPLOY_DIR/backend/.env.production"
sudo chown golftournament:golftournament "$DEPLOY_DIR/backend/.env.production"
sudo chmod 600 "$DEPLOY_DIR/backend/.env.production"
log_success "Configuration deployed"

# Step 12: Start service
log_info "Step 12: Starting service..."
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

# Step 13: Wait for service to be ready
log_info "Step 13: Waiting for service to be ready..."
if wait_for_service "http://localhost:${PORT}/health"; then
    log_success "Service is ready"
else
    log_error "Service failed to become ready"
    log_error "Check logs with: sudo journalctl -u $SERVICE_NAME -n 100"
    exit 1
fi

# Step 14: Run verification
log_info "Step 14: Running verification checks..."
cd "$SCRIPT_DIR"
if ./verify-deployment.sh production; then
    log_success "Verification passed"
else
    log_error "Verification failed"
    exit 1
fi

# Step 15: Cleanup
log_info "Step 15: Cleaning up..."
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

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions for logging and env loading
source "$SCRIPT_DIR/common.sh"

ENV_FILE="$PROJECT_ROOT/.env.production"
load_env_file "$ENV_FILE"

if [ -z "${BACKUP_DB_USER:-}" ] || [ -z "${BACKUP_DB_PASSWORD:-}" ]; then
    log_error "BACKUP_DB_USER and BACKUP_DB_PASSWORD must be set in $ENV_FILE"
    exit 1
fi

DB_NAME="${DB_NAME}"

log_info "Setting up backup user '$BACKUP_DB_USER' for database '$DB_NAME'"

# Escape single quotes in password for safe SQL literal
ESC_PASS=$(printf "%s" "$BACKUP_DB_PASSWORD" | sed "s/'/''/g")

# Create role if it doesn't exist
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$BACKUP_DB_USER'" | grep -q 1; then
    log_info "Backup user '$BACKUP_DB_USER' already exists"
else
    log_info "Creating role $BACKUP_DB_USER"
    sudo -u postgres psql -c "CREATE ROLE \"$BACKUP_DB_USER\" WITH LOGIN PASSWORD '$ESC_PASS';"
    log_success "Created role $BACKUP_DB_USER"
fi

# Grant required privileges
log_info "Granting privileges to $BACKUP_DB_USER on database $DB_NAME"
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE \"$DB_NAME\" TO \"$BACKUP_DB_USER\";"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT USAGE ON SCHEMA public TO \"$BACKUP_DB_USER\";"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"$BACKUP_DB_USER\";"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO \"$BACKUP_DB_USER\";"
# Ensure future objects created by the application DB user have SELECT granted
# Use FOR ROLE so default privileges apply to objects created by $DB_USER
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES FOR ROLE \"$DB_USER\" IN SCHEMA public GRANT SELECT ON TABLES TO \"$BACKUP_DB_USER\";"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES FOR ROLE \"$DB_USER\" IN SCHEMA public GRANT SELECT ON SEQUENCES TO \"$BACKUP_DB_USER\";"

log_success "Backup user '$BACKUP_DB_USER' is configured"

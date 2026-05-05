#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Default to production env file
ENV_FILE="$PROJECT_ROOT/.env.production"
load_env_file "$ENV_FILE"

if [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
    log_error "DB_USER and DB_NAME must be set in $ENV_FILE"
    exit 1
fi

log_info "Reassigning DB ownership for database '$DB_NAME' to user '$DB_USER'"

# Reassign objects owned by the postgres superuser to the application DB user
# This avoids migration failures when the application (running as DB_USER)
# attempts to alter or drop objects it doesn't own.
sudo -u postgres psql -d "$DB_NAME" -c "REASSIGN OWNED BY postgres TO \"$DB_USER\";"

# Ensure the public schema is owned by the application user
sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO \"$DB_USER\";" || true

log_success "Reassigned DB ownership to '$DB_USER' for database '$DB_NAME'"

#!/bin/bash
# Database restore script
# Usage: ./restore-database.sh <backup_file> [environment]
# Example: ./restore-database.sh /var/backups/golf-tournament/daily/mayham_prod_20260110_120000.sql.gz production

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Check arguments
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <backup_file> [environment]"
    log_error "Example: $0 /var/backups/golf-tournament/daily/mayham_prod_20260110_120000.sql.gz production"
    exit 1
fi

BACKUP_FILE="$1"
ENVIRONMENT="${2:-production}"
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"

log_warning "=== DATABASE RESTORE ==="
log_warning "This will REPLACE the current database with data from the backup!"
log_info "Environment: $ENVIRONMENT"
log_info "Backup file: $BACKUP_FILE"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
load_env_file "$ENV_FILE"

# Check PostgreSQL
check_postgres

# Confirm action
confirm_action "Are you sure you want to restore database $DB_NAME from this backup?"

# Create a safety backup before restore
log_info "Creating safety backup of current database before restore..."
SAFETY_BACKUP="/tmp/${DB_NAME}_pre_restore_$(get_timestamp).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F plain \
    --no-owner \
    --no-acl \
    | gzip > "$SAFETY_BACKUP"

log_success "Safety backup created: $SAFETY_BACKUP"

# Decompress if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup file..."
    RESTORE_FILE="/tmp/restore_$(basename ${BACKUP_FILE%.gz})"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
fi

# Drop existing connections to the database
log_info "Terminating existing connections to $DB_NAME..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres <<EOF
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
EOF

# Restore database
log_info "Restoring database from backup..."
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    < "$RESTORE_FILE"

if [ $? -eq 0 ]; then
    log_success "Database restored successfully"
    
    # Cleanup temporary decompressed file
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        rm -f "$RESTORE_FILE"
    fi
    
    log_info "Safety backup kept at: $SAFETY_BACKUP"
    log_info "You can delete this file once you've verified the restore"
else
    log_error "Database restore failed!"
    log_error "Your data is still intact. Safety backup is at: $SAFETY_BACKUP"
    
    # Cleanup
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        rm -f "$RESTORE_FILE"
    fi
    
    exit 1
fi

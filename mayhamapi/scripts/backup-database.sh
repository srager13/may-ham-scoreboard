#!/bin/bash
# Database backup script
# Usage: ./backup-database.sh [environment]
# Example: ./backup-database.sh production

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

# Configuration
ENVIRONMENT="${1:-production}"
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
BACKUP_ROOT="/var/backups/golf-tournament"
RETENTION_DAYS=7
RETENTION_WEEKS=4
RETENTION_MONTHS=12

log_info "Starting database backup for $ENVIRONMENT environment"


# Load environment variables
load_env_file "$ENV_FILE"

# Check PostgreSQL service
check_postgres

# Create backup directories
ensure_backup_dir "$BACKUP_ROOT/daily"
ensure_backup_dir "$BACKUP_ROOT/weekly"
ensure_backup_dir "$BACKUP_ROOT/monthly"

# Allow using a dedicated backup user if set in the env file. This avoids
# using the postgres superuser for backups. If not set, fall back to the
# main DB credentials (for backward compatibility).
BACKUP_USER="${BACKUP_DB_USER:-$DB_USER}"
BACKUP_PASS="${BACKUP_DB_PASSWORD:-$DB_PASSWORD}"

# Generate backup filename
TIMESTAMP=$(get_timestamp)
BACKUP_FILE="$BACKUP_ROOT/daily/${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

log_info "Backing up database: $DB_NAME"
log_info "Using backup user: $BACKUP_USER"
log_info "Backup file: $BACKUP_FILE_GZ"

# Create backup using the selected credentials
PGPASSWORD="$BACKUP_PASS" pg_dump \
    -h "$DB_HOST" \
    -U "$BACKUP_USER" \
    -d "$DB_NAME" \
    -F plain \
    --no-owner \
    --no-acl \
    > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    log_error "Database backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress backup
gzip "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    log_error "Backup compression failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Verify backup file exists and has content
if [ ! -s "$BACKUP_FILE_GZ" ]; then
    log_error "Backup file is empty or doesn't exist"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
log_success "Backup created successfully: $BACKUP_FILE_GZ ($BACKUP_SIZE)"

# Copy to weekly backup on Sundays
if [ "$(date +%u)" -eq 7 ]; then
    WEEKLY_BACKUP="$BACKUP_ROOT/weekly/${DB_NAME}_$(date +%Y_week%V).sql.gz"
    cp "$BACKUP_FILE_GZ" "$WEEKLY_BACKUP"
    log_info "Created weekly backup: $WEEKLY_BACKUP"
fi

# Copy to monthly backup on the 1st of the month
if [ "$(date +%d)" -eq 1 ]; then
    MONTHLY_BACKUP="$BACKUP_ROOT/monthly/${DB_NAME}_$(date +%Y_%m).sql.gz"
    cp "$BACKUP_FILE_GZ" "$MONTHLY_BACKUP"
    log_info "Created monthly backup: $MONTHLY_BACKUP"
fi

# Cleanup old backups
log_info "Cleaning up old backups..."

# Remove daily backups older than $RETENTION_DAYS days
find "$BACKUP_ROOT/daily" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
log_info "Removed daily backups older than $RETENTION_DAYS days"

# Remove weekly backups older than $RETENTION_WEEKS weeks
find "$BACKUP_ROOT/weekly" -name "${DB_NAME}_*.sql.gz" -mtime +$((RETENTION_WEEKS * 7)) -delete
log_info "Removed weekly backups older than $RETENTION_WEEKS weeks"

# Remove monthly backups older than $RETENTION_MONTHS months
find "$BACKUP_ROOT/monthly" -name "${DB_NAME}_*.sql.gz" -mtime +$((RETENTION_MONTHS * 30)) -delete
log_info "Removed monthly backups older than $RETENTION_MONTHS months"

# Show backup summary
log_info "Backup Summary:"
echo "  Daily backups:   $(ls -1 "$BACKUP_ROOT/daily" | wc -l)"
echo "  Weekly backups:  $(ls -1 "$BACKUP_ROOT/weekly" | wc -l)"
echo "  Monthly backups: $(ls -1 "$BACKUP_ROOT/monthly" | wc -l)"
echo ""

log_success "Database backup completed successfully"

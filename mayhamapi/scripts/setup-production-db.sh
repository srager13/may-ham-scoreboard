#!/bin/bash
# Setup production database
# This script should be run ONCE to set up the production database

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

log_info "=== Production Database Setup ==="

# Check if .env.production exists
if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
    log_error "File .env.production not found"
    log_error "Please create it first (see .env.example)"
    exit 1
fi

# Load production environment
load_env_file "$PROJECT_ROOT/.env.production"

# Check PostgreSQL
check_postgres

log_info "Database Name: $DB_NAME"
log_info "Database User: $DB_USER"
log_info "Database Host: $DB_HOST"

# Check if database already exists
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    log_warning "Database $DB_NAME already exists"
    confirm_action "Do you want to continue? (This will NOT drop the existing database)"
else
    log_info "Creating database: $DB_NAME"
    
    # Create database as postgres superuser
    sudo -u postgres createdb "$DB_NAME"
    
    if [ $? -eq 0 ]; then
        log_success "Database created: $DB_NAME"
    else
        log_error "Failed to create database"
        exit 1
    fi
    
    # Grant privileges to production user
    log_info "Granting privileges to user $DB_USER..."
    sudo -u postgres psql <<EOF
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF
    
    log_success "Privileges granted to $DB_USER"
fi

# Test connection
log_info "Testing database connection..."
if test_db_connection "$DB_USER" "$DB_NAME"; then
    log_success "Database connection successful"
else
    log_error "Database connection failed"
    exit 1
fi

# Run migrations (the application will do this on startup, but we can do it manually too)
log_info "Database schema will be created automatically when the application starts"
log_info "Or you can run migrations manually with: psql -U $DB_USER -d $DB_NAME -f db/golf_db_schema.sql"

log_success "Production database setup complete!"
echo ""
log_info "Next steps:"
echo "  1. Review .env.production file"
echo "  2. Run: sudo ./scripts/install-services.sh"
echo "  3. Deploy application: ./scripts/deploy.sh v1.0.0"

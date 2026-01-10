#!/bin/bash
# Common functions for deployment scripts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if script is run as root
require_root() {
    if [ "$EUID" -ne 0 ]; then 
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check if script is NOT run as root
require_not_root() {
    if [ "$EUID" -eq 0 ]; then 
        log_error "This script should NOT be run as root"
        exit 1
    fi
}

# Load environment file
load_env_file() {
    local env_file="$1"
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    set -a
    source "$env_file"
    set +a
    log_success "Loaded environment from $env_file"
}

# Check if service is running
is_service_running() {
    local service_name="$1"
    systemctl is-active --quiet "$service_name"
}

# Wait for service to be ready
wait_for_service() {
    local url="$1"
    local max_attempts="${2:-30}"
    local attempt=1
    
    log_info "Waiting for service to be ready at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            log_success "Service is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo ""
    log_error "Service failed to become ready after $max_attempts seconds"
    return 1
}

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    local backup_dir="$1"
    if [ ! -d "$backup_dir" ]; then
        mkdir -p "$backup_dir"
        log_info "Created backup directory: $backup_dir"
    fi
}

# Get timestamp for backup files
get_timestamp() {
    date +%Y%m%d_%H%M%S
}

# Check if PostgreSQL is running
check_postgres() {
    if ! systemctl is-active --quiet postgresql; then
        log_error "PostgreSQL is not running"
        exit 1
    fi
}

# Test database connection
test_db_connection() {
    local db_user="$1"
    local db_name="$2"
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$db_user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Failed to connect to database $db_name as user $db_user"
        return 1
    fi
}

# Confirm action
confirm_action() {
    local message="$1"
    read -p "$message (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Action cancelled"
        exit 0
    fi
}

# Get git current branch
get_git_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Get git commit hash
get_git_commit() {
    git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Check if git working directory is clean
is_git_clean() {
    git diff-index --quiet HEAD -- 2>/dev/null
}

# Export functions
export -f log_info
export -f log_success
export -f log_warning
export -f log_error
export -f require_root
export -f require_not_root
export -f load_env_file
export -f is_service_running
export -f wait_for_service
export -f ensure_backup_dir
export -f get_timestamp
export -f check_postgres
export -f test_db_connection
export -f confirm_action
export -f get_git_branch
export -f get_git_commit
export -f is_git_clean

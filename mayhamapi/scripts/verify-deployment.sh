#!/bin/bash
# Verify deployment health checks
# Usage: ./verify-deployment.sh [environment]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$SCRIPT_DIR/common.sh"

ENVIRONMENT="${1:-production}"
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"

log_info "=== Deployment Verification for $ENVIRONMENT ==="

# Load environment
load_env_file "$ENV_FILE"

# Test 1: Check if service is running
log_info "Test 1: Checking if golf-api service is running..."
if is_service_running golf-api; then
    log_success "Service is running"
else
    log_error "Service is not running"
    log_info "Check logs with: sudo journalctl -u golf-api -n 50"
    exit 1
fi

# Test 2: Check health endpoint
log_info "Test 2: Checking health endpoint..."
HEALTH_URL="http://localhost:${PORT}/health"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    log_success "Health check passed (HTTP $HTTP_CODE)"
    echo "  Response: $RESPONSE_BODY"
else
    log_error "Health check failed (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 3: Check database connection
log_info "Test 3: Checking database connection..."
if test_db_connection "$DB_USER" "$DB_NAME"; then
    log_success "Database connection successful"
else
    log_error "Database connection failed"
    exit 1
fi

# Test 4: Check if tables exist
log_info "Test 4: Verifying database schema..."
TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
TABLE_COUNT=$(echo $TABLE_COUNT | xargs)

if [ "$TABLE_COUNT" -gt 0 ]; then
    log_success "Database has $TABLE_COUNT tables"
else
    log_error "No tables found in database"
    exit 1
fi

# Test 5: Check recent logs for errors
log_info "Test 5: Checking recent logs for errors..."
ERROR_COUNT=$(sudo journalctl -u golf-api --since "5 minutes ago" | grep -i "error\|fatal\|panic" | wc -l)

if [ "$ERROR_COUNT" -eq 0 ]; then
    log_success "No errors in recent logs"
else
    log_warning "Found $ERROR_COUNT error(s) in recent logs"
    log_info "Review logs with: sudo journalctl -u golf-api -n 100"
fi

# Test 6: Test API endpoints
log_info "Test 6: Testing API endpoints..."

# Test tournaments endpoint (should require auth, but should respond)
TOURNAMENTS_RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:${PORT}/api/v1/tournaments")
TOURNAMENTS_HTTP_CODE=$(echo "$TOURNAMENTS_RESPONSE" | tail -n1)

if [ "$TOURNAMENTS_HTTP_CODE" = "200" ] || [ "$TOURNAMENTS_HTTP_CODE" = "401" ]; then
    log_success "API endpoints responding (HTTP $TOURNAMENTS_HTTP_CODE)"
else
    log_warning "Unexpected API response (HTTP $TOURNAMENTS_HTTP_CODE)"
fi

# Test 7: Check static files (if nginx is configured)
if command -v nginx &> /dev/null; then
    log_info "Test 7: Checking nginx configuration..."
    if nginx -t 2>&1 | grep -q "successful"; then
        log_success "Nginx configuration is valid"
    else
        log_warning "Nginx configuration may have issues"
    fi
else
    log_info "Test 7: Nginx not installed, skipping..."
fi

# Summary
echo ""
log_success "=== All verification tests passed ==="
echo ""
log_info "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Service: golf-api (running)"
echo "  Port: $PORT"
echo "  Database: $DB_NAME ($TABLE_COUNT tables)"
echo "  Health: OK"
echo ""
log_info "Monitor logs with: sudo journalctl -u golf-api -f"
log_info "Check status with: sudo systemctl status golf-api"

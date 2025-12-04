#!/bin/bash

# Integration Test Runner Script
# This script sets up the environment and runs integration tests

set -e  # Exit on any error

echo "🚀 Running Golf Tournament API Integration Tests"
echo "================================================"

# Check if PostgreSQL is available
echo "📋 Checking PostgreSQL connection..."
if ! PGPASSWORD=password psql -h localhost -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ PostgreSQL connection failed!"
    echo "Please ensure:"
    echo "  1. PostgreSQL is installed and running"
    echo "  2. User 'postgres' exists with password 'password'"
    echo "  3. Server is listening on localhost:5432"
    echo ""
    echo "Quick setup commands:"
    echo "  sudo apt-get update && sudo apt-get install postgresql postgresql-contrib"
    echo "  sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'password';\""
    exit 1
fi
echo "✅ PostgreSQL connection successful!"

# Load test environment
echo "📦 Loading test environment..."
if [ -f .env.test ]; then
    export $(grep -v '^#' .env.test | xargs)
    echo "✅ Test environment loaded"
else
    echo "⚠️  .env.test not found, using defaults"
fi

# Run integration tests
echo "🧪 Running integration tests..."
echo ""

# Set Go test timeout (integration tests may take longer)
export GO_TEST_TIMEOUT=${GO_TEST_TIMEOUT:-30s}

# Run the integration tests with verbose output
go test -v -timeout $GO_TEST_TIMEOUT -run "Integration" . || {
    echo ""
    echo "❌ Integration tests failed!"
    echo "Check the output above for details."
    exit 1
}

echo ""
echo "✅ All integration tests passed!"
echo "🎉 Ready for production!"
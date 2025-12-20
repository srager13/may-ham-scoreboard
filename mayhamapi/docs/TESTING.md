# API Integration Testing Guide

This document explains how to run and understand the API integration tests for the Golf Tournament application.

## Overview

The integration tests verify that:
- API endpoints work correctly with real database operations
- Complex data relationships are properly loaded (teams, players, formats)
- Database transactions and constraints work as expected
- The full API request/response cycle functions correctly

## Test Structure

### Files Created

1. **`integration_test.go`** - Main integration tests for API endpoints
2. **`test_config.go`** - Test database setup and utilities
3. **`repository/repository_test.go`** - Repository-level integration tests
4. **`.env.test`** - Test environment configuration
5. **`Makefile`** - Build and test automation
6. **`run-integration-tests.sh`** - Test runner script

### Test Types

#### 1. API Endpoint Tests (`integration_test.go`)
- `TestGetMatchesByRound_Integration` - Tests the main endpoint with full data loading
- `TestGetMatchesByRound_EmptyResult` - Tests edge case with no data
- `TestGetMatchesByRound_MultipleMatches` - Tests multiple matches in one round
- `TestCreateMatch_WithPlayerAssignments` - Tests match creation with specific players

#### 2. Repository Tests (`repository/repository_test.go`)
- Currently configured as examples/stubs
- Can be expanded for direct repository testing

## Prerequisites

### Database Setup
You need PostgreSQL running with specific configuration:

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install postgresql postgresql-contrib

# Set postgres user password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"

# Verify connection
PGPASSWORD=password psql -h localhost -U postgres -d postgres -c "SELECT version();"
```

### Go Dependencies
All required dependencies are already in `go.mod`:
- `github.com/stretchr/testify` - Testing framework
- `github.com/gin-gonic/gin` - Web framework
- `github.com/lib/pq` - PostgreSQL driver

## Running Tests

### Option 1: Using the Script (Recommended)
```bash
cd mayhamapi
./run-integration-tests.sh
```

### Option 2: Using Make
```bash
cd mayhamapi
make setup-test-db        # Verify database setup
make test-integration     # Run integration tests
make test-coverage        # Run with coverage report
```

### Option 3: Direct Go Commands
```bash
cd mayhamapi
# Load test environment and run integration tests
ENV_FILE=.env.test go test -v -run "Integration" .

# Run all tests
go test -v ./...
```

## What Gets Tested

### TestGetMatchesByRound_Integration
This is the main test that verifies your original issue is fixed:

**Setup:**
1. Creates test database
2. Inserts: users, groups, tournament, teams, team members, round, match
3. Triggers automatic player assignment to match

**Tests:**
- ✅ Match basic data (ID, round, teams, holes)
- ✅ Team data is populated (names, colors)
- ✅ Format data is populated (name, description, etc.)
- ✅ **Players data is populated with user information**
- ✅ Correct number of players (4 total, 2 per team)
- ✅ Player positions and team assignments
- ✅ User data within players (name, email)

**Expected API Response:**
```json
{
  "matches": [{
    "id": "match-id",
    "team1": {
      "id": "team1-id",
      "name": "Team Alpha",
      "color": "#FF0000"
    },
    "team2": {
      "id": "team2-id", 
      "name": "Team Beta",
      "color": "#0000FF"
    },
    "format": {
      "id": "format-id",
      "name": "Match Play",
      "description": "..."
    },
    "players": [
      {
        "id": "player1-id",
        "team_id": "team1-id",
        "position": 1,
        "user": {
          "id": "user1-id",
          "name": "Test User",
          "email": "test@example.com"
        }
      },
      // ... 3 more players
    ]
  }]
}
```

## Test Database Management

### Automatic Cleanup
- Each test creates a uniquely named database (`test_mayham_golf_<timestamp>`)
- Database is automatically dropped after test completion
- No interference between test runs

### Test Data Creation
The `CreateTestData` function sets up a complete test scenario:
- 4 test users
- 1 test group  
- 1 tournament
- 2 teams with team members
- 1 round
- 1 match with automatic player assignments

### Schema Management
- Full database schema is applied to each test database
- Both main schema and groups migration are executed
- Schema files: `db/golf_db_schema.sql`, `db/add_groups_migration.sql`

## Troubleshooting

### Common Issues

**1. PostgreSQL Connection Failed**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if postgres user exists and has correct password
sudo -u postgres psql -c "\\du"

# Reset postgres password if needed
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"
```

**2. Permission Denied for Database Creation**
```bash
# Grant createdb permission to postgres user
sudo -u postgres psql -c "ALTER USER postgres CREATEDB;"
```

**3. Tests Timeout**
```bash
# Increase timeout (default is 30s)
GO_TEST_TIMEOUT=60s ./run-integration-tests.sh
```

**4. Database Connection Refused**
Check your PostgreSQL configuration:
```bash
# Check if PostgreSQL is listening on localhost:5432
sudo netstat -tlnp | grep 5432

# Check PostgreSQL config
sudo cat /etc/postgresql/*/main/postgresql.conf | grep listen_addresses
```

### Debug Mode
For detailed test output:
```bash
go test -v -run "Integration" . -args -test.v
```

## Extending Tests

### Adding New Test Cases
1. Create new test functions in `integration_test.go`
2. Use `SetupTestDatabase(t)` for database setup
3. Use `CreateTestData(t, repo)` for test data
4. Follow naming convention: `TestEndpointName_Scenario`

### Testing New Endpoints
```go
func TestNewEndpoint_Integration(t *testing.T) {
    // Setup
    testDB := SetupTestDatabase(t)
    defer testDB.Cleanup(t)
    
    repo := repository.NewRepository(testDB.DB)
    handler := handlers.NewYourHandler(repo)
    
    // Create test data
    testData := CreateTestData(t, repo)
    
    // Setup router and test
    router := gin.New()
    router.GET("/your/endpoint", handler.YourMethod)
    
    // Execute test
    req, _ := http.NewRequest("GET", "/your/endpoint", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    // Assert results
    assert.Equal(t, http.StatusOK, w.Code)
    // ... more assertions
}
```

## Benefits of This Testing Approach

1. **Realistic Testing** - Uses real database operations, not mocks
2. **Data Integrity** - Verifies foreign key relationships and constraints
3. **Full Stack Coverage** - Tests from HTTP request to database response
4. **Regression Prevention** - Catches issues in complex data loading
5. **Documentation** - Tests serve as examples of expected API behavior
6. **CI/CD Ready** - Can be automated in continuous integration pipelines

## Next Steps

1. **Run the tests** to verify the player data issue is fixed
2. **Add authentication tests** with JWT tokens
3. **Create tests for other endpoints** (tournaments, scoring, etc.)
4. **Add performance tests** for large datasets
5. **Create frontend unit tests** that mock these API responses
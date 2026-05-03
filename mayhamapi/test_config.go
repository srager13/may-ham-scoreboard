package main

import (
	"database/sql"
	"fmt"
	"github.com/joho/godotenv"
	"log"
	"os"
	"testing"
	"time"

	"mayhamapi/db"
	"mayhamapi/models"
	"mayhamapi/repository"

	_ "github.com/lib/pq"
)

// TestDB wraps the database connection for testing
type TestDB struct {
	*db.DB
	dbName string
}

// SetupTestDatabase creates a test database and runs migrations
func SetupTestDatabase(t *testing.T) *TestDB {
	// Generate unique test database name
	testDBName := fmt.Sprintf("test_mayham_golf_%d", time.Now().UnixNano())

	// Connect to postgres database to create test database
	adminDSN := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=disable",
		getEnvWithDefault("DB_HOST", "localhost"),
		getEnvWithDefault("DB_PORT", "5432"),
		getEnvWithDefault("DB_USER", "postgres"),
		getEnvWithDefault("DB_PASSWORD", "password"))

	adminDB, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Fatalf("Failed to connect to admin database: %v", err)
	}
	defer adminDB.Close()

	// Create test database
	_, err = adminDB.Exec(fmt.Sprintf("CREATE DATABASE %s", testDBName))
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Connect to test database
	testDSN := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnvWithDefault("DB_HOST", "localhost"),
		getEnvWithDefault("DB_PORT", "5432"),
		getEnvWithDefault("DB_USER", "postgres"),
		getEnvWithDefault("DB_PASSWORD", "password"),
		testDBName)

	testSQLDB, err := sql.Open("postgres", testDSN)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	testDB := &db.DB{DB: testSQLDB}

	// Run migrations
	err = runTestMigrations(testDB)
	if err != nil {
		t.Fatalf("Failed to run test migrations: %v", err)
	}

	return &TestDB{
		DB:     testDB,
		dbName: testDBName,
	}
}

// CleanupTestDatabase drops the test database
func (tdb *TestDB) Cleanup(t *testing.T) {
	tdb.Close()

	// Connect to postgres database to drop test database
	adminDSN := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=disable",
		getEnvWithDefault("DB_HOST", "localhost"),
		getEnvWithDefault("DB_PORT", "5432"),
		getEnvWithDefault("DB_USER", "postgres"),
		getEnvWithDefault("DB_PASSWORD", "password"))

	adminDB, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Logf("Warning: Failed to connect to admin database for cleanup: %v", err)
		return
	}
	defer adminDB.Close()

	// Terminate connections to test database
	_, err = adminDB.Exec(fmt.Sprintf("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%s'", tdb.dbName))
	if err != nil {
		t.Logf("Warning: Failed to terminate connections: %v", err)
	}

	// Drop test database
	_, err = adminDB.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", tdb.dbName))
	if err != nil {
		t.Logf("Warning: Failed to drop test database: %v", err)
	}
}

// runTestMigrations runs the database schema on test database
func runTestMigrations(testDB *db.DB) error {
	// Read schema file
	schema, err := os.ReadFile("db/golf_db_schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute schema
	_, err = testDB.Exec(string(schema))
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	// Read and execute groups migration
	groupsMigration, err := os.ReadFile("db/add_groups_migration.sql")
	if err != nil {
		log.Printf("Warning: Could not read groups migration: %v", err)
	} else {
		_, err = testDB.Exec(string(groupsMigration))
		if err != nil {
			return fmt.Errorf("failed to execute groups migration: %w", err)
		}
	}

	return nil
}

// CreateTestData creates a complete set of test data and returns IDs for testing
func CreateTestData(t *testing.T, testDB *TestDB, repo *repository.Repository) *TestDataSet {
	// Create test users with UUID generation
	var userID, user2ID, user3ID, user4ID string

	err := testDB.QueryRow(`INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3) RETURNING id`,
		"test@example.com", "Test User", false).Scan(&userID)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	err = testDB.QueryRow(`INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3) RETURNING id`,
		"test2@example.com", "Test User 2", false).Scan(&user2ID)
	if err != nil {
		t.Fatalf("Failed to create test user 2: %v", err)
	}

	err = testDB.QueryRow(`INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3) RETURNING id`,
		"test3@example.com", "Test User 3", false).Scan(&user3ID)
	if err != nil {
		t.Fatalf("Failed to create test user 3: %v", err)
	}

	err = testDB.QueryRow(`INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3) RETURNING id`,
		"test4@example.com", "Test User 4", false).Scan(&user4ID)
	if err != nil {
		t.Fatalf("Failed to create test user 4: %v", err)
	}

	// Create test group
	var groupID string
	err = testDB.QueryRow(`INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
		"Test Group", "Test group for testing", userID).Scan(&groupID)
	if err != nil {
		t.Fatalf("Failed to create test group: %v", err)
	}

	// Create test tournament
	tournamentReq := &models.CreateTournamentRequest{
		Name:        "Test Tournament",
		Description: stringPtr("Test tournament for integration tests"),
		StartDate:   time.Now(),
		EndDate:     time.Now().AddDate(0, 0, 7),
		GroupID:     groupID,
	}
	tournament, err := repo.CreateTournament(tournamentReq, userID)
	if err != nil {
		t.Fatalf("Failed to create test tournament: %v", err)
	}

	// Create test teams
	team1Req := &models.CreateTeamRequest{
		Name:  "Team Alpha",
		Color: stringPtr("#FF0000"),
	}
	team1, err := repo.CreateTeam(tournament.ID, team1Req)
	if err != nil {
		t.Fatalf("Failed to create team1: %v", err)
	}

	team2Req := &models.CreateTeamRequest{
		Name:  "Team Beta",
		Color: stringPtr("#0000FF"),
	}
	team2, err := repo.CreateTeam(tournament.ID, team2Req)
	if err != nil {
		t.Fatalf("Failed to create team2: %v", err)
	}

	// Add team members
	_, err = repo.AddTeamMember(team1.ID, userID)
	if err != nil {
		t.Fatalf("Failed to add member to team1: %v", err)
	}
	_, err = repo.AddTeamMember(team1.ID, user2ID)
	if err != nil {
		t.Fatalf("Failed to add member to team1: %v", err)
	}
	_, err = repo.AddTeamMember(team2.ID, user3ID)
	if err != nil {
		t.Fatalf("Failed to add member to team2: %v", err)
	}
	_, err = repo.AddTeamMember(team2.ID, user4ID)
	if err != nil {
		t.Fatalf("Failed to add member to team2: %v", err)
	}

	// Create test round
	roundReq := &models.CreateRoundRequest{
		Name:        "Round 1",
		RoundNumber: 1,
		RoundDate:   time.Now().Format("2006-01-02"),
		StartTime:   &time.Time{},
	}
	round, err := repo.CreateRound(tournament.ID, roundReq)
	if err != nil {
		t.Fatalf("Failed to create test round: %v", err)
	}

	// Get match format ID
	formats, err := repo.GetAllMatchFormats()
	if err != nil || len(formats) == 0 {
		t.Fatalf("Failed to get match formats or no formats available: %v", err)
	}
	formatID := formats[0]["id"].(string)

	// Create test pairing
	teeTime := time.Now()
	pairingReq := &models.CreatePairingRequest{
		PairingNumber: 1,
		TeeTime:       &teeTime,
		Players: []models.PairingPlayerRequest{
			{UserID: userID, TeamID: team1.ID, PlayerOrder: 1},
			{UserID: user2ID, TeamID: team1.ID, PlayerOrder: 2},
			{UserID: user3ID, TeamID: team2.ID, PlayerOrder: 3},
			{UserID: user4ID, TeamID: team2.ID, PlayerOrder: 4},
		},
		Matches: []models.PairingMatchRequest{
			{
				Team1ID:         team1.ID,
				Team2ID:         team2.ID,
				MatchFormatID:   formatID,
				Holes:           9,
				PointsAvailable: floatPtr(1.0),
			},
		},
	}
	pairing, err := repo.CreatePairing(round.ID, pairingReq)
	if err != nil {
		t.Fatalf("Failed to create test pairing: %v", err)
	}

	// Get the created match from the pairing
	matches, err := repo.GetMatchesByPairing(pairing.ID)
	if err != nil || len(matches) == 0 {
		t.Fatalf("Failed to get matches for pairing: %v", err)
	}
	matchID := matches[0].ID

	return &TestDataSet{
		UserIDs:      []string{userID, user2ID, user3ID, user4ID},
		GroupID:      groupID,
		TournamentID: tournament.ID,
		Team1ID:      team1.ID,
		Team2ID:      team2.ID,
		RoundID:      round.ID,
		PairingID:    pairing.ID,
		MatchID:      matchID,
		FormatID:     formatID,
	}
}

type TestDataSet struct {
	UserIDs      []string
	GroupID      string
	TournamentID string
	Team1ID      string
	Team2ID      string
	RoundID      string
	PairingID    string
	MatchID      string
	FormatID     string
}

func stringPtr(s string) *string {
	return &s
}

func floatPtr(f float64) *float64 {
	return &f
}

func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestMain loads environment variables from ENV_FILE (or .env.test by default)
// so integration tests pick up the correct DB credentials when run via the Makefile.
func TestMain(m *testing.M) {
	envFile := os.Getenv("ENV_FILE")
	if envFile == "" {
		envFile = ".env.test"
	}

	// Best-effort load; if the file is missing we still let tests run and
	// rely on environment or defaults in code.
	_ = godotenv.Load(envFile)

	os.Exit(m.Run())
}

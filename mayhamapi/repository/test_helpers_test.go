package repository

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"mayhamapi/db"
)

// TestDB holds a test database connection and its generated name.
type TestDB struct {
	DB   *db.DB
	Name string
}

// SetupTestDatabase creates a temporary PostgreSQL database, runs migrations,
// and returns a TestDB. Call Cleanup on the returned object when finished.
func SetupTestDatabase(t *testing.T) *TestDB {
	t.Helper()

	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	pass := os.Getenv("DB_PASSWORD")
	if pass == "" {
		pass = "password"
	}
	ssl := os.Getenv("DB_SSL_MODE")
	if ssl == "" {
		ssl = "disable"
	}

	adminDsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s", host, port, user, pass, ssl)
	adminDb, err := sql.Open("postgres", adminDsn)
	if err != nil {
		t.Fatalf("failed to open admin db connection: %v", err)
	}
	if err := adminDb.Ping(); err != nil {
		adminDb.Close()
		t.Fatalf("failed to ping admin db: %v", err)
	}

	dbName := fmt.Sprintf("mayham_test_%d", time.Now().UnixNano())
	if _, err := adminDb.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName)); err != nil {
		adminDb.Close()
		t.Fatalf("failed to create test database %s: %v", dbName, err)
	}

	testDsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", host, port, user, pass, dbName, ssl)
	sqlDB, err := sql.Open("postgres", testDsn)
	if err != nil {
		// attempt to drop db before failing
		adminDb.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", dbName))
		adminDb.Close()
		t.Fatalf("failed to open test db connection: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		adminDb.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", dbName))
		adminDb.Close()
		t.Fatalf("failed to ping test db: %v", err)
	}

	testDB := &db.DB{sqlDB}
	if err := testDB.RunMigrations(); err != nil {
		testDB.Close()
		adminDb.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", dbName))
		adminDb.Close()
		t.Fatalf("failed to run migrations on test db: %v", err)
	}

	// Close admin connection; tests will use the test DB only
	adminDb.Close()

	return &TestDB{DB: testDB, Name: dbName}
}

// Cleanup drops the temporary database and closes connections. Call via
// defer td.Cleanup(t).
func (td *TestDB) Cleanup(t *testing.T) {
	t.Helper()
	if td.DB != nil {
		td.DB.Close()
	}

	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	pass := os.Getenv("DB_PASSWORD")
	if pass == "" {
		pass = "password"
	}
	ssl := os.Getenv("DB_SSL_MODE")
	if ssl == "" {
		ssl = "disable"
	}

	adminDsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s", host, port, user, pass, ssl)
	adminDb, err := sql.Open("postgres", adminDsn)
	if err != nil {
		t.Fatalf("failed to open admin connection for cleanup: %v", err)
	}
	defer adminDb.Close()

	// Terminate any connections to the test DB, then drop it
	if _, err := adminDb.Exec("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", td.Name); err != nil {
		t.Logf("warning: failed to terminate backends for %s: %v", td.Name, err)
	}
	if _, err := adminDb.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", td.Name)); err != nil {
		t.Fatalf("failed to drop test database %s: %v", td.Name, err)
	}
}

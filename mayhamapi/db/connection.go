package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
}

func NewConnection() (*DB, error) {
	dbHost := getEnvWithDefault("DB_HOST", "localhost")
	dbPort := getEnvWithDefault("DB_PORT", "5432")
	dbUser := getEnvWithDefault("DB_USER", "postgres")
	dbPassword := getEnvWithDefault("DB_PASSWORD", "password")
	dbName := getEnvWithDefault("DB_NAME", "mayham_golf")
	sslMode := getEnvWithDefault("DB_SSL_MODE", "disable")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, sslMode)

	log.Print(dsn)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established successfully")
	return &DB{db}, nil
}

func (db *DB) Close() error {
	return db.DB.Close()
}

func (db *DB) RunMigrations() error {
	log.Println("Running database migrations...")

	// Ensure a simple migrations tracking table exists so we can avoid re-
	// executing SQL files that already ran. This is a lightweight alternative
	// to introducing an external migration dependency while still being safe
	// for tests and production.
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
	if err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	// Run main schema (only if not already applied)
	schemaFile := "db/golf_db_schema.sql"
	if err := runMigrationIfNeeded(db, schemaFile); err != nil {
		return err
	}

	// Run all migration files in order, skipping ones already applied
	files, err := filepath.Glob("db/migrations/*.sql")
	if err != nil {
		return fmt.Errorf("failed to find migration files: %w", err)
	}
	sort.Strings(files)

	for _, file := range files {
		if err := runMigrationIfNeeded(db, file); err != nil {
			return err
		}
	}

	log.Println("Database migrations completed successfully")
	return nil
}

// runMigrationIfNeeded executes the SQL file at path if it hasn't been
// recorded in schema_migrations. Each migration is executed inside a
// transaction and recorded on success.
func runMigrationIfNeeded(db *DB, path string) error {
	filename := filepath.Base(path)

	var exists bool
	if err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)", filename).Scan(&exists); err != nil {
		return fmt.Errorf("failed to check migration %s: %w", filename, err)
	}
	if exists {
		log.Printf("Skipping already-applied migration: %s", filename)
		return nil
	}

	log.Printf("Applying migration: %s", filename)
	sqlBytes, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", path, err)
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction for migration %s: %w", filename, err)
	}

	// Execute migration SQL
	if _, err := tx.Exec(string(sqlBytes)); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to execute migration %s: %w", filename, err)
	}

	// Record migration
	if _, err := tx.Exec("INSERT INTO schema_migrations (filename) VALUES ($1)", filename); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to record migration %s: %w", filename, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %s: %w", filename, err)
	}

	return nil
}

func getEnvWithDefault(key, defaultValue string) string {
	if val, set := os.LookupEnv(key); !set {
		log.Printf("%s is not set", key)
	} else {
		log.Printf("%s is set to %s", key, val)
	}
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

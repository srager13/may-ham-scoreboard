package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"path/filepath"

	_ "github.com/lib/pq"
)

// migratecheck prints which migration files in db/migrations are not recorded
// in the schema_migrations table of the target database.
func main() {
	dsn := flag.String("dsn", "host=localhost port=5432 user=postgres password=password dbname=mayham_dev sslmode=disable", "Postgres DSN")
	migrationsDir := flag.String("dir", "db/migrations", "Migrations directory")
	flag.Parse()

	db, err := sql.Open("postgres", *dsn)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	// Ensure schema_migrations exists (we don't create it here; if it doesn't
	// exist we inform the user).
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='schema_migrations')").Scan(&exists)
	if err != nil {
		log.Fatalf("failed to query information_schema: %v", err)
	}
	if !exists {
		fmt.Println("schema_migrations table does not exist in target DB; no migrations recorded.")
	}

	// Read migration files
	files, err := filepath.Glob(filepath.Join(*migrationsDir, "*.sql"))
	if err != nil {
		log.Fatalf("failed to list migrations: %v", err)
	}

	applied := map[string]bool{}
	if exists {
		rows, err := db.Query("SELECT filename FROM schema_migrations")
		if err != nil {
			log.Fatalf("failed to read schema_migrations: %v", err)
		}
		defer rows.Close()
		var fname string
		for rows.Next() {
			if err := rows.Scan(&fname); err != nil {
				log.Fatalf("failed to scan schema_migrations row: %v", err)
			}
			applied[fname] = true
		}
	}

	fmt.Println("Migrations present on disk:")
	for _, f := range files {
		fmt.Printf("  %s\n", filepath.Base(f))
	}

	fmt.Println()
	fmt.Println("Migrations not recorded in schema_migrations:")
	missing := 0
	for _, f := range files {
		b := filepath.Base(f)
		if !applied[b] {
			fmt.Printf("  %s\n", b)
			missing++
		}
	}
	if missing == 0 {
		fmt.Println("  (none)")
	}
}

# Makefile for Golf Tournament API

.PHONY: build run test test-integration test-unit clean dev build-prod

# Environment file (can be overridden: ENV_FILE=.env.production make run)
ENV_FILE ?= .env.development

# Build the application
build:
	go build -o mayhamapi

# Build for production
build-prod:
	CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags '-extldflags "-static"' -o mayhamapi

# Run the application
run: build
	ENV_FILE=$(ENV_FILE) ./mayhamapi

# Run development server with live reload (requires air: go install github.com/air-verse/air@latest)
dev:
	ENV_FILE=$(ENV_FILE) PATH=$$PATH:/root/go/bin air

# Run all tests
test:
	go test -v ./...

# Run integration tests (requires PostgreSQL)
test-integration:
	@echo "Running integration tests..."
	@echo "Make sure PostgreSQL is running on localhost:5432"
	@echo "User 'postgres' should exist with password 'password'"
	@echo "Admin privileges required to create/drop test databases"
	ENV_FILE=.env.test go test -v -run "Integration" .

# Run unit tests only (excludes integration tests)
test-unit:
	go test -v -short ./...

# Run repository tests
test-repo:
	ENV_FILE=.env.test go test -v ./repository/

# Clean build artifacts
clean:
	rm -f mayhamapi
	go clean

# Format code
fmt:
	go fmt ./...

# Vet code for common mistakes
vet:
	go vet ./...

# Run linter (requires golangci-lint: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
lint:
	golangci-lint run

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Setup test database (PostgreSQL)
setup-test-db:
	@echo "Setting up test database requirements..."
	@echo "This will check PostgreSQL connection..."
	@PGPASSWORD=password psql -h localhost -U postgres -d postgres -c "SELECT version();" || \
		(echo "PostgreSQL connection failed. Please ensure:"; \
		 echo "1. PostgreSQL is installed and running"; \
		 echo "2. User 'postgres' exists with password 'password'"; \
		 echo "3. Server is listening on localhost:5432"; \
		 exit 1)
	@echo "PostgreSQL connection successful!"

# Help
help:
	@echo "Available commands:"
	@echo "  build            - Build the application"
	@echo "  run              - Build and run the application"
	@echo "  dev              - Run with live reload (requires air)"
	@echo "  test             - Run all tests"
	@echo "  test-integration - Run integration tests only"
	@echo "  test-unit        - Run unit tests only"
	@echo "  test-repo        - Run repository tests"
	@echo "  test-coverage    - Run tests with coverage report"
	@echo "  setup-test-db    - Verify test database setup"
	@echo "  clean            - Clean build artifacts"
	@echo "  fmt              - Format code"
	@echo "  vet              - Vet code for common mistakes"
	@echo "  lint             - Run linter"
	@echo "  help             - Show this help"
#!/bin/bash
# Helper script to initialize environment files from template
# Usage: ./init-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Environment Files Initialization ===${NC}"
echo ""

# Check if .env.example exists
if [ ! -f "$PROJECT_ROOT/.env.example" ]; then
    echo "Error: .env.example not found"
    exit 1
fi

# Create .env.development if it doesn't exist
if [ -f "$PROJECT_ROOT/.env.development" ]; then
    echo -e "${YELLOW}.env.development already exists, skipping...${NC}"
else
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.development"
    
    # Update for development
    sed -i 's/ENV=development/ENV=development/' "$PROJECT_ROOT/.env.development"
    sed -i 's/PORT=8080/PORT=8080/' "$PROJECT_ROOT/.env.development"
    sed -i 's/DB_NAME=mayham_dev/DB_NAME=mayham_dev/' "$PROJECT_ROOT/.env.development"
    sed -i 's/GIN_MODE=debug/GIN_MODE=debug/' "$PROJECT_ROOT/.env.development"
    
    echo -e "${GREEN}✓ Created .env.development${NC}"
    echo "  Edit this file and set:"
    echo "    - DB_USER (your dev database user)"
    echo "    - DB_PASSWORD (your dev database password)"
fi

# Create .env.production if it doesn't exist
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    echo -e "${YELLOW}.env.production already exists, skipping...${NC}"
else
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.production"
    
    # Update for production
    sed -i 's/ENV=development/ENV=production/' "$PROJECT_ROOT/.env.production"
    sed -i 's/PORT=8080/PORT=8081/' "$PROJECT_ROOT/.env.production"
    sed -i 's/DB_NAME=mayham_dev/DB_NAME=mayham_prod/' "$PROJECT_ROOT/.env.production"
    sed -i 's/GIN_MODE=debug/GIN_MODE=release/' "$PROJECT_ROOT/.env.production"
    
    echo -e "${GREEN}✓ Created .env.production${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.production and set:${NC}"
    echo "    - DB_USER (production database user)"
    echo "    - DB_PASSWORD (STRONG password)"
    echo "    - JWT_SECRET (generate with: openssl rand -hex 64)"
fi

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Edit both .env files with your database credentials"
echo "  2. Run: psql -U postgres -c \"ALTER DATABASE mayham_golf RENAME TO mayham_dev;\""
echo "  3. Run: ./scripts/setup-production-db.sh"
echo "  4. Run: sudo ./scripts/install-services.sh"
echo "  5. Run: ./scripts/deploy.sh v1.0.0"

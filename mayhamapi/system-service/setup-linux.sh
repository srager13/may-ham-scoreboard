
# ============================================
# SETUP SCRIPT FOR LINUX (Systemd)
# ============================================

#!/bin/bash
# File: setup-linux.sh
# Usage: sudo bash setup-linux.sh

set -e

echo "🏌️  Golf Tournament Service Setup (Linux)"
echo "=========================================="

# Determine environment (prod or dev)
ENV_TYPE="${1:-prod}"

if [ "$ENV_TYPE" = "dev" ]; then
    echo "Setting up DEVELOPMENT environment..."
    SERVICE_USER="golftournament-dev"
    SERVICE_DIR="/root/may-ham-scoreboard/mayhamapi"
    LOG_DIR="/var/log/golf-tournament-dev"
    BACKUP_DIR="/var/backups/golf-tournament-dev"
    API_SERVICE="golf-api-dev.service"
    FRONTEND_SERVICE="golf-frontend-dev.service"
    SERVICE_SOURCE_DIR="dev"
else
    echo "Setting up PRODUCTION environment..."
    SERVICE_USER="golftournament"
    SERVICE_DIR="/opt/golf-tournament"
    LOG_DIR="/var/log/golf-tournament"
    BACKUP_DIR="/var/backups/golf-tournament"
    API_SERVICE="golf-api.service"
    FRONTEND_SERVICE="golf-frontend.service"
    SERVICE_SOURCE_DIR="."
fi

# Create user
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "Creating $SERVICE_USER user..."
    useradd -r -s /bin/bash $SERVICE_USER
else
    echo "User $SERVICE_USER already exists"
fi

# Create directories
echo "Creating directories..."
if [ "$ENV_TYPE" = "prod" ]; then
    mkdir -p /opt/golf-tournament/{backend,frontend,logs}
fi
mkdir -p $LOG_DIR
mkdir -p $BACKUP_DIR

# Copy service files
echo "Installing systemd service files..."
if [ "$ENV_TYPE" = "dev" ]; then
    cp $SERVICE_SOURCE_DIR/$API_SERVICE /etc/systemd/system/
    cp $SERVICE_SOURCE_DIR/$FRONTEND_SERVICE /etc/systemd/system/
else
    cp $API_SERVICE /etc/systemd/system/
    cp $FRONTEND_SERVICE /etc/systemd/system/
fi

# Set permissions
echo "Setting permissions..."
chown -R $SERVICE_USER:$SERVICE_USER $LOG_DIR
chown -R $SERVICE_USER:$SERVICE_USER $BACKUP_DIR

if [ "$ENV_TYPE" = "prod" ]; then
    chown -R $SERVICE_USER:$SERVICE_USER /opt/golf-tournament
    if [ -f /opt/golf-tournament/backend/mayhamapi ]; then
        chmod 755 /opt/golf-tournament/backend/mayhamapi
    fi
else
    # For dev, set ownership of the working directory
    chown -R $SERVICE_USER:$SERVICE_USER $SERVICE_DIR
fi

# Build backend and frontend (prod only)
if [ "$ENV_TYPE" = "prod" ]; then
    echo "Building backend..."
    cd /opt/golf-tournament/backend
    go build -o mayhamapi .

    echo "Building frontend..."
    cd /opt/golf-tournament/frontend
    npm install
    npm run build
else
    echo "Skipping build for dev environment (using live reload)..."
    # Ensure air is installed
    if ! command -v air &> /dev/null; then
        echo "Installing air for live reload..."
        go install github.com/air-verse/air@latest
    else
        echo "Air is already installed"
    fi
    
    # Ensure frontend dependencies are installed
    echo "Installing frontend dependencies..."
    cd $SERVICE_DIR/frontend
    npm install
fi

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable $API_SERVICE
systemctl enable $FRONTEND_SERVICE

echo "✅ Setup complete!"
echo ""
echo "To start services:"
echo "  sudo systemctl start ${API_SERVICE%.service}"
echo "  sudo systemctl start ${FRONTEND_SERVICE%.service}"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u ${API_SERVICE%.service} -f"
echo "  sudo journalctl -u ${FRONTEND_SERVICE%.service} -f"
echo ""
echo "To check status:"
echo "  sudo systemctl status ${API_SERVICE%.service}"
echo "  sudo systemctl status ${FRONTEND_SERVICE%.service}"
echo ""
if [ "$ENV_TYPE" = "dev" ]; then
    echo "DEV MODE: Services will use live reload (air for backend, npm run dev for frontend)"
fi

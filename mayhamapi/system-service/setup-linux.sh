
# ============================================
# SETUP SCRIPT FOR LINUX (Systemd)
# ============================================

#!/bin/bash
# File: setup-linux.sh
# Usage: sudo bash setup-linux.sh

set -e

echo "🏌️  Golf Tournament Service Setup (Linux)"
echo "=========================================="

# Create user
if ! id "golftournament" &>/dev/null; then
    echo "Creating golftournament user..."
    useradd -r -s /bin/bash -d /opt/golf-tournament golftournament
else
    echo "User golftournament already exists"
fi

# Create directories
echo "Creating directories..."
mkdir -p /opt/golf-tournament/{backend,frontend,logs}
mkdir -p /var/log/golf-tournament

# Copy service files
echo "Installing systemd service files..."
cp golf-api.service /etc/systemd/system/
cp golf-frontend.service /etc/systemd/system/

# Set permissions
chown -R golftournament:golftournament /opt/golf-tournament
chown -R golftournament:golftournament /var/log/golf-tournament
chmod 755 /opt/golf-tournament/backend/golf-api

# Build backend
echo "Building backend..."
cd /opt/golf-tournament/backend
go build -o golf-api .

# Build frontend
echo "Building frontend..."
cd /opt/golf-tournament/frontend
npm install
npm run build

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable golf-api.service
systemctl enable golf-frontend.service

echo "✅ Setup complete!"
echo ""
echo "To start services:"
echo "  sudo systemctl start golf-api"
echo "  sudo systemctl start golf-frontend"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u golf-api -f"
echo "  sudo journalctl -u golf-frontend -f"
echo ""
echo "To check status:"
echo "  sudo systemctl status golf-api"
echo "  sudo systemctl status golf-frontend"

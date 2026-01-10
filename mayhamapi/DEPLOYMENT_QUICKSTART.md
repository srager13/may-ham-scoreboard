# Quick Start Guide for Deployment

## Initial Setup (One-Time)

### 1. Create Environment Files

```bash
cd /root/may-ham-scoreboard/mayhamapi

# Create development environment file
cp .env.example .env.development
nano .env.development
# Edit: Set DB_NAME=mayham_dev, DB_USER=golf_dev_user (or your dev user)

# Create production environment file
cp .env.example .env.production
nano .env.production
# Edit: 
#   - Set ENV=production
#   - Set PORT=8081
#   - Set DB_NAME=mayham_prod
#   - Set DB_USER=golf_prod_user (your production user)
#   - Set DB_PASSWORD=<strong-password>
#   - Set JWT_SECRET=<strong-random-secret>
#   - Set GIN_MODE=release
```

### 2. Rename Existing Database to Dev

```bash
psql -U postgres -c "ALTER DATABASE mayham_golf RENAME TO mayham_dev;"
```

### 3. Set Up Production Database

```bash
cd /root/may-ham-scoreboard/mayhamapi/scripts
./setup-production-db.sh
```

### 4. Install System Services

```bash
sudo ./install-services.sh
```

## Deploying to Production

### First Deployment

```bash
cd /root/may-ham-scoreboard/mayhamapi/scripts
./deploy.sh v1.0.0
```

### Subsequent Deployments

```bash
# Make your changes in development
# Test thoroughly
# Commit and tag

cd /root/may-ham-scoreboard/mayhamapi/scripts
./deploy.sh v1.1.0
```

## Development Workflow

### Starting Development Environment

```bash
# Terminal 1: Backend
cd /root/may-ham-scoreboard/mayhamapi
ENV_FILE=.env.development make dev

# Terminal 2: Frontend
cd /root/may-ham-scoreboard/mayhamapi/frontend
npm run dev
```

## Production Commands

```bash
# Check service status
sudo systemctl status golf-api

# View logs
sudo journalctl -u golf-api -f

# Restart service
sudo systemctl restart golf-api

# Manual backup
cd /root/may-ham-scoreboard/mayhamapi/scripts
./backup-database.sh production

# Verify deployment
./verify-deployment.sh production

# Rollback if needed
./rollback.sh <timestamp>
```

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u golf-api -n 100 --no-pager

# Check if env file exists
ls -la /opt/golf-tournament/backend/.env.production

# Test database connection
ENV_FILE=.env.production psql -h localhost -U golf_prod_user -d mayham_prod -c "SELECT version();"
```

### Database issues

```bash
# List databases
psql -U postgres -l

# Check connection
psql -U golf_prod_user -d mayham_prod
```

## File Locations

- **Development code**: `/root/may-ham-scoreboard/mayhamapi/`
- **Production binaries**: `/opt/golf-tournament/backend/`
- **Logs**: `/var/log/golf-tournament/`
- **Backups**: `/var/backups/golf-tournament/`
- **Service file**: `/etc/systemd/system/golf-api.service`
- **Cron jobs**: `/etc/cron.d/golf-tournament-backup`

# Production Deployment Checklist

Use this checklist to track your progress through the deployment setup.

## Phase 1: Initial Setup ⚙️

### Database Separation
- [ ] Rename existing database to dev
  ```bash
  psql -U postgres -c "ALTER DATABASE mayham_golf RENAME TO mayham_dev;"
  ```
- [ ] Verify dev database
  ```bash
  psql -U postgres -l | grep mayham_dev
  ```

### Environment Configuration
- [ ] Create environment files
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/scripts
  ./init-env.sh
  ```
- [ ] Edit `.env.development`
  - Set DB_USER (golf_dev_user or your dev user)
  - Set DB_PASSWORD
  - Verify DB_NAME=mayham_dev
  - Verify PORT=8080
  
- [ ] Edit `.env.production`
  - Set DB_USER (golf_prod_user)
  - Set DB_PASSWORD (STRONG password)
  - Set JWT_SECRET (generate with `openssl rand -hex 64`)
  - Verify DB_NAME=mayham_prod
  - Verify PORT=8081
  - Verify GIN_MODE=release

### Security Check
- [ ] Verify .env files are NOT in git
  ```bash
  git status  # Should not show .env.development or .env.production
  ```
- [ ] Generate strong production passwords
  ```bash
  # Database password
  openssl rand -base64 32
  
  # JWT secret
  openssl rand -hex 64
  ```

## Phase 2: Production Database Setup 🗄️

- [ ] Run production database setup
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/scripts
  ./setup-production-db.sh
  ```
- [ ] Verify production database exists
  ```bash
  psql -U postgres -l | grep mayham_prod
  ```
- [ ] Test production database connection
  ```bash
  source /root/may-ham-scoreboard/mayhamapi/.env.production
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"
  ```

## Phase 3: System Service Installation 🔧

- [ ] Install systemd services
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/scripts
  sudo ./install-services.sh
  ```
- [ ] Verify service file exists
  ```bash
  ls -l /etc/systemd/system/golf-api.service
  ```
- [ ] Verify directories created
  ```bash
  ls -ld /opt/golf-tournament/backend
  ls -ld /var/log/golf-tournament
  ls -ld /var/backups/golf-tournament
  ```
- [ ] Verify user created
  ```bash
  id golftournament
  ```

## Phase 4: Test Development Environment 🧪

- [ ] Test backend with dev environment
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi
  ENV_FILE=.env.development make dev
  # Should connect to mayham_dev database
  # Ctrl+C to stop
  ```
- [ ] Test frontend build
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/frontend
  npm run build
  # Should create static files in ../static/
  ```
- [ ] Run tests
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi
  ENV_FILE=.env.test make test-integration
  ```

## Phase 5: First Production Deployment 🚀

- [ ] Create git tag for first release
  ```bash
  cd /root/may-ham-scoreboard
  git tag -a v1.0.0 -m "First production release"
  ```
- [ ] Run deployment script
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/scripts
  ./deploy.sh v1.0.0
  ```
- [ ] Verify service is running
  ```bash
  sudo systemctl status golf-api
  ```
- [ ] Check health endpoint
  ```bash
  curl http://localhost:8081/health
  ```
- [ ] Run verification
  ```bash
  ./verify-deployment.sh production
  ```

## Phase 6: Configure Nginx (Optional) 🌐

If you want to serve on port 80 with Nginx:

- [ ] Install Nginx
  ```bash
  sudo apt-get update
  sudo apt-get install nginx
  ```
- [ ] Copy Nginx configuration
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/nginx-proxy-config
  sudo bash setup-nginx.sh
  ```
- [ ] Test Nginx configuration
  ```bash
  sudo nginx -t
  ```
- [ ] Restart Nginx
  ```bash
  sudo systemctl restart nginx
  ```
- [ ] Verify frontend loads
  ```bash
  curl http://localhost/
  ```

## Phase 7: Set Up Monitoring 📊

- [ ] Test manual backup
  ```bash
  cd /root/may-ham-scoreboard/mayhamapi/scripts
  ./backup-database.sh production
  ```
- [ ] Verify backup created
  ```bash
  ls -lh /var/backups/golf-tournament/daily/
  ```
- [ ] Verify backup cron job
  ```bash
  sudo cat /etc/cron.d/golf-tournament-backup
  ```
- [ ] Set up log monitoring (optional)
  ```bash
  # Add to your crontab or monitoring system
  watch -n 60 'sudo journalctl -u golf-api --since "1 hour ago" | grep -i error | tail -20'
  ```

## Phase 8: Documentation 📝

- [ ] Document production URLs/ports
- [ ] Document database credentials (securely!)
- [ ] Create runbook for common operations
- [ ] Share access with team members
- [ ] Set up alerting/notification system

## Daily Operations Checklist ✅

### Starting Development
- [ ] Start backend: `ENV_FILE=.env.development make dev`
- [ ] Start frontend: `cd frontend && npm run dev`

### Deploying to Production
- [ ] Test locally first
- [ ] Commit and push changes
- [ ] Create git tag
- [ ] Run deployment script
- [ ] Verify deployment
- [ ] Monitor logs for 5-10 minutes

### Monitoring Production
- [ ] Check service status: `sudo systemctl status golf-api`
- [ ] View logs: `sudo journalctl -u golf-api -f`
- [ ] Check health: `curl http://localhost:8081/health`
- [ ] Verify backups are running

## Emergency Procedures 🆘

### If Deployment Fails
```bash
# Check logs
sudo journalctl -u golf-api -n 100 --no-pager

# Rollback to previous version
cd /root/may-ham-scoreboard/mayhamapi/scripts
./rollback.sh <timestamp>
```

### If Database Corrupted
```bash
# Restore from backup
cd /root/may-ham-scoreboard/mayhamapi/scripts
./restore-database.sh /var/backups/golf-tournament/daily/mayham_prod_YYYYMMDD_HHMMSS.sql.gz production
```

### If Service Won't Start
```bash
# Check configuration
sudo systemctl status golf-api
sudo journalctl -u golf-api -n 50

# Test manually
cd /opt/golf-tournament/backend
ENV_FILE=.env.production ./mayhamapi

# Check environment file
cat /opt/golf-tournament/backend/.env.production
```

## Post-Deployment Verification ✓

After each deployment, verify:

- [ ] Service is running: `systemctl status golf-api`
- [ ] Health check passes: `curl http://localhost:8081/health`
- [ ] Frontend loads: `curl http://localhost:8081/`
- [ ] API responds: `curl http://localhost:8081/api/v1/tournaments`
- [ ] Database connection works
- [ ] No errors in logs: `journalctl -u golf-api --since "5 minutes ago"`
- [ ] Backup completed successfully

## Maintenance Schedule 🗓️

### Daily
- Automated database backup at 2 AM (cron job)
- Review logs for errors

### Weekly
- Review backup retention
- Check disk space
- Review service performance

### Monthly
- Test restore procedure
- Review and update documentation
- Check for security updates

---

## Quick Reference Commands

```bash
# Development
ENV_FILE=.env.development make dev

# Deploy to production
./scripts/deploy.sh v1.2.3

# Check production status
sudo systemctl status golf-api
sudo journalctl -u golf-api -f

# Manual backup
./scripts/backup-database.sh production

# Rollback
./scripts/rollback.sh <timestamp>

# Health check
curl http://localhost:8081/health
```

---

**Status Tracker:**
- Setup Started: _________
- Production Deployed: _________
- Team Trained: _________
- Monitoring Active: _________

# Production Deployment - Success! 🎉

## Status: OPERATIONAL ✅

Your Golf Tournament application is now successfully deployed and running in production!

### Deployment Details

- **Date:** January 10, 2026
- **Version:** v1.0.0
- **Environment:** Production
- **Database:** mayham_prod (PostgreSQL)
- **Service:** golf-api.service (systemd)

### Service Endpoints

| Endpoint | URL | Status |
|----------|-----|--------|
| Frontend | https://mayhamscoreboard.com | ✅ Running |
| API Health | https://mayhamscoreboard.com/health | ✅ Healthy |
| API Base | https://mayhamscoreboard.com/api/v1/ | ✅ Running |

### Service Configuration

```bash
Service:     golf-api
User:        golftournament
Directory:   /opt/golf-tournament/backend/
Port:        8081
Database:    mayham_prod (localhost:5432)
Config:      /opt/golf-tournament/backend/.env.production
```

### Architecture

```
Internet → Nginx (Port 443) → Go Backend (Port 8081) → PostgreSQL
                 ↓
           Static Files (served by Go)
```

## Issues Resolved

### 1. Database Permissions ✅
**Problem:** `permission denied for schema public`

**Solution:** Granted proper schema permissions to `mayham_prod_user`:
- USAGE on schema public
- CREATE on schema public
- ALL PRIVILEGES on tables and sequences
- Default privileges for future objects

### 2. Missing Database Schema ✅
**Problem:** `failed to read migration file: db/golf_db_schema.sql`

**Solution:** Updated deploy.sh to copy `db/` directory to production location.

### 3. Nginx 502 Bad Gateway ✅
**Problem:** Nginx proxying to wrong port (8080 instead of 8081)

**Solution:** Updated nginx upstream configuration:
```nginx
upstream golf_api_backend {
    least_conn;
    server localhost:8081 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

## Monitoring & Management

### Check Service Status
```bash
sudo systemctl status golf-api
```

### View Logs
```bash
# Recent logs
sudo journalctl -u golf-api -n 50 --no-pager

# Follow logs in real-time
sudo journalctl -u golf-api -f

# Nginx logs
sudo tail -f /var/log/nginx/golf_access.log
sudo tail -f /var/log/nginx/golf_error.log
```

### Health Checks
```bash
# Direct backend check
curl http://localhost:8081/health

# Through nginx
curl -k https://localhost/health

# API check
curl -k https://localhost/api/v1/health
```

### Service Management
```bash
# Start service
sudo systemctl start golf-api

# Stop service
sudo systemctl stop golf-api

# Restart service
sudo systemctl restart golf-api

# Reload nginx
sudo systemctl reload nginx
```

## Development vs Production

### Development Environment
- **Location:** `/root/may-ham-scoreboard/mayhamapi/`
- **Port:** 8080
- **Database:** mayham_dev
- **Run:** `make dev` (live reload with air)
- **Config:** `.env.development`

### Production Environment
- **Location:** `/opt/golf-tournament/backend/`
- **Port:** 8081
- **Database:** mayham_prod
- **Run:** `sudo systemctl start golf-api`
- **Config:** `.env.production`

## Deployment Process

For future deployments:

```bash
cd /root/may-ham-scoreboard/mayhamapi

# Run deployment script
./scripts/deploy.sh v1.0.1

# Or follow manual steps:
# 1. Run tests
make test-integration

# 2. Build backend and frontend
go build -o mayhamapi
cd frontend && npm run build

# 3. Backup database
./scripts/backup-database.sh production

# 4. Deploy
sudo cp mayhamapi /opt/golf-tournament/backend/
sudo cp -r static /opt/golf-tournament/backend/
sudo systemctl restart golf-api

# 5. Verify
./scripts/verify-deployment.sh production
```

### File uploads (UPLOAD_DIR)

This deployment uses a configurable upload directory for runtime file uploads (team logos). By default the application stores uploads at `./uploads/team_logos` and serves them at the public path `/static/team_logos/<file>`.

If you are upgrading from an older deployment that stored uploads in `./static/team_logos`, move those files to the new location before restarting the service:

```bash
cd /opt/golf-tournament/backend
sudo mkdir -p ./uploads/team_logos
# Backup existing files first
sudo cp -a ./static/team_logos /tmp/team_logos_backup || true
sudo mv ./static/team_logos/* ./uploads/team_logos/ || true
sudo chown -R golftournament:golftournament ./uploads/team_logos
```

To override the default upload directory set the `UPLOAD_DIR` environment variable in your `.env.production` file (path can be absolute or relative to the running directory):

```
UPLOAD_DIR=./uploads/team_logos
```


## Backup & Recovery

### Create Backup
```bash
# Database backup
./scripts/backup-database.sh production

# Full deployment backup (automatic during deploy)
ls -lt /var/backups/golf-tournament/deployments/
```

### Restore Backup
```bash
# List backups
ls -lt /var/backups/golf-tournament/database/

# Restore database
./scripts/restore-database.sh production 20260110_040000

# Rollback deployment
./scripts/rollback.sh 20260110_040000
```

## Next Steps

### Recommended Actions

1. **Set up automated backups:**
   ```bash
   # Add to crontab
   sudo crontab -e
   
   # Add daily backup at 2 AM
   0 2 * * * /root/may-ham-scoreboard/mayhamapi/scripts/backup-database.sh production
   ```

2. **Configure monitoring:**
   - Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
   - Configure log aggregation
   - Set up alerts for service failures

3. **SSL Certificate renewal:**
   ```bash
   # Test renewal
   sudo certbot renew --dry-run
   
   # Certbot auto-renewal is already configured via systemd timer
   sudo systemctl status certbot.timer
   ```

4. **Security hardening:**
   - [ ] Enable firewall (ufw)
   - [ ] Set up fail2ban
   - [ ] Regular security updates
   - [ ] Review nginx security headers

5. **Performance optimization:**
   - Monitor database query performance
   - Set up database connection pooling
   - Consider CDN for static assets
   - Enable HTTP/2 push for critical assets

## Troubleshooting

If you encounter issues, refer to:

📖 [TROUBLESHOOTING.md](scripts/TROUBLESHOOTING.md)

Quick diagnostics:
```bash
cd /root/may-ham-scoreboard/mayhamapi
./scripts/verify-deployment.sh production
```

## Documentation

- **Deployment Scripts:** `scripts/README.md`
- **Troubleshooting Guide:** `scripts/TROUBLESHOOTING.md`
- **API Documentation:** `docs/`
- **Project Structure:** `ProjectStructure.md`

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u golf-api -n 100`
2. Review troubleshooting guide
3. Run verification: `./scripts/verify-deployment.sh production`

---

**Congratulations on your successful deployment! 🎉**

Your Golf Tournament application is now live and ready to use.

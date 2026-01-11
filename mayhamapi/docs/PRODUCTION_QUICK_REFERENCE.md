# Production Quick Reference

## ✅ Current Status: OPERATIONAL

### Service URLs
- **Site:** https://mayhamscoreboard.com
- **Health:** https://mayhamscoreboard.com/health
- **API:** https://mayhamscoreboard.com/api/v1/

### Quick Commands

#### Service Management
```bash
# Status
sudo systemctl status golf-api

# Start/Stop/Restart
sudo systemctl start golf-api
sudo systemctl stop golf-api
sudo systemctl restart golf-api

# Logs
sudo journalctl -u golf-api -f
```

#### Nginx
```bash
# Status
sudo systemctl status nginx

# Reload config (after changes)
sudo nginx -t && sudo systemctl reload nginx

# Logs
sudo tail -f /var/log/nginx/golf_access.log
sudo tail -f /var/log/nginx/golf_error.log
```

#### Health Checks
```bash
# Backend direct
curl http://localhost:8081/health

# Through nginx
curl -k https://localhost/health
```

#### Deployment
```bash
cd /root/may-ham-scoreboard/mayhamapi

# Full deployment
./scripts/deploy.sh v1.0.1

# Verify
./scripts/verify-deployment.sh production

# Rollback
./scripts/rollback.sh <timestamp>
```

#### Database
```bash
# Backup
./scripts/backup-database.sh production

# Restore
./scripts/restore-database.sh production <timestamp>

# Connect
PGPASSWORD=<password> psql -h localhost -U mayham_prod_user -d mayham_prod
```

### File Locations

| Item | Development | Production |
|------|-------------|------------|
| Code | `/root/may-ham-scoreboard/mayhamapi/` | `/opt/golf-tournament/backend/` |
| Config | `.env.development` | `.env.production` |
| Port | 8080 | 8081 |
| Database | mayham_dev | mayham_prod |
| Logs | `./logs/` | `/var/log/nginx/`, journalctl |

### Configuration Files
- **Backend Config:** `/opt/golf-tournament/backend/.env.production`
- **Systemd Service:** `/etc/systemd/system/golf-api.service`
- **Nginx Config:** `/etc/nginx/nginx.conf`

### Issues Fixed During Deployment

1. ✅ Database permissions (`GRANT USAGE/CREATE ON SCHEMA public`)
2. ✅ Missing DB schema files (deploy.sh copies `db/` directory)
3. ✅ Nginx 502 (updated upstream to port 8081)

### Troubleshooting

**502 Bad Gateway?**
```bash
# Check backend
sudo systemctl status golf-api
curl http://localhost:8081/health

# Check nginx upstream
sudo nginx -T | grep "upstream golf_api_backend" -A 5
```

**Database issues?**
```bash
# Check connection
PGPASSWORD=<pass> psql -U mayham_prod_user -d mayham_prod -c "SELECT version();"

# Check permissions
sudo -u postgres psql -d mayham_prod -c "\dp"
```

**Service won't start?**
```bash
# Check logs
sudo journalctl -u golf-api -n 100 --no-pager

# Check config
cat /opt/golf-tournament/backend/.env.production

# Check files
ls -la /opt/golf-tournament/backend/
```

### Documentation
- 📖 Full Guide: [DEPLOYMENT_SUCCESS.md](mayhamapi/DEPLOYMENT_SUCCESS.md)
- 🔧 Troubleshooting: [scripts/TROUBLESHOOTING.md](mayhamapi/scripts/TROUBLESHOOTING.md)
- 🚀 Scripts: [scripts/README.md](mayhamapi/scripts/README.md)

---

**Last Updated:** January 10, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅

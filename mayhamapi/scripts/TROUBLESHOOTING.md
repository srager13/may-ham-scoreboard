# Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. Permission Denied for Schema Public

**Error Message:**
```
pq: permission denied for schema public
```

**Cause:**
The database user doesn't have the necessary permissions to create tables in the public schema.

**Solution:**
Run the following SQL commands as the postgres superuser:

```bash
sudo -u postgres psql -d mayham_prod <<EOF
GRANT USAGE ON SCHEMA public TO mayham_prod_user;
GRANT CREATE ON SCHEMA public TO mayham_prod_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mayham_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mayham_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO mayham_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO mayham_prod_user;
EOF
```

**Prevention:**
The `setup-production-db.sh` script now includes these permissions automatically.

---

### 2. Failed to Read Migration File

**Error Message:**
```
failed to read migration file: open db/golf_db_schema.sql: no such file or directory
```

**Cause:**
The `db/` directory was not copied to the deployment location.

**Solution:**
Ensure the `db/` directory is deployed:

```bash
sudo mkdir -p /opt/golf-tournament/backend/db
sudo cp /root/may-ham-scoreboard/mayhamapi/db/golf_db_schema.sql /opt/golf-tournament/backend/db/
sudo chown -R golftournament:golftournament /opt/golf-tournament/backend/db
```

**Prevention:**
The `deploy.sh` script includes this step automatically.

---

### 3. Service Fails to Start

**Check logs:**
```bash
sudo journalctl -u golf-api -n 100 --no-pager
```

**Common issues:**
- Database connection fails (check DB_HOST, DB_USER, DB_PASSWORD in .env.production)
- Port already in use (check if another instance is running)
- Missing environment file (ensure .env.production exists in /opt/golf-tournament/backend/)

**Quick status check:**
```bash
sudo systemctl status golf-api
```

---

### 4. Database Connection Refused

**Error Message:**
```
dial tcp [::1]:5432: connect: connection refused
```

**Solution:**
1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verify PostgreSQL is listening on the correct interface:
   ```bash
   sudo netstat -tlnp | grep 5432
   ```

3. Check pg_hba.conf for authentication settings:
   ```bash
   sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -v "^#" | grep -v "^$"
   ```

---

### 5. Health Check Fails

**Test health endpoint:**
```bash
curl http://localhost:8081/health
```

**Expected response:**
```json
{"status":"healthy"}
```

**If it fails:**
1. Check if service is running: `sudo systemctl status golf-api`
2. Check which port is configured: `grep PORT /opt/golf-tournament/backend/.env.production`
3. Check firewall rules: `sudo ufw status`

---

## Verification Commands

### Check Service Status
```bash
# Service status
sudo systemctl status golf-api

# Recent logs
sudo journalctl -u golf-api -n 50 --no-pager

# Follow logs live
sudo journalctl -u golf-api -f
```

### Check Database Connection
```bash
# From scripts directory
./verify-deployment.sh production

# Manual test
PGPASSWORD=your_password psql -h localhost -U mayham_prod_user -d mayham_prod -c "SELECT version();"
```

### Check File Permissions
```bash
# Check deployed files
ls -la /opt/golf-tournament/backend/

# Check .env.production permissions (should be 600)
ls -l /opt/golf-tournament/backend/.env.production

# Check database directory
ls -la /opt/golf-tournament/backend/db/
```

### Check Network
```bash
# Check if service is listening on correct port
sudo netstat -tlnp | grep 8081

# Test health endpoint
curl http://localhost:8081/health

# Test from another machine (if applicable)
curl http://your-server-ip:8081/health
```

---

## Rollback Procedures

### Rollback to Previous Deployment
```bash
# List available backups
ls -lt /var/backups/golf-tournament/deployments/

# Rollback to specific version
./scripts/rollback.sh 20260110_040000
```

### Restore Database Backup
```bash
# List available database backups
ls -lt /var/backups/golf-tournament/database/

# Restore specific backup
./scripts/restore-database.sh production 20260110_040000
```

---

## Frontend Issues

### Site Loads But Shows Blank Page

**Symptoms:**
- HTML loads but page is blank
- Browser console shows errors loading JS/CSS files
- Assets return wrong content-type (text/html instead of text/javascript)

**Cause:**
Static files (JS, CSS) are not being served correctly by the backend. The NoRoute handler is catching asset requests and returning index.html instead of the actual files.

**Solution:**

1. **Check asset content type:**
   ```bash
   curl -I http://localhost:8081/assets/index-*.js | grep Content-Type
   ```
   
   Should return:
   ```
   Content-Type: text/javascript; charset=utf-8
   ```
   
   NOT:
   ```
   Content-Type: text/html; charset=utf-8
   ```

2. **Verify main.go configuration:**
   The static file routes in `main.go` should be:
   ```go
   // Serve static files from root (assets, vite.svg, etc.)
   r.Static("/assets", "./static/assets")
   r.StaticFile("/vite.svg", "./static/vite.svg")
   r.StaticFile("/favicon.ico", "./static/favicon.ico")
   
   // Serve index.html at root
   r.GET("/", func(c *gin.Context) {
       c.File("./static/index.html")
   })
   ```

3. **Rebuild and redeploy if needed:**
   ```bash
   cd /root/may-ham-scoreboard/mayhamapi
   go build -o mayhamapi
   sudo systemctl stop golf-api
   sudo cp mayhamapi /opt/golf-tournament/backend/
   sudo systemctl start golf-api
   ```

### Static Files Not Found (404)

**Check static directory:**
```bash
ls -la /opt/golf-tournament/backend/static/
ls -la /opt/golf-tournament/backend/static/assets/
```

**Rebuild frontend if needed:**
```bash
cd /root/may-ham-scoreboard/mayhamapi/frontend
npm run build
sudo cp -r ../static /opt/golf-tournament/backend/
sudo chown -R golftournament:golftournament /opt/golf-tournament/backend/static
```

---

## Nginx Issues

### 502 Bad Gateway Error

**Symptoms:**
- Website shows "502 Bad Gateway" error
- API requests fail with 502 status

**Cause:**
Nginx is configured to proxy to the wrong port or the backend service is not running.

**Solution:**

1. **Check if backend is running:**
   ```bash
   sudo systemctl status golf-api
   curl http://localhost:8081/health
   ```

2. **Check nginx upstream configuration:**
   ```bash
   sudo nginx -T | grep "upstream golf_api_backend" -A 5
   ```
   
   Should show:
   ```nginx
   upstream golf_api_backend {
       least_conn;
       server localhost:8081 max_fails=3 fail_timeout=30s;
       keepalive 32;
   }
   ```

3. **Update nginx if needed:**
   ```bash
   # Edit the upstream section in /etc/nginx/nginx.conf
   sudo nano /etc/nginx/nginx.conf
   
   # Change port 8080 to 8081 for production
   # Test configuration
   sudo nginx -t
   
   # Reload nginx
   sudo systemctl reload nginx
   ```

4. **Check nginx error logs:**
   ```bash
   sudo tail -50 /var/log/nginx/golf_error.log
   ```

### Nginx Won't Start

**Check configuration:**
```bash
sudo nginx -t
```

**Common issues:**
- SSL certificate files missing or wrong path
- Port already in use
- Syntax error in configuration

**Check what's using port 80/443:**
```bash
sudo netstat -tlnp | grep ':80\|:443'
```

### Update Nginx Configuration

After changing `/etc/nginx/nginx.conf`:

```bash
# Test configuration
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx

# Or restart if needed
sudo systemctl restart nginx
```

---

## Performance Issues

### High Memory Usage
Check memory limits in the systemd service:
```bash
sudo systemctl show golf-api | grep Memory
```

### Slow Database Queries
Enable query logging in PostgreSQL:
```sql
ALTER DATABASE mayham_prod SET log_min_duration_statement = 1000;  -- Log queries >1s
```

### Check Database Connections
```sql
SELECT * FROM pg_stat_activity WHERE datname = 'mayham_prod';
```

---

## Getting Help

1. **Check logs first:**
   ```bash
   sudo journalctl -u golf-api -n 200 --no-pager
   ```

2. **Verify configuration:**
   ```bash
   cat /opt/golf-tournament/backend/.env.production
   ```

3. **Run verification:**
   ```bash
   cd /root/may-ham-scoreboard/mayhamapi
   ./scripts/verify-deployment.sh production
   ```

4. **Collect diagnostic information:**
   ```bash
   echo "=== Service Status ===" && sudo systemctl status golf-api
   echo "=== Recent Logs ===" && sudo journalctl -u golf-api -n 50 --no-pager
   echo "=== Database Connection ===" && PGPASSWORD=your_password psql -U mayham_prod_user -d mayham_prod -c "SELECT version();"
   echo "=== Health Check ===" && curl http://localhost:8081/health
   ```

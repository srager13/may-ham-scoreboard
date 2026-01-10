# Production Deployment & Release Process Plan

## Current State Analysis

**Development Setup:**
- Backend: `make dev` (using air for live reload on port 8080)
- Frontend: `npm run dev` (Vite dev server on port 5173)
- Database: Single PostgreSQL database `mayham_golf`
- Configuration: Single `.env` file
- No separation between dev and production

**Existing Infrastructure:**
- ✅ Systemd service files (`system-service/`)
- ✅ Nginx reverse proxy config (`nginx-proxy-config/`)
- ✅ Docker setup (`system-service/docker-compose.yaml`)
- ✅ Database schema and migrations (`db/`)

## Production Architecture Plan

### 1. Environment Separation

```
┌─────────────────────────────────────────────────────────┐
│                    DEVELOPMENT                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Frontend Dev │  │ Backend Dev  │  │   Dev DB     │ │
│  │  Port 5173   │  │  Port 8080   │  │ mayham_dev   │ │
│  │ npm run dev  │  │  make dev    │  │ localhost    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Nginx     │  │ Backend API  │  │   Prod DB    │ │
│  │   Port 80    │──│  Port 8081   │──│ mayham_prod  │ │
│  │ Static Files │  │  Systemd     │  │ localhost    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2. Database Setup

**Create Two Databases:**

```bash
# Production database
createdb -U postgres mayham_prod

# Development database (rename existing)
psql -U postgres -c "ALTER DATABASE mayham_golf RENAME TO mayham_dev;"
```

**Database Migration Strategy:**
- Use existing schema files
- Automated migrations on startup (already implemented in `db/connection.go`)
- Backup strategy for production

### 3. Configuration Management

**File Structure:**
```
mayhamapi/
├── .env.development      # Dev config (git ignored)
├── .env.production       # Prod config (git ignored, deploy separately)
├── .env.test            # Test config (existing)
├── .env.example         # Template for all environments (git tracked)
└── config/
    └── environments.go   # Load config based on ENV variable
```

**Environment Variables:**

`.env.development`:
```bash
ENV=development
PORT=8080
DB_HOST=localhost
DB_NAME=mayham_dev
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=dev-jwt-secret-changeme
GIN_MODE=debug
FRONTEND_URL=http://localhost:5173
```

`.env.production`:
```bash
ENV=production
PORT=8081
DB_HOST=localhost
DB_NAME=mayham_prod
DB_USER=postgres
DB_PASSWORD=STRONG_PRODUCTION_PASSWORD
JWT_SECRET=STRONG_PRODUCTION_JWT_SECRET
GIN_MODE=release
FRONTEND_URL=http://your-domain.com
```

### 4. Systemd Service Configuration

**Update Service Files:**
- Load production environment file
- Use dedicated user/group
- Proper logging and restart policies

### 5. Build Process

**Backend:**
```bash
# Development
make dev

# Production build
make build-prod
```

**Frontend:**
```bash
# Development
npm run dev

# Production build
npm run build  # outputs to mayhamapi/static/
```

## Release Process

### Phase 1: Initial Production Setup (One-time)

**Step 1: Create Production Database**
```bash
./scripts/setup-production-db.sh
```

**Step 2: Configure Production Environment**
```bash
./scripts/setup-production-env.sh
```

**Step 3: Install System Services**
```bash
sudo ./scripts/install-services.sh
```

**Step 4: Configure Nginx**
```bash
sudo ./scripts/setup-nginx.sh
```

### Phase 2: Regular Deployment Process

**Automated Deploy Script:**
```bash
./scripts/deploy.sh [version-tag]
```

**Deploy Script Steps:**
1. Run tests (`make test-integration`)
2. Create git tag
3. Build backend (`make build-prod`)
4. Build frontend (`npm run build`)
5. Backup production database
6. Stop production service
7. Copy new binaries
8. Run migrations
9. Start production service
10. Verify health
11. Rollback if failed

**Manual Verification:**
```bash
./scripts/verify-deployment.sh
```

### Phase 3: Rollback Process

**If deployment fails:**
```bash
./scripts/rollback.sh [previous-version-tag]
```

## File Structure for Scripts

```
mayhamapi/
├── scripts/
│   ├── setup-production-db.sh      # One-time: Create prod DB
│   ├── setup-production-env.sh     # One-time: Create .env.production
│   ├── install-services.sh         # One-time: Install systemd services
│   ├── setup-nginx.sh              # One-time: Configure nginx
│   ├── deploy.sh                   # Regular: Deploy new version
│   ├── rollback.sh                 # Emergency: Rollback deployment
│   ├── verify-deployment.sh        # Health check after deploy
│   ├── backup-database.sh          # Create DB backup
│   ├── restore-database.sh         # Restore from backup
│   └── common.sh                   # Shared functions
```

## Security Considerations

### 1. Secrets Management

**NEVER commit to git:**
- `.env.production`
- `.env.development`
- Database passwords
- JWT secrets
- API keys

**Use git-ignored files:**
```bash
# Add to .gitignore
.env.production
.env.development
.env.local
*.key
*.pem
backups/
```

**Store production secrets separately:**
- Use environment variables in systemd service
- Or use secrets management tool (HashiCorp Vault, AWS Secrets Manager)

### 2. Database Security

- Different passwords for dev and prod
- Restrict database access by IP
- Regular backups (automated)
- Encrypted backups

### 3. Application Security

- Strong JWT secrets (production)
- Rate limiting in nginx
- HTTPS only in production
- Secure headers

## Monitoring & Logging

### Logging Setup

**Development:**
- Console output
- Debug level logging

**Production:**
- Systemd journal: `journalctl -u golf-api -f`
- Application logs: `/var/log/golf-tournament/api.log`
- Nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Health Checks

**Endpoint:**
```
GET /health
```

**Monitoring script:**
```bash
./scripts/monitor-health.sh
```

## Backup Strategy

### Automated Backups

**Cron job for daily backups:**
```bash
0 2 * * * /opt/golf-tournament/scripts/backup-database.sh
```

**Backup retention:**
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

**Backup location:**
```
/var/backups/golf-tournament/
├── daily/
│   ├── mayham_prod_2025-01-10.sql.gz
│   └── ...
├── weekly/
└── monthly/
```

## Implementation Timeline

### Week 1: Infrastructure Setup
- [ ] Create production database
- [ ] Set up environment files
- [ ] Update systemd services
- [ ] Configure nginx

### Week 2: Scripting & Automation
- [ ] Create setup scripts
- [ ] Create deployment script
- [ ] Create rollback script
- [ ] Create backup/restore scripts

### Week 3: Testing & Documentation
- [ ] Test deployment process
- [ ] Test rollback process
- [ ] Document procedures
- [ ] Train team on processes

### Week 4: Production Cutover
- [ ] Final testing
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Adjust as needed

## Post-Deployment Checklist

After each deployment:
- [ ] Verify service is running: `systemctl status golf-api`
- [ ] Check logs for errors: `journalctl -u golf-api -n 100`
- [ ] Test health endpoint: `curl http://localhost:8081/health`
- [ ] Test API endpoints
- [ ] Test frontend loading
- [ ] Verify database connectivity
- [ ] Check nginx access logs

## Next Steps

1. **Review this plan** and adjust based on your infrastructure
2. **Start with database separation** (safest first step)
3. **Create environment files** (dev and prod)
4. **Build deployment scripts** (automated, repeatable)
5. **Test deployment process** in dev environment first
6. **Gradual rollout** to production

## Questions to Answer Before Implementation

1. **Hosting:** Where will production run? (Same server, different server?)
2. **Domain:** What domain/subdomain for production?
3. **SSL/TLS:** Do you need HTTPS? (Recommended: yes)
4. **Monitoring:** What monitoring tools to use?
5. **Backups:** Where to store backups? (Local, S3, etc.)
6. **Access:** Who needs access to production? SSH keys setup?
7. **Notifications:** How to notify on deployment success/failure?

## Useful Commands Reference

```bash
# Development
make dev                          # Start backend dev server
npm run dev                       # Start frontend dev server

# Production
sudo systemctl start golf-api     # Start production backend
sudo systemctl stop golf-api      # Stop production backend
sudo systemctl restart golf-api   # Restart production backend
sudo systemctl status golf-api    # Check service status

# Logs
journalctl -u golf-api -f         # Follow backend logs
tail -f /var/log/nginx/access.log # Follow nginx logs

# Database
psql -U postgres -d mayham_dev    # Connect to dev DB
psql -U postgres -d mayham_prod   # Connect to prod DB

# Deployment
./scripts/deploy.sh v1.2.3        # Deploy version 1.2.3
./scripts/rollback.sh v1.2.2      # Rollback to version 1.2.2
./scripts/backup-database.sh      # Manual backup
```

---

**Priority Actions:**
1. ✅ Review this plan
2. Create `.env.development` and `.env.production`
3. Set up production database
4. Create deployment scripts
5. Test deployment process
6. Deploy to production


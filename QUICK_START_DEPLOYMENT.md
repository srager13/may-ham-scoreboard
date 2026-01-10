# Quick Start: Dev → Production Migration

## 🎯 Goal
Separate development and production environments with automated deployment.

## 📊 Current State → Target State

### BEFORE (Current)
```
Single Environment
├── Backend: make dev (port 8080)
├── Frontend: npm run dev (port 5173)
└── Database: mayham_golf
```

### AFTER (Target)
```
Development Environment
├── Backend: make dev (port 8080)
├── Frontend: npm run dev (port 5173)
└── Database: mayham_dev

Production Environment
├── Backend: systemd service (port 8081)
├── Frontend: nginx static files (port 80)
└── Database: mayham_prod
```

## 🚀 Quick Implementation Steps

### Step 1: Separate Databases (5 minutes)

```bash
# Rename existing database to dev
psql -U postgres -h $DB_HOST -c "ALTER DATABASE mayham_golf RENAME TO mayham_dev;"

# Create production database
createdb -U postgres mayham_prod
```

### Step 2: Create Environment Files (10 minutes)

**Create `.env.development`:**
```bash
cd /root/may-ham-scoreboard/mayhamapi
cat > .env.development << 'EOF'
ENV=development
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=mayham_dev
DB_SSL_MODE=disable
JWT_SECRET=dev-jwt-secret-change-in-production
GOLF_COURSE_API_KEY=WKTSEX3UKGXJ6IISKYEBH7UNPY
GIN_MODE=debug
EOF
```

**Create `.env.production`:**
```bash
cat > .env.production << 'EOF'
ENV=production
PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
DB_NAME=mayham_prod
DB_SSL_MODE=disable
JWT_SECRET=CHANGE_THIS_STRONG_JWT_SECRET
GOLF_COURSE_API_KEY=WKTSEX3UKGXJ6IISKYEBH7UNPY
GIN_MODE=release
EOF
```

**Update `.gitignore`:**
```bash
echo ".env.development" >> .gitignore
echo ".env.production" >> .gitignore
echo ".env.local" >> .gitignore
```

### Step 3: Update Development Workflow (2 minutes)

**Modify your workflow:**
```bash
# Instead of: make dev
# Use: ENV_FILE=.env.development make dev

# Or update Makefile to use .env.development by default
```

### Step 4: Create Deployment Script (15 minutes)

See `/root/may-ham-scoreboard/mayhamapi/scripts/deploy.sh` (to be created)

### Step 5: Set Up Production Service (10 minutes)

```bash
# Build backend
cd /root/may-ham-scoreboard/mayhamapi
go build -o mayhamapi

# Build frontend
cd frontend
npm run build

# Copy static files are already in ../static/
```

## 📝 Critical Security Updates

1. **Cretate production database user**
**BEFORE going to production, change these:**
sudo -u postgres psql << 'EOF'
-- Create prod user with password
CREATE USER mayham_prod_user WITH PASSWORD 'CHANGE_ME';

-- Grant privileges on production database
GRANT CONNECT ON DATABASE mayham_prod TO mayham_prod_user;
\c mayham_prod
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mayham_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mayham_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mayham_prod_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mayham_prod_user;
EOF

1. **Production Database Password:**
   ```bash
   # Generate strong password
   openssl rand -base64 32
   
   # Update in .env.production
   # Update in PostgreSQL
   psql -U postgres -c "ALTER USER postgres PASSWORD 'new-strong-password';"
   ```

2. **JWT Secret:**
   ```bash
   # Generate strong secret
   openssl rand -hex 64
   
   # Update in .env.production
   ```

3. **Remove from Git History:**
   ```bash
   # Check what's committed
   git log --all --full-history -- "*.env"
   
   # If .env was committed, clean it
   # (Use BFG Repo-Cleaner or git-filter-repo)
   ```

## 🔄 Daily Workflow After Setup

### Development:
```bash
cd /root/may-ham-scoreboard/mayhamapi

# Backend
ENV_FILE=.env.development make dev

# Frontend (separate terminal)
cd frontend
npm run dev
```

### Deploy to Production:
```bash
cd /root/may-ham-scoreboard/mayhamapi

# Run tests
make test

# Deploy
./scripts/deploy.sh v1.0.0
```

## 🛠️ Scripts to Create

Priority order:

1. **`scripts/deploy.sh`** - Main deployment script
2. **`scripts/backup-database.sh`** - Database backup
3. **`scripts/rollback.sh`** - Emergency rollback
4. **`scripts/verify-deployment.sh`** - Health checks

## ✅ Testing the Setup

### Test Development Environment:
```bash
# Start dev backend
ENV_FILE=.env.development make dev

# In another terminal, test
curl http://localhost:8080/health

# Start dev frontend
cd frontend && npm run dev

# Visit http://localhost:5173
```

### Test Production Environment:
```bash
# Build and start production backend
ENV_FILE=.env.production go build -o mayhamapi
ENV_FILE=.env.production ./mayhamapi

# Test
curl http://localhost:8081/health
```

## 📋 Pre-Production Checklist

- [ ] Databases separated (mayham_dev, mayham_prod)
- [ ] Environment files created (.env.development, .env.production)
- [ ] Strong passwords set in .env.production
- [ ] .env files added to .gitignore
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Backend builds successfully (`go build`)
- [ ] Can run dev environment with new config
- [ ] Systemd service file updated with .env.production path
- [ ] Nginx configured to serve static files
- [ ] Deployment script created and tested
- [ ] Backup script created and tested
- [ ] Rollback procedure documented and tested

## 🆘 Troubleshooting

### Database Connection Fails
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -d mayham_dev -c "SELECT version();"
```

### Backend Won't Start
```bash
# Check environment file exists
ls -la .env.development .env.production

# Test environment loading
ENV_FILE=.env.development printenv | grep DB_
```

### Frontend Build Fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📚 Next Steps

1. Review the full [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)
2. Create the deployment scripts
3. Test deployment process in dev
4. Deploy to production
5. Set up monitoring and backups

## 🎯 First Milestone

**Goal:** Dev and Prod databases separated, can switch between them

**Time Estimate:** 30 minutes

**Success Criteria:**
- ✅ Can run development with `mayham_dev` database
- ✅ Can run production build with `mayham_prod` database
- ✅ No .env secrets committed to git
- ✅ Both environments working independently


# May Ham Cup Golf Tournament Scoreboard - AI Agent Instructions

## Project Overview
Ryder Cup-style golf tournament management system with Go backend (Gin framework) and React TypeScript frontend. Supports real-time scoring, multiple match formats (Match Play, Best Ball, Scramble, Alternate Shot, High-Low, Shamble), and live leaderboards via WebSocket.

## Architecture & Component Structure

### Backend (Go)
- **Entry**: [mayhamapi/main.go](../mayhamapi/main.go) - Sets up router, initializes handlers with dependency injection pattern
- **Repository Pattern**: [mayhamapi/repository/repository.go](../mayhamapi/repository/repository.go) - All database operations centralized here; methods return Go models
- **Models**: [../mayhamapi/models/models.go](../mayhamapi/models/models.go) - Single source of truth for all data structures (entities + DTOs)
- **Handlers**: [../mayhamapi/handlers/](../mayhamapi/handlers/) - HTTP layer; each handler receives repo via constructor `NewXHandler(repo *repository.Repository)`
- **Database**: PostgreSQL; migrations auto-run on startup from [../mayhamapi/db/golf_db_schema.sql](../mayhamapi/db/golf_db_schema.sql)

### Frontend (React + TypeScript)
- **Build System**: Vite; built assets served from [../mayhamapi/static/](../mayhamapi/static/) by Go backend
- **API Client**: [../mayhamapi/frontend/src/services/api.ts](../mayhamapi/frontend/src/services/api.ts) - TypeScript interfaces mirror Go models; all API calls here
- **Components**: [../mayhamapi/frontend/src/components/](../mayhamapi/frontend/src/components/) - Main UI components
- **Routing**: React Router with SPA fallback handled by Go backend's NoRoute handler

### Key Data Flow
1. **Pairing → Match relationship**: Pairings contain players; Matches reference a pairing and define the format/teams
2. **Scoring calculation**: [../mayhamapi/scoring/service.go](../mayhamapi/scoring/service.go) handles all match format logic; calculates points per hole based on format type
3. **Groups → Tournaments**: Groups contain users; Tournaments belong to a group; Teams pull from group members

## Development Workflows

### Build & Run
```bash
# Backend (from mayhamapi/)
make run              # Build and start Go server (port 8080)
make dev              # Live reload with air (requires: go install github.com/air-verse/air@latest)

# Frontend (from mayhamapi/frontend/)
npm run dev           # Vite dev server (port 5173)
npm run build         # Build to mayhamapi/static/ for production

# Full stack: Run both servers concurrently for development
```

### Testing
```bash
# Integration tests (from mayhamapi/)
make test-integration  # Uses .env.test config; creates/destroys test DB per test
make test-repo        # Repository-level integration tests
make test             # All tests

# Requirements: PostgreSQL with user 'postgres', password 'password', localhost:5432
# Tests use testcontainers pattern - see integration_test.go and test_config.go
```

### Database Operations
```bash
# Schema migrations run automatically on server start
# Manual database reset:
psql -U postgres -d mayham_golf -f db/reset_database.sql

# Test users auto-created by insert_test_users.sql (referenced in schema)
```

## Project-Specific Conventions

### API Routing Pattern
- **Protected routes**: `/api/v1/*` - Require JWT via `middleware.JWTAuth()`
- **Example pattern** (from [main.go](../mayhamapi/main.go)):
  ```go
	auth.POST("/login", authHandler.Login)
  protected.GET("/tournaments", tournamentHandler.ListTournaments)
  ```

### Frontend-Backend Type Sync
TypeScript interfaces in [api.ts](../mayhamapi/frontend/src/services/api.ts) **must** match Go structs in [models.go](../mayhamapi/models/models.go). Field naming:
- Go: `snake_case` JSON tags
- TypeScript: `snake_case` properties (NOT camelCase) to match API responses

### Authentication
- **JWT tokens** stored in localStorage as `token`
- **No real passwords yet** - development uses simple email-based auth (see TODOs.yaml)
- **Claims structure**: UserID, Email, IsAdmin in [middleware/auth.go](../mayhamapi/middleware/auth.go)

### Match Formats & Scoring
Each format has unique calculation logic in [scoring/service.go](../mayhamapi/scoring/service.go):
- **Match Play**: Head-to-head, win/lose/halve per hole
- **Best Ball**: Each team uses lowest individual score
- **Scramble/Alternate Shot**: Team plays one ball (combined scores)
- **High-Low**: Sum of highest + lowest team scores
- **Shamble**: Best drive, then individual play

When adding scoring features, update `calculateHoleResult()` switch statement.

### Environment Configuration
- **.env** in `mayhamapi/` root - used by both backend and frontend build
- **.env.test** - integration test config (separate test database)
- **Key vars**: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`

## Key Principles
- Focus on readability over being performant.
- Fully implement all requested functionality.
- Leave NO todo's, placeholders or missing pieces.
- Be sure to reference file names.
- Be concise. Minimize any other prose.
- If you think there might not be a correct answer, you say so. If you do not know the answer, say so instead of guessing.
- Only write code that is necessary to complete the task.
- Rewrite the complete code only if necessary.
- Update relevant tests or create new tests if necessary.
- Do not perform tests that require starting the backend api, starting or querying the database, or launching the frontend service (npm run) unless explicitly instructed to do so. Leave high-level testing to the the developer. Do run unit tests after updating them or asked to find issues in them. 

## REFACTORING GUIDANCE
When refactoring large files:
- Break work into logical, independently functional chunks
- Ensure each intermediate state maintains functionality
- Consider temporary duplication as a valid interim step
- Always indicate the refactoring pattern being applied
                
## RATE LIMIT AVOIDANCE
- For very large files, suggest splitting changes across multiple sessions
- Prioritize changes that are logically complete units
- Always provide clear stopping points
            
## General Requirements
    Use modern technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.          

## Common Tasks

### Adding a New API Endpoint
1. Add request/response structs to [models/models.go](../mayhamapi/models/models.go)
2. Implement repository method in [repository/repository.go](../mayhamapi/repository/repository.go)
3. Create handler method in appropriate handler file (e.g., [handlers/tournament_handler.go](../mayhamapi/handlers/tournament_handler.go))
4. Register route in [main.go](../mayhamapi/main.go) `setupRouter()`
5. Add TypeScript types to [frontend/src/services/api.ts](../mayhamapi/frontend/src/services/api.ts)
6. Create API function in `api.ts` using `fetch(API_BASE_URL + '/endpoint')`

### Database Schema Changes
1. Modify [db/golf_db_schema.sql](../mayhamapi/db/golf_db_schema.sql) (uses `CREATE TABLE IF NOT EXISTS`)
2. Add migration SQL to new file in `db/` if needed (see [db/add_groups_migration.sql](../mayhamapi/db/add_groups_migration.sql))
3. Update corresponding models in [models/models.go](../mayhamapi/models/models.go)
4. Restart server to auto-apply migrations

### Adding React Components
1. Create `.tsx` in [frontend/src/components/](../mayhamapi/frontend/src/components/)
2. Import from [App.tsx](../mayhamapi/frontend/src/App.tsx) or route in React Router
3. Use Tailwind CSS for styling (config in [tailwind.config.js](../mayhamapi/frontend/tailwind.config.js))
4. Call API via functions from [services/api.ts](../mayhamapi/frontend/src/services/api.ts)

## Key Files for Reference

- **[TODOs.yaml](../TODOs.yaml)** - Active development priorities and known issues
- **[ProjectStructure.md](../mayhamapi/ProjectStructure.md)** - Full directory tree explanation
- **[TESTING.md](../mayhamapi/docs/TESTING.md)** - Integration test setup guide
- **[Makefile](../mayhamapi/Makefile)** - All build/test/dev commands

## Production Deployment Notes
- Project is still in development and testing phase. nginx server configured for this phase, but may need securing and performance improvements in the future:
  - **Nginx config**: [nginx-proxy-config/](../mayhamapi/nginx-proxy-config/) - Load balancer setup
- **Systemd services**: [system-service/](../mayhamapi/system-service/) - Backend/frontend service files
- **Static assets**: Frontend builds to `mayhamapi/static/`, served by Go on `/` and `/static`

## Important Constraints
- WebSocket implementation exists but needs fixes (see TODOs)
- Admin authentication is basic; no role-based access control yet
- Mobile optimization pending (responsive but not optimized)
- Database backups not automated (production TODO)

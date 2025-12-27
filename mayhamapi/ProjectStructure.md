
### Project Structure

```
may-ham-scoreboard/
├── mayhamapi/                    # Backend API server and frontend
│   ├── main.go                  # Backend API server entry point
│   ├── go.mod                   # Go module definition
│   ├── go.sum                   # Go module dependencies
│   ├── mayhamapi               # Compiled backend binary
│   ├── .env                    # Environment variables (for API and database)
│   ├── .env.example            # Example environment configuration
│   ├── .env.test               # Test environment configuration
│   ├── Makefile                # Build and test automation
│   ├── README.md               # Project documentation
│   ├── docs/
│   │   ├── API_SCORING.md       # Scoring API documentation
│   │   ├── USER_GUIDE_SCORING.md # User guide for scoring features
│   │   ├── PHASE_9_TEST_RESULTS.md # Integration test results
│   │   ├── PAIRING_API_ENDPOINTS.md # Pairing system documentation
│   │   └── TESTING.md           # Integration testing guide
│   ├── integration_test.go     # API integration tests
│   ├── test_config.go          # Test database setup utilities
│   ├── run-integration-tests.sh # Automated test runner script
│   ├── db/
│   │   ├── connection.go       # Database connection and migrations
│   │   ├── golf_db_schema.sql  # Database schema
│   │   ├── add_groups_migration.sql # Groups feature migration
│   │   ├── migrations/
│   │   │   └── 001_add_scoring_improvements.sql # Scoring enhancements migration
│   │   └── reset_database.sql  # SQL to clear database and initialize users
│   ├── models/
│   │   └── models.go          # Data models and DTOs
│   ├── repository/
│   │   ├── repository.go      # Database operations
│   │   ├── repository_test.go # Repository integration test templates
│   ├── handlers/
│   │   ├── auth_handler.go        # Authentication endpoints
│   │   ├── group_handler.go       # Group management endpoints
│   │   ├── tournament_handler.go  # Tournament management
│   │   └── scoring_handler.go     # Scoring endpoints
│   ├── scoring/
│   │   └── service.go         # Scoring business logic
│   ├── middleware/
│   │   └── auth.go           # JWT and CORS middleware
│   ├── websocket/
│   │   └── hub.go            # WebSocket hub for real-time updates
│   ├── frontend/                 # React frontend application
│   │   ├── index.html           # HTML entry point
│   │   ├── package.json         # Node.js dependencies
│   │   ├── package-lock.json    # Dependency lock file
│   │   ├── vite.config.ts       # Vite build configuration
│   │   ├── tailwind.config.js   # Tailwind CSS configuration
│   │   ├── postcss.config.js    # PostCSS configuration
│   │   ├── tsconfig.json        # TypeScript configuration
│   │   ├── tsconfig.node.json   # TypeScript Node configuration
│   │   └── src/
│   │       ├── main.tsx         # React application entry point
│   │       ├── App.tsx          # Main application component
│   │       ├── index.css        # Global styles
│   │       ├── components/
│   │       │   ├── AdminPortal.tsx    # Tournament administration
│   │       │   ├── Auth.tsx           # Authentication component
│   │       │   ├── ErrorBoundary.tsx  # Error handling wrapper
│   │       │   ├── Groups.tsx         # Group management interface
│   │       │   ├── LandingPage.tsx    # Landing page component
│   │       │   ├── Leaderboard.tsx    # Tournament leaderboard
│   │       │   └── ScoreInterface.tsx # Score entry interface
│   │       └── services/
│   │           └── api.ts             # API client and type definitions
│   ├── static/                   # Built frontend assets (served by backend)
│   │   ├── index.html           # Production HTML
│   │   └── assets/              # Built CSS/JS assets
│   ├── nginx-proxy-config/       # Nginx configuration for production
│   │   ├── nginx.conf           # Main nginx configuration
│   │   ├── upstream.conf        # Upstream server configuration
│   │   ├── performance.conf     # Performance optimizations
│   │   ├── logging.conf         # Logging configuration
│   │   ├── setup-nginx.sh       # Nginx setup script
│   │   ├── reload-nginx.sh      # Nginx reload script
│   │   ├── test-nginx.sh        # Nginx test script
│   │   └── commands-reference.txt # Nginx commands reference
│   └── system-service/           # Production deployment configuration
│       ├── docker-compose.yaml  # Docker deployment configuration
│       ├── Dockerfile.backend   # Backend container definition
│       ├── Dockerfile.frontend  # Frontend container definition
│       ├── golf-api.service     # Systemd service for backend
│       ├── golf-frontend.service # Systemd service for frontend
│       ├── setup-linux.sh       # Linux deployment setup
│       ├── setup-guide.txt      # Deployment guide
│       └── useful-commands.txt  # Useful deployment commands
├── Notes.txt                     # Development notes
│── TODOs.yaml                   # Development TODOs
└── LANDING_PAGE_README.md       # Project overview and landing page
```

---

## Database Schema Overview

### Core Tables

#### users
Stores player/user information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | User email (unique) |
| name | VARCHAR(255) | Display name |
| handicap | DECIMAL(4,1) | Golf handicap (optional) |
| is_admin | BOOLEAN | Admin privileges flag |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

#### tournaments
Main tournament container.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Tournament name |
| description | TEXT | Optional description |
| start_date | DATE | Tournament start |
| end_date | DATE | Tournament end |
| group_id | UUID | FK to groups |
| created_by | UUID | FK to users (creator) |
| status | VARCHAR(50) | draft, active, completed |
| **scoring_method** | **VARCHAR(20)** | **'gross' or 'stableford'** ⭐ |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

**⭐ New in v2.0:** `scoring_method` field determines tournament-wide scoring type.

#### matches
Individual matches within rounds.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| pairing_id | UUID | FK to pairings |
| round_id | UUID | FK to rounds |
| team1_id | UUID | FK to teams |
| team2_id | UUID | FK to teams |
| match_format_id | UUID | FK to match_formats |
| match_number | INT | Order within pairing |
| holes | INT | Number of holes (6, 9, or 18) |
| **start_hole** | **INT** | **First hole (1-18)** ⭐ |
| **end_hole** | **INT** | **Last hole (1-18)** ⭐ |
| status | VARCHAR(50) | not_started, in_progress, completed |
| points_available | DECIMAL(3,1) | Points awarded to winner |
| team1_points | DECIMAL(3,1) | Points earned by team 1 |
| team2_points | DECIMAL(3,1) | Points earned by team 2 |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

**⭐ New in v2.0:** `start_hole` and `end_hole` enable matches covering specific hole ranges.

**Constraints:**
- `start_hole` and `end_hole` must both be NULL or both be set
- When set: `start_hole` >= 1, `end_hole` <= 18, `start_hole` <= `end_hole`

#### hole_scores
Individual player scores per hole.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| pairing_id | UUID | FK to pairings |
| hole_number | INT | Hole number (1-18) |
| user_id | UUID | FK to users |
| strokes | INT | Raw stroke count |
| **stableford_points** | **INT** | **Points (0-5)** ⭐ |
| created_at | TIMESTAMP | Score entry time |
| updated_at | TIMESTAMP | Last update |

**⭐ New in v2.0:** `stableford_points` stores calculated points for Stableford scoring.

**Rules:**
- `stableford_points` is NULL for gross scoring tournaments
- Points calculated as: 0 (double bogey+), 1 (bogey), 2 (par), 3 (birdie), 4 (eagle), 5 (albatross)
- Calculation: `score_to_par = (strokes - handicap_strokes) - par`

#### match_formats
Defines available match format types.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Format name (e.g., "2v2 Scramble") |
| description | TEXT | Format description |
| players_per_side | INT | Players per team (1 or 2) |
| scoring_type | VARCHAR(50) | match_play, scramble, best_ball, etc. |
| **score_input_type** | **VARCHAR(20)** | **'individual' or 'team'** ⭐ |
| created_at | TIMESTAMP | Record creation |

**⭐ New in v2.0:** `score_input_type` determines UI behavior:
- `'individual'` - Each player enters own score (Match Play, Best Ball, High-Low, Shamble)
- `'team'` - One combined score per team (Scramble, Alternate Shot)

### Indexes

Key indexes for performance:

```sql
-- Hole range queries
CREATE INDEX idx_matches_hole_range ON matches(start_hole, end_hole) 
WHERE start_hole IS NOT NULL;

-- Stableford scoring queries
CREATE INDEX idx_hole_scores_stableford ON hole_scores(stableford_points) 
WHERE stableford_points IS NOT NULL;

-- Tournament scoring method queries
CREATE INDEX idx_tournaments_scoring_method ON tournaments(scoring_method);
```

### Migration Files

#### 001_add_scoring_improvements.sql
Adds all v2.0 scoring enhancements:
- `tournaments.scoring_method` column with default 'gross'
- `matches.start_hole` and `end_hole` columns
- `hole_scores.stableford_points` column
- `match_formats.score_input_type` column with default 'individual'
- Constraint on matches: `(start_hole IS NULL AND end_hole IS NULL) OR (start_hole >= 1 AND end_hole <= 18 AND start_hole <= end_hole)`
- All necessary indexes

### Data Flow Examples

#### Example 1: Stableford Scoring
```
Tournament → scoring_method='stableford'
  ↓
Score Entry → strokes=4, hole par=4
  ↓
Backend Calculation → net_score=4, score_to_par=0 → stableford_points=2
  ↓
Database → hole_scores.stableford_points=2
  ↓
Leaderboard → Sum of stableford_points (higher is better)
```

#### Example 2: Match Hole Ranges
```
Round 1 has 3 matches in same pairing:
  Match 1: start_hole=1,  end_hole=6   (holes 1-6)
  Match 2: start_hole=7,  end_hole=12  (holes 7-12)
  Match 3: start_hole=13, end_hole=18  (holes 13-18)

Score Entry for Hole 5:
  → Only Match 1 processes this score
  → Matches 2 and 3 ignore it

Scoring Service:
  → Iterates holes 1-6 for Match 1
  → Iterates holes 7-12 for Match 2
  → Iterates holes 13-18 for Match 3
```

#### Example 3: Team vs Individual Scoring
```
Match Format → score_input_type='team' (Scramble)
  ↓
Frontend UI → Shows 2 input fields (one per team)
  ↓
API Request → scores: [{user_id: team1_id, strokes: 4}, {user_id: team2_id, strokes: 5}]
  ↓
Scoring Service → calculateScrambleHole() uses team scores
  ↓
Result → Team with lower combined score wins hole

vs.

Match Format → score_input_type='individual' (Best Ball)
  ↓
Frontend UI → Shows 4 input fields (one per player)
  ↓
API Request → scores: [{user_id: player1, strokes: 4}, {user_id: player2, strokes: 5}, ...]
  ↓
Scoring Service → calculateBestBallHole() finds best score per team
  ↓
Result → Team with better best score wins hole
```

### Schema Version History

- **v1.0** (Original): Basic tournament, rounds, matches, scores
- **v1.5** (Groups): Added groups and group_members tables
- **v2.0** (Scoring Improvements): Added scoring_method, hole ranges, stableford_points, score_input_type

---
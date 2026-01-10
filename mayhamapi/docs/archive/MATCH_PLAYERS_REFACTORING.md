# Match Players Refactoring - Complete Summary

## Overview
This refactoring adds back the `match_players` table to properly support both 1v1 and 2v2 match formats. Previously, matches only referenced pairings, but now we track which specific players from a pairing participate in each match.

## Problem Statement
- Matches referenced `pairing_id` but didn't track which specific players were in each match
- A pairing might have 4 players, but a 1v1 match within that pairing only involves 2 specific players
- When calculating/displaying match results, we need to know exactly which players participated
- The old `match_players` table was removed when pairings were added and needed to be restored

## Changes Made

### 1. Database Schema Updates

#### Added `match_players` Table
**File:** `mayhamapi/db/golf_db_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    player_order INT, -- position within the match (1-4 for most formats)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, user_id)
);
```

#### Added Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
```

#### Migration File
**File:** `mayhamapi/db/migrations/002_add_match_players.sql`
- Creates the `match_players` table
- Backfills existing matches with players from their pairings

### 2. Backend Model Updates

#### Updated Models
**File:** `mayhamapi/models/models.go`

Added `MatchPlayer` struct:
```go
type MatchPlayer struct {
    ID          string    `json:"id" db:"id"`
    MatchID     string    `json:"match_id" db:"match_id"`
    UserID      string    `json:"user_id" db:"user_id"`
    TeamID      string    `json:"team_id" db:"team_id"`
    PlayerOrder int       `json:"player_order" db:"player_order"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    User        *User     `json:"user,omitempty"`
}
```

Updated `Match` struct to include players:
```go
type Match struct {
    // ... existing fields ...
    Players []MatchPlayer `json:"players,omitempty"`
}
```

### 3. Repository Updates

#### Restored Match Player Methods
**File:** `mayhamapi/repository/repository.go`

- `CreateMatchPlayer(matchPlayer *models.MatchPlayer)` - Creates a match player record
- `GetMatchPlayersByMatch(matchID string)` - Retrieves all players for a match with user details

#### Updated Match Retrieval Methods
- `GetMatch()` - Now loads match players
- `GetMatchesByRound()` - Now loads match players for each match
- `GetMatchesByPairing()` - Now loads match players for each match

#### Auto-Assignment Logic
- `CreateMatchForPairing()` - Automatically assigns all pairing players to the match when created
- Players are copied from `pairing_players` to `match_players` with the same team and order

### 4. Handler Updates

#### Tournament Handler
**File:** `mayhamapi/handlers/tournament_handler.go`

- Updated `GetMatchPlayers()` to use `GetMatchPlayersByMatch()` directly instead of getting pairing players
- Removed deprecation notice - this is now the primary way to get match-specific player information

### 5. Frontend Updates

#### API Type Updates
**File:** `mayhamapi/frontend/src/services/api.ts`

Updated interfaces:
```typescript
export interface Match {
  // ... existing fields ...
  players?: MatchPlayer[];
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  user_id: string;
  team_id: string;
  player_order: number; // Changed from 'position'
  user?: User;
}
```

#### ScoreInterface Component
**File:** `mayhamapi/frontend/src/components/ScoreInterface.tsx`

- Updated to use `match.players` instead of `match.match_players`
- Fixed field name from `position` to `player_order`
- Now displays actual player names from `match.players` array
- Falls back to pairing players if match players aren't available

#### Leaderboard Component
**File:** `mayhamapi/frontend/src/components/Leaderboard.tsx`

- Added player names below team names in live match displays
- Shows players filtered by team and sorted by `player_order`
- Applied to both compact and expanded match views

## Data Flow

### Creating a Pairing with Matches
1. Admin creates a pairing with players
2. Players are added to `pairing_players` table
3. When matches are created for the pairing via `CreateMatchForPairing()`:
   - Match record is created in `matches` table
   - All pairing players are automatically copied to `match_players` table
   - This ensures each match knows exactly who is playing

### Retrieving Match Data
1. API calls `GetMatch()` or `GetMatchesByRound()`
2. Repository queries `matches` table
3. For each match:
   - Loads teams
   - Loads match format
   - Loads pairing (if exists)
   - **Loads match players from `match_players` table**
4. Returns complete match object with players

### Displaying Match Results
1. Frontend receives match data with `players` array
2. Filters players by `team_id` to separate teams
3. Sorts by `player_order` for consistent display
4. Shows player names with `user?.name`
5. Falls back to pairing players if match players aren't loaded

## Benefits

### For 1v1 Matches
- Each singles match can specify exactly which 2 players are competing
- Example: Pairing has 4 players, but Match 1 is Player A vs Player C

### For 2v2 Matches
- Team matches clearly show all 4 participants
- Example: Match 1 is (Player A & Player B) vs (Player C & Player D)

### For Mixed Pairings
- A pairing can contain multiple matches with different formats
- Example: Same 4 players play 3 matches (6 holes each)
  - Match 1: Singles (Player A vs Player C)
  - Match 2: Singles (Player B vs Player D)  
  - Match 3: 2v2 Best Ball (all 4 players)

### For Scoring Calculations
- Scoring service can identify exact participants per match
- Properly handles individual vs team scoring based on actual match players
- Supports accurate handicap calculations per player

## Migration Path

### For Existing Databases
1. Run the migration: `mayhamapi/db/migrations/002_add_match_players.sql`
2. This will:
   - Create the `match_players` table
   - Backfill all existing matches with players from their pairings
   - Preserve existing data integrity

### For New Installations
- Schema in `golf_db_schema.sql` includes `match_players` table
- No migration needed - table created on first run

## API Changes

### New/Updated Endpoints

#### GET /api/v1/matches/:match_id/players
**Before:** Returned pairing players (deprecated)
**Now:** Returns match-specific players directly

**Response:**
```json
{
  "players": [
    {
      "id": "player-id",
      "match_id": "match-id",
      "user_id": "user-id",
      "team_id": "team-id",
      "player_order": 1,
      "user": {
        "id": "user-id",
        "name": "John Doe",
        "email": "john@example.com",
        "handicap": 12.5
      }
    }
  ]
}
```

#### GET /api/v1/rounds/:round_id/matches
**Enhanced:** Now includes `players` array in each match object

#### GET /api/v1/matches/:match_id
**Enhanced:** Now includes `players` array in match object

## Testing

### Database Migration
```bash
# Test migration on existing database
psql -U postgres -d mayham_golf -f mayhamapi/db/migrations/002_add_match_players.sql

# Verify match_players table exists
psql -U postgres -d mayham_golf -c "\d match_players"

# Check backfilled data
psql -U postgres -d mayham_golf -c "SELECT COUNT(*) FROM match_players;"
```

### Backend Tests
```bash
cd mayhamapi
make test-integration  # Run integration tests
make test-repo         # Run repository tests
```

### Frontend Type Checking
```bash
cd mayhamapi/frontend
npm run build  # TypeScript compilation
```

## Backward Compatibility

### Breaking Changes
- Frontend field name changed from `position` to `player_order`
- Must update any custom code referencing `match.match_players` to `match.players`

### Non-Breaking
- Database schema is additive (adds table, doesn't modify existing)
- Migration backfills existing data automatically
- API response structure expanded but existing fields unchanged

## Related Files

### Database
- `mayhamapi/db/golf_db_schema.sql` - Main schema with match_players table
- `mayhamapi/db/migrations/002_add_match_players.sql` - Migration file

### Backend
- `mayhamapi/models/models.go` - MatchPlayer model and Match.Players field
- `mayhamapi/repository/repository.go` - Match player CRUD methods
- `mayhamapi/handlers/tournament_handler.go` - GetMatchPlayers endpoint
- `mayhamapi/scoring/service.go` - Uses match players for scoring calculations

### Frontend
- `mayhamapi/frontend/src/services/api.ts` - TypeScript interfaces
- `mayhamapi/frontend/src/components/ScoreInterface.tsx` - Match player display
- `mayhamapi/frontend/src/components/Leaderboard.tsx` - Live match player display

## Future Enhancements

### Potential Features
1. **Custom Player Selection** - Allow admins to manually assign specific players to matches
2. **Substitutions** - Support player substitutions mid-tournament
3. **Player Statistics** - Track individual player performance across matches
4. **Head-to-Head Records** - Show historical matchups between specific players

### Performance Optimizations
1. **Eager Loading** - Consider loading match players in a single query vs per-match
2. **Caching** - Cache match player data for frequently accessed matches
3. **Indexing** - Add composite indexes if filtering by multiple columns becomes common

## Conclusion

This refactoring successfully restores the `match_players` table and integrates it throughout the application stack. The system now properly tracks which players participate in each match, enabling accurate display and scoring for both 1v1 and 2v2 match formats.

The changes maintain backward compatibility through automatic backfilling of existing data, while providing a clean path forward for more sophisticated player assignment and tracking features.

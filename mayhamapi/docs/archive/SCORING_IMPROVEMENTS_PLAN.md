# Scoring System Improvements - Implementation Plan

## Overview
This document outlines the comprehensive plan to fix and enhance the scoring system to properly handle:
1. Multiple matches per pairing with different hole ranges (6, 9, or 18 holes)
2. Different scoring input requirements per match format (team vs individual)
3. Tournament-level scoring method (gross vs Stableford)

## Current Issues
- Matches don't track which specific holes they cover (e.g., holes 1-6, 7-12, 13-18)
- Match formats don't specify whether they need individual or team scores
- Scoring interface assumes all players submit scores for all holes
- No support for Stableford scoring
- Hole results calculation doesn't properly map scores to correct match holes

---

## Phase 1: Database Schema Updates

### 1.1 Add Hole Range Tracking to Matches Table
**File:** `mayhamapi/db/golf_db_schema.sql`

**Changes:**
```sql
ALTER TABLE matches ADD COLUMN start_hole INT;
ALTER TABLE matches ADD COLUMN end_hole INT;
```

**Migration file:** Create `mayhamapi/db/migrations/001_add_match_hole_ranges.sql`

**Notes:**
- `start_hole`: First hole of the match (1-18)
- `end_hole`: Last hole of the match (1-18)
- For 6-hole matches: (1,6), (7,12), or (13,18)
- For 9-hole matches: (1,9) or (10,18)
- For 18-hole matches: (1,18)
- Add validation: `CHECK (start_hole >= 1 AND end_hole <= 18 AND start_hole <= end_hole)`

### 1.2 Update Match Formats Table
**File:** `mayhamapi/db/golf_db_schema.sql`

**Changes:**
```sql
ALTER TABLE match_formats ADD COLUMN score_input_type VARCHAR(20) DEFAULT 'individual';
-- Options: 'individual' or 'team'
-- individual: Each player submits their own score (match_play, best_ball, high_low)
-- team: One combined score per team (scramble, shamble, alternate_shot)
```

**Update existing data:**
```sql
UPDATE match_formats SET score_input_type = 'team' 
WHERE scoring_type IN ('scramble', 'shamble', 'alternate_shot');

UPDATE match_formats SET score_input_type = 'individual' 
WHERE scoring_type IN ('match_play', 'best_ball', 'high_low');
```

### 1.3 Add Tournament Scoring Method
**File:** `mayhamapi/db/golf_db_schema.sql`

**Changes:**
```sql
ALTER TABLE tournaments ADD COLUMN scoring_method VARCHAR(20) DEFAULT 'gross';
-- Options: 'gross' or 'stableford'
```

### 1.4 Add Stableford Points to Hole Scores (Optional - for display)
**File:** `mayhamapi/db/golf_db_schema.sql`

**Changes:**
```sql
ALTER TABLE hole_scores ADD COLUMN stableford_points INT;
-- Calculated based on strokes vs par and handicap
```

**Validation:**
- Ensure backward compatibility with existing data
- Add indexes if needed for performance

---

## Phase 2: Backend Models and Types

### 2.1 Update Go Models
**File:** `mayhamapi/models/models.go`

**Changes:**
```go
// Update Match struct
type Match struct {
    // ... existing fields ...
    StartHole       *int      `json:"start_hole,omitempty" db:"start_hole"`
    EndHole         *int      `json:"end_hole,omitempty" db:"end_hole"`
}

// Update MatchFormatEntity struct
type MatchFormatEntity struct {
    // ... existing fields ...
    ScoreInputType  string    `json:"score_input_type" db:"score_input_type"`
}

// Update Tournament struct
type Tournament struct {
    // ... existing fields ...
    ScoringMethod   string    `json:"scoring_method" db:"scoring_method"`
}

// Add Stableford calculation helper
type StablefordCalculator struct {
    Par      int
    Handicap int
    Strokes  int
}

func (s *StablefordCalculator) CalculatePoints() int {
    netScore := s.Strokes - s.Handicap
    diff := s.Par - netScore
    // Stableford points: +2 for eagle or better, +1 for birdie, 0 for par, etc.
    if diff >= 2 { return diff + 2 }
    if diff == 1 { return 2 }
    if diff == 0 { return 1 }
    return 0
}
```

### 2.2 Update Request DTOs
**File:** `mayhamapi/models/models.go`

**Changes:**
```go
type CreateMatchRequest struct {
    // ... existing fields ...
    StartHole       *int     `json:"start_hole,omitempty"`
    EndHole         *int     `json:"end_hole,omitempty"`
}

type CreateTournamentRequest struct {
    // ... existing fields ...
    ScoringMethod   string   `json:"scoring_method,omitempty"`
}

type PairingMatchRequest struct {
    // ... existing fields ...
    StartHole       *int     `json:"start_hole,omitempty"`
    EndHole         *int     `json:"end_hole,omitempty"`
}
```

---

## Phase 3: Repository Updates

### 3.1 Update Match Creation
**File:** `mayhamapi/repository/repository.go`

**Changes:**
- Update `CreateMatch` to accept and store `start_hole` and `end_hole`
- Update `CreateMatchForPairing` to accept and store hole ranges
- Update `GetMatch` and `GetMatchesByRound` to retrieve hole range data

**Code locations:**
```go
func (r *Repository) CreateMatchForPairing(...) {
    query := `
        INSERT INTO matches (..., start_hole, end_hole)
        VALUES (..., $9, $10)
        ...
    `
}
```

### 3.2 Update Tournament Creation
**File:** `mayhamapi/repository/repository.go`

**Changes:**
- Update `CreateTournament` to accept and store `scoring_method`
- Update `GetTournament` to retrieve scoring method

---

## Phase 4: Scoring Service Updates

### 4.1 Update Scoring Logic
**File:** `mayhamapi/scoring/service.go`

**Major changes needed:**
1. **Hole validation**: Only process scores for holes within match range
2. **Score filtering**: Filter scores by match hole range before calculation
3. **Stableford support**: Add Stableford calculation path
4. **Team vs Individual**: Handle different input types per format

**New methods:**
```go
func (s *ScoringService) filterScoresForMatch(match *Match, allScores []models.Score) []models.Score {
    filtered := []models.Score{}
    for _, score := range allScores {
        if score.HoleNumber >= *match.StartHole && score.HoleNumber <= *match.EndHole {
            filtered = append(filtered, score)
        }
    }
    return filtered
}

func (s *ScoringService) calculateStablefordPoints(score models.Score, par int, handicap int) int {
    // Implement Stableford calculation
    calc := StablefordCalculator{Par: par, Handicap: handicap, Strokes: score.Strokes}
    return calc.CalculatePoints()
}

func (s *ScoringService) CalculateAndStoreMatchResults(match *Match, scores []models.Score, tournament *models.Tournament) (*MatchStatus, error) {
    // Filter scores to only those in match hole range
    matchScores := s.filterScoresForMatch(match, scores)
    
    // Check scoring method
    if tournament.ScoringMethod == "stableford" {
        return s.calculateStablefordMatchResults(match, matchScores)
    }
    return s.calculateGrossMatchResults(match, matchScores)
}
```

### 4.2 Update Match Format Handling
**Changes:**
- Update each format calculation to respect `score_input_type`
- For 'team' formats: Expect only one score per team per hole
- For 'individual' formats: Expect each player to have a score

---

## Phase 5: API Handler Updates

### 5.1 Update Tournament Handler
**File:** `mayhamapi/handlers/tournament_handler.go`

**Changes:**
```go
func (h *TournamentHandler) CreateTournament(c *gin.Context) {
    // Accept scoring_method in request
    // Validate scoring_method is 'gross' or 'stableford'
    // Pass to repository
}

func (h *TournamentHandler) CreateMatch(c *gin.Context) {
    // Accept start_hole and end_hole in request
    // Validate hole ranges (1-18, start <= end)
    // Validate no overlapping holes in same pairing
    // Pass to repository
}
```

### 5.2 Update Scoring Handler
**File:** `mayhamapi/handlers/scoring_handler.go`

**Changes:**
```go
func (h *ScoringHandler) SubmitPairingScores(c *gin.Context) {
    // Load tournament to get scoring method
    // Load all matches for this pairing to determine which holes are active
    // Validate submitted holes are valid for at least one match
    // Process scores and update all affected matches
}

func (h *ScoringHandler) GetPairingScores(c *gin.Context) {
    // Return scores with Stableford points if tournament uses Stableford
    // Group scores by match if needed
}
```

### 5.3 Add New Validation Helper
**File:** `mayhamapi/handlers/validation.go` (new file)

```go
func ValidateMatchHoleRanges(matches []models.Match) error {
    // Ensure no overlapping hole ranges within same pairing
    // Ensure all holes are within 1-18
    // Return error if validation fails
}

func ValidateHoleForMatches(holeNumber int, matches []models.Match) bool {
    // Check if hole number is valid for at least one match
    for _, match := range matches {
        if holeNumber >= *match.StartHole && holeNumber <= *match.EndHole {
            return true
        }
    }
    return false
}
```

---

## Phase 6: Frontend - TypeScript Types

### 6.1 Update API Types
**File:** `mayhamapi/frontend/src/services/api.ts`

**Changes:**
```typescript
export interface Match {
  // ... existing fields ...
  start_hole?: number;
  end_hole?: number;
}

export interface MatchFormat {
  // ... existing fields ...
  score_input_type: 'individual' | 'team';
}

export interface Tournament {
  // ... existing fields ...
  scoring_method: 'gross' | 'stableford';
}

export interface CreateMatchRequest {
  // ... existing fields ...
  start_hole?: number;
  end_hole?: number;
}

export interface CreateTournamentRequest {
  // ... existing fields ...
  scoring_method?: 'gross' | 'stableford';
}

export interface PairingMatchRequest {
  // ... existing fields ...
  start_hole?: number;
  end_hole?: number;
}
```

---

## Phase 7: Frontend - Tournament Setup Updates

### 7.1 Add Scoring Method Selection
**File:** `mayhamapi/frontend/src/components/TournamentSetup.tsx`

**Changes in TournamentInfoStep:**
```typescript
// Add scoring method dropdown
<div>
  <label className="block text-sm font-medium mb-2">Scoring Method</label>
  <select
    value={tournament.scoring_method || 'gross'}
    onChange={(e) => setTournament({ ...tournament, scoring_method: e.target.value })}
    className="w-full p-3 border rounded-lg"
  >
    <option value="gross">Gross (Stroke Play)</option>
    <option value="stableford">Stableford</option>
  </select>
  <p className="text-xs text-gray-500 mt-1">
    Gross: Total strokes per hole. Stableford: Points based on score relative to par.
  </p>
</div>
```

### 7.2 Add Hole Range Selection for Matches
**File:** `mayhamapi/frontend/src/components/TournamentSetup.tsx`

**Changes in MatchConfig component:**
```typescript
// Add hole range selector (only show if holes < 18)
{match.holes < 18 && (
  <div className="col-span-3 mt-2">
    <label className="block text-xs font-medium mb-1">Hole Range</label>
    <select
      value={match.start_hole ? `${match.start_hole}-${match.end_hole}` : ''}
      onChange={(e) => {
        const [start, end] = e.target.value.split('-').map(Number);
        updateMatch(roundIdx, pairingIdx, matchIdx, 'start_hole', start);
        updateMatch(roundIdx, pairingIdx, matchIdx, 'end_hole', end);
      }}
      className="w-full p-2 border rounded text-sm"
    >
      <option value="">Select holes...</option>
      {match.holes === 6 && (
        <>
          <option value="1-6">Holes 1-6 (Front Six)</option>
          <option value="7-12">Holes 7-12 (Middle Six)</option>
          <option value="13-18">Holes 13-18 (Back Six)</option>
        </>
      )}
      {match.holes === 9 && (
        <>
          <option value="1-9">Holes 1-9 (Front Nine)</option>
          <option value="10-18">Holes 10-18 (Back Nine)</option>
        </>
      )}
    </select>
  </div>
)}
```

### 7.3 Update State Management
**Changes:**
```typescript
interface MatchData {
  // ... existing fields ...
  start_hole?: number;
  end_hole?: number;
}

// Update tournament state to include scoring_method
const [tournament, setTournament] = useState({
  // ... existing fields ...
  scoring_method: 'gross' as 'gross' | 'stableford'
});
```

### 7.4 Add Validation
```typescript
// Validate hole ranges before submission
const validateHoleRanges = (pairings: PairingData[]): string[] => {
  const errors: string[] = [];
  
  pairings.forEach((pairing, pIdx) => {
    const holeRanges: { start: number; end: number; matchIdx: number }[] = [];
    
    pairing.matches.forEach((match, mIdx) => {
      if (match.holes < 18 && (!match.start_hole || !match.end_hole)) {
        errors.push(`Pairing ${pairing.pairing_number}, Match ${mIdx + 1}: Please specify hole range`);
      }
      
      if (match.start_hole && match.end_hole) {
        // Check for overlaps
        holeRanges.forEach(existing => {
          if (!(match.end_hole! < existing.start || match.start_hole! > existing.end)) {
            errors.push(`Pairing ${pairing.pairing_number}: Match ${mIdx + 1} overlaps with Match ${existing.matchIdx + 1}`);
          }
        });
        holeRanges.push({ start: match.start_hole, end: match.end_hole, matchIdx: mIdx });
      }
    });
  });
  
  return errors;
};
```

---

## Phase 8: Frontend - Score Interface Updates

### 8.1 Update Score Display Logic
**File:** `mayhamapi/frontend/src/components/ScoreInterface.tsx`

**Major changes:**
1. **Load match format data** to determine `score_input_type`
2. **Filter holes by match** - only show holes within match range
3. **Adjust input fields** based on score_input_type:
   - Individual: Show input for each player
   - Team: Show single input per team
4. **Display Stableford points** if tournament uses Stableford

**Implementation:**
```typescript
// Determine which players need to enter scores
const getScoreInputsForMatch = (match: Match, format: MatchFormat) => {
  if (format.score_input_type === 'team') {
    // Return one input per team
    return [
      { teamId: match.team1_id, label: match.team1?.name || 'Team 1' },
      { teamId: match.team2_id, label: match.team2?.name || 'Team 2' }
    ];
  } else {
    // Return one input per player
    return pairing.players.map(player => ({
      playerId: player.user_id,
      label: player.user?.name || 'Player',
      teamId: player.team_id
    }));
  }
};

// Filter holes to show
const getHolesForMatch = (match: Match) => {
  const holes = [];
  const start = match.start_hole || 1;
  const end = match.end_hole || 18;
  for (let i = start; i <= end; i++) {
    holes.push(i);
  }
  return holes;
};

// Render score inputs per hole
{getHolesForMatch(selectedMatch).map(holeNumber => (
  <div key={holeNumber}>
    <h4>Hole {holeNumber}</h4>
    {getScoreInputsForMatch(selectedMatch, matchFormat).map(input => (
      <div key={input.playerId || input.teamId}>
        <label>{input.label}</label>
        <input
          type="number"
          value={scores[holeNumber]?.[input.playerId || input.teamId] || ''}
          onChange={(e) => handleScoreChange(holeNumber, input.playerId || input.teamId, e.target.value)}
        />
        {tournament.scoring_method === 'stableford' && (
          <span className="text-sm text-gray-600">
            ({calculateStablefordPoints(scores[holeNumber]?.[input.playerId || input.teamId], holePar, playerHandicap)} pts)
          </span>
        )}
      </div>
    ))}
  </div>
))}
```

### 8.2 Add Stableford Helper
```typescript
const calculateStablefordPoints = (strokes: number, par: number, handicap: number): number => {
  if (!strokes) return 0;
  const netScore = strokes - handicap;
  const diff = par - netScore;
  
  if (diff >= 2) return diff + 2; // Eagle or better
  if (diff === 1) return 2;       // Birdie
  if (diff === 0) return 1;       // Par
  return 0;                        // Bogey or worse
};
```

---

## Phase 9: Testing Strategy

### 9.1 Database Migration Testing
1. Test migration on clean database
2. Test migration with existing data
3. Verify rollback scripts work
4. Test with different PostgreSQL versions

### 9.2 Backend Unit Tests
**Create:** `mayhamapi/scoring/service_test.go`

Tests needed:
- Hole filtering for different match ranges
- Stableford calculation accuracy
- Team vs individual score handling
- Match overlap validation
- Edge cases (6-hole, 9-hole, 18-hole matches)

### 9.3 API Integration Tests
**Update:** `mayhamapi/integration_test.go`

Tests needed:
- Create tournament with Stableford scoring
- Create matches with hole ranges
- Submit scores for specific match holes
- Verify hole results calculated correctly per match
- Test overlapping hole prevention

### 9.4 Frontend Testing
Manual testing checklist:
- [ ] Can create tournament with Stableford scoring
- [ ] Can create 6-hole match and assign hole range
- [ ] Can create 9-hole match and assign hole range
- [ ] Cannot create overlapping matches
- [ ] Score interface shows correct holes per match
- [ ] Score interface shows correct input fields per format
- [ ] Stableford points display correctly
- [ ] Can submit scores for team formats
- [ ] Can submit scores for individual formats

---

## Phase 10: Documentation Updates

### 10.1 Update API Documentation
**Create:** `mayhamapi/docs/API_SCORING.md`

Document:
- Scoring method options
- Match hole range specification
- Score submission for team vs individual formats
- Stableford calculation formula
- Error codes for validation failures

### 10.2 Update User Guide
**Update:** `LANDING_PAGE_README.md` or create user docs

Explain:
- Difference between gross and Stableford
- How to set up matches with different hole ranges
- Which formats require team scores vs individual scores

### 10.3 Update Database Schema Docs
**Update:** `mayhamapi/ProjectStructure.md`

Document new columns and their purposes

---

## Implementation Order (Recommended)

### Sprint 1: Database & Models (1-2 days)
- [ ] Phase 1: Database schema updates
- [ ] Phase 2: Backend models
- [ ] Phase 3: Repository updates
- [ ] Create migration scripts
- [ ] Basic unit tests

### Sprint 2: Backend Logic (2-3 days)
- [ ] Phase 4: Scoring service updates
- [ ] Phase 5: API handler updates
- [ ] Validation helpers
- [ ] Integration tests

### Sprint 3: Frontend Types & API (1 day)
- [ ] Phase 6: TypeScript type updates
- [ ] Update API client methods
- [ ] Frontend validation helpers

### Sprint 4: Tournament Setup UI (2-3 days)
- [ ] Phase 7.1: Scoring method selector
- [ ] Phase 7.2: Hole range selector
- [ ] Phase 7.3: State management updates
- [ ] Phase 7.4: Frontend validation
- [ ] Testing

### Sprint 5: Score Interface UI (2-3 days)
- [ ] Phase 8.1: Score input logic updates
- [ ] Phase 8.2: Stableford display
- [ ] Team vs individual handling
- [ ] Testing

### Sprint 6: Testing & Documentation (1-2 days)
- [ ] Phase 9: Comprehensive testing
- [ ] Phase 10: Documentation
- [ ] Bug fixes
- [ ] Performance optimization

**Total estimated time:** 2-3 weeks for full implementation

---

## Migration Safety Checklist

Before deploying to production:
- [ ] Backup database
- [ ] Test migration on staging environment
- [ ] Verify existing tournaments still work
- [ ] Add default values for new columns
- [ ] Create rollback script
- [ ] Document breaking changes (if any)
- [ ] Update API version if needed

---

## Future Enhancements (Not in this plan)

- Match play concession logic (match ends when one team is mathematically eliminated)
- Modified Stableford scoring variations
- Handicap adjustments based on course difficulty
- Real-time Stableford leaderboard
- Mobile-optimized scoring interface
- Offline scoring support with sync

---

## Notes

- All database changes should be done via migration files for version control
- Maintain backward compatibility where possible
- Add feature flags for gradual rollout if needed
- Consider creating a "scoring calculator" utility class for reuse
- Keep gross scoring as default for existing tournaments
- Stableford calculation may need course/tee data (par per hole)

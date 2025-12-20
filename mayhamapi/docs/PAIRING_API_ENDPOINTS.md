# Pairing-Based API Endpoints

## Overview
The API has been refactored to support pairings - groups of players who play together in a round. Players enter scores once per pairing, and multiple match results are calculated from those scores.

## New Endpoints

### Pairings

#### Create Pairing
```
POST /api/v1/rounds/:round_id/pairings
```

**Request Body:**
```json
{
  "pairing_number": 1,
  "tee_time": "2025-06-15T09:00:00Z",
  "golf_course_tee_id": "uuid-here",
  "players": [
    {
      "user_id": "user-uuid-1",
      "team_id": "team-uuid-1",
      "player_order": 1
    },
    {
      "user_id": "user-uuid-2",
      "team_id": "team-uuid-2",
      "player_order": 2
    }
  ],
  "matches": [
    {
      "team1_id": "team-uuid-1",
      "team2_id": "team-uuid-2",
      "match_format_id": "format-uuid",
      "holes": 18,
      "points_available": 1.0
    }
  ]
}
```

**Response:** Pairing object with created matches

#### Get Pairings for Round
```
GET /api/v1/rounds/:round_id/pairings
```

**Response:**
```json
{
  "pairings": [
    {
      "id": "pairing-uuid",
      "round_id": "round-uuid",
      "pairing_number": 1,
      "tee_time": "2025-06-15T09:00:00Z",
      "golf_course_tee_id": "tee-uuid",
      "status": "not_started",
      "players": [...],
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### Get Specific Pairing
```
GET /api/v1/pairings/:pairing_id
```

**Response:** Single pairing object with players

#### Get Pairing Players
```
GET /api/v1/pairings/:pairing_id/players
```

**Response:**
```json
{
  "players": [
    {
      "id": "player-uuid",
      "pairing_id": "pairing-uuid",
      "user_id": "user-uuid",
      "team_id": "team-uuid",
      "player_order": 1,
      "user": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "handicap": 12.5
      },
      "team": {
        "id": "team-uuid",
        "name": "Team A",
        "color": "blue"
      }
    }
  ]
}
```

#### Get Pairing Matches
```
GET /api/v1/pairings/:pairing_id/matches
```

**Response:**
```json
{
  "matches": [
    {
      "id": "match-uuid",
      "pairing_id": "pairing-uuid",
      "round_id": "round-uuid",
      "team1_id": "team1-uuid",
      "team2_id": "team2-uuid",
      "match_format_id": "format-uuid",
      "match_number": 1,
      "holes": 18,
      "status": "in_progress",
      "team1_points": 2.5,
      "team2_points": 1.5
    }
  ]
}
```

### Scoring

#### Submit Scores for Pairing
```
POST /api/v1/pairings/:pairing_id/scores
```

**Request Body:**
```json
{
  "hole_number": 1,
  "scores": [
    {
      "user_id": "user-uuid-1",
      "strokes": 4
    },
    {
      "user_id": "user-uuid-2",
      "strokes": 5
    }
  ]
}
```

**Response:**
```json
{
  "scores": [...],
  "match_statuses": [
    {
      "match_id": "match-uuid",
      "match_status": {
        "team1_hole_points": 1.0,
        "team2_hole_points": 0.0,
        "team1_match_points": 3.0,
        "team2_match_points": 1.0,
        "holes_completed": 5,
        "holes_remaining": 13,
        "match_complete": false
      }
    }
  ]
}
```

**Note:** Submitting scores for a pairing automatically calculates and updates all match results for that pairing.

#### Get Pairing Scores
```
GET /api/v1/pairings/:pairing_id/scores
```

**Response:**
```json
{
  "scores": [
    {
      "id": "score-uuid",
      "pairing_id": "pairing-uuid",
      "user_id": "user-uuid",
      "hole_number": 1,
      "strokes": 4,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pairing": {...},
  "match_statuses": [...]
}
```

## Legacy Endpoints (Still Supported)

### Deprecated but Functional

#### Submit Scores by Match (Deprecated)
```
POST /api/v1/matches/:match_id/scores
```
Still works but internally finds the pairing and submits scores there.

#### Get Match Scores (Deprecated)
```
GET /api/v1/matches/:match_id/scores
```
Still works but internally gets scores from the pairing.

#### Get Match Players (Deprecated)
```
GET /api/v1/matches/:match_id/players
```
Still works but returns pairing players.

## Migration Guide

### Old Workflow (Match-Based)
1. Create matches in a round
2. Assign players to each match separately
3. Submit scores for each match
4. View scores per match

### New Workflow (Pairing-Based)
1. Create pairings in a round (includes players and matches)
2. Submit scores once for the pairing
3. All match results calculated automatically
4. View scores and match statuses per pairing

## Key Benefits

- **Single Score Entry**: Players enter their scores once for the entire round
- **Multiple Match Formats**: One pairing can have multiple matches (e.g., singles and team matches)
- **Automatic Calculation**: All match results are calculated from the same scorecard
- **Better UX**: Scorecard interface instead of separate match entries
- **Golf Standard**: Matches real-world golf workflow

## Example Use Case

A foursome with 2v2 team match:
1. Create pairing with 4 players (2 from each team)
2. Define matches within pairing (e.g., best ball, high-low)
3. Players enter their individual scores hole-by-hole
4. System automatically calculates:
   - Best ball results
   - High-low results
   - Individual match play results
   - Overall team points

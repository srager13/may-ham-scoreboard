# Golf Tournament Scoring API Documentation

**Version:** 2.0 (Scoring Improvements Update)  
**Last Updated:** December 27, 2025

## Overview

This document describes the enhanced scoring features added to the Mayham Golf Tournament API, including:
- **Stableford Scoring** - Points-based scoring system
- **Match Hole Ranges** - Ability to specify which holes a match covers (e.g., holes 1-6, 7-12, 13-18)
- **Team vs Individual Scoring** - Different score input requirements per match format

---

## Table of Contents

1. [Scoring Methods](#scoring-methods)
2. [Match Hole Ranges](#match-hole-ranges)
3. [Score Input Types](#score-input-types)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Examples](#examples)
6. [Validation Rules](#validation-rules)
7. [Error Codes](#error-codes)

---

## Scoring Methods

### Gross Scoring (Stroke Play)
- **Method:** `"gross"`
- **Description:** Traditional stroke play where lowest total strokes wins
- **Scoring:** Raw strokes without points conversion
- **Use Case:** Traditional stroke play tournaments

### Stableford Scoring (Points-Based)
- **Method:** `"stableford"`
- **Description:** Points awarded based on score relative to par
- **Scoring:** Points calculated per hole (0-5 range)
- **Use Case:** Tournaments where consistency is rewarded over low scores

#### Stableford Points Table

| Score vs Par | Points | Description |
|--------------|--------|-------------|
| -3 or better | 5      | Albatross or better |
| -2           | 4      | Eagle |
| -1           | 3      | Birdie |
| 0 (Par)      | 2      | Par |
| +1           | 1      | Bogey |
| +2 or worse  | 0      | Double bogey or worse |

**Formula:**
```
net_score = strokes - handicap_strokes
score_to_par = net_score - par
points = lookup_points_table(score_to_par)
```

---

## Match Hole Ranges

Matches can now be configured to cover specific hole ranges, enabling formats like:
- **Three 6-hole matches:** Holes 1-6, 7-12, 13-18
- **Two 9-hole matches:** Holes 1-9, 10-18
- **Full 18-hole match:** Holes 1-18 (default)

### Configuration

**Full 18 holes (default):**
```json
{
  "holes": 18,
  "start_hole": null,
  "end_hole": null
}
```

**Specific range:**
```json
{
  "holes": 6,
  "start_hole": 1,
  "end_hole": 6
}
```

### Rules
- `start_hole` and `end_hole` must both be provided or both omitted
- Both values must be between 1 and 18
- `start_hole` must be ≤ `end_hole`
- Calculated holes must match `(end_hole - start_hole + 1) = holes`

---

## Score Input Types

Match formats specify how scores should be entered:

### Individual Score Input
- **Type:** `"individual"`
- **Description:** Each player enters their own score
- **Formats:** Match Play, Best Ball, High-Low, Shamble
- **UI:** One input field per player
- **API:** Scores submitted with user IDs

**Example formats:**
```json
{
  "name": "Singles Match Play",
  "score_input_type": "individual"
}
```

### Team Score Input
- **Type:** `"team"`
- **Description:** One combined score per team
- **Formats:** Scramble, Alternate Shot
- **UI:** One input field per team
- **API:** Scores submitted with team IDs

**Example formats:**
```json
{
  "name": "2v2 Scramble",
  "score_input_type": "team"
}
```

---

## API Endpoints

### Tournament Management

#### Create Tournament
```http
POST /api/v1/tournaments
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Summer Stableford Cup",
  "description": "Points-based tournament",
  "start_date": "2025-07-01T00:00:00Z",
  "end_date": "2025-07-02T00:00:00Z",
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "scoring_method": "stableford"
}
```

**Response:** `201 Created`
```json
{
  "id": "tournament-uuid",
  "name": "Summer Stableford Cup",
  "scoring_method": "stableford",
  "status": "draft",
  "created_at": "2025-06-15T10:00:00Z",
  "updated_at": "2025-06-15T10:00:00Z"
}
```

**Validation:**
- `scoring_method` must be `"gross"` or `"stableford"`
- Defaults to `"gross"` if omitted

---

### Match Management

#### Create Pairing with Matches
```http
POST /api/v1/rounds/{round_id}/pairings
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (3 six-hole matches):**
```json
{
  "pairing_number": 1,
  "tee_time": "2025-07-01T08:00:00Z",
  "golf_course_tee_id": "tee-uuid",
  "players": [
    { "user_id": "user1-uuid", "team_id": "team1-uuid", "player_order": 1 },
    { "user_id": "user2-uuid", "team_id": "team1-uuid", "player_order": 2 },
    { "user_id": "user3-uuid", "team_id": "team2-uuid", "player_order": 3 },
    { "user_id": "user4-uuid", "team_id": "team2-uuid", "player_order": 4 }
  ],
  "matches": [
    {
      "team1_id": "team1-uuid",
      "team2_id": "team2-uuid",
      "match_format_id": "format-uuid",
      "holes": 6,
      "start_hole": 1,
      "end_hole": 6,
      "points_available": 1.0
    },
    {
      "team1_id": "team1-uuid",
      "team2_id": "team2-uuid",
      "match_format_id": "format-uuid",
      "holes": 6,
      "start_hole": 7,
      "end_hole": 12,
      "points_available": 1.0
    },
    {
      "team1_id": "team1-uuid",
      "team2_id": "team2-uuid",
      "match_format_id": "format-uuid",
      "holes": 6,
      "start_hole": 13,
      "end_hole": 18,
      "points_available": 1.0
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "pairing-uuid",
  "round_id": "round-uuid",
  "pairing_number": 1,
  "status": "not_started",
  "players": [...],
  "matches": [
    {
      "id": "match1-uuid",
      "holes": 6,
      "start_hole": 1,
      "end_hole": 6,
      "status": "not_started"
    },
    ...
  ]
}
```

---

### Score Submission

#### Submit Pairing Scores (Individual Format)
```http
POST /api/v1/pairings/{pairing_id}/scores
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "hole_number": 1,
  "scores": [
    { "user_id": "user1-uuid", "strokes": 4 },
    { "user_id": "user2-uuid", "strokes": 5 },
    { "user_id": "user3-uuid", "strokes": 3 },
    { "user_id": "user4-uuid", "strokes": 4 }
  ]
}
```

**Response:** `200 OK`
```json
{
  "message": "Scores submitted successfully",
  "hole_number": 1,
  "scores_saved": 4
}
```

**For Stableford Tournaments:**
Backend automatically calculates and stores Stableford points based on:
- Hole par
- Player strokes
- Player handicap (if available)

---

#### Submit Team Scores (Team Format)
```http
POST /api/v1/pairings/{pairing_id}/scores
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Scramble format):**
```json
{
  "hole_number": 1,
  "scores": [
    { "user_id": "team1-uuid", "strokes": 4 },
    { "user_id": "team2-uuid", "strokes": 5 }
  ]
}
```

**Note:** For team formats, use team IDs instead of user IDs.

---

#### Get Pairing Scores
```http
GET /api/v1/pairings/{pairing_id}/scores
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "scores": [
    {
      "id": "score-uuid",
      "pairing_id": "pairing-uuid",
      "user_id": "user1-uuid",
      "hole_number": 1,
      "strokes": 4,
      "stableford_points": 2,
      "created_at": "2025-07-01T08:15:00Z",
      "updated_at": "2025-07-01T08:15:00Z"
    },
    ...
  ]
}
```

**Fields:**
- `stableford_points`: Only present for Stableford tournaments; `null` for gross scoring

---

### Match Formats

#### Get All Match Formats
```http
GET /api/v1/match-formats
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "formats": [
    {
      "id": "format-uuid",
      "name": "Singles Match Play",
      "description": "One-on-one match play",
      "players_per_side": 1,
      "scoring_type": "match_play",
      "score_input_type": "individual",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "format-uuid-2",
      "name": "2v2 Scramble",
      "description": "Two-person team scramble format",
      "players_per_side": 2,
      "scoring_type": "scramble",
      "score_input_type": "team",
      "created_at": "2025-01-01T00:00:00Z"
    }
    ,
    {
      "id": "format-uuid-3",
      "name": "2v2 Combined Scores",
      "description": "Two-person teams: sum player scores per hole; higher sum wins for Stableford, lower sum wins for Gross",
      "players_per_side": 2,
      "scoring_type": "combined_scores",
      "score_input_type": "individual",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Score Input Types:**
- `"individual"` - Each player submits their own score
- `"team"` - One combined score per team

---

## Validation Rules

### Tournament Creation
- ✅ `scoring_method` must be `"gross"` or `"stableford"`
- ✅ Defaults to `"gross"` if not specified

### Match Creation
- ✅ If `start_hole` provided, `end_hole` must also be provided
- ✅ If `end_hole` provided, `start_hole` must also be provided
- ✅ `start_hole` must be between 1 and 18
- ✅ `end_hole` must be between 1 and 18
- ✅ `start_hole` must be ≤ `end_hole`
- ✅ For multiple matches in same pairing, hole ranges should not overlap (recommended)

### Score Submission
- ✅ `hole_number` must be between 1 and 18
- ✅ For individual formats: provide scores for all players in pairing
- ✅ For team formats: provide scores for all teams in match
- ✅ `strokes` must be ≥ 1

---

## Error Codes

### Validation Errors (400 Bad Request)

**Invalid Scoring Method:**
```json
{
  "error": "Invalid scoring_method. Must be 'gross' or 'stableford'"
}
```

**Invalid Hole Range:**
```json
{
  "error": "Match 1: start_hole must be less than or equal to end_hole"
}
```

**Out of Range Holes:**
```json
{
  "error": "Match 1: start_hole must be between 1 and 18"
}
```

**Missing Hole Range Component:**
```json
{
  "error": "Match 1: Both start_hole and end_hole must be provided together, or neither"
}
```

### Authentication Errors (401 Unauthorized)
```json
{
  "error": "Authorization header required"
}
```

### Not Found Errors (404 Not Found)
```json
{
  "error": "Tournament not found"
}
```

---

## Best Practices

### Tournament Setup
1. Choose scoring method (`gross` or `stableford`) at tournament creation
2. Cannot change scoring method after tournament created
3. Create teams before creating rounds and pairings

### Match Configuration
1. For 18-hole matches, omit `start_hole` and `end_hole`
2. For partial matches, specify exact hole ranges
3. Ensure hole ranges don't overlap if running concurrent matches
4. Consider player rest when scheduling back-to-back matches

### Score Entry
1. Check match format's `score_input_type` before displaying UI
2. For team formats, submit one score per team (not per player)
3. For individual formats, submit score for each player
4. Stableford points calculated automatically by backend
5. Submit scores incrementally (hole by hole) for live scoring

### Performance
1. Use indexes on hole ranges for efficient querying
2. Cache match format information to reduce API calls
3. Load scores incrementally rather than all at once

---

## Migration Guide

If you have existing tournaments created before this update:

1. **Existing tournaments** default to `"gross"` scoring
2. **Existing matches** without hole ranges work as 18-hole matches
3. **No data migration required** - new columns have sensible defaults
4. **Backward compatible** - old API requests still work

---

## Support

For questions or issues:
- See main README.md for setup instructions
- Check TESTING.md for integration test examples
- Review ProjectStructure.md for architecture details

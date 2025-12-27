# Database Migration Guide

## Migration 001: Scoring Improvements

### What This Migration Does

This migration adds support for:
1. **Match hole ranges** - Tracks which specific holes (1-18) each match covers
2. **Score input types** - Defines whether a match format needs individual or team scores
3. **Tournament scoring methods** - Supports both gross (stroke play) and Stableford scoring
4. **Stableford points storage** - Optional column to cache calculated Stableford points

### Changes Made

#### Tables Modified

**tournaments**
- Added: `scoring_method` VARCHAR(20) DEFAULT 'gross'
- Values: 'gross' or 'stableford'

**matches**
- Added: `start_hole` INT (nullable)
- Added: `end_hole` INT (nullable)
- Added: CHECK constraint for hole range validation

**match_formats**
- Added: `score_input_type` VARCHAR(20) DEFAULT 'individual'
- Values: 'individual' or 'team'
- Updated existing records based on scoring_type

**hole_scores**
- Added: `stableford_points` INT (nullable)

#### Indexes Added
- `idx_matches_hole_range` - For efficient hole range queries
- `idx_hole_scores_stableford` - For Stableford scoring queries

### How to Apply

#### Option 1: Fresh Database (Recommended for Development)

If you're okay with losing existing data:

```bash
cd /root/may-ham-scoreboard/mayhamapi

# Reset the database using the updated schema
psql -U postgres -d mayham_golf -f db/reset_database.sql
```

The main schema file (`golf_db_schema.sql`) has been updated to include all new columns, so fresh installs will have everything.

#### Option 2: Apply Migration to Existing Database

If you need to preserve existing data:

```bash
cd /root/may-ham-scoreboard/mayhamapi

# Apply the migration
psql -U postgres -d mayham_golf -f db/migrations/001_add_scoring_improvements.sql
```

### Verification

After applying the migration, verify the changes:

```sql
-- Check tournaments table
\d tournaments

-- Check matches table  
\d matches

-- Check match_formats table
\d match_formats

-- Check hole_scores table
\d hole_scores

-- Verify match format updates
SELECT name, scoring_type, score_input_type FROM match_formats;
```

Expected output for match_formats:
```
         name          | scoring_type  | score_input_type 
-----------------------+---------------+------------------
 Singles Match Play    | match_play    | individual
 2v2 Scramble          | scramble      | team
 2v2 Best Ball         | best_ball     | individual
 2v2 Alternate Shot    | alternate_shot| team
 High-Low              | high_low      | individual
 Shamble               | shamble       | team
```

### Backward Compatibility

- All new columns are nullable or have defaults
- Existing tournaments default to 'gross' scoring
- Existing matches work without hole ranges (NULL values allowed)
- Match formats default to 'individual' score input
- No breaking changes to existing APIs (yet - Phase 2 will update handlers)

### Rollback

If you need to rollback this migration:

```sql
-- Remove new columns
ALTER TABLE tournaments DROP COLUMN IF EXISTS scoring_method;
ALTER TABLE matches DROP COLUMN IF EXISTS start_hole;
ALTER TABLE matches DROP COLUMN IF EXISTS end_hole;
ALTER TABLE match_formats DROP COLUMN IF EXISTS score_input_type;
ALTER TABLE hole_scores DROP COLUMN IF EXISTS stableford_points;

-- Remove indexes
DROP INDEX IF EXISTS idx_matches_hole_range;
DROP INDEX IF EXISTS idx_hole_scores_stableford;

-- Remove constraints
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS check_scoring_method;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS check_hole_range;
ALTER TABLE match_formats DROP CONSTRAINT IF EXISTS check_score_input_type;
```

### Next Steps

After applying this migration:
1. ✅ Database schema updated
2. ⏭️ Next: Phase 2 - Update Go models to use new columns
3. ⏭️ Then: Phase 3 - Update repository methods
4. ⏭️ Then: Phase 4 - Update scoring service logic

See `SCORING_IMPROVEMENTS_PLAN.md` for the complete implementation roadmap.

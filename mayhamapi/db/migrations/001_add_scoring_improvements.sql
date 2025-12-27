-- Migration: Add Scoring Improvements
-- Adds support for:
-- - Match hole ranges (start_hole, end_hole)
-- - Match format score input types (individual vs team)
-- - Tournament scoring methods (gross vs stableford)
-- - Stableford points storage

-- Add hole range tracking to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS start_hole INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_hole INT;

-- Add validation constraint for hole ranges
ALTER TABLE matches DROP CONSTRAINT IF EXISTS check_hole_range;
ALTER TABLE matches ADD CONSTRAINT check_hole_range 
    CHECK (
        (start_hole IS NULL AND end_hole IS NULL) OR
        (start_hole >= 1 AND end_hole <= 18 AND start_hole <= end_hole)
    );

-- Add score input type to match formats
ALTER TABLE match_formats ADD COLUMN IF NOT EXISTS score_input_type VARCHAR(20) DEFAULT 'individual';

-- Add constraint for score_input_type
ALTER TABLE match_formats DROP CONSTRAINT IF EXISTS check_score_input_type;
ALTER TABLE match_formats ADD CONSTRAINT check_score_input_type 
    CHECK (score_input_type IN ('individual', 'team'));

-- Update existing match formats with correct score input types
UPDATE match_formats SET score_input_type = 'team' 
WHERE scoring_type IN ('scramble', 'shamble', 'alternate_shot')
AND score_input_type = 'individual';

UPDATE match_formats SET score_input_type = 'individual' 
WHERE scoring_type IN ('match_play', 'best_ball', 'high_low')
AND (score_input_type IS NULL OR score_input_type = 'team');

-- Add scoring method to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_method VARCHAR(20) DEFAULT 'gross';

-- Add constraint for scoring_method
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS check_scoring_method;
ALTER TABLE tournaments ADD CONSTRAINT check_scoring_method 
    CHECK (scoring_method IN ('gross', 'stableford'));

-- Add stableford points to hole scores (optional - for display/caching)
ALTER TABLE hole_scores ADD COLUMN IF NOT EXISTS stableford_points INT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_hole_range ON matches(start_hole, end_hole) WHERE start_hole IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hole_scores_stableford ON hole_scores(stableford_points) WHERE stableford_points IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN matches.start_hole IS 'First hole of the match (1-18). NULL for 18-hole matches or legacy data.';
COMMENT ON COLUMN matches.end_hole IS 'Last hole of the match (1-18). NULL for 18-hole matches or legacy data.';
COMMENT ON COLUMN match_formats.score_input_type IS 'Whether format requires individual player scores or one team score: individual or team';
COMMENT ON COLUMN tournaments.scoring_method IS 'Scoring method for tournament: gross (stroke play) or stableford (points)';
COMMENT ON COLUMN hole_scores.stableford_points IS 'Stableford points for this hole (calculated from strokes, par, handicap). NULL if tournament uses gross scoring.';

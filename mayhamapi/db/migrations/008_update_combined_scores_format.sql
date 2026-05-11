-- Migration: Rename existing '2v2 Combined Scores' to '2v2 Combined Scores - Match Play'
-- and add cumulative combined-scores format for gross/stableford aggregate scoring

-- Update existing name if present, but only when the target name does not already exist
UPDATE match_formats
SET name = '2v2 Combined Scores - Match Play',
    description = 'Two-person teams: sum player scores per hole; higher sum wins for Stableford, lower sum wins for Gross (hole-by-hole match play)'
WHERE scoring_type = 'combined_scores'
  AND name = '2v2 Combined Scores'
  AND NOT EXISTS (
    SELECT 1 FROM match_formats mf2 WHERE mf2.name = '2v2 Combined Scores - Match Play'
  );

-- Insert new cumulative combined-scores format
INSERT INTO match_formats (name, description, players_per_side, scoring_type, score_input_type)
VALUES ('2v2 Combined Scores - Gross Score/Points', 'Two-person teams: aggregate combined strokes (gross) or combined Stableford points (stableford) across all holes; lower total wins for Gross, higher total wins for Stableford', 2, 'combined_scores_total', 'individual')
ON CONFLICT (name) DO NOTHING;

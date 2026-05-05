-- Migration: Add 2v2 Combined Scores match format
-- Inserts the new match format if it does not already exist
INSERT INTO match_formats (name, description, players_per_side, scoring_type, score_input_type)
VALUES ('2v2 Combined Scores', 'Two-person teams: sum player scores per hole; higher sum wins for Stableford, lower sum wins for Gross', 2, 'combined_scores', 'individual')
ON CONFLICT (name) DO NOTHING;

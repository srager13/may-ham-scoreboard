-- Migration: Add match_players table
-- This table tracks which specific players from a pairing participate in each match
-- Needed to support both 1v1 and 2v2 match formats within the same pairing

-- Create match_players table
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    player_order INT, -- position within the match (1-4 for most formats)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);

-- Backfill existing matches with players from their pairings
-- This assumes all players in a pairing participate in all matches
INSERT INTO match_players (match_id, user_id, team_id, player_order)
SELECT DISTINCT 
    m.id as match_id,
    pp.user_id,
    pp.team_id,
    pp.player_order
FROM matches m
INNER JOIN pairing_players pp ON m.pairing_id = pp.pairing_id
WHERE m.pairing_id IS NOT NULL
ON CONFLICT (match_id, user_id) DO NOTHING;

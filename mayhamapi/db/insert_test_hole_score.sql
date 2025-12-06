-- Insert test hole scores for all players in a match
-- Replace 'your-match-id-here' with an actual match ID from your database

WITH match_info AS (
    SELECT id as match_id, holes
    FROM matches 
    WHERE id = '5cddbe98-746b-4501-b870-f67dd859e538'  -- Replace with actual match ID
),
match_players_list AS (
    SELECT mp.user_id, mi.match_id, mi.holes
    FROM match_players mp
    CROSS JOIN match_info mi
    WHERE mp.match_id = mi.match_id
),
hole_numbers AS (
    SELECT generate_series(1, (SELECT holes FROM match_info)) as hole_number
),
player_holes AS (
    SELECT 
        mpl.user_id,
        mpl.match_id,
        hn.hole_number
    FROM match_players_list mpl
    CROSS JOIN hole_numbers hn
)
INSERT INTO hole_scores (match_id, user_id, hole_number, strokes, created_at, updated_at)
SELECT 
    ph.match_id,
    ph.user_id,
    ph.hole_number,
    -- Generate realistic golf scores (3-8 strokes, weighted toward par scores)
    CASE 
        WHEN random() < 0.05 THEN 3  -- Eagle (5%)
        WHEN random() < 0.25 THEN 4  -- Birdie/Par (20%)
        WHEN random() < 0.65 THEN 5  -- Par/Bogey (40%)
        WHEN random() < 0.85 THEN 6  -- Bogey/Double (20%)
        WHEN random() < 0.95 THEN 7  -- Double/Triple (10%)
        ELSE 8                       -- Worse (5%)
    END as strokes,
    NOW() as created_at,
    NOW() as updated_at
FROM player_holes ph
ON CONFLICT (match_id, hole_number, user_id) 
DO UPDATE SET 
    strokes = EXCLUDED.strokes,
    updated_at = NOW();
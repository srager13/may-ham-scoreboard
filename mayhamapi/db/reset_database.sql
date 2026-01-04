-- Reset Database for Development
-- This script clears all data

-- Clear all tables (in order to respect foreign key constraints)
-- Most dependent tables first, working backwards to independent tables
TRUNCATE TABLE hole_results CASCADE;
TRUNCATE TABLE hole_scores CASCADE;
TRUNCATE TABLE match_players CASCADE;
TRUNCATE TABLE matches CASCADE;
TRUNCATE TABLE pairing_players CASCADE;
TRUNCATE TABLE pairings CASCADE;
TRUNCATE TABLE rounds CASCADE;
TRUNCATE TABLE team_members CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE tournaments CASCADE;
TRUNCATE TABLE group_members CASCADE;
TRUNCATE TABLE groups CASCADE;
TRUNCATE TABLE golf_course_holes CASCADE;
TRUNCATE TABLE golf_course_tees CASCADE;
TRUNCATE TABLE golf_courses CASCADE;
TRUNCATE TABLE player_stats CASCADE;
TRUNCATE TABLE match_formats CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reset sequences (if any auto-increment fields exist)
-- Note: Using UUID primary keys, so no sequences to reset
-- Sample match formats data
INSERT INTO match_formats (name, description, players_per_side, scoring_type) VALUES
    ('Singles Match Play', 'One-on-one match play', 1, 'match_play'),
    ('2v2 Scramble', 'Two-person team scramble format', 2, 'scramble'),
    ('2v2 Best Ball', 'Two-person team best ball', 2, 'best_ball'),
    ('2v2 Alternate Shot', 'Two-person alternate shot', 2, 'alternate_shot'),
    ('High-Low', 'Best and worst score combination', 2, 'high_low'),
    ('Shamble', 'Drive scramble, then individual play', 2, 'shamble')
ON CONFLICT (name) DO NOTHING;
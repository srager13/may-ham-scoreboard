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
-- TRUNCATE TABLE golf_course_holes CASCADE;
-- TRUNCATE TABLE golf_course_tees CASCADE;
-- TRUNCATE TABLE golf_courses CASCADE;
TRUNCATE TABLE player_stats CASCADE;
TRUNCATE TABLE match_formats CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reset sequences (if any auto-increment fields exist)
-- Note: Using UUID primary keys, so no sequences to reset
-- Sample match formats data
INSERT INTO match_formats (name, description, players_per_side, scoring_type, score_input_type) VALUES
    ('Singles Match Play', 'One-on-one match play', 1, 'match_play', 'individual'),
    ('2v2 Scramble', 'Two-person team scramble format', 2, 'scramble', 'team'),
    ('2v2 Best Ball', 'Two-person team best ball', 2, 'best_ball', 'individual'),
    ('2v2 Alternate Shot', 'Two-person alternate shot', 2, 'alternate_shot', 'team'),
    ('High-Low', 'Two-on-two, one point for best low score and better of each team''s higher score', 2, 'high_low', 'individual'),
    ('Shamble', 'Drive scramble, then individual play', 2, 'shamble', 'team')
ON CONFLICT (name) DO NOTHING;

-- Add test users
INSERT INTO users (email, name, password_hash, handicap, is_admin, created_at, updated_at) VALUES
    ('srager13@gmail.com', 'Scott Rager', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 12.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.riffle@mayhamgolf.com', 'Sean Riffle', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 2.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('michael.kearns@mayhamgolf.com', 'Michael Kearns', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 15.0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kyle.dowler@mayhamgolf.com', 'Kyle Dowler', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 9.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremy.virgin@mayhamgolf.com', 'Jeremy Virgin', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 14.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.lohrer@mayhamgolf.com', 'Sean Lohrer', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 15.1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rob.lessig@mayhamgolf.com', 'Rob Lessig', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 2.6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.riffle@mayhamgolf.com', 'Brian Riffle', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 10.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('alan.waters@mayhamgolf.com', 'Alan Waters', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 0.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.marquette@mayhamgolf.com', 'Brian Marquette', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 1.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kevin.kilgour@mayhamgolf.com', 'Kevin Kilgour', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 13.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('marty.gudewicz@mayhamgolf.com', 'Marty Gudewicz', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jay.gudewicz@mayhamgolf.com', 'Jay Gudewicz', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jared.moser@mayhamgolf.com', 'Jared Moser', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 8.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremey.teckmeyer@mayhamgolf.com', 'Jeremy Teckmeyer', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 14.3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('garrett.herbert@mayhamgolf.com', 'Garrett Herbert', '$2a$12$gd6/cw4AdEkg/gfktz4.a.xOa4sdhGS0koS8TGpkYl3s5x5zPalAO', 16.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    -- ('justin.fleischmann@mayhamgolf.com', 'Justin Fleischmann', 5.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    -- ('brett.reimann@mayhamgolf.com', 'Brett Reimann', 15.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    handicap = EXCLUDED.handicap,
    is_admin = EXCLUDED.is_admin,
    updated_at = CURRENT_TIMESTAMP;
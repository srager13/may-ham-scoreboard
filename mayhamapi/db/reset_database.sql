-- Reset Database for Development
-- This script clears all data and adds test users

-- Clear all tables (in order to respect foreign key constraints)
-- Most dependent tables first, working backwards to independent tables
TRUNCATE TABLE hole_results CASCADE;
TRUNCATE TABLE hole_scores CASCADE;
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

-- Add test users
INSERT INTO users (email, name, handicap, is_admin, created_at, updated_at) VALUES
    ('scott.rager@mayhamgolf.com', 'Scott Rager', 12.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.riffle@mayhamgolf.com', 'Sean Riffle', 2.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('michael.kearns@mayhamgolf.com', 'Michael Kearns', 15.0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kyle.dowler@mayhamgolf.com', 'Kyle Dowler', 9.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremy.virgin@mayhamgolf.com', 'Jeremy Virgin', 14.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.lohrer@mayhamgolf.com', 'Sean Lohrer', 15.1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rob.lessig@mayhamgolf.com', 'Rob Lessig', 2.6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.riffle@mayhamgolf.com', 'Brian Riffle', 10.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('alan.waters@mayhamgolf.com', 'Alan Waters', 0.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.marquette@mayhamgolf.com', 'Brian Marquette', 1.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kevin.kilgour@mayhamgolf.com', 'Kevin Kilgour', 13.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Note: Passwords are handled by the authentication system, not stored in the database
-- To set passwords to "mayham", you'll need to register these users through the API
-- or create password hashes if your system stores them

-- Display the created users
SELECT id, email, name, handicap, is_admin, created_at FROM users ORDER BY created_at;
-- Reset Database for Development
-- This script clears all data and adds test users

-- Clear all tables (in order to respect foreign key constraints)
TRUNCATE TABLE hole_results CASCADE;
TRUNCATE TABLE hole_scores CASCADE;
TRUNCATE TABLE match_players CASCADE;
TRUNCATE TABLE matches CASCADE;
TRUNCATE TABLE rounds CASCADE;
TRUNCATE TABLE team_members CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE tournaments CASCADE;
TRUNCATE TABLE player_stats CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reset sequences (if any auto-increment fields exist)
-- Note: Using UUID primary keys, so no sequences to reset

-- Add test users
INSERT INTO users (email, name, handicap, is_admin, created_at, updated_at) VALUES
    ('scott.rager@mayhamgolf.com', 'Scott Rager', 12.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.riffle@mayhamgolf.com', 'Sean Riffle', 8.2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('michael.kearns@mayhamgolf.com', 'Michael Kearns', 15.0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kyle.dowler@mayhamgolf.com', 'Kyle Dowler', 9.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Note: Passwords are handled by the authentication system, not stored in the database
-- To set passwords to "mayham", you'll need to register these users through the API
-- or create password hashes if your system stores them

-- Display the created users
SELECT id, email, name, handicap, is_admin, created_at FROM users ORDER BY created_at;
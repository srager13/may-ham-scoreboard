
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
    ('kevin.kilgour@mayhamgolf.com', 'Kevin Kilgour', 13.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('marty.gudewicz@mayhamgolf.com', 'Marty Gudewicz', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jay.gudewicz@mayhamgolf.com', 'Jay Gudewicz', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jared.moser@mayhamgolf.com', 'Jared Moser', 8.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremey.teckmeyer@mayhamgolf.com', 'Jeremy Teckmeyer', 14.3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('garrett.herbert@mayhamgolf.com', 'Garrett Herbert', 16.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    -- ('justin.fleischmann@mayhamgolf.com', 'Justin Fleischmann', 5.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    -- ('brett.reimann@mayhamgolf.com', 'Brett Reimann', 15.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    handicap = EXCLUDED.handicap,
    is_admin = EXCLUDED.is_admin,
    updated_at = CURRENT_TIMESTAMP;

-- Note: Passwords are handled by the authentication system, not stored in the database
-- To set passwords to "mayham", you'll need to register these users through the API
-- or create password hashes if your system stores them

-- Display the created users
SELECT id, email, name, handicap, is_admin, created_at FROM users ORDER BY created_at;
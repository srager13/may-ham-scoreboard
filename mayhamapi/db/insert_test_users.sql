
-- Add test users
-- Default password for all seed users: "mayham"
-- Hash generated with bcrypt cost 12 via golang.org/x/crypto/bcrypt.
-- To generate a new hash: bcrypt.GenerateFromPassword([]byte("mayham"), 12)
INSERT INTO users (email, name, password_hash, handicap, is_admin, created_at, updated_at) VALUES
    ('scott.rager@mayhamgolf.com', 'Scott Rager', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 12.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.riffle@mayhamgolf.com', 'Sean Riffle', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 2.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('michael.kearns@mayhamgolf.com', 'Michael Kearns', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 15.0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kyle.dowler@mayhamgolf.com', 'Kyle Dowler', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 9.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremy.virgin@mayhamgolf.com', 'Jeremy Virgin', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 14.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sean.lohrer@mayhamgolf.com', 'Sean Lohrer', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 15.1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rob.lessig@mayhamgolf.com', 'Rob Lessig', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 2.6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.riffle@mayhamgolf.com', 'Brian Riffle', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 10.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('alan.waters@mayhamgolf.com', 'Alan Waters', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 0.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('brian.marquette@mayhamgolf.com', 'Brian Marquette', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 1.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('kevin.kilgour@mayhamgolf.com', 'Kevin Kilgour', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 13.9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('marty.gudewicz@mayhamgolf.com', 'Marty Gudewicz', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jay.gudewicz@mayhamgolf.com', 'Jay Gudewicz', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 11.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jared.moser@mayhamgolf.com', 'Jared Moser', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 8.4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('jeremey.teckmeyer@mayhamgolf.com', 'Jeremy Teckmeyer', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 14.3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('garrett.herbert@mayhamgolf.com', 'Garrett Herbert', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 16.5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    -- ('justin.fleischmann@mayhamgolf.com', 'Justin Fleischmann', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 5.2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    -- ('brett.reimann@mayhamgolf.com', 'Brett Reimann', '$2a$12$PWpYH6H0EZ.G6lqBSdw0kurDM8rMKrfiDO85gS7lY4NaMO6g03Hf.', 15.7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    handicap = EXCLUDED.handicap,
    is_admin = EXCLUDED.is_admin,
    updated_at = CURRENT_TIMESTAMP;

-- Display the created users
SELECT id, email, name, handicap, is_admin, created_at FROM users ORDER BY created_at;

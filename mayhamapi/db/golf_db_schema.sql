-- Golf Tournament Management Database Schema

-- Users/Players
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    handicap DECIMAL(4,1),
    is_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups (collections of users who can participate in tournaments together)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group memberships (users can belong to multiple groups)
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- member, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Tournaments (e.g., "Summer Ryder Cup 2025")
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    group_id UUID REFERENCES groups(id),
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed
    scoring_method VARCHAR(20) DEFAULT 'gross' CHECK (scoring_method IN ('gross', 'stableford')), -- gross: stroke play, stableford: points-based
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams within a tournament
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50), -- for UI display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players assigned to teams for a tournament
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Golf Courses
CREATE TABLE IF NOT EXISTS golf_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id INT UNIQUE, -- ID from golfcourseapi.com
    club_name VARCHAR(255) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Golf Course Tees (different tee boxes for a course)
CREATE TABLE IF NOT EXISTS golf_course_tees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES golf_courses(id) ON DELETE CASCADE,
    tee_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20), -- male, female
    course_rating DECIMAL(4, 1),
    slope_rating INT,
    bogey_rating DECIMAL(4, 1),
    total_yards INT,
    total_meters INT,
    number_of_holes INT,
    par_total INT,
    front_course_rating DECIMAL(4, 1),
    front_slope_rating INT,
    front_bogey_rating DECIMAL(4, 1),
    back_course_rating DECIMAL(4, 1),
    back_slope_rating INT,
    back_bogey_rating DECIMAL(4, 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, tee_name, gender)
);

-- Golf Course Holes (hole details for each tee)
CREATE TABLE IF NOT EXISTS golf_course_holes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tee_id UUID REFERENCES golf_course_tees(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    par INT NOT NULL,
    yards INT,
    meters INT,
    handicap INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tee_id, hole_number)
);

-- Rounds within a tournament (e.g., "Friday Morning", "Saturday Afternoon")
CREATE TABLE IF NOT EXISTS rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    golf_course_id UUID REFERENCES golf_courses(id),
    name VARCHAR(255) NOT NULL,
    round_number INT NOT NULL,
    round_date DATE NOT NULL,
    start_time TIMESTAMP, -- optional tee time
    status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, in_progress, completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, round_number)
);

-- Pairings (groupings of players playing together in a round)
CREATE TABLE IF NOT EXISTS pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    pairing_number INT NOT NULL, -- order within the round
    tee_time TIMESTAMP, -- scheduled tee time for this group
    golf_course_tee_id UUID REFERENCES golf_course_tees(id), -- which tee box they're playing from
    status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(round_id, pairing_number)
);

-- Players in a pairing (the physical group playing together)
CREATE TABLE IF NOT EXISTS pairing_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    player_order INT, -- order in the pairing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pairing_id, user_id)
);

-- Match formats/types
CREATE TABLE IF NOT EXISTS match_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., "2v2 Scramble", "Singles Match Play", "High-Low"
    description TEXT,
    players_per_side INT NOT NULL, -- 1 for singles, 2 for pairs
    scoring_type VARCHAR(50) NOT NULL, -- match_play, stroke_play, scramble, shamble, high_low
    score_input_type VARCHAR(20) DEFAULT 'individual' CHECK (score_input_type IN ('individual', 'team')), -- individual: each player scores, team: one score per team
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches within a pairing (multiple match results can be calculated from one pairing)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE, -- kept for easier querying
    match_format_id UUID REFERENCES match_formats(id),
    match_number INT NOT NULL, -- order within the pairing
    holes INT NOT NULL, -- 6, 9, or 18
    start_hole INT, -- first hole of match (1-18), NULL for 18-hole or legacy
    end_hole INT, -- last hole of match (1-18), NULL for 18-hole or legacy
    status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, completed
    team1_id UUID REFERENCES teams(id),
    team2_id UUID REFERENCES teams(id),
    points_available DECIMAL(3,1) DEFAULT 1.0, -- typically 1 point per match
    team1_points DECIMAL(3,1) DEFAULT 0,
    team2_points DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pairing_id, match_number),
    CHECK ((start_hole IS NULL AND end_hole IS NULL) OR (start_hole >= 1 AND end_hole <= 18 AND start_hole <= end_hole))
);

-- Match players (specific players participating in each match)
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    player_order INT, -- position within the match (1-4 for most formats)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, user_id)
);

-- Hole-by-hole scores
CREATE TABLE IF NOT EXISTS hole_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    user_id UUID REFERENCES users(id),
    strokes INT NOT NULL,
    par INT, -- cached par for easier scoring stats
    stableford_points INT, -- Stableford points (calculated from strokes vs par/handicap), NULL if using gross scoring
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pairing_id, hole_number, user_id)
);

-- Hole results (who won each hole)
CREATE TABLE IF NOT EXISTS hole_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    team1_score INT, -- team score for this hole (after format logic applied)
    team2_score INT,
    winner_team_id UUID REFERENCES teams(id), -- NULL for tie
    team1_points DECIMAL(3,1) DEFAULT 0, -- points earned on this hole
    team2_points DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, hole_number)
);

-- Player statistics/leaderboard
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    matches_played INT DEFAULT 0,
    points_won DECIMAL(5,2) DEFAULT 0,
    points_lost DECIMAL(5,2) DEFAULT 0,
    holes_won INT DEFAULT 0,
    holes_lost INT DEFAULT 0,
    holes_tied INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_group ON tournaments(group_id);
CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON rounds(tournament_id, round_number);
CREATE INDEX IF NOT EXISTS idx_rounds_course ON rounds(golf_course_id);
CREATE INDEX IF NOT EXISTS idx_pairings_round ON pairings(round_id);
CREATE INDEX IF NOT EXISTS idx_pairing_players_pairing ON pairing_players(pairing_id);
CREATE INDEX IF NOT EXISTS idx_pairing_players_user ON pairing_players(user_id);
CREATE INDEX IF NOT EXISTS idx_golf_course_tees_course ON golf_course_tees(course_id);
CREATE INDEX IF NOT EXISTS idx_golf_course_holes_tee ON golf_course_holes(tee_id);
CREATE INDEX IF NOT EXISTS idx_matches_pairing ON matches(pairing_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round_id);
CREATE INDEX IF NOT EXISTS idx_matches_hole_range ON matches(start_hole, end_hole) WHERE start_hole IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_pairing ON hole_scores(pairing_id, hole_number);
CREATE INDEX IF NOT EXISTS idx_hole_scores_stableford ON hole_scores(stableford_points) WHERE stableford_points IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hole_results_match ON hole_results(match_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_tournament ON player_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- Password reset tokens (single-use, 1-hour expiry)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hex digest of the plaintext token
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Email verification tokens (single-use, 24-hour expiry)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Sample match formats data
INSERT INTO match_formats (name, description, players_per_side, scoring_type, score_input_type) VALUES
    ('Singles Match Play', 'One-on-one match play', 1, 'match_play', 'individual'),
    ('2v2 Scramble', 'Two-person team scramble format', 2, 'scramble', 'team'),
    ('2v2 Best Ball', 'Two-person team best ball', 2, 'best_ball', 'individual'),
    ('2v2 Alternate Shot', 'Two-person alternate shot', 2, 'alternate_shot', 'team'),
    ('High-Low', 'Two-on-two, one point for best low score and better of each team''s higher score', 2, 'high_low', 'individual'),
    ('Shamble', 'Drive scramble, then individual play', 2, 'shamble', 'team')
    ,('2v2 Combined Scores', 'Two-person teams: sum player scores per hole; higher sum wins for Stableford, lower sum wins for Gross', 2, 'combined_scores', 'individual')
ON CONFLICT (name) DO NOTHING;

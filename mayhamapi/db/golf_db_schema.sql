-- Golf Tournament Management Database Schema

-- Users/Players
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    handicap DECIMAL(4,1),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tournaments (e.g., "Summer Ryder Cup 2025")
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed
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

-- Rounds within a tournament (e.g., "Friday Morning", "Saturday Afternoon")
CREATE TABLE IF NOT EXISTS rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    round_number INT NOT NULL,
    round_date DATE NOT NULL,
    start_time TIMESTAMP, -- optional tee time
    status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, in_progress, completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, round_number)
);

-- Match formats/types
CREATE TABLE IF NOT EXISTS match_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., "2v2 Scramble", "Singles Match Play", "High-Low"
    description TEXT,
    players_per_side INT NOT NULL, -- 1 for singles, 2 for pairs
    scoring_type VARCHAR(50) NOT NULL, -- match_play, stroke_play, scramble, shamble, high_low
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches within a round
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    match_format_id UUID REFERENCES match_formats(id),
    match_number INT NOT NULL, -- order within the round
    holes INT NOT NULL, -- 6, 9, or 18
    status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, completed
    team1_id UUID REFERENCES teams(id),
    team2_id UUID REFERENCES teams(id),
    points_available DECIMAL(3,1) DEFAULT 1.0, -- typically 1 point per match
    team1_points DECIMAL(3,1) DEFAULT 0,
    team2_points DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(round_id, match_number)
);

-- Players participating in a specific match
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    player_order INT, -- for tracking which player in a pairing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hole-by-hole scores
CREATE TABLE IF NOT EXISTS hole_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    user_id UUID REFERENCES users(id),
    strokes INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, hole_number, user_id)
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
CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON rounds(tournament_id, round_number);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_match ON hole_scores(match_id, hole_number);
CREATE INDEX IF NOT EXISTS idx_hole_results_match ON hole_results(match_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_tournament ON player_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- Sample match formats data
INSERT INTO match_formats (name, description, players_per_side, scoring_type) VALUES
    ('Singles Match Play', 'One-on-one match play', 1, 'match_play'),
    ('2v2 Scramble', 'Two-person team scramble format', 2, 'scramble'),
    ('2v2 Best Ball', 'Two-person team best ball', 2, 'best_ball'),
    ('2v2 Alternate Shot', 'Two-person alternate shot', 2, 'alternate_shot'),
    ('High-Low', 'Best and worst score combination', 2, 'high_low'),
    ('Shamble', 'Drive scramble, then individual play', 2, 'shamble')
ON CONFLICT (name) DO NOTHING;

package repository

import (
	"database/sql"
	"fmt"
	"mayhamapi/db"
	"mayhamapi/models"
)

type Repository struct {
	db *db.DB
}

func NewRepository(database *db.DB) *Repository {
	return &Repository{db: database}
}

// ============================================
// Tournament Repository Methods
// ============================================

func (r *Repository) CreateTournament(req *models.CreateTournamentRequest, createdBy string) (*models.Tournament, error) {
	query := `
		INSERT INTO tournaments (name, description, start_date, end_date, created_by, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, start_date, end_date, created_by, status, created_at, updated_at
	`

	var tournament models.Tournament
	err := r.db.QueryRow(query, req.Name, req.Description, req.StartDate, req.EndDate, createdBy).Scan(
		&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
		&tournament.EndDate, &tournament.CreatedBy, &tournament.Status, &tournament.CreatedAt, &tournament.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create tournament: %w", err)
	}

	return &tournament, nil
}

func (r *Repository) GetTournament(id string) (*models.Tournament, error) {
	query := `SELECT id, name, description, start_date, end_date, created_by, status, created_at, updated_at FROM tournaments WHERE id = $1`

	var tournament models.Tournament
	err := r.db.QueryRow(query, id).Scan(
		&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
		&tournament.EndDate, &tournament.CreatedBy, &tournament.Status, &tournament.CreatedAt, &tournament.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tournament not found")
		}
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	return &tournament, nil
}

func (r *Repository) ListTournaments() ([]models.Tournament, error) {
	query := `SELECT id, name, description, start_date, end_date, created_by, status, created_at, updated_at FROM tournaments ORDER BY created_at DESC`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list tournaments: %w", err)
	}
	defer rows.Close()

	var tournaments []models.Tournament
	for rows.Next() {
		var tournament models.Tournament
		err := rows.Scan(
			&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
			&tournament.EndDate, &tournament.CreatedBy, &tournament.Status, &tournament.CreatedAt, &tournament.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tournament: %w", err)
		}
		tournaments = append(tournaments, tournament)
	}

	return tournaments, nil
}

// ============================================
// Team Repository Methods
// ============================================

func (r *Repository) CreateTeam(tournamentID string, req *models.CreateTeamRequest) (*models.Team, error) {
	query := `
		INSERT INTO teams (tournament_id, name, color, created_at, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, tournament_id, name, color, created_at, updated_at
	`

	var team models.Team
	err := r.db.QueryRow(query, tournamentID, req.Name, req.Color).Scan(
		&team.ID, &team.TournamentID, &team.Name, &team.Color, &team.CreatedAt, &team.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create team: %w", err)
	}

	return &team, nil
}

func (r *Repository) GetTeamsByTournament(tournamentID string) ([]models.Team, error) {
	query := `SELECT id, tournament_id, name, color, created_at, updated_at FROM teams WHERE tournament_id = $1 ORDER BY created_at`

	rows, err := r.db.Query(query, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get teams: %w", err)
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var team models.Team
		err := rows.Scan(
			&team.ID, &team.TournamentID, &team.Name, &team.Color, &team.CreatedAt, &team.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, team)
	}

	return teams, nil
}

func (r *Repository) AddTeamMember(teamID, userID string) (*models.TeamMember, error) {
	query := `
		INSERT INTO team_members (team_id, user_id, created_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		RETURNING id, team_id, user_id, created_at
	`

	var member models.TeamMember
	err := r.db.QueryRow(query, teamID, userID).Scan(
		&member.ID, &member.TeamID, &member.UserID, &member.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to add team member: %w", err)
	}

	return &member, nil
}

// ============================================
// Round Repository Methods
// ============================================

func (r *Repository) CreateRound(tournamentID string, req *models.CreateRoundRequest) (*models.Round, error) {
	query := `
		INSERT INTO rounds (tournament_id, name, round_number, round_date, start_time, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, tournament_id, name, round_number, round_date, start_time, status, created_at, updated_at
	`

	var round models.Round
	err := r.db.QueryRow(query, tournamentID, req.Name, req.RoundNumber, req.RoundDate, req.StartTime).Scan(
		&round.ID, &round.TournamentID, &round.Name, &round.RoundNumber,
		&round.RoundDate, &round.StartTime, &round.Status, &round.CreatedAt, &round.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create round: %w", err)
	}

	return &round, nil
}

func (r *Repository) GetRoundsByTournament(tournamentID string) ([]models.Round, error) {
	query := `SELECT id, tournament_id, name, round_number, round_date, start_time, status, created_at, updated_at FROM rounds WHERE tournament_id = $1 ORDER BY round_number`

	rows, err := r.db.Query(query, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rounds: %w", err)
	}
	defer rows.Close()

	var rounds []models.Round
	for rows.Next() {
		var round models.Round
		err := rows.Scan(
			&round.ID, &round.TournamentID, &round.Name, &round.RoundNumber,
			&round.RoundDate, &round.StartTime, &round.Status, &round.CreatedAt, &round.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan round: %w", err)
		}
		rounds = append(rounds, round)
	}

	return rounds, nil
}

// ============================================
// Match Repository Methods
// ============================================

func (r *Repository) CreateMatch(roundID string, req *models.CreateMatchRequest) (*models.Match, error) {
	// First, get the next match number for this round
	var nextMatchNumber int
	countQuery := `SELECT COALESCE(MAX(match_number), 0) + 1 FROM matches WHERE round_id = $1`
	err := r.db.QueryRow(countQuery, roundID).Scan(&nextMatchNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get next match number: %w", err)
	}

	query := `
		INSERT INTO matches (round_id, team1_id, team2_id, match_format_id, match_number, holes, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, round_id, team1_id, team2_id, match_format_id, match_number, holes, status, points_available, team1_points, team2_points, created_at, updated_at
	`

	var match models.Match
	err = r.db.QueryRow(query, roundID, req.Team1ID, req.Team2ID, req.MatchFormatID, nextMatchNumber, req.Holes).Scan(
		&match.ID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
		&match.MatchNumber, &match.Holes, &match.Status, &match.PointsAvailable,
		&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create match: %w", err)
	}

	return &match, nil
}

func (r *Repository) GetMatch(id string) (*models.Match, error) {
	query := `SELECT id, round_id, team1_id, team2_id, match_format_id, match_number, holes, status, points_available, team1_points, team2_points, created_at, updated_at FROM matches WHERE id = $1`

	var match models.Match
	err := r.db.QueryRow(query, id).Scan(
		&match.ID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
		&match.MatchNumber, &match.Holes, &match.Status, &match.PointsAvailable,
		&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("match not found")
		}
		return nil, fmt.Errorf("failed to get match: %w", err)
	}

	return &match, nil
}

func (r *Repository) GetMatchesByRound(roundID string) ([]models.Match, error) {
	query := `SELECT id, round_id, team1_id, team2_id, match_format_id, match_number, holes, status, points_available, team1_points, team2_points, created_at, updated_at FROM matches WHERE round_id = $1 ORDER BY match_number`

	rows, err := r.db.Query(query, roundID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var match models.Match
		err := rows.Scan(
			&match.ID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
			&match.MatchNumber, &match.Holes, &match.Status, &match.PointsAvailable,
			&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}
		matches = append(matches, match)
	}

	return matches, nil
}

// ============================================
// Score Repository Methods
// ============================================

func (r *Repository) SubmitScore(matchID, userID string, holeNumber, strokes int) (*models.Score, error) {
	query := `
		INSERT INTO scores (match_id, user_id, hole_number, strokes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (match_id, user_id, hole_number) 
		DO UPDATE SET strokes = EXCLUDED.strokes, updated_at = CURRENT_TIMESTAMP
		RETURNING id, match_id, user_id, hole_number, strokes, created_at, updated_at
	`

	var score models.Score
	err := r.db.QueryRow(query, matchID, userID, holeNumber, strokes).Scan(
		&score.ID, &score.MatchID, &score.UserID, &score.HoleNumber,
		&score.Strokes, &score.CreatedAt, &score.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to submit score: %w", err)
	}

	return &score, nil
}

func (r *Repository) GetMatchScores(matchID string) ([]models.Score, error) {
	query := `SELECT id, match_id, user_id, hole_number, strokes, created_at, updated_at FROM scores WHERE match_id = $1 ORDER BY hole_number, user_id`

	rows, err := r.db.Query(query, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match scores: %w", err)
	}
	defer rows.Close()

	var scores []models.Score
	for rows.Next() {
		var score models.Score
		err := rows.Scan(
			&score.ID, &score.MatchID, &score.UserID, &score.HoleNumber,
			&score.Strokes, &score.CreatedAt, &score.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan score: %w", err)
		}
		scores = append(scores, score)
	}

	return scores, nil
}

// ============================================
// User Repository Methods
// ============================================

func (r *Repository) CreateUser(email, name string, handicap *float64) (*models.User, error) {
	query := `
		INSERT INTO users (email, name, handicap, created_at, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, email, name, handicap, is_admin, created_at, updated_at
	`

	var user models.User
	err := r.db.QueryRow(query, email, name, handicap).Scan(
		&user.ID, &user.Email, &user.Name, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetUserByEmail(email string) (*models.User, error) {
	query := `SELECT id, email, name, handicap, is_admin, created_at, updated_at FROM users WHERE email = $1`

	var user models.User
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.Name, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetAllUsers() ([]*models.User, error) {
	query := `SELECT id, email, name, handicap, is_admin, created_at, updated_at FROM users ORDER BY name ASC`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID, &user.Email, &user.Name, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, &user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating users: %w", err)
	}

	return users, nil
}

func (r *Repository) UpdateMatchStatus(matchID, status string) error {
	query := `UPDATE matches SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	args := []interface{}{status, matchID}

	_, err := r.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update match status: %w", err)
	}

	return nil
}

// ============================================
// Match Format Repository Methods
// ============================================

func (r *Repository) GetAllMatchFormats() ([]map[string]interface{}, error) {
	query := `SELECT id, name, description, players_per_side, scoring_type, created_at FROM match_formats ORDER BY name`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get match formats: %w", err)
	}
	defer rows.Close()

	var formats []map[string]interface{}
	for rows.Next() {
		var id, name, description, scoringType, createdAt string
		var playersPerSide int

		err := rows.Scan(&id, &name, &description, &playersPerSide, &scoringType, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match format: %w", err)
		}

		format := map[string]interface{}{
			"id":               id,
			"name":             name,
			"description":      description,
			"players_per_side": playersPerSide,
			"scoring_type":     scoringType,
			"created_at":       createdAt,
		}
		formats = append(formats, format)
	}

	return formats, nil
}

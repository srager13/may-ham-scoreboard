package repository

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"mayhamapi/db"
	"mayhamapi/models"
	"time"
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
	// Default to 'gross' scoring if not specified
	scoringMethod := "gross"
	if req.ScoringMethod != nil && *req.ScoringMethod != "" {
		scoringMethod = *req.ScoringMethod
	}

	query := `
		INSERT INTO tournaments (name, description, start_date, end_date, group_id, created_by, status, scoring_method, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, start_date, end_date, group_id, created_by, status, scoring_method, created_at, updated_at
	`

	var tournament models.Tournament
	err := r.db.QueryRow(query, req.Name, req.Description, req.StartDate, req.EndDate, req.GroupID, createdBy, scoringMethod).Scan(
		&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
		&tournament.EndDate, &tournament.GroupID, &tournament.CreatedBy, &tournament.Status, &tournament.ScoringMethod, &tournament.CreatedAt, &tournament.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create tournament: %w", err)
	}

	return &tournament, nil
}

func (r *Repository) GetTournament(id string) (*models.Tournament, error) {
	query := `SELECT id, name, description, start_date, end_date, group_id, created_by, status, scoring_method, created_at, updated_at FROM tournaments WHERE id = $1`

	var tournament models.Tournament
	err := r.db.QueryRow(query, id).Scan(
		&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
		&tournament.EndDate, &tournament.GroupID, &tournament.CreatedBy, &tournament.Status, &tournament.ScoringMethod, &tournament.CreatedAt, &tournament.UpdatedAt,
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
	query := `SELECT id, name, description, start_date, end_date, group_id, created_by, status, scoring_method, created_at, updated_at FROM tournaments ORDER BY created_at DESC`

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
			&tournament.EndDate, &tournament.GroupID, &tournament.CreatedBy, &tournament.Status, &tournament.ScoringMethod, &tournament.CreatedAt, &tournament.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tournament: %w", err)
		}
		tournaments = append(tournaments, tournament)
	}

	return tournaments, nil
}

func (r *Repository) GetUserTournaments(userID string) ([]models.Tournament, error) {
	query := `
		SELECT DISTINCT t.id, t.name, t.description, t.start_date, t.end_date, t.group_id, t.created_by, t.status, t.scoring_method, t.created_at, t.updated_at
		FROM tournaments t
		INNER JOIN teams teams ON teams.tournament_id = t.id
		INNER JOIN team_members tm ON tm.team_id = teams.id
		WHERE tm.user_id = $1
		ORDER BY t.created_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user tournaments: %w", err)
	}
	defer rows.Close()

	var tournaments []models.Tournament
	for rows.Next() {
		var tournament models.Tournament
		err := rows.Scan(
			&tournament.ID, &tournament.Name, &tournament.Description, &tournament.StartDate,
			&tournament.EndDate, &tournament.GroupID, &tournament.CreatedBy, &tournament.Status, &tournament.ScoringMethod, &tournament.CreatedAt, &tournament.UpdatedAt,
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

func (r *Repository) GetTeam(teamID string) (*models.Team, error) {
	query := `SELECT id, tournament_id, name, color, created_at, updated_at FROM teams WHERE id = $1`

	var team models.Team
	err := r.db.QueryRow(query, teamID).Scan(
		&team.ID, &team.TournamentID, &team.Name, &team.Color, &team.CreatedAt, &team.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("team not found")
		}
		return nil, fmt.Errorf("failed to get team: %w", err)
	}

	return &team, nil
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
		INSERT INTO rounds (tournament_id, name, round_number, round_date, start_time, golf_course_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, tournament_id, name, round_number, round_date, start_time, golf_course_id, status, created_at, updated_at
	`

	var round models.Round
	err := r.db.QueryRow(query, tournamentID, req.Name, req.RoundNumber, req.RoundDate, req.StartTime, req.GolfCourseID).Scan(
		&round.ID, &round.TournamentID, &round.Name, &round.RoundNumber,
		&round.RoundDate, &round.StartTime, &round.GolfCourseID, &round.Status, &round.CreatedAt, &round.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create round: %w", err)
	}

	return &round, nil
}

func (r *Repository) GetRoundsByTournament(tournamentID string) ([]models.Round, error) {
	query := `SELECT id, tournament_id, golf_course_id, name, round_number, round_date, start_time, status, created_at, updated_at FROM rounds WHERE tournament_id = $1 ORDER BY round_number`

	rows, err := r.db.Query(query, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rounds: %w", err)
	}
	defer rows.Close()

	var rounds []models.Round
	for rows.Next() {
		var round models.Round
		err := rows.Scan(
			&round.ID, &round.TournamentID, &round.GolfCourseID, &round.Name, &round.RoundNumber,
			&round.RoundDate, &round.StartTime, &round.Status, &round.CreatedAt, &round.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan round: %w", err)
		}

		// Fetch golf course information if golf_course_id is set
		if round.GolfCourseID != nil {
			course, err := r.GetGolfCourseByID(*round.GolfCourseID)
			if err != nil {
				// Log the error but don't fail the entire request
				// The round will just not have golf course info
				fmt.Printf("Warning: failed to fetch golf course for round %s: %v\n", round.ID, err)
			} else {
				round.GolfCourse = course
			}
		}

		rounds = append(rounds, round)
	}

	return rounds, nil
}

// ============================================
// Pairing Repository Methods
// ============================================

func (r *Repository) CreatePairing(roundID string, req *models.CreatePairingRequest) (*models.Pairing, error) {
	teeID := req.GolfCourseTeeID
	if teeID == nil {
		defaultTeeID, err := r.getDefaultTeeIDForRound(roundID)
		if err != nil {
			return nil, err
		}
		if defaultTeeID == nil {
			return nil, fmt.Errorf("golf_course_tee_id is required for pairings without a default tee")
		}
		teeID = defaultTeeID
	}

	query := `
		INSERT INTO pairings (round_id, pairing_number, tee_time, golf_course_tee_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'not_started', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, round_id, pairing_number, tee_time, golf_course_tee_id, status, created_at, updated_at
	`

	var pairing models.Pairing
	err := r.db.QueryRow(query, roundID, req.PairingNumber, req.TeeTime, teeID).Scan(
		&pairing.ID, &pairing.RoundID, &pairing.PairingNumber, &pairing.TeeTime,
		&pairing.GolfCourseTeeID, &pairing.Status, &pairing.CreatedAt, &pairing.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create pairing: %w", err)
	}

	// Add players to the pairing
	for _, playerReq := range req.Players {
		pairingPlayer := &models.PairingPlayer{
			PairingID:   pairing.ID,
			UserID:      playerReq.UserID,
			TeamID:      playerReq.TeamID,
			PlayerOrder: playerReq.PlayerOrder,
		}
		if err := r.CreatePairingPlayer(pairingPlayer); err != nil {
			return nil, fmt.Errorf("failed to add player to pairing: %w", err)
		}
	}

	// Create matches for this pairing if provided
	for i, matchReq := range req.Matches {
		pointsAvailable := 1.0
		if matchReq.PointsAvailable != nil {
			pointsAvailable = *matchReq.PointsAvailable
		}
		matchCreateReq := &models.CreateMatchRequest{
			Team1ID:         matchReq.Team1ID,
			Team2ID:         matchReq.Team2ID,
			MatchFormatID:   matchReq.MatchFormatID,
			Holes:           matchReq.Holes,
			StartHole:       matchReq.StartHole,
			EndHole:         matchReq.EndHole,
			PointsAvailable: &pointsAvailable,
			PlayerUserIDs:   matchReq.PlayerUserIDs, // Pass through specific player assignments
		}
		if _, err := r.CreateMatchForPairing(pairing.ID, roundID, i+1, matchCreateReq); err != nil {
			return nil, fmt.Errorf("failed to create match for pairing: %w", err)
		}
	}

	return &pairing, nil
}

func (r *Repository) getDefaultTeeIDForRound(roundID string) (*string, error) {
	query := `SELECT golf_course_id FROM rounds WHERE id = $1`

	var courseID *string
	if err := r.db.QueryRow(query, roundID).Scan(&courseID); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("round not found")
		}
		return nil, fmt.Errorf("failed to get round golf course: %w", err)
	}

	if courseID == nil {
		return nil, nil
	}

	tees, err := r.GetGolfCourseTees(*courseID)
	if err != nil {
		return nil, err
	}
	if len(tees) == 0 {
		return nil, nil
	}

	return &tees[0].ID, nil
}

func (r *Repository) CreatePairingPlayer(player *models.PairingPlayer) error {
	query := `
		INSERT INTO pairing_players (pairing_id, user_id, team_id, player_order, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		RETURNING id, created_at
	`

	err := r.db.QueryRow(query, player.PairingID, player.UserID, player.TeamID, player.PlayerOrder).Scan(
		&player.ID, &player.CreatedAt,
	)
	return err
}

func (r *Repository) GetPairing(id string) (*models.Pairing, error) {
	query := `SELECT id, round_id, pairing_number, tee_time, golf_course_tee_id, status, created_at, updated_at FROM pairings WHERE id = $1`

	var pairing models.Pairing
	err := r.db.QueryRow(query, id).Scan(
		&pairing.ID, &pairing.RoundID, &pairing.PairingNumber, &pairing.TeeTime,
		&pairing.GolfCourseTeeID, &pairing.Status, &pairing.CreatedAt, &pairing.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("pairing not found")
		}
		return nil, fmt.Errorf("failed to get pairing: %w", err)
	}

	// Load players
	players, err := r.GetPairingPlayers(id)
	if err != nil {
		fmt.Printf("Warning: failed to load players for pairing %s: %v\n", id, err)
	} else {
		pairing.Players = players
	}

	return &pairing, nil
}

func (r *Repository) GetPairingsByRound(roundID string) ([]models.Pairing, error) {
	query := `SELECT id, round_id, pairing_number, tee_time, golf_course_tee_id, status, created_at, updated_at FROM pairings WHERE round_id = $1 ORDER BY pairing_number`

	rows, err := r.db.Query(query, roundID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pairings: %w", err)
	}
	defer rows.Close()

	var pairings []models.Pairing
	for rows.Next() {
		var pairing models.Pairing
		err := rows.Scan(
			&pairing.ID, &pairing.RoundID, &pairing.PairingNumber, &pairing.TeeTime,
			&pairing.GolfCourseTeeID, &pairing.Status, &pairing.CreatedAt, &pairing.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pairing: %w", err)
		}

		// Load players
		players, err := r.GetPairingPlayers(pairing.ID)
		if err != nil {
			fmt.Printf("Warning: failed to load players for pairing %s: %v\n", pairing.ID, err)
		} else {
			pairing.Players = players
		}

		pairings = append(pairings, pairing)
	}

	return pairings, nil
}

func (r *Repository) GetPairingPlayers(pairingID string) ([]models.PairingPlayer, error) {
	query := `
		SELECT pp.id, pp.pairing_id, pp.user_id, pp.team_id, pp.player_order, pp.created_at,
		       u.id, u.email, u.name, u.password_hash, u.handicap, u.is_admin, u.created_at, u.updated_at,
		       t.id, t.tournament_id, t.name, t.color, t.created_at, t.updated_at
		FROM pairing_players pp
		JOIN users u ON pp.user_id = u.id
		LEFT JOIN teams t ON pp.team_id = t.id
		WHERE pp.pairing_id = $1
		ORDER BY pp.player_order
	`

	rows, err := r.db.Query(query, pairingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pairing players: %w", err)
	}
	defer rows.Close()

	var players []models.PairingPlayer
	for rows.Next() {
		var player models.PairingPlayer
		var user models.User
		var team models.Team
		var passwordHashNull sql.NullString

		err := rows.Scan(
			&player.ID, &player.PairingID, &player.UserID, &player.TeamID, &player.PlayerOrder, &player.CreatedAt,
			&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
			&team.ID, &team.TournamentID, &team.Name, &team.Color, &team.CreatedAt, &team.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pairing player: %w", err)
		}
		if passwordHashNull.Valid {
			user.PasswordHash = passwordHashNull.String
		}

		player.User = &user
		player.Team = &team
		players = append(players, player)
	}

	return players, nil
}

// ============================================
// Match Repository Methods
// ============================================

func (r *Repository) CreateMatchForPairing(pairingID, roundID string, matchNumber int, req *models.CreateMatchRequest) (*models.Match, error) {
	pointsAvailable := 1.0
	if req.PointsAvailable != nil {
		pointsAvailable = *req.PointsAvailable
	}

	query := `
		INSERT INTO matches (pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'not_started', $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, team1_points, team2_points, created_at, updated_at
	`

	var match models.Match
	err := r.db.QueryRow(query, pairingID, roundID, req.Team1ID, req.Team2ID, req.MatchFormatID, matchNumber, req.Holes, req.StartHole, req.EndHole, pointsAvailable).Scan(
		&match.ID, &match.PairingID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
		&match.MatchNumber, &match.Holes, &match.StartHole, &match.EndHole, &match.Status, &match.PointsAvailable,
		&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create match: %w", err)
	}

	// Auto-assign players from pairing to this match
	pairingPlayers, err := r.GetPairingPlayers(pairingID)
	if err != nil {
		fmt.Printf("Warning: failed to get pairing players for match %s: %v\n", match.ID, err)
	} else {
		// If specific player user IDs were provided, only assign those players
		// Otherwise, assign all pairing players (legacy behavior)
		playersToAssign := pairingPlayers
		if req.PlayerUserIDs != nil {
			// Filter to only the specified players
			playerIDMap := make(map[string]bool)
			for _, userID := range req.PlayerUserIDs {
				playerIDMap[userID] = true
			}
			playersToAssign = []models.PairingPlayer{}
			for _, pp := range pairingPlayers {
				if playerIDMap[pp.UserID] {
					playersToAssign = append(playersToAssign, pp)
				}
			}
		}

		// Create match_players entries for the selected players
		for _, pp := range playersToAssign {
			matchPlayer := &models.MatchPlayer{
				MatchID:     match.ID,
				UserID:      pp.UserID,
				TeamID:      pp.TeamID,
				PlayerOrder: pp.PlayerOrder,
			}
			if err := r.CreateMatchPlayer(matchPlayer); err != nil {
				fmt.Printf("Warning: failed to create match player for match %s: %v\n", match.ID, err)
			}
		}
	}

	return &match, nil
}

func (r *Repository) CreateMatch(roundID string, req *models.CreateMatchRequest) (*models.Match, error) {
	// Legacy method - creates a match without a pairing
	// First, get the next match number for this round
	var nextMatchNumber int
	countQuery := `SELECT COALESCE(MAX(match_number), 0) + 1 FROM matches WHERE round_id = $1 AND pairing_id IS NULL`
	err := r.db.QueryRow(countQuery, roundID).Scan(&nextMatchNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get next match number: %w", err)
	}

	pointsAvailable := 1.0
	if req.PointsAvailable != nil {
		pointsAvailable = *req.PointsAvailable
	}

	query := `
		INSERT INTO matches (round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'not_started', $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, team1_points, team2_points, created_at, updated_at
	`

	var match models.Match
	err = r.db.QueryRow(query, roundID, req.Team1ID, req.Team2ID, req.MatchFormatID, nextMatchNumber, req.Holes, req.StartHole, req.EndHole, pointsAvailable).Scan(
		&match.ID, &match.PairingID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
		&match.MatchNumber, &match.Holes, &match.StartHole, &match.EndHole, &match.Status, &match.PointsAvailable,
		&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create match: %w", err)
	}

	return &match, nil
}

func (r *Repository) GetMatch(id string) (*models.Match, error) {
	query := `SELECT id, pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, team1_points, team2_points, created_at, updated_at FROM matches WHERE id = $1`

	var match models.Match
	err := r.db.QueryRow(query, id).Scan(
		&match.ID, &match.PairingID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
		&match.MatchNumber, &match.Holes, &match.StartHole, &match.EndHole, &match.Status, &match.PointsAvailable,
		&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("match not found")
		}
		return nil, fmt.Errorf("failed to get match: %w", err)
	}

	// Load pairing if it exists
	if match.PairingID != "" {
		if pairing, err := r.GetPairing(match.PairingID); err == nil {
			match.Pairing = pairing
		}
	}

	// Load match players
	if players, err := r.GetMatchPlayersByMatch(match.ID); err == nil {
		match.Players = players
	}

	return &match, nil
}

func (r *Repository) GetMatchesByRound(roundID string) ([]models.Match, error) {
	query := `SELECT id, pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, team1_points, team2_points, created_at, updated_at FROM matches WHERE round_id = $1 ORDER BY pairing_id NULLS FIRST, match_number`

	rows, err := r.db.Query(query, roundID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var match models.Match
		err := rows.Scan(
			&match.ID, &match.PairingID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
			&match.MatchNumber, &match.Holes, &match.StartHole, &match.EndHole, &match.Status, &match.PointsAvailable,
			&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}

		// Load related data
		// Load teams
		if team1, err := r.GetTeam(match.Team1ID); err == nil {
			match.Team1 = team1
		} else {
			fmt.Printf("Warning: failed to load team1 for match %s: %v\n", match.ID, err)
		}

		if team2, err := r.GetTeam(match.Team2ID); err == nil {
			match.Team2 = team2
		} else {
			fmt.Printf("Warning: failed to load team2 for match %s: %v\n", match.ID, err)
		}

		// Load match format
		if format, err := r.GetMatchFormat(match.MatchFormatID); err == nil {
			match.Format = format
		} else {
			fmt.Printf("Warning: failed to load format for match %s: %v\n", match.ID, err)
		}

		// Load pairing if it exists
		if match.PairingID != "" {
			if pairing, err := r.GetPairing(match.PairingID); err == nil {
				match.Pairing = pairing
			}
		}

		// Load match players
		if players, err := r.GetMatchPlayersByMatch(match.ID); err == nil {
			match.Players = players
		}

		matches = append(matches, match)
	}

	return matches, nil
}

func (r *Repository) GetMatchesByPairing(pairingID string) ([]models.Match, error) {
	query := `SELECT id, pairing_id, round_id, team1_id, team2_id, match_format_id, match_number, holes, start_hole, end_hole, status, points_available, team1_points, team2_points, created_at, updated_at FROM matches WHERE pairing_id = $1 ORDER BY match_number`

	rows, err := r.db.Query(query, pairingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var match models.Match
		err := rows.Scan(
			&match.ID, &match.PairingID, &match.RoundID, &match.Team1ID, &match.Team2ID, &match.MatchFormatID,
			&match.MatchNumber, &match.Holes, &match.StartHole, &match.EndHole, &match.Status, &match.PointsAvailable,
			&match.Team1Points, &match.Team2Points, &match.CreatedAt, &match.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}

		// Load teams
		if team1, err := r.GetTeam(match.Team1ID); err == nil {
			match.Team1 = team1
		}
		if team2, err := r.GetTeam(match.Team2ID); err == nil {
			match.Team2 = team2
		}

		// Load match format
		if format, err := r.GetMatchFormat(match.MatchFormatID); err == nil {
			match.Format = format
		}

		// Load match players
		if players, err := r.GetMatchPlayersByMatch(match.ID); err == nil {
			match.Players = players
		}

		matches = append(matches, match)
	}

	return matches, nil
}

// ============================================
// Score Repository Methods
// ============================================

func (r *Repository) SubmitScore(pairingID, userID string, holeNumber, strokes int) (*models.Score, error) {
	// Get tournament scoring method to determine if we need to calculate Stableford points
	scoringMethod, err := r.getTournamentScoringMethodFromPairing(pairingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament scoring method: %w", err)
	}

	var holePar *int
	parValue, parErr := r.getHoleParFromPairing(pairingID, holeNumber)
	if parErr != nil {
		fmt.Printf("Warning: failed to get hole par: %v\n", parErr)
	} else {
		holePar = &parValue
	}

	var stablefordPoints *int
	if scoringMethod == "stableford" {
		if holePar == nil {
			fmt.Printf("Warning: missing hole par for stableford calculation\n")
		} else {
			points := calculateStablefordPointsFromPar(strokes, *holePar)
			stablefordPoints = &points
		}
	}

	query := `
		INSERT INTO hole_scores (pairing_id, user_id, hole_number, strokes, par, stableford_points, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (pairing_id, user_id, hole_number) 
		DO UPDATE SET strokes = EXCLUDED.strokes, par = EXCLUDED.par, stableford_points = EXCLUDED.stableford_points, updated_at = CURRENT_TIMESTAMP
		RETURNING id, pairing_id, user_id, hole_number, strokes, par, stableford_points, created_at, updated_at
	`

	var score models.Score
	err = r.db.QueryRow(query, pairingID, userID, holeNumber, strokes, holePar, stablefordPoints).Scan(
		&score.ID, &score.PairingID, &score.UserID, &score.HoleNumber,
		&score.Strokes, &score.Par, &score.StablefordPoints, &score.CreatedAt, &score.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to submit score: %w", err)
	}

	return &score, nil
}

// Helper method to get tournament scoring method from a pairing
func (r *Repository) getTournamentScoringMethodFromPairing(pairingID string) (string, error) {
	query := `
		SELECT t.scoring_method
		FROM pairings p
		JOIN rounds r ON p.round_id = r.id
		JOIN tournaments t ON r.tournament_id = t.id
		WHERE p.id = $1
	`
	var scoringMethod string
	err := r.db.QueryRow(query, pairingID).Scan(&scoringMethod)
	if err != nil {
		return "", fmt.Errorf("failed to get scoring method: %w", err)
	}
	return scoringMethod, nil
}

func (r *Repository) getHoleParFromPairing(pairingID string, holeNumber int) (int, error) {
	parQuery := `
		SELECT gch.par
		FROM pairings p
		JOIN golf_course_tees gct ON p.golf_course_tee_id = gct.id
		JOIN golf_course_holes gch ON gch.tee_id = gct.id
		WHERE p.id = $1 AND gch.hole_number = $2
	`

	var holePar int
	if err := r.db.QueryRow(parQuery, pairingID, holeNumber).Scan(&holePar); err != nil {
		return 0, fmt.Errorf("failed to get hole par: %w", err)
	}

	return holePar, nil
}

func calculateStablefordPointsFromPar(strokes, holePar int) int {
	// Points: albatross(5), eagle(4), birdie(3), par(2), bogey(1), double bogey or worse(0)
	scoreToPar := strokes - holePar

	switch {
	case scoreToPar <= -3:
		return 5 // Albatross or better
	case scoreToPar == -2:
		return 4 // Eagle
	case scoreToPar == -1:
		return 3 // Birdie
	case scoreToPar == 0:
		return 2 // Par
	case scoreToPar == 1:
		return 1 // Bogey
	default:
		return 0 // Double bogey or worse
	}
}

// Legacy method - submit score by matchID (will find pairing from match)
func (r *Repository) SubmitScoreByMatch(matchID, userID string, holeNumber, strokes int) (*models.Score, error) {
	// Get the match to find its pairing
	match, err := r.GetMatch(matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match: %w", err)
	}

	if match.PairingID == "" {
		return nil, fmt.Errorf("match has no associated pairing")
	}

	return r.SubmitScore(match.PairingID, userID, holeNumber, strokes)
}

func (r *Repository) GetPairingScores(pairingID string) ([]models.Score, error) {
	query := `SELECT id, pairing_id, user_id, hole_number, strokes, par, stableford_points, created_at, updated_at FROM hole_scores WHERE pairing_id = $1 ORDER BY hole_number, user_id`

	rows, err := r.db.Query(query, pairingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pairing scores: %w", err)
	}
	defer rows.Close()

	var scores []models.Score
	for rows.Next() {
		var score models.Score
		err := rows.Scan(
			&score.ID, &score.PairingID, &score.UserID, &score.HoleNumber,
			&score.Strokes, &score.Par, &score.StablefordPoints, &score.CreatedAt, &score.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan score: %w", err)
		}
		scores = append(scores, score)
	}

	return scores, nil
}

// Legacy method - get scores by match (deprecated, use GetPairingScores)
func (r *Repository) GetMatchScores(matchID string) ([]models.Score, error) {
	// Get the match to find its pairing
	match, err := r.GetMatch(matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match: %w", err)
	}

	if match.PairingID == "" {
		return nil, fmt.Errorf("match has no associated pairing")
	}

	return r.GetPairingScores(match.PairingID)
}

// ============================================
// User Repository Methods
// ============================================

func (r *Repository) CreateUser(email, name, passwordHash string, handicap *float64) (*models.User, error) {
	query := `
		INSERT INTO users (email, name, password_hash, handicap, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, email, name, password_hash, handicap, is_admin, email_verified, created_at, updated_at
	`

	var user models.User
	var passwordHashNull sql.NullString
	err := r.db.QueryRow(query, email, name, passwordHash, handicap).Scan(
		&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if passwordHashNull.Valid {
		user.PasswordHash = passwordHashNull.String
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetUserByEmail(email string) (*models.User, error) {
	query := `SELECT id, email, name, password_hash, handicap, is_admin, email_verified, created_at, updated_at FROM users WHERE email = $1`

	var user models.User
	var passwordHashNull sql.NullString
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if passwordHashNull.Valid {
		user.PasswordHash = passwordHashNull.String
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetUserByID(userID string) (*models.User, error) {
	query := `SELECT id, email, name, password_hash, handicap, is_admin, email_verified, created_at, updated_at FROM users WHERE id = $1`

	var user models.User
	var passwordHashNull sql.NullString
	err := r.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
	)
	if passwordHashNull.Valid {
		user.PasswordHash = passwordHashNull.String
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

func (r *Repository) GetAllUsers() ([]*models.User, error) {
	query := `SELECT id, email, name, password_hash, handicap, is_admin, email_verified, created_at, updated_at FROM users ORDER BY name ASC`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var passwordHashNull sql.NullString
		err := rows.Scan(
			&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		if passwordHashNull.Valid {
			user.PasswordHash = passwordHashNull.String
		}
		users = append(users, &user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating users: %w", err)
	}

	return users, nil
}

func (r *Repository) GetGroupUsers(groupID string) ([]*models.User, error) {
	query := `
		SELECT u.id, u.email, u.name, u.password_hash, u.handicap, u.is_admin, u.email_verified, u.created_at, u.updated_at 
		FROM users u
		JOIN group_members gm ON u.id = gm.user_id
		WHERE gm.group_id = $1
		ORDER BY u.name ASC
	`

	rows, err := r.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query group users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		var passwordHashNull sql.NullString
		err := rows.Scan(
			&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		if passwordHashNull.Valid {
			user.PasswordHash = passwordHashNull.String
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

func (r *Repository) UpdatePairingStatus(pairingID, status string) error {
	query := `UPDATE pairings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	args := []interface{}{status, pairingID}

	_, err := r.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update pairing status: %w", err)
	}

	return nil
}

// ============================================
// Match Format Repository Methods
// ============================================

func (r *Repository) GetMatchFormat(formatID string) (*models.MatchFormatEntity, error) {
	query := `SELECT id, name, description, players_per_side, scoring_type, score_input_type, created_at FROM match_formats WHERE id = $1`

	var format models.MatchFormatEntity
	err := r.db.QueryRow(query, formatID).Scan(
		&format.ID, &format.Name, &format.Description, &format.PlayersPerSide, &format.ScoringType, &format.ScoreInputType, &format.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("match format not found")
		}
		return nil, fmt.Errorf("failed to get match format: %w", err)
	}

	return &format, nil
}

func (r *Repository) GetAllMatchFormats() ([]map[string]interface{}, error) {
	query := `SELECT id, name, description, players_per_side, scoring_type, score_input_type, created_at FROM match_formats ORDER BY name`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get match formats: %w", err)
	}
	defer rows.Close()

	var formats []map[string]interface{}
	for rows.Next() {
		var id, name, description, scoringType, scoreInputType, createdAt string
		var playersPerSide int

		err := rows.Scan(&id, &name, &description, &playersPerSide, &scoringType, &scoreInputType, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match format: %w", err)
		}

		format := map[string]interface{}{
			"id":               id,
			"name":             name,
			"description":      description,
			"players_per_side": playersPerSide,
			"scoring_type":     scoringType,
			"score_input_type": scoreInputType,
			"created_at":       createdAt,
		}
		formats = append(formats, format)
	}

	return formats, nil
}

// ============================================
// Group Repository Methods
// ============================================

func (r *Repository) CreateGroup(req *models.CreateGroupRequest, createdBy string) (*models.Group, error) {
	query := `
		INSERT INTO groups (name, description, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, created_by, created_at, updated_at
	`

	var group models.Group
	err := r.db.QueryRow(query, req.Name, req.Description, createdBy).Scan(
		&group.ID, &group.Name, &group.Description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}

	// Add creator as admin
	_, err = r.AddGroupMember(group.ID, createdBy, "admin")
	if err != nil {
		return nil, fmt.Errorf("failed to add creator as admin: %w", err)
	}

	return &group, nil
}

func (r *Repository) GetUserGroups(userID string) ([]models.Group, error) {
	query := `
		SELECT g.id, g.name, g.description, g.created_by, g.created_at, g.updated_at 
		FROM groups g
		JOIN group_members gm ON g.id = gm.group_id
		WHERE gm.user_id = $1
		ORDER BY g.created_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user groups: %w", err)
	}
	defer rows.Close()

	var groups []models.Group
	for rows.Next() {
		var group models.Group
		err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.CreatedBy, &group.CreatedAt, &group.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group: %w", err)
		}
		groups = append(groups, group)
	}

	return groups, nil
}

func (r *Repository) GetGroupMembers(groupID string) ([]*models.GroupMember, error) {
	query := `
		SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.created_at,
		       u.id, u.email, u.name, u.password_hash, u.handicap, u.is_admin, u.created_at, u.updated_at
		FROM group_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = $1
		ORDER BY gm.role DESC, u.name
	`

	rows, err := r.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group members: %w", err)
	}
	defer rows.Close()

	var members []*models.GroupMember
	for rows.Next() {
		var member models.GroupMember
		var user models.User
		var passwordHashNull sql.NullString
		err := rows.Scan(
			&member.ID, &member.GroupID, &member.UserID, &member.Role, &member.CreatedAt,
			&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group member: %w", err)
		}
		if passwordHashNull.Valid {
			user.PasswordHash = passwordHashNull.String
		}
		member.User = &user
		members = append(members, &member)
	}

	return members, nil
}

func (r *Repository) AddGroupMember(groupID, userID, role string) (*models.GroupMember, error) {
	if role == "" {
		role = "member"
	}

	query := `
		INSERT INTO group_members (group_id, user_id, role, created_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		RETURNING id, group_id, user_id, role, created_at
	`

	var member models.GroupMember
	err := r.db.QueryRow(query, groupID, userID, role).Scan(
		&member.ID, &member.GroupID, &member.UserID, &member.Role, &member.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to add group member: %w", err)
	}

	return &member, nil
}

func (r *Repository) IsGroupAdmin(groupID, userID string) (bool, error) {
	query := `SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`

	var count int
	err := r.db.QueryRow(query, groupID, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check group admin status: %w", err)
	}

	return count > 0, nil
}

// ============================================
// Match Player Repository Methods
// ============================================

func (r *Repository) CreateMatchPlayer(matchPlayer *models.MatchPlayer) error {
	query := `
		INSERT INTO match_players (match_id, user_id, team_id, player_order, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		RETURNING id, created_at
	`

	err := r.db.QueryRow(query, matchPlayer.MatchID, matchPlayer.UserID, matchPlayer.TeamID, matchPlayer.PlayerOrder).Scan(
		&matchPlayer.ID, &matchPlayer.CreatedAt,
	)
	return err
}

func (r *Repository) GetMatchPlayersByMatch(matchID string) ([]models.MatchPlayer, error) {
	query := `
		SELECT mp.id, mp.match_id, mp.user_id, mp.team_id, mp.player_order, mp.created_at,
		       u.id, u.email, u.name, u.password_hash, u.handicap, u.is_admin, u.created_at, u.updated_at
		FROM match_players mp
		JOIN users u ON mp.user_id = u.id
		WHERE mp.match_id = $1
		ORDER BY mp.team_id, mp.player_order
	`

	rows, err := r.db.Query(query, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match players: %w", err)
	}
	defer rows.Close()

	var players []models.MatchPlayer
	for rows.Next() {
		var player models.MatchPlayer
		var user models.User
		var passwordHashNull sql.NullString

		err := rows.Scan(
			&player.ID, &player.MatchID, &player.UserID, &player.TeamID, &player.PlayerOrder, &player.CreatedAt,
			&user.ID, &user.Email, &user.Name, &passwordHashNull, &user.Handicap, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan match player: %w", err)
		}
		if passwordHashNull.Valid {
			user.PasswordHash = passwordHashNull.String
		}

		player.User = &user
		players = append(players, player)
	}

	return players, nil
}

// ============================================
// Team Member Repository Methods
// ============================================

func (r *Repository) GetTeamMembersByTeam(teamID string) ([]models.TeamMember, error) {
	query := `SELECT id, team_id, user_id, created_at FROM team_members WHERE team_id = $1`

	rows, err := r.db.Query(query, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team members: %w", err)
	}
	defer rows.Close()

	var members []models.TeamMember
	for rows.Next() {
		var member models.TeamMember
		err := rows.Scan(&member.ID, &member.TeamID, &member.UserID, &member.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}
		members = append(members, member)
	}

	return members, nil
}

// ============================================
// Leaderboard Repository Methods
// ============================================

func (r *Repository) GetTeamStandings(tournamentID string) ([]models.TeamStanding, error) {
	// First, get all teams for this tournament
	teams, err := r.GetTeamsByTournament(tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get teams: %w", err)
	}

	var standings []models.TeamStanding

	for _, team := range teams {
		standing := models.TeamStanding{
			Team:        team,
			PointsWon:   0,
			PointsLost:  0,
			MatchesWon:  0,
			MatchesLost: 0,
			MatchesTied: 0,
			HolesWon:    0,
			HolesLost:   0,
			HolesTied:   0,
		}

		// Get match statistics for this team
		matchStats, err := r.getTeamMatchStats(tournamentID, team.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get match stats for team %s: %w", team.ID, err)
		}

		standing.PointsWon = matchStats.PointsWon
		standing.PointsLost = matchStats.PointsLost
		standing.MatchesWon = matchStats.MatchesWon
		standing.MatchesLost = matchStats.MatchesLost
		standing.MatchesTied = matchStats.MatchesTied

		// Get hole statistics for this team
		holeStats, err := r.getTeamHoleStats(tournamentID, team.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get hole stats for team %s: %w", team.ID, err)
		}

		standing.HolesWon = holeStats.Won
		standing.HolesLost = holeStats.Lost
		standing.HolesTied = holeStats.Tied

		standings = append(standings, standing)
	}

	return standings, nil
}

func (r *Repository) GetLiveMatches(tournamentID string) ([]models.Match, error) {
	query := `
		SELECT m.id, m.round_id, m.team1_id, m.team2_id, m.match_format_id, 
		       m.match_number, m.holes, m.status, m.points_available, 
		       m.team1_points, m.team2_points, m.created_at, m.updated_at
		FROM matches m
		INNER JOIN rounds r ON m.round_id = r.id
		WHERE r.tournament_id = $1 AND m.status = 'in_progress'
		ORDER BY m.match_number
	`

	rows, err := r.db.Query(query, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get live matches: %w", err)
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
			return nil, fmt.Errorf("failed to scan live match: %w", err)
		}

		// Load related data for each match
		team1, err := r.GetTeam(match.Team1ID)
		if err == nil {
			match.Team1 = team1
		}

		team2, err := r.GetTeam(match.Team2ID)
		if err == nil {
			match.Team2 = team2
		}

		format, err := r.GetMatchFormat(match.MatchFormatID)
		if err == nil {
			match.Format = format
		}

		matches = append(matches, match)
	}

	return matches, nil
}

func (r *Repository) GetTournamentTotalAvailablePoints(tournamentID string) (float64, error) {
	query := `
		SELECT COALESCE(SUM(m.points_available), 0) as total_points
		FROM matches m
		INNER JOIN rounds r ON m.round_id = r.id
		WHERE r.tournament_id = $1
	`

	var totalPoints float64
	err := r.db.QueryRow(query, tournamentID).Scan(&totalPoints)
	if err != nil {
		return 0, fmt.Errorf("failed to get total available points: %w", err)
	}

	return totalPoints, nil
}

type teamMatchStats struct {
	PointsWon   float64
	PointsLost  float64
	MatchesWon  int
	MatchesLost int
	MatchesTied int
}

type teamHoleStats struct {
	Won  int
	Lost int
	Tied int
}

func (r *Repository) getTeamMatchStats(tournamentID, teamID string) (*teamMatchStats, error) {
	query := `
		SELECT 
			COALESCE(SUM(CASE 
				WHEN (m.team1_id = $2 AND m.team1_points > m.team2_points) OR 
				     (m.team2_id = $2 AND m.team2_points > m.team1_points) 
				THEN CASE WHEN m.team1_id = $2 THEN m.team1_points ELSE m.team2_points END 
				ELSE 0 
			END), 0) as points_won,
			COALESCE(SUM(CASE 
				WHEN (m.team1_id = $2 AND m.team1_points < m.team2_points) OR 
				     (m.team2_id = $2 AND m.team2_points < m.team1_points) 
				THEN CASE WHEN m.team1_id = $2 THEN m.team2_points ELSE m.team1_points END 
				ELSE 0 
			END), 0) as points_lost,
			COUNT(CASE 
				WHEN (m.team1_id = $2 AND m.team1_points > m.team2_points) OR 
				     (m.team2_id = $2 AND m.team2_points > m.team1_points) 
				THEN 1 
			END) as matches_won,
			COUNT(CASE 
				WHEN (m.team1_id = $2 AND m.team1_points < m.team2_points) OR 
				     (m.team2_id = $2 AND m.team2_points < m.team1_points) 
				THEN 1 
			END) as matches_lost,
			COUNT(CASE 
				WHEN m.team1_points = m.team2_points AND (m.team1_id = $2 OR m.team2_id = $2)
				THEN 1 
			END) as matches_tied
		FROM matches m
		INNER JOIN rounds r ON m.round_id = r.id
		WHERE r.tournament_id = $1 
			AND (m.team1_id = $2 OR m.team2_id = $2)
			AND m.status = 'completed'
	`

	var stats teamMatchStats
	err := r.db.QueryRow(query, tournamentID, teamID).Scan(
		&stats.PointsWon, &stats.PointsLost, &stats.MatchesWon,
		&stats.MatchesLost, &stats.MatchesTied,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get team match stats: %w", err)
	}

	return &stats, nil
}

func (r *Repository) getTeamHoleStats(tournamentID, teamID string) (*teamHoleStats, error) {
	// Query hole results from the database using stored data
	query := `
		SELECT 
			COUNT(CASE WHEN hr.winner_team_id = $2 THEN 1 END) as holes_won,
			COUNT(CASE WHEN hr.winner_team_id IS NOT NULL AND hr.winner_team_id != $2 THEN 1 END) as holes_lost,
			COUNT(CASE WHEN hr.winner_team_id IS NULL THEN 1 END) as holes_tied
		FROM hole_results hr
		INNER JOIN matches m ON hr.match_id = m.id
		INNER JOIN rounds r ON m.round_id = r.id
		WHERE r.tournament_id = $1 
			AND (m.team1_id = $2 OR m.team2_id = $2)
	`

	var stats teamHoleStats
	err := r.db.QueryRow(query, tournamentID, teamID).Scan(
		&stats.Won, &stats.Lost, &stats.Tied,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get hole stats: %w", err)
	}

	return &stats, nil
}

// ============================================
// Hole Results Methods
// ============================================

func (r *Repository) SaveHoleResult(holeResult *models.HoleResult) error {
	query := `
		INSERT INTO hole_results (match_id, hole_number, team1_score, team2_score, winner_team_id, team1_points, team2_points, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (match_id, hole_number)
		DO UPDATE SET 
			team1_score = EXCLUDED.team1_score,
			team2_score = EXCLUDED.team2_score,
			winner_team_id = EXCLUDED.winner_team_id,
			team1_points = EXCLUDED.team1_points,
			team2_points = EXCLUDED.team2_points,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(
		query,
		holeResult.MatchID,
		holeResult.HoleNumber,
		holeResult.Team1Score,
		holeResult.Team2Score,
		holeResult.WinnerTeamID,
		holeResult.Team1Points,
		holeResult.Team2Points,
	).Scan(&holeResult.ID, &holeResult.CreatedAt, &holeResult.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to save hole result: %w", err)
	}

	return nil
}

func (r *Repository) GetMatchHoleResults(matchID string) ([]models.HoleResult, error) {
	query := `
		SELECT id, match_id, hole_number, team1_score, team2_score, winner_team_id, team1_points, team2_points, created_at, updated_at
		FROM hole_results
		WHERE match_id = $1
		ORDER BY hole_number`

	rows, err := r.db.Query(query, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get hole results: %w", err)
	}
	defer rows.Close()

	var results []models.HoleResult
	for rows.Next() {
		var result models.HoleResult
		err := rows.Scan(
			&result.ID,
			&result.MatchID,
			&result.HoleNumber,
			&result.Team1Score,
			&result.Team2Score,
			&result.WinnerTeamID,
			&result.Team1Points,
			&result.Team2Points,
			&result.CreatedAt,
			&result.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan hole result: %w", err)
		}
		results = append(results, result)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate hole results: %w", err)
	}

	return results, nil
}

func (r *Repository) UpdateMatchPoints(matchID string, team1Points, team2Points float64) error {
	query := `
		UPDATE matches 
		SET team1_points = $2, team2_points = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	_, err := r.db.Exec(query, matchID, team1Points, team2Points)
	if err != nil {
		return fmt.Errorf("failed to update match points: %w", err)
	}

	return nil
}

// ============================================
// Delete Methods
// ============================================

func (r *Repository) DeleteMatch(matchID string) error {
	query := `DELETE FROM matches WHERE id = $1`
	_, err := r.db.Exec(query, matchID)
	if err != nil {
		return fmt.Errorf("failed to delete match: %w", err)
	}
	return nil
}

func (r *Repository) DeleteRound(roundID string) error {
	// Note: This will cascade delete all matches due to ON DELETE CASCADE
	query := `DELETE FROM rounds WHERE id = $1`
	_, err := r.db.Exec(query, roundID)
	if err != nil {
		return fmt.Errorf("failed to delete round: %w", err)
	}
	return nil
}

func (r *Repository) DeleteTeam(teamID string) error {
	// Note: This will cascade delete team members due to ON DELETE CASCADE
	query := `DELETE FROM teams WHERE id = $1`
	_, err := r.db.Exec(query, teamID)
	if err != nil {
		return fmt.Errorf("failed to delete team: %w", err)
	}
	return nil
}

func (r *Repository) DeleteTournament(tournamentID string) error {
	// Note: This will cascade delete teams, rounds, and matches due to ON DELETE CASCADE
	query := `DELETE FROM tournaments WHERE id = $1`
	_, err := r.db.Exec(query, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to delete tournament: %w", err)
	}
	return nil
}

func (r *Repository) DeleteTeamMember(teamID, userID string) error {
	query := `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, teamID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete team member: %w", err)
	}
	return nil
}

func (r *Repository) GetTeamMembers(teamID string) ([]models.TeamMember, error) {
	query := `
		SELECT tm.id, tm.team_id, tm.user_id, tm.created_at
		FROM team_members tm
		WHERE tm.team_id = $1
	`

	rows, err := r.db.Query(query, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team members: %w", err)
	}
	defer rows.Close()

	var members []models.TeamMember
	for rows.Next() {
		var member models.TeamMember

		err := rows.Scan(
			&member.ID, &member.TeamID, &member.UserID, &member.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}

		members = append(members, member)
	}

	return members, nil
}

// ============================================
// Golf Course Methods
// ============================================

func (r *Repository) CreateGolfCourse(course *models.GolfCourse) error {
	query := `
INSERT INTO golf_courses (external_id, club_name, course_name, address, city, state, country, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, created_at, updated_at
`
	err := r.db.QueryRow(query,
		course.ExternalID, course.ClubName, course.CourseName, course.Address,
		course.City, course.State, course.Country, course.Latitude, course.Longitude,
	).Scan(&course.ID, &course.CreatedAt, &course.UpdatedAt)

	return err
}

func (r *Repository) CreateGolfCourseTee(tee *models.GolfCourseTee) error {
	query := `
INSERT INTO golf_course_tees (
course_id, tee_name, gender, course_rating, slope_rating, bogey_rating,
total_yards, total_meters, number_of_holes, par_total,
front_course_rating, front_slope_rating, front_bogey_rating,
back_course_rating, back_slope_rating, back_bogey_rating
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (course_id, tee_name, gender) DO UPDATE SET
			course_rating = EXCLUDED.course_rating,
			slope_rating = EXCLUDED.slope_rating,
			bogey_rating = EXCLUDED.bogey_rating,
			total_yards = EXCLUDED.total_yards,
			total_meters = EXCLUDED.total_meters,
			number_of_holes = EXCLUDED.number_of_holes,
			par_total = EXCLUDED.par_total,
			front_course_rating = EXCLUDED.front_course_rating,
			front_slope_rating = EXCLUDED.front_slope_rating,
			front_bogey_rating = EXCLUDED.front_bogey_rating,
			back_course_rating = EXCLUDED.back_course_rating,
			back_slope_rating = EXCLUDED.back_slope_rating,
			back_bogey_rating = EXCLUDED.back_bogey_rating
		RETURNING id, created_at
	`
	err := r.db.QueryRow(query,
		tee.CourseID, tee.TeeName, tee.Gender, tee.CourseRating, tee.SlopeRating, tee.BogeyRating,
		tee.TotalYards, tee.TotalMeters, tee.NumberOfHoles, tee.ParTotal,
		tee.FrontCourseRating, tee.FrontSlopeRating, tee.FrontBogeyRating,
		tee.BackCourseRating, tee.BackSlopeRating, tee.BackBogeyRating,
	).Scan(&tee.ID, &tee.CreatedAt)

	return err
}

func (r *Repository) CreateGolfCourseHole(hole *models.GolfCourseHole) error {
	query := `
		INSERT INTO golf_course_holes (tee_id, hole_number, par, yards, handicap)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tee_id, hole_number) DO UPDATE SET
			par = EXCLUDED.par,
			yards = EXCLUDED.yards,
			handicap = EXCLUDED.handicap
		RETURNING id, created_at
	`
	err := r.db.QueryRow(query,
		hole.TeeID, hole.HoleNumber, hole.Par, hole.Yards, hole.Handicap,
	).Scan(&hole.ID, &hole.CreatedAt)

	return err
}

func (r *Repository) GetGolfCourses() ([]*models.GolfCourse, error) {
	query := `
SELECT id, external_id, club_name, course_name, address, city, state, country, latitude, longitude, created_at, updated_at
FROM golf_courses
ORDER BY club_name, course_name
`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get golf courses: %w", err)
	}
	defer rows.Close()

	var courses []*models.GolfCourse
	for rows.Next() {
		var course models.GolfCourse
		err := rows.Scan(
			&course.ID, &course.ExternalID, &course.ClubName, &course.CourseName,
			&course.Address, &course.City, &course.State, &course.Country,
			&course.Latitude, &course.Longitude, &course.CreatedAt, &course.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan golf course: %w", err)
		}
		courses = append(courses, &course)
	}

	return courses, nil
}

func (r *Repository) GetGolfCourseByID(courseID string) (*models.GolfCourse, error) {
	query := `
SELECT id, external_id, club_name, course_name, address, city, state, country, latitude, longitude, created_at, updated_at
FROM golf_courses
WHERE id = $1
`
	var course models.GolfCourse
	err := r.db.QueryRow(query, courseID).Scan(
		&course.ID, &course.ExternalID, &course.ClubName, &course.CourseName,
		&course.Address, &course.City, &course.State, &course.Country,
		&course.Latitude, &course.Longitude, &course.CreatedAt, &course.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get golf course: %w", err)
	}

	return &course, nil
}

func (r *Repository) GetGolfCourseByExternalID(externalID int) (*models.GolfCourse, error) {
	query := `
SELECT id, external_id, club_name, course_name, address, city, state, country, latitude, longitude, created_at, updated_at
FROM golf_courses
WHERE external_id = $1
`
	var course models.GolfCourse
	err := r.db.QueryRow(query, externalID).Scan(
		&course.ID, &course.ExternalID, &course.ClubName, &course.CourseName,
		&course.Address, &course.City, &course.State, &course.Country,
		&course.Latitude, &course.Longitude, &course.CreatedAt, &course.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get golf course by external ID: %w", err)
	}

	return &course, nil
}

func (r *Repository) GetGolfCourseTees(courseID string) ([]*models.GolfCourseTee, error) {
	query := `
SELECT id, course_id, tee_name, gender, course_rating, slope_rating, bogey_rating,
       total_yards, total_meters, number_of_holes, par_total,
       front_course_rating, front_slope_rating, front_bogey_rating,
       back_course_rating, back_slope_rating, back_bogey_rating, created_at
FROM golf_course_tees
WHERE course_id = $1
ORDER BY total_yards DESC
`
	rows, err := r.db.Query(query, courseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get golf course tees: %w", err)
	}
	defer rows.Close()

	var tees []*models.GolfCourseTee
	for rows.Next() {
		var tee models.GolfCourseTee
		err := rows.Scan(
			&tee.ID, &tee.CourseID, &tee.TeeName, &tee.Gender,
			&tee.CourseRating, &tee.SlopeRating, &tee.BogeyRating,
			&tee.TotalYards, &tee.TotalMeters, &tee.NumberOfHoles, &tee.ParTotal,
			&tee.FrontCourseRating, &tee.FrontSlopeRating, &tee.FrontBogeyRating,
			&tee.BackCourseRating, &tee.BackSlopeRating, &tee.BackBogeyRating,
			&tee.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan golf course tee: %w", err)
		}
		tees = append(tees, &tee)
	}

	return tees, nil
}

func (r *Repository) GetGolfCourseHoles(teeID string) ([]*models.GolfCourseHole, error) {
	query := `
SELECT id, tee_id, hole_number, par, yards, handicap, created_at
FROM golf_course_holes
WHERE tee_id = $1
ORDER BY hole_number
`
	rows, err := r.db.Query(query, teeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get golf course holes: %w", err)
	}
	defer rows.Close()

	var holes []*models.GolfCourseHole
	for rows.Next() {
		var hole models.GolfCourseHole
		err := rows.Scan(
			&hole.ID, &hole.TeeID, &hole.HoleNumber, &hole.Par,
			&hole.Yards, &hole.Handicap, &hole.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan golf course hole: %w", err)
		}
		holes = append(holes, &hole)
	}

	return holes, nil
}

// ============================================
// Password Reset Repository Methods
// ============================================

// CreatePasswordResetToken generates a cryptographically random plaintext token,
// stores only its SHA-256 hash in the database, and returns the plaintext token
// to be embedded in the reset link sent to the user.
func (r *Repository) CreatePasswordResetToken(userID string) (string, error) {
	// Generate 32 random bytes → 43-char base64url plaintext token.
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}
	plaintext := base64.RawURLEncoding.EncodeToString(buf)

	// Hash for storage — we never persist the plaintext.
	sum := sha256.Sum256([]byte(plaintext))
	tokenHash := hex.EncodeToString(sum[:])

	expiresAt := time.Now().Add(time.Hour)

	query := `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
	`
	if _, err := r.db.Exec(query, userID, tokenHash, expiresAt); err != nil {
		return "", fmt.Errorf("failed to store reset token: %w", err)
	}

	return plaintext, nil
}

// GetPasswordResetToken looks up a valid (unexpired, unused) token by its hash.
func (r *Repository) GetPasswordResetToken(plaintext string) (*models.PasswordResetToken, error) {
	sum := sha256.Sum256([]byte(plaintext))
	tokenHash := hex.EncodeToString(sum[:])

	query := `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM password_reset_tokens
		WHERE token_hash = $1
	`
	var t models.PasswordResetToken
	var usedAt sql.NullTime
	err := r.db.QueryRow(query, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &usedAt, &t.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("token not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to look up reset token: %w", err)
	}
	if usedAt.Valid {
		t.UsedAt = &usedAt.Time
	}
	return &t, nil
}

// ConsumePasswordResetToken atomically marks the token as used and updates the
// user's password hash in a single transaction, preventing race conditions.
func (r *Repository) ConsumePasswordResetToken(tokenID, userID, newPasswordHash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Mark token as used.
	_, err = tx.Exec(
		`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	// Update the user's password.
	_, err = tx.Exec(
		`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		newPasswordHash, userID,
	)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return tx.Commit()
}

// CreateEmailVerificationToken generates a cryptographically random plaintext token,
// stores only its SHA-256 hash in the database, and returns the plaintext token
// to be embedded in the verification link sent to the user.
func (r *Repository) CreateEmailVerificationToken(userID string) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}
	plaintext := base64.RawURLEncoding.EncodeToString(buf)

	sum := sha256.Sum256([]byte(plaintext))
	tokenHash := hex.EncodeToString(sum[:])

	expiresAt := time.Now().Add(24 * time.Hour)

	query := `
		INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
	`
	if _, err := r.db.Exec(query, userID, tokenHash, expiresAt); err != nil {
		return "", fmt.Errorf("failed to store verification token: %w", err)
	}

	return plaintext, nil
}

// GetEmailVerificationToken looks up an unexpired, unused token by its hash.
func (r *Repository) GetEmailVerificationToken(plaintext string) (*models.EmailVerificationToken, error) {
	sum := sha256.Sum256([]byte(plaintext))
	tokenHash := hex.EncodeToString(sum[:])

	query := `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM email_verification_tokens
		WHERE token_hash = $1
	`
	var t models.EmailVerificationToken
	var usedAt sql.NullTime
	err := r.db.QueryRow(query, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &usedAt, &t.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("token not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to look up verification token: %w", err)
	}
	if usedAt.Valid {
		t.UsedAt = &usedAt.Time
	}
	return &t, nil
}

// ConsumeEmailVerificationToken atomically marks the token as used and sets
// email_verified = true on the user in a single transaction.
func (r *Repository) ConsumeEmailVerificationToken(tokenID, userID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	_, err = tx.Exec(
		`UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("failed to set email_verified: %w", err)
	}

	return tx.Commit()
}

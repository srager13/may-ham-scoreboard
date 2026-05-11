package scoring

import (
	"fmt"
	"mayhamapi/models"
)

// ScoringService handles all golf scoring calculations for different match formats.
// It supports the following formats:
// - Singles Match Play: 1v1 head-to-head comparison
// - 2v2 Best Ball: Each team uses their best score per hole
// - 2v2 Scramble: Teams play one ball together (combined score)
// - 2v2 Alternate Shot: Teams alternate shots with one ball (combined score)
// - High-Low: Head-to-head comparison of lowest scores from each team and highest scores from each team
// - Shamble: Teams tee off together, then play best ball from the best drive
// repoInterface describes the subset of repository methods used by the scoring service.
type repoInterface interface {
	SaveHoleResult(*models.HoleResult) error
	UpdateMatchPoints(matchID string, team1Points, team2Points float64) error
	UpdateMatchStatus(matchID, status string) error
	GetMatchHoleResults(matchID string) ([]models.HoleResult, error)
	GetMatchFormat(formatID string) (*models.MatchFormatEntity, error)
}

type ScoringService struct {
	repo repoInterface
}

func NewScoringService(repo repoInterface) *ScoringService {
	return &ScoringService{repo: repo}
}

// CalculateStablefordPoints calculates Stableford points for a hole
// par: the par for the hole
// strokes: gross strokes taken
// handicapStrokes: number of strokes received on this hole (based on player handicap and hole difficulty)
// Returns: Stableford points (0-5, where 2 = par)
func CalculateStablefordPoints(par, strokes, handicapStrokes int) int {
	// Net score = gross strokes - handicap strokes
	netScore := strokes - handicapStrokes

	// Stableford points based on net score vs par:
	// Albatross or better (-3 or more): 5 points
	// Eagle (-2): 4 points
	// Birdie (-1): 3 points
	// Par (0): 2 points
	// Bogey (+1): 1 point
	// Double bogey or worse (+2 or more): 0 points
	scoreToPar := netScore - par

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

// MatchStatus represents the current status of a match
type MatchStatus struct {
	Team1HolePoints  float64 `json:"team1_hole_points"`  // Points from individual holes
	Team2HolePoints  float64 `json:"team2_hole_points"`  // Points from individual holes
	Team1MatchPoints float64 `json:"team1_match_points"` // Match-level points (for leaderboard)
	Team2MatchPoints float64 `json:"team2_match_points"` // Match-level points (for leaderboard)
	HolesCompleted   int     `json:"holes_completed"`
	HolesRemaining   int     `json:"holes_remaining"`
	MatchComplete    bool    `json:"match_complete"`
	WinnerTeamID     *string `json:"winner_team_id"`
}

// HoleResult represents the result of a specific hole
type HoleResult struct {
	HoleNumber   int            `json:"hole_number"`
	Team1Score   *int           `json:"team1_score"` // nil if format doesn't produce team score
	Team2Score   *int           `json:"team2_score"`
	WinnerTeamID *string        `json:"winner_team_id"` // nil for tie
	Team1Points  float64        `json:"team1_points"`
	Team2Points  float64        `json:"team2_points"`
	PlayerScores []models.Score `json:"player_scores"`
}

func (s *ScoringService) CalculateAndStoreMatchResults(match *models.Match, scores []models.Score) (*MatchStatus, error) {
	// Fetch match format early so we can handle format-specific match-level logic
	matchFormat, err := s.repo.GetMatchFormat(match.MatchFormatID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match format: %w", err)
	}
	// Get the number of players from the pairing
	expectedPlayersPerHole := 2 // Default minimum
	if match.Pairing != nil && len(match.Pairing.Players) > 0 {
		expectedPlayersPerHole = len(match.Pairing.Players)
	}

	// Determine hole range for this match
	startHole := 1
	endHole := match.Holes
	if match.StartHole != nil && match.EndHole != nil {
		// Match has specific hole range (e.g., holes 1-6, 7-12, 13-18)
		startHole = *match.StartHole
		endHole = *match.EndHole
	}

	// Group scores by hole
	holeScores := make(map[int][]models.Score)
	for _, score := range scores {
		holeScores[score.HoleNumber] = append(holeScores[score.HoleNumber], score)
	}

	team1TotalPoints := 0.0
	team2TotalPoints := 0.0
	holesCompleted := 0

	// Detect whether this match uses Stableford points by scanning submitted scores
	useStableford := false
	for _, sc := range scores {
		if sc.StablefordPoints != nil {
			useStableford = true
			break
		}
	}

	// Calculate and store results for each completed hole in this match's range
	for holeNum := startHole; holeNum <= endHole; holeNum++ {
		holePlayerScores, exists := holeScores[holeNum]
		if !exists || len(holePlayerScores) == 0 {
			continue // Hole not played yet
		}

		// Check if all required players have submitted scores for this hole
		if len(holePlayerScores) < expectedPlayersPerHole {
			continue // Not all players have submitted scores for this hole
		}

		holeResult, err := s.calculateHoleResult(match, holeNum, holePlayerScores)
		if err != nil {
			return nil, fmt.Errorf("failed to calculate hole result: %w", err)
		}

		// Store hole result in database
		dbHoleResult := &models.HoleResult{
			MatchID:      match.ID,
			HoleNumber:   holeNum,
			Team1Score:   holeResult.Team1Score,
			Team2Score:   holeResult.Team2Score,
			WinnerTeamID: holeResult.WinnerTeamID,
			Team1Points:  holeResult.Team1Points,
			Team2Points:  holeResult.Team2Points,
		}

		err = s.repo.SaveHoleResult(dbHoleResult)
		if err != nil {
			return nil, fmt.Errorf("failed to save hole result: %w", err)
		}

		team1TotalPoints += holeResult.Team1Points
		team2TotalPoints += holeResult.Team2Points
		holesCompleted++
	}

	// Calculate match-level points based on overall match winner
	// team1TotalPoints and team2TotalPoints represent hole points won
	// Use the actual hole range length (endHole - startHole + 1) when
	// determining how many holes are expected for this match. This
	// ensures matches that cover sub-ranges (e.g., holes 1-9) are
	// evaluated correctly even if match.Holes contains a different
	// value.
	holesInRange := endHole - startHole + 1
	holesRemaining := holesInRange - holesCompleted
	matchComplete := holesCompleted >= holesInRange

	var matchTeam1Points, matchTeam2Points float64
	var winnerTeamID *string

	if matchComplete {
		// Special handling for cumulative combined-scores formats where the
		// winner is determined by the sum across all holes instead of hole-by-hole
		if matchFormat.ScoringType == "combined_scores_total" {
			// For Stableford-style scoring higher total wins, for gross lower total wins
			if useStableford {
				if team1TotalPoints > team2TotalPoints {
					winnerTeamID = &match.Team1ID
					matchTeam1Points = match.PointsAvailable
					matchTeam2Points = 0
				} else if team2TotalPoints > team1TotalPoints {
					winnerTeamID = &match.Team2ID
					matchTeam1Points = 0
					matchTeam2Points = match.PointsAvailable
				} else {
					matchTeam1Points = match.PointsAvailable / 2
					matchTeam2Points = match.PointsAvailable / 2
				}
			} else {
				// Gross scoring: lower total strokes wins
				if team1TotalPoints < team2TotalPoints {
					winnerTeamID = &match.Team1ID
					matchTeam1Points = match.PointsAvailable
					matchTeam2Points = 0
				} else if team2TotalPoints < team1TotalPoints {
					winnerTeamID = &match.Team2ID
					matchTeam1Points = 0
					matchTeam2Points = match.PointsAvailable
				} else {
					matchTeam1Points = match.PointsAvailable / 2
					matchTeam2Points = match.PointsAvailable / 2
				}
			}
		} else {
			// Default behavior: higher aggregated hole points wins
			if team1TotalPoints > team2TotalPoints {
				// Team 1 wins the match - gets the full match points
				winnerTeamID = &match.Team1ID
				matchTeam1Points = match.PointsAvailable
				matchTeam2Points = 0
			} else if team2TotalPoints > team1TotalPoints {
				// Team 2 wins the match - gets the full match points
				winnerTeamID = &match.Team2ID
				matchTeam1Points = 0
				matchTeam2Points = match.PointsAvailable
			} else {
				// Match is tied - each team gets half the available points
				matchTeam1Points = match.PointsAvailable / 2
				matchTeam2Points = match.PointsAvailable / 2
			}
		}
	} else {
		// Match not complete - no match points awarded yet
		matchTeam1Points = 0
		matchTeam2Points = 0
	}

	// Update match total points (these are match-level points, not hole points)
	err = s.repo.UpdateMatchPoints(match.ID, matchTeam1Points, matchTeam2Points)
	if err != nil {
		return nil, fmt.Errorf("failed to update match points: %w", err)
	}

	// If match is complete, update its status
	if matchComplete && match.Status != "completed" {
		err = s.repo.UpdateMatchStatus(match.ID, "completed")
		if err != nil {
			return nil, fmt.Errorf("failed to update match status: %w", err)
		}
	}

	return &MatchStatus{
		Team1HolePoints:  team1TotalPoints,
		Team2HolePoints:  team2TotalPoints,
		Team1MatchPoints: matchTeam1Points,
		Team2MatchPoints: matchTeam2Points,
		HolesCompleted:   holesCompleted,
		HolesRemaining:   holesRemaining,
		MatchComplete:    matchComplete,
		WinnerTeamID:     winnerTeamID,
	}, nil
}

// CalculateMatchStatus calculates current match status, preferring stored results when available
func (s *ScoringService) CalculateMatchStatus(match *models.Match, scores []models.Score) (*MatchStatus, error) {
	// Get match format so we can correctly interpret stored results
	matchFormat, mfErr := s.repo.GetMatchFormat(match.MatchFormatID)
	if mfErr != nil {
		// If match format can't be loaded, we can still try to compute status from scores
		matchFormat = nil
	}

	// First try to get stored hole results
	storedResults, err := s.repo.GetMatchHoleResults(match.ID)
	if err != nil {
		// If we can't get stored results, fall back to calculation
		return s.calculateMatchStatusFromScores(match, scores)
	}

	// Use stored results if available
	if len(storedResults) > 0 {
		team1TotalPoints := 0.0
		team2TotalPoints := 0.0
		holesCompleted := len(storedResults)

		for _, result := range storedResults {
			team1TotalPoints += result.Team1Points
			team2TotalPoints += result.Team2Points
		}

		// Determine hole range for stored results as well
		startHole := 1
		endHole := match.Holes
		if match.StartHole != nil && match.EndHole != nil {
			startHole = *match.StartHole
			endHole = *match.EndHole
		}
		holesInRange := endHole - startHole + 1
		holesRemaining := holesInRange - holesCompleted
		matchComplete := holesCompleted == holesInRange

		var winnerTeamID *string
		matchTeam1Points := 0.0
		matchTeam2Points := 0.0

		if matchComplete {
			// If this is a cumulative combined-scores format, determine winner by
			// comparing total aggregated scores/points rather than hole points.
			if matchFormat != nil && matchFormat.ScoringType == "combined_scores_total" {
				// Determine whether stored results represent Stableford points by
				// checking if any stored Team1Score/Team2Score came from points.
				// We can infer by checking the presence of non-zero Team1Score values
				// but to be safe, prefer comparing totals as higher wins for Stableford
				// and lower wins for gross. We'll assume that when Team1Points are
				// aggregated as raw strokes the lower total should win.
				// Heuristic: if any stored result has Team1Score != nil and Team1Score > 0
				// and any of original submitted scores included StablefordPoints, we
				// could rely on the submitted scores. As a simpler approach here,
				// treat higher total as winning only if the tournament's scores in
				// the provided scores slice include StablefordPoints. Fall back to
				// higher-wins behavior otherwise.
				useStableford := false
				for _, sc := range scores {
					if sc.StablefordPoints != nil {
						useStableford = true
						break
					}
				}

				if useStableford {
					if team1TotalPoints > team2TotalPoints {
						winnerTeamID = &match.Team1ID
						matchTeam1Points = match.PointsAvailable
						matchTeam2Points = 0.0
					} else if team2TotalPoints > team1TotalPoints {
						winnerTeamID = &match.Team2ID
						matchTeam1Points = 0.0
						matchTeam2Points = match.PointsAvailable
					} else {
						matchTeam1Points = match.PointsAvailable / 2
						matchTeam2Points = match.PointsAvailable / 2
					}
				} else {
					// Gross scoring: lower total strokes wins
					if team1TotalPoints < team2TotalPoints {
						winnerTeamID = &match.Team1ID
						matchTeam1Points = match.PointsAvailable
						matchTeam2Points = 0.0
					} else if team2TotalPoints < team1TotalPoints {
						winnerTeamID = &match.Team2ID
						matchTeam1Points = 0.0
						matchTeam2Points = match.PointsAvailable
					} else {
						matchTeam1Points = match.PointsAvailable / 2
						matchTeam2Points = match.PointsAvailable / 2
					}
				}
			} else {
				if team1TotalPoints > team2TotalPoints {
					winnerTeamID = &match.Team1ID
					matchTeam1Points = match.PointsAvailable
					matchTeam2Points = 0.0
				} else if team2TotalPoints > team1TotalPoints {
					winnerTeamID = &match.Team2ID
					matchTeam1Points = 0.0
					matchTeam2Points = match.PointsAvailable
				} else {
					// Tie - split points
					matchTeam1Points = match.PointsAvailable / 2
					matchTeam2Points = match.PointsAvailable / 2
				}
			}
		}

		return &MatchStatus{
			Team1HolePoints:  team1TotalPoints,
			Team2HolePoints:  team2TotalPoints,
			Team1MatchPoints: matchTeam1Points,
			Team2MatchPoints: matchTeam2Points,
			HolesCompleted:   holesCompleted,
			HolesRemaining:   holesRemaining,
			MatchComplete:    matchComplete,
			WinnerTeamID:     winnerTeamID,
		}, nil
	}

	// Fall back to calculation from scores
	return s.calculateMatchStatusFromScores(match, scores)
}

func (s *ScoringService) calculateMatchStatusFromScores(match *models.Match, scores []models.Score) (*MatchStatus, error) {
	// Load match format so we can support cumulative combined-scores logic
	matchFormat, _ := s.repo.GetMatchFormat(match.MatchFormatID)
	// Get the number of players from the pairing
	expectedPlayersPerHole := 2 // Default minimum
	if match.Pairing != nil && len(match.Pairing.Players) > 0 {
		expectedPlayersPerHole = len(match.Pairing.Players)
	}

	// Determine hole range for this match
	startHole := 1
	endHole := match.Holes
	if match.StartHole != nil && match.EndHole != nil {
		startHole = *match.StartHole
		endHole = *match.EndHole
	}

	// Group scores by hole
	holeScores := make(map[int][]models.Score)
	for _, score := range scores {
		holeScores[score.HoleNumber] = append(holeScores[score.HoleNumber], score)
	}

	team1Points := 0.0
	team2Points := 0.0
	holesCompleted := 0

	// Calculate points for each completed hole in this match's range
	for holeNum := startHole; holeNum <= endHole; holeNum++ {
		holePlayerScores, exists := holeScores[holeNum]
		if !exists || len(holePlayerScores) == 0 {
			continue // Hole not played yet
		}

		// Check if all required players have submitted scores for this hole
		if len(holePlayerScores) < expectedPlayersPerHole {
			continue // Not all players have submitted scores for this hole
		}

		holeResult, err := s.calculateHoleResult(match, holeNum, holePlayerScores)
		if err != nil {
			return nil, fmt.Errorf("failed to calculate hole result: %w", err)
		}

		team1Points += holeResult.Team1Points
		team2Points += holeResult.Team2Points
		holesCompleted++
	}

	// Calculate holes in range
	holesInRange := endHole - startHole + 1
	holesRemaining := holesInRange - holesCompleted
	matchComplete := holesCompleted >= holesInRange

	// Determine winner and calculate match points
	var winnerTeamID *string
	matchTeam1Points := 0.0
	matchTeam2Points := 0.0

	if matchComplete {
		if matchFormat != nil && matchFormat.ScoringType == "combined_scores_total" {
			// For cumulative combined-scores, decide winner based on aggregate
			useStableford := false
			for _, sc := range scores {
				if sc.StablefordPoints != nil {
					useStableford = true
					break
				}
			}

			if useStableford {
				if team1Points > team2Points {
					winnerTeamID = &match.Team1ID
					matchTeam1Points = match.PointsAvailable
					matchTeam2Points = 0.0
				} else if team2Points > team1Points {
					winnerTeamID = &match.Team2ID
					matchTeam1Points = 0.0
					matchTeam2Points = match.PointsAvailable
				} else {
					matchTeam1Points = match.PointsAvailable / 2
					matchTeam2Points = match.PointsAvailable / 2
				}
			} else {
				// Gross scoring: lower total wins
				if team1Points < team2Points {
					winnerTeamID = &match.Team1ID
					matchTeam1Points = match.PointsAvailable
					matchTeam2Points = 0.0
				} else if team2Points < team1Points {
					winnerTeamID = &match.Team2ID
					matchTeam1Points = 0.0
					matchTeam2Points = match.PointsAvailable
				} else {
					matchTeam1Points = match.PointsAvailable / 2
					matchTeam2Points = match.PointsAvailable / 2
				}
			}
		} else {
			if team1Points > team2Points {
				winnerTeamID = &match.Team1ID
				matchTeam1Points = match.PointsAvailable
				matchTeam2Points = 0.0
			} else if team2Points > team1Points {
				winnerTeamID = &match.Team2ID
				matchTeam1Points = 0.0
				matchTeam2Points = match.PointsAvailable
			} else {
				// Tie - split points
				matchTeam1Points = match.PointsAvailable / 2
				matchTeam2Points = match.PointsAvailable / 2
			}
		}
	}

	return &MatchStatus{
		Team1HolePoints:  team1Points,
		Team2HolePoints:  team2Points,
		Team1MatchPoints: matchTeam1Points,
		Team2MatchPoints: matchTeam2Points,
		HolesCompleted:   holesCompleted,
		HolesRemaining:   holesRemaining,
		MatchComplete:    matchComplete,
		WinnerTeamID:     winnerTeamID,
	}, nil
}

func (s *ScoringService) calculateHoleResult(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Get the match format to determine scoring type
	matchFormat, err := s.repo.GetMatchFormat(match.MatchFormatID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match format: %w", err)
	}

	// Route to appropriate scoring method based on format type
	switch matchFormat.ScoringType {
	case "combined_scores":
		return s.calculateCombinedScoresHole(match, holeNumber, scores)
	case "combined_scores_total":
		return s.calculateCombinedScoresTotalHole(match, holeNumber, scores)
	case "match_play":
		return s.calculateMatchPlayHole(match, holeNumber, scores)
	case "scramble":
		return s.calculateScrambleHole(match, holeNumber, scores)
	case "best_ball":
		return s.calculateBestBallHole(match, holeNumber, scores)
	case "alternate_shot":
		return s.calculateAlternateShotHole(match, holeNumber, scores)
	case "high_low":
		return s.calculateHighLowHole(match, holeNumber, scores)
	case "shamble":
		return s.calculateShambleHole(match, holeNumber, scores)
	default:
		return nil, fmt.Errorf("unknown scoring type: %s", matchFormat.ScoringType)
	}
}

func (s *ScoringService) calculateMatchPlayHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Get match format to check if this is singles or team match play
	matchFormat, err := s.repo.GetMatchFormat(match.MatchFormatID)
	if err != nil {
		return nil, fmt.Errorf("failed to get match format: %w", err)
	}

	// Group scores by team using match players
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players (preferred).
	// If match.Players isn't populated (e.g., in unit tests or lightweight calls),
	// fall back to inferring teams from the provided scores for singles match play.
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Fallback: if no player metadata is available, try to infer team membership
	// from the scores for the common singles match_play case.
	if len(team1UserIDs) == 0 && len(team2UserIDs) == 0 {
		if matchFormat.PlayersPerSide == 1 {
			// Collect first two unique user IDs from scores in order seen.
			seen := make(map[string]bool)
			userOrder := []string{}
			for _, sc := range scores {
				if !seen[sc.UserID] {
					userOrder = append(userOrder, sc.UserID)
					seen[sc.UserID] = true
					if len(userOrder) == 2 {
						break
					}
				}
			}
			if len(userOrder) < 2 {
				return nil, fmt.Errorf("insufficient scores for match play")
			}
			team1UserIDs[userOrder[0]] = true
			team2UserIDs[userOrder[1]] = true
		} else {
			// For team match play, we require explicit match player metadata
			return nil, fmt.Errorf("insufficient match player metadata for team match play")
		}
	}

	// Group scores by actual team membership
	for _, score := range scores {
		if team1UserIDs[score.UserID] {
			team1Scores = append(team1Scores, score.Strokes)
		} else if team2UserIDs[score.UserID] {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}

	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for match play")
	}

	var team1Score, team2Score int

	if matchFormat.PlayersPerSide == 1 {
		// Singles match play - use the single score from each team
		team1Score = team1Scores[0]
		team2Score = team2Scores[0]
	} else {
		// Team match play - take the best score from each team
		team1Score = team1Scores[0]
		for _, score := range team1Scores {
			if score < team1Score {
				team1Score = score
			}
		}

		team2Score = team2Scores[0]
		for _, score := range team2Scores {
			if score < team2Score {
				team2Score = score
			}
		}
	}

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1Score,
		Team2Score:   &team2Score,
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	if team1Score < team2Score {
		result.Team1Points = 1
		result.WinnerTeamID = &match.Team1ID
	} else if team2Score < team1Score {
		result.Team2Points = 1
		result.WinnerTeamID = &match.Team2ID
	} else {
		// If scores are equal, it's a halve (0.5 points each)
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (s *ScoringService) calculateBestBallHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Group scores by team using match players
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Group scores by actual team membership
	for _, score := range scores {
		if team1UserIDs[score.UserID] {
			team1Scores = append(team1Scores, score.Strokes)
		} else if team2UserIDs[score.UserID] {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}

	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for best ball")
	}

	// For best ball, take the best (lowest) score from each team
	team1Best := team1Scores[0]
	for _, score := range team1Scores {
		if score < team1Best {
			team1Best = score
		}
	}

	team2Best := team2Scores[0]
	for _, score := range team2Scores {
		if score < team2Best {
			team2Best = score
		}
	}

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1Best,
		Team2Score:   &team2Best,
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	// Award 1 point to winning team, 0.5 each for tie
	if team1Best < team2Best {
		result.Team1Points = 1
		result.WinnerTeamID = &match.Team1ID
	} else if team2Best < team1Best {
		result.Team2Points = 1
		result.WinnerTeamID = &match.Team2ID
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (s *ScoringService) calculateScrambleHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// For scramble, each team should have one combined score
	// We expect only one score per team (the team's combined scramble score)
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Group scores by actual team membership
	for _, score := range scores {
		if team1UserIDs[score.UserID] {
			team1Scores = append(team1Scores, score.Strokes)
		} else if team2UserIDs[score.UserID] {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}

	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for scramble")
	}

	// For scramble, use the first (and ideally only) score from each team
	// In a proper scramble, teams submit one combined score
	team1Score := team1Scores[0]
	team2Score := team2Scores[0]

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1Score,
		Team2Score:   &team2Score,
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	if team1Score < team2Score {
		result.Team1Points = 1
		result.WinnerTeamID = &match.Team1ID
	} else if team2Score < team1Score {
		result.Team2Points = 1
		result.WinnerTeamID = &match.Team2ID
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (s *ScoringService) calculateAlternateShotHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Alternate shot is similar to scramble - teams have one combined score per hole
	// Each team plays one ball, alternating shots between team members
	return s.calculateScrambleHole(match, holeNumber, scores)
}

func (s *ScoringService) calculateHighLowHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// High-Low combines the highest and lowest scores from each team
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Group scores by actual team membership
	for _, score := range scores {
		if team1UserIDs[score.UserID] {
			team1Scores = append(team1Scores, score.Strokes)
		} else if team2UserIDs[score.UserID] {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}

	if len(team1Scores) < 2 || len(team2Scores) < 2 {
		return nil, fmt.Errorf("high-low requires at least 2 players per team")
	}

	// Calculate high + low for each team
	team1High := team1Scores[0]
	team1Low := team1Scores[0]
	for _, score := range team1Scores {
		if score > team1High {
			team1High = score
		}
		if score < team1Low {
			team1Low = score
		}
	}

	team2High := team2Scores[0]
	team2Low := team2Scores[0]
	for _, score := range team2Scores {
		if score > team2High {
			team2High = score
		}
		if score < team2Low {
			team2Low = score
		}
	}

	// For high-low, we don't store a single team score since there are two separate comparisons
	// (low vs low, and high vs high). The points tell the full story.
	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   nil, // Not applicable for high-low format
		Team2Score:   nil, // Not applicable for high-low format
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	// Calculate low scores winner
	if team1Low < team2Low {
		result.Team1Points += 1
	} else if team2Low < team1Low {
		result.Team2Points += 1
	} else {
		result.Team1Points += 0.5
		result.Team2Points += 0.5
	}

	// Calculate high scores winner
	if team1High < team2High {
		result.Team1Points += 1
	} else if team2High < team1High {
		result.Team2Points += 1
	} else {
		result.Team1Points += 0.5
		result.Team2Points += 0.5
	}

	if result.Team1Points > result.Team2Points {
		result.WinnerTeamID = &match.Team1ID
	} else if result.Team2Points > result.Team1Points {
		result.WinnerTeamID = &match.Team2ID
	}

	return result, nil
}

func (s *ScoringService) calculateShambleHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Shamble: all team members tee off, select best drive, then play individual ball from there
	// For scoring purposes, this is essentially best ball - take the best score from each team
	return s.calculateBestBallHole(match, holeNumber, scores)
}

// calculateCombinedScoresHole implements the "2v2 Combined Scores" format.
// Each team has two players; their scores for the hole are summed. For Stableford
// tournaments we expect the Score objects to have StablefordPoints populated and
// a higher team sum wins. For gross scoring (no StablefordPoints), the lower
// stroke total wins.
func (s *ScoringService) calculateCombinedScoresHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Determine if Stableford points are present on any score
	useStableford := false
	for _, sc := range scores {
		if sc.StablefordPoints != nil {
			useStableford = true
			break
		}
	}

	// Group and sum appropriate values per team
	team1Sum := 0
	team2Sum := 0
	for _, sc := range scores {
		if team1UserIDs[sc.UserID] {
			if useStableford {
				if sc.StablefordPoints == nil {
					return nil, fmt.Errorf("missing stableford points for player %s in stableford match", sc.UserID)
				}
				team1Sum += *sc.StablefordPoints
			} else {
				team1Sum += sc.Strokes
			}
			team1Scores = append(team1Scores, sc.Strokes)
		} else if team2UserIDs[sc.UserID] {
			if useStableford {
				if sc.StablefordPoints == nil {
					return nil, fmt.Errorf("missing stableford points for player %s in stableford match", sc.UserID)
				}
				team2Sum += *sc.StablefordPoints
			} else {
				team2Sum += sc.Strokes
			}
			team2Scores = append(team2Scores, sc.Strokes)
		}
	}

	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for combined scores format")
	}

	// Prepare hole result. For stableford we store team scores as the summed points;
	// for gross we store summed strokes.
	var team1ScoreVal, team2ScoreVal int
	if useStableford {
		team1ScoreVal = team1Sum
		team2ScoreVal = team2Sum
	} else {
		team1ScoreVal = team1Sum
		team2ScoreVal = team2Sum
	}

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1ScoreVal,
		Team2Score:   &team2ScoreVal,
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	// Decide winner: for stableford higher sum wins, for gross lower sum wins
	if useStableford {
		if team1Sum > team2Sum {
			result.Team1Points = 1
			result.WinnerTeamID = &match.Team1ID
		} else if team2Sum > team1Sum {
			result.Team2Points = 1
			result.WinnerTeamID = &match.Team2ID
		} else {
			result.Team1Points = 0.5
			result.Team2Points = 0.5
		}
	} else {
		if team1Sum < team2Sum {
			result.Team1Points = 1
			result.WinnerTeamID = &match.Team1ID
		} else if team2Sum < team1Sum {
			result.Team2Points = 1
			result.WinnerTeamID = &match.Team2ID
		} else {
			result.Team1Points = 0.5
			result.Team2Points = 0.5
		}
	}

	return result, nil
}

// calculateCombinedScoresTotalHole implements the cumulative "2v2 Combined Scores - Gross Score/Points" format.
// Instead of awarding hole-by-hole match points, this format returns the team's combined
// strokes (for gross) or combined Stableford points (for stableford) for the hole in
// the Team1Points/Team2Points fields so callers can sum them across the match.
func (s *ScoringService) calculateCombinedScoresTotalHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	team1Scores := []int{}
	team2Scores := []int{}

	// Create maps for quick lookup using match players
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, player := range match.Players {
		switch player.TeamID {
		case match.Team1ID:
			team1UserIDs[player.UserID] = true
		case match.Team2ID:
			team2UserIDs[player.UserID] = true
		}
	}

	// Determine if Stableford points are present on any score
	useStableford := false
	for _, sc := range scores {
		if sc.StablefordPoints != nil {
			useStableford = true
			break
		}
	}

	// Group and sum appropriate values per team for this hole
	team1Sum := 0
	team2Sum := 0
	for _, sc := range scores {
		if team1UserIDs[sc.UserID] {
			if useStableford {
				if sc.StablefordPoints == nil {
					return nil, fmt.Errorf("missing stableford points for player %s in stableford match", sc.UserID)
				}
				team1Sum += *sc.StablefordPoints
			} else {
				team1Sum += sc.Strokes
			}
			team1Scores = append(team1Scores, sc.Strokes)
		} else if team2UserIDs[sc.UserID] {
			if useStableford {
				if sc.StablefordPoints == nil {
					return nil, fmt.Errorf("missing stableford points for player %s in stableford match", sc.UserID)
				}
				team2Sum += *sc.StablefordPoints
			} else {
				team2Sum += sc.Strokes
			}
			team2Scores = append(team2Scores, sc.Strokes)
		}
	}

	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for combined scores total format")
	}

	// Prepare hole result: store the team totals in Team1Score/Team2Score and
	// also put the same values into Team1Points/Team2Points so callers that
	// aggregate Team*Points across holes get the cumulative totals.
	team1ScoreVal := team1Sum
	team2ScoreVal := team2Sum

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1ScoreVal,
		Team2Score:   &team2ScoreVal,
		PlayerScores: scores,
		Team1Points:  float64(team1Sum),
		Team2Points:  float64(team2Sum),
	}

	// WinnerTeamID is not meaningful per-hole for this cumulative format, leave nil
	return result, nil
}

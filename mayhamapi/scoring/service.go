package scoring

import (
	"fmt"
	"mayhamapi/models"
	"mayhamapi/repository"
)

// ScoringService handles all golf scoring calculations for different match formats.
// It supports the following formats:
// - Singles Match Play: 1v1 head-to-head comparison
// - 2v2 Best Ball: Each team uses their best score per hole
// - 2v2 Scramble: Teams play one ball together (combined score)
// - 2v2 Alternate Shot: Teams alternate shots with one ball (combined score)
// - High-Low: Teams add their highest and lowest individual scores
// - Shamble: Teams tee off together, then play best ball from the best drive
type ScoringService struct {
	repo *repository.Repository
}

func NewScoringService(repo *repository.Repository) *ScoringService {
	return &ScoringService{repo: repo}
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
	// Group scores by hole
	holeScores := make(map[int][]models.Score)
	for _, score := range scores {
		holeScores[score.HoleNumber] = append(holeScores[score.HoleNumber], score)
	}

	team1TotalPoints := 0.0
	team2TotalPoints := 0.0
	holesCompleted := 0

	// Calculate and store results for each completed hole
	for holeNum := 1; holeNum <= match.Holes; holeNum++ {
		holePlayerScores, exists := holeScores[holeNum]
		if !exists || len(holePlayerScores) == 0 {
			continue // Hole not played yet
		}

		// Check if all required players have submitted scores for this hole
		// This ensures we only calculate results for completed holes
		if len(holePlayerScores) < 2 {
			continue // Not enough scores to calculate hole result
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
	holesRemaining := match.Holes - holesCompleted
	matchComplete := holesCompleted >= match.Holes

	var matchTeam1Points, matchTeam2Points float64
	var winnerTeamID *string

	if matchComplete {
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
	} else {
		// Match not complete - no match points awarded yet
		matchTeam1Points = 0
		matchTeam2Points = 0
	}

	// Update match total points (these are match-level points, not hole points)
	err := s.repo.UpdateMatchPoints(match.ID, matchTeam1Points, matchTeam2Points)
	if err != nil {
		return nil, fmt.Errorf("failed to update match points: %w", err)
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

		holesRemaining := match.Holes - holesCompleted
		matchComplete := holesCompleted == match.Holes

		var winnerTeamID *string
		matchTeam1Points := 0.0
		matchTeam2Points := 0.0

		if matchComplete {
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
	// Group scores by hole
	holeScores := make(map[int][]models.Score)
	for _, score := range scores {
		holeScores[score.HoleNumber] = append(holeScores[score.HoleNumber], score)
	}

	team1Points := 0.0
	team2Points := 0.0
	holesCompleted := 0

	// Calculate points for each completed hole
	for holeNum := 1; holeNum <= match.Holes; holeNum++ {
		holePlayerScores, exists := holeScores[holeNum]
		if !exists || len(holePlayerScores) == 0 {
			continue // Hole not played yet
		}

		// Check if all required players have submitted scores for this hole
		if len(holePlayerScores) < 2 {
			continue // Not enough scores to calculate hole result
		}

		holeResult, err := s.calculateHoleResult(match, holeNum, holePlayerScores)
		if err != nil {
			return nil, fmt.Errorf("failed to calculate hole result: %w", err)
		}

		team1Points += holeResult.Team1Points
		team2Points += holeResult.Team2Points
		holesCompleted++
	}

	holesRemaining := match.Holes - holesCompleted
	matchComplete := holesCompleted == match.Holes

	// Determine winner and calculate match points
	var winnerTeamID *string
	matchTeam1Points := 0.0
	matchTeam2Points := 0.0

	if matchComplete {
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

	// Group scores by team using actual team membership
	team1Scores := []int{}
	team2Scores := []int{}

	// Get team memberships for this match
	team1Members, err := s.repo.GetTeamMembersByTeam(match.Team1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team1 members: %w", err)
	}
	team2Members, err := s.repo.GetTeamMembersByTeam(match.Team2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team2 members: %w", err)
	}

	// Create maps for quick lookup
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, member := range team1Members {
		team1UserIDs[member.UserID] = true
	}
	for _, member := range team2Members {
		team2UserIDs[member.UserID] = true
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
	// Group scores by team using actual team membership
	team1Scores := []int{}
	team2Scores := []int{}

	// Get team memberships for this match
	team1Members, err := s.repo.GetTeamMembersByTeam(match.Team1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team1 members: %w", err)
	}
	team2Members, err := s.repo.GetTeamMembersByTeam(match.Team2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team2 members: %w", err)
	}

	// Create maps for quick lookup
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, member := range team1Members {
		team1UserIDs[member.UserID] = true
	}
	for _, member := range team2Members {
		team2UserIDs[member.UserID] = true
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

	// Get team memberships for this match
	team1Members, err := s.repo.GetTeamMembersByTeam(match.Team1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team1 members: %w", err)
	}
	team2Members, err := s.repo.GetTeamMembersByTeam(match.Team2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team2 members: %w", err)
	}

	// Create maps for quick lookup
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, member := range team1Members {
		team1UserIDs[member.UserID] = true
	}
	for _, member := range team2Members {
		team2UserIDs[member.UserID] = true
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

	// Get team memberships for this match
	team1Members, err := s.repo.GetTeamMembersByTeam(match.Team1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team1 members: %w", err)
	}
	team2Members, err := s.repo.GetTeamMembersByTeam(match.Team2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get team2 members: %w", err)
	}

	// Create maps for quick lookup
	team1UserIDs := make(map[string]bool)
	team2UserIDs := make(map[string]bool)
	for _, member := range team1Members {
		team1UserIDs[member.UserID] = true
	}
	for _, member := range team2Members {
		team2UserIDs[member.UserID] = true
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

	team1Total := team1High + team1Low
	team2Total := team2High + team2Low

	result := &HoleResult{
		HoleNumber:   holeNumber,
		Team1Score:   &team1Total,
		Team2Score:   &team2Total,
		PlayerScores: scores,
		Team1Points:  0,
		Team2Points:  0,
	}

	if team1Total < team2Total {
		result.Team1Points = 1
		result.WinnerTeamID = &match.Team1ID
	} else if team2Total < team1Total {
		result.Team2Points = 1
		result.WinnerTeamID = &match.Team2ID
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (s *ScoringService) calculateShambleHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Shamble: all team members tee off, select best drive, then play individual ball from there
	// For scoring purposes, this is essentially best ball - take the best score from each team
	return s.calculateBestBallHole(match, holeNumber, scores)
}

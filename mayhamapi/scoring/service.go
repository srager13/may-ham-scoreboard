package scoring

import (
	"fmt"
	"mayhamapi/models"
	"mayhamapi/repository"
)

type ScoringService struct {
	repo *repository.Repository
}

func NewScoringService(repo *repository.Repository) *ScoringService {
	return &ScoringService{repo: repo}
}

// MatchStatus represents the current status of a match
type MatchStatus struct {
	Team1TotalPoints float64 `json:"team1_total_points"`
	Team2TotalPoints float64 `json:"team2_total_points"`
	HolesCompleted   int     `json:"holes_completed"`
	HolesRemaining   int     `json:"holes_remaining"`
	MatchComplete    bool    `json:"match_complete"`
	WinnerTeamID     *string `json:"winner_team_id"`
}

// HoleResult represents the result of a specific hole
type HoleResult struct {
	HoleNumber    int      `json:"hole_number"`
	Team1Score    *int     `json:"team1_score"`    // nil if format doesn't produce team score
	Team2Score    *int     `json:"team2_score"`
	WinnerTeamID  *string  `json:"winner_team_id"` // nil for tie
	Team1Points   float64  `json:"team1_points"`
	Team2Points   float64  `json:"team2_points"`
	PlayerScores  []models.Score `json:"player_scores"`
}

func (s *ScoringService) CalculateMatchStatus(match *models.Match, scores []models.Score) (*MatchStatus, error) {
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
		// This is a simplified check - in a real scenario you'd need to know which players are in each team
		if len(holePlayerScores) < 2 {
			continue // Not all players have submitted scores
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
	
	// Determine winner
	var winnerTeamID *string
	if matchComplete {
		if team1Points > team2Points {
			winnerTeamID = &match.Team1ID
		} else if team2Points > team1Points {
			winnerTeamID = &match.Team2ID
		}
		// If points are equal, it's a tie (winnerTeamID remains nil)
	}
	
	return &MatchStatus{
		Team1TotalPoints: team1Points,
		Team2TotalPoints: team2Points,
		HolesCompleted:   holesCompleted,
		HolesRemaining:   holesRemaining,
		MatchComplete:    matchComplete,
		WinnerTeamID:     winnerTeamID,
	}, nil
}

func (s *ScoringService) calculateHoleResult(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	switch match.Format {
	case models.MatchPlay:
		return s.calculateMatchPlayHole(match, holeNumber, scores)
	case models.BestBall:
		return s.calculateBestBallHole(match, holeNumber, scores)
	case models.Scramble:
		return s.calculateScrambleHole(match, holeNumber, scores)
	case models.AlternateShot:
		return s.calculateAlternateShotHole(match, holeNumber, scores)
	case models.HighLow:
		return s.calculateHighLowHole(match, holeNumber, scores)
	case models.Shamble:
		return s.calculateShambleHole(match, holeNumber, scores)
	default:
		return nil, fmt.Errorf("unsupported match format: %s", match.Format)
	}
}

func (s *ScoringService) calculateMatchPlayHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Group scores by team (simplified - assumes we know which users are on which team)
	team1Scores := []int{}
	team2Scores := []int{}
	
	// TODO: In a real implementation, you'd need to look up team memberships
	// For now, we'll assume alternating assignment (first score = team1, second = team2, etc.)
	for i, score := range scores {
		if i%2 == 0 {
			team1Scores = append(team1Scores, score.Strokes)
		} else {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}
	
	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for match play")
	}
	
	// For match play, take the best score from each team
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
	
	if team1Best < team2Best {
		result.Team1Points = 1
		result.WinnerTeamID = &match.Team1ID
	} else if team2Best < team1Best {
		result.Team2Points = 1
		result.WinnerTeamID = &match.Team2ID
	}
	// If scores are equal, it's a halve (0.5 points each)
	if team1Best == team2Best {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}
	
	return result, nil
}

func (s *ScoringService) calculateBestBallHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// Similar logic to match play - use the best score from each team
	return s.calculateMatchPlayHole(match, holeNumber, scores)
}

func (s *ScoringService) calculateScrambleHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// For scramble, each team should have one combined score
	// This is a simplified implementation
	team1Scores := []int{}
	team2Scores := []int{}
	
	for i, score := range scores {
		if i%2 == 0 {
			team1Scores = append(team1Scores, score.Strokes)
		} else {
			team2Scores = append(team2Scores, score.Strokes)
		}
	}
	
	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, fmt.Errorf("insufficient scores for scramble")
	}
	
	// Take the first score from each team (representing the team's combined score)
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
	// Similar to scramble - teams have combined scores
	return s.calculateScrambleHole(match, holeNumber, scores)
}

func (s *ScoringService) calculateHighLowHole(match *models.Match, holeNumber int, scores []models.Score) (*HoleResult, error) {
	// High-Low combines the highest and lowest scores from each team
	team1Scores := []int{}
	team2Scores := []int{}
	
	for i, score := range scores {
		if i%2 == 0 {
			team1Scores = append(team1Scores, score.Strokes)
		} else {
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
	// Shamble typically uses best ball after the tee shot
	return s.calculateBestBallHole(match, holeNumber, scores)
}
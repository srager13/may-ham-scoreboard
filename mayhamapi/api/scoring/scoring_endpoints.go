package handlers

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

func (h *Handler) SubmitScores(c *gin.Context) {
	var req scoring.SubmitScoresRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Submit scores
	response, err := h.scoringService.SubmitHoleScores(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast WebSocket update
	payload := map[string]interface{}{
		"match_id":     req.MatchID,
		"hole_number":  req.HoleNumber,
		"hole_result":  response.HoleResult,
		"match_status": response.MatchStatus,
	}
	h.wsHub.BroadcastToTournament(match.TournamentID, "score_updated", payload)

	c.JSON(http.StatusOK, response)
}

func (s *ScoringService) getMatch(matchID string) (*Match, error) {
	var match Match
	err := s.db.QueryRow(`
		SELECT id, tournament_id, match_format_id, holes, team1_id, team2_id
		FROM matches WHERE id = $1
	`, matchID).Scan(&match.ID, &match.TournamentID, ...)
	return &match, err
}

func (s *ScoringService) saveHoleResult(matchID string, result *HoleResult) error {
	tx, _ := s.db.Begin()
	
	// Save individual scores
	for _, score := range result.Scores {
		_, err := tx.Exec(`
			INSERT INTO hole_scores (match_id, hole_number, user_id, strokes)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (match_id, hole_number, user_id) 
			DO UPDATE SET strokes = $4
		`, matchID, result.HoleNumber, score.UserID, score.Strokes)
	}
	
	// Save hole result
	_, err := tx.Exec(`
		INSERT INTO hole_results 
		(match_id, hole_number, team1_score, team2_score, winner_team_id, team1_points, team2_points)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (match_id, hole_number) 
		DO UPDATE SET 
			team1_score = $3, 
			team2_score = $4, 
			winner_team_id = $5,
			team1_points = $6,
			team2_points = $7,
			updated_at = CURRENT_TIMESTAMP
	`, matchID, result.HoleNumber, result.Team1Score, result.Team2Score, 
	   result.WinnerTeamID, result.Team1Points, result.Team2Points)
	
	if err != nil {
		tx.Rollback()
		return err
	}
	
	return tx.Commit()
}

func (s *ScoringService) updateMatchPoints(matchID string, status *MatchStatus) error {
	statusStr := "in_progress"
	if status.MatchComplete {
		statusStr = "completed"
	}
	
	_, err := s.db.Exec(`
		UPDATE matches 
		SET team1_points = $1, 
		    team2_points = $2,
		    status = $3,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, status.Team1TotalPoints, status.Team2TotalPoints, statusStr, matchID)
	
	return err
}

func (s *ScoringService) updateStatistics(match *Match, results []HoleResult) error {
	// Calculate statistics for each player
	playerStats := make(map[string]*PlayerMatchStats)
	
	for _, result := range results {
		for _, score := range result.Scores {
			if _, exists := playerStats[score.UserID]; !exists {
				playerStats[score.UserID] = &PlayerMatchStats{
					UserID:     score.UserID,
					HolesWon:   0,
					HolesLost:  0,
					HolesTied:  0,
				}
			}
			
			// Determine if this player's team won the hole
			playerTeamID := s.getPlayerTeamID(score.UserID, match)
			
			if result.WinnerTeamID != nil && *result.WinnerTeamID == playerTeamID {
				playerStats[score.UserID].HolesWon++
			} else if result.WinnerTeamID != nil {
				playerStats[score.UserID].HolesLost++
			} else {
				playerStats[score.UserID].HolesTied++
			}
		}
	}
	
	// Update player_stats table
	tx, _ := s.db.Begin()
	
	for userID, stats := range playerStats {
		var pointsWon, pointsLost float64
		teamID := s.getPlayerTeamID(userID, match)
		
		if teamID == match.Team1ID {
			pointsWon = status.Team1TotalPoints
			pointsLost = status.Team2TotalPoints
		} else {
			pointsWon = status.Team2TotalPoints
			pointsLost = status.Team1TotalPoints
		}
		
		_, err := tx.Exec(`
			INSERT INTO player_stats 
			(tournament_id, user_id, team_id, matches_played, points_won, points_lost, 
			 holes_won, holes_lost, holes_tied)
			VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)
			ON CONFLICT (tournament_id, user_id) 
			DO UPDATE SET
				matches_played = player_stats.matches_played + 1,
				points_won = player_stats.points_won + $4,
				points_lost = player_stats.points_lost + $5,
				holes_won = player_stats.holes_won + $6,
				holes_lost = player_stats.holes_lost + $7,
				holes_tied = player_stats.holes_tied + $8,
				updated_at = CURRENT_TIMESTAMP
		`, match.TournamentID, userID, teamID, pointsWon, pointsLost,
		   stats.HolesWon, stats.HolesLost, stats.HolesTied)
		
		if err != nil {
			tx.Rollback()
			return err
		}
	}
	
	return tx.Commit()
}

func (s *ScoringService) separateScoresByTeam(match *Match, scores []HoleScore) ([]HoleScore, []HoleScore) {
	var team1Scores, team2Scores []HoleScore
	
	// Get player-team assignments for this match
	playerTeams := s.getMatchPlayerTeams(match.ID)
	
	for _, score := range scores {
		if teamID, exists := playerTeams[score.UserID]; exists {
			if teamID == match.Team1ID {
				team1Scores = append(team1Scores, score)
			} else {
				team2Scores = append(team2Scores, score)
			}
		}
	}
	
	return team1Scores, team2Scores
}

func (s *ScoringService) validateScores(match *Match, scores []HoleScore) error {
	// Check score values
	for _, score := range scores {
		if score.Strokes < 1 || score.Strokes > 15 {
			return errors.New("invalid score: must be between 1 and 15")
		}
	}
	
	// Check that all players are in the match
	matchPlayers := s.getMatchPlayers(match.ID)
	for _, score := range scores {
		if !contains(matchPlayers, score.UserID) {
			return errors.New("player not in this match")
		}
	}
	
	// Check minimum number of scores based on format
	calculator, _ := GetCalculator(match.Format)
	expectedPlayers := s.getExpectedPlayerCount(match)
	
	if len(scores) < expectedPlayers {
		return errors.New("missing scores for some players")
	}
	
	return nil
}

type PlayerMatchStats struct {
	UserID     string
	HolesWon   int
	HolesLost  int
	HolesTied  int
}
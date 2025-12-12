package handlers

import (
	"net/http"

	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
)

type LeaderboardHandler struct {
	repo *repository.Repository
}

func NewLeaderboardHandler(repo *repository.Repository) *LeaderboardHandler {
	return &LeaderboardHandler{repo: repo}
}

// GET /api/v1/tournaments/:tournament_id/leaderboard
func (h *LeaderboardHandler) GetTournamentLeaderboard(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	// Get tournament details
	tournament, err := h.repo.GetTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	// Get team standings
	teamStandings, err := h.repo.GetTeamStandings(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get live matches (in_progress status)
	liveMatches, err := h.repo.GetLiveMatches(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get total available points for the tournament
	totalAvailablePoints, err := h.repo.GetTournamentTotalAvailablePoints(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"tournament":             tournament,
		"team_standings":         teamStandings,
		"live_matches":           liveMatches,
		"total_available_points": totalAvailablePoints,
	}

	c.JSON(http.StatusOK, response)
}

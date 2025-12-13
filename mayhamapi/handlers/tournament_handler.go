package handlers

import (
	"net/http"

	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
)

type TournamentHandler struct {
	repo *repository.Repository
}

func NewTournamentHandler(repo *repository.Repository) *TournamentHandler {
	return &TournamentHandler{repo: repo}
}

// POST /api/v1/tournaments
func (h *TournamentHandler) CreateTournament(c *gin.Context) {
	var req models.CreateTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from JWT token
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	createdBy, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	tournament, err := h.repo.CreateTournament(&req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tournament)
}

// GET /api/v1/tournaments/:tournament_id
func (h *TournamentHandler) GetTournament(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	tournament, err := h.repo.GetTournament(tournamentID)
	if err != nil {
		if err.Error() == "tournament not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tournament)
}

// GET /api/v1/tournaments
func (h *TournamentHandler) ListTournaments(c *gin.Context) {
	tournaments, err := h.repo.ListTournaments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tournaments": tournaments})
}

// GET /api/v1/user/tournaments
func (h *TournamentHandler) GetUserTournaments(c *gin.Context) {
	// Get user ID from JWT token
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	tournaments, err := h.repo.GetUserTournaments(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tournaments)
}

// PATCH /api/v1/matches/:match_id/status
func (h *TournamentHandler) UpdateMatchStatus(c *gin.Context) {
	matchID := c.Param("match_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate status
	validStatuses := []string{"not_started", "in_progress", "completed"}
	isValid := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be one of: not_started, in_progress, completed"})
		return
	}

	err := h.repo.UpdateMatchStatus(matchID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match status updated successfully"})
}

// POST /api/v1/tournaments/:tournament_id/teams
func (h *TournamentHandler) CreateTeam(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	var req models.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team, err := h.repo.CreateTeam(tournamentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, team)
}

// GET /api/v1/tournaments/:tournament_id/teams
func (h *TournamentHandler) GetTeams(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	teams, err := h.repo.GetTeamsByTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teams": teams})
}

// POST /api/v1/teams/:team_id/members
func (h *TournamentHandler) AddTeamMember(c *gin.Context) {
	teamID := c.Param("team_id")

	var req models.AddTeamMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	member, err := h.repo.AddTeamMember(teamID, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, member)
}

// POST /api/v1/tournaments/:tournament_id/rounds
func (h *TournamentHandler) CreateRound(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	var req models.CreateRoundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	round, err := h.repo.CreateRound(tournamentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, round)
}

// GET /api/v1/tournaments/:tournament_id/rounds
func (h *TournamentHandler) GetRounds(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	rounds, err := h.repo.GetRoundsByTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rounds": rounds})
}

// POST /api/v1/rounds/:round_id/matches
func (h *TournamentHandler) CreateMatch(c *gin.Context) {
	roundID := c.Param("round_id")

	var req models.CreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	match, err := h.repo.CreateMatch(roundID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, match)
}

// GET /api/v1/rounds/:round_id/matches
func (h *TournamentHandler) GetMatches(c *gin.Context) {
	roundID := c.Param("round_id")

	matches, err := h.repo.GetMatchesByRound(roundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"matches": matches})
}

// GET /api/v1/matches/:match_id
func (h *TournamentHandler) GetMatch(c *gin.Context) {
	matchID := c.Param("match_id")

	match, err := h.repo.GetMatch(matchID)
	if err != nil {
		if err.Error() == "match not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Match not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, match)
}

// GET /api/v1/public/match-formats
func (h *TournamentHandler) GetMatchFormats(c *gin.Context) {
	formats, err := h.repo.GetAllMatchFormats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"formats": formats})
}

// DELETE /api/v1/tournaments/:tournament_id
func (h *TournamentHandler) DeleteTournament(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	err := h.repo.DeleteTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament deleted successfully"})
}

// DELETE /api/v1/teams/:team_id
func (h *TournamentHandler) DeleteTeam(c *gin.Context) {
	teamID := c.Param("team_id")

	err := h.repo.DeleteTeam(teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team deleted successfully"})
}

// DELETE /api/v1/rounds/:round_id
func (h *TournamentHandler) DeleteRound(c *gin.Context) {
	roundID := c.Param("round_id")

	err := h.repo.DeleteRound(roundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Round deleted successfully"})
}

// DELETE /api/v1/matches/:match_id
func (h *TournamentHandler) DeleteMatch(c *gin.Context) {
	matchID := c.Param("match_id")

	err := h.repo.DeleteMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match deleted successfully"})
}

// DELETE /api/v1/teams/:team_id/members/:user_id
func (h *TournamentHandler) DeleteTeamMember(c *gin.Context) {
	teamID := c.Param("team_id")
	userID := c.Param("user_id")

	err := h.repo.DeleteTeamMember(teamID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team member removed successfully"})
}

// GET /api/v1/teams/:team_id/members
func (h *TournamentHandler) GetTeamMembers(c *gin.Context) {
	teamID := c.Param("team_id")

	members, err := h.repo.GetTeamMembers(teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// GET /api/v1/matches/:match_id/players
func (h *TournamentHandler) GetMatchPlayers(c *gin.Context) {
	matchID := c.Param("match_id")

	players, err := h.repo.GetMatchPlayers(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"players": players})
}

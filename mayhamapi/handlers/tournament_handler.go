package handlers

import (
	"net/http"
	
	"github.com/gin-gonic/gin"
	"mayhamapi/models"
	"mayhamapi/repository"
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
	
	// TODO: Get user ID from JWT token
	createdBy := "user-id-placeholder" // For now, use placeholder
	
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

// GET /api/v1/match-formats
func (h *TournamentHandler) GetMatchFormats(c *gin.Context) {
	formats := []gin.H{
		{
			"id":          "match_play",
			"name":        "Match Play",
			"description": "Head-to-head match where each hole is won, lost, or halved",
		},
		{
			"id":          "scramble",
			"name":        "Scramble",
			"description": "Team plays from the best shot on each stroke",
		},
		{
			"id":          "best_ball",
			"name":        "Best Ball",
			"description": "Team uses the lowest score from any team member on each hole",
		},
		{
			"id":          "alternate_shot",
			"name":        "Alternate Shot",
			"description": "Team members alternate shots throughout the hole",
		},
		{
			"id":          "high_low",
			"name":        "High-Low",
			"description": "Combines highest and lowest scores from each team",
		},
		{
			"id":          "shamble",
			"name":        "Shamble",
			"description": "Team tees off, selects best drive, then plays individual balls",
		},
	}
	
	c.JSON(http.StatusOK, gin.H{"formats": formats})
}
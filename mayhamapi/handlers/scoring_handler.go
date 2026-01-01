package handlers

import (
	"net/http"
	"strconv"

	"mayhamapi/models"
	"mayhamapi/repository"
	"mayhamapi/scoring"

	"github.com/gin-gonic/gin"
)

type ScoringHandler struct {
	repo           *repository.Repository
	scoringService *scoring.ScoringService
}

func NewScoringHandler(repo *repository.Repository, scoringService *scoring.ScoringService) *ScoringHandler {
	return &ScoringHandler{
		repo:           repo,
		scoringService: scoringService,
	}
}

// POST /api/v1/matches/:match_id/scores
func (h *ScoringHandler) SubmitScores(c *gin.Context) {
	matchID := c.Param("match_id")

	var req models.SubmitScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Submit each score to the database
	var submittedScores []models.Score
	for _, holeScore := range req.Scores {
		score, err := h.repo.SubmitScore(matchID, holeScore.UserID, req.HoleNumber, holeScore.Strokes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		submittedScores = append(submittedScores, *score)
	}

	// Get match details
	match, err := h.repo.GetMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate and store match status using scoring service
	scores, err := h.repo.GetMatchScores(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	matchStatus, err := h.scoringService.CalculateAndStoreMatchResults(match, scores)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"scores":       submittedScores,
		"match_status": matchStatus,
	})
}

// GET /api/v1/matches/:match_id/scores
func (h *ScoringHandler) GetMatchScores(c *gin.Context) {
	matchID := c.Param("match_id")

	scores, err := h.repo.GetMatchScores(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get match details for context
	match, err := h.repo.GetMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate current match status
	matchStatus, err := h.scoringService.CalculateMatchStatus(match, scores)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get hole results from database
	holeResults, err := h.repo.GetMatchHoleResults(match.ID)
	if err != nil {
		// Don't fail if hole results aren't available, just log it
		holeResults = []models.HoleResult{}
	}

	c.JSON(http.StatusOK, gin.H{
		"scores":       scores,
		"match_status": matchStatus,
		"hole_results": holeResults,
	})
}

// PATCH /api/v1/matches/:match_id/scores/:hole_number
func (h *ScoringHandler) UpdateHoleScore(c *gin.Context) {
	matchID := c.Param("match_id")
	holeNumberStr := c.Param("hole_number")

	holeNumber, err := strconv.Atoi(holeNumberStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hole number"})
		return
	}

	var req models.SubmitScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update scores for the specific hole
	var updatedScores []models.Score
	for _, holeScore := range req.Scores {
		score, err := h.repo.SubmitScore(matchID, holeScore.UserID, holeNumber, holeScore.Strokes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		updatedScores = append(updatedScores, *score)
	}

	// Get updated match status
	match, err := h.repo.GetMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	allScores, err := h.repo.GetMatchScores(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	matchStatus, err := h.scoringService.CalculateAndStoreMatchResults(match, allScores)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"updated_scores": updatedScores,
		"match_status":   matchStatus,
	})
}

// POST /api/v1/pairings/:pairing_id/scores
func (h *ScoringHandler) SubmitPairingScores(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	var req models.SubmitScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Submit each score to the database
	var submittedScores []models.Score
	for _, holeScore := range req.Scores {
		score, err := h.repo.SubmitScore(pairingID, holeScore.UserID, req.HoleNumber, holeScore.Strokes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		submittedScores = append(submittedScores, *score)
	}

	// Get all matches for this pairing and calculate their statuses
	matches, err := h.repo.GetMatchesByPairing(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get all scores for the pairing
	scores, err := h.repo.GetPairingScores(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate match statuses for all matches in this pairing
	var matchStatuses []interface{}
	for _, match := range matches {
		matchStatus, err := h.scoringService.CalculateAndStoreMatchResults(&match, scores)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		matchStatuses = append(matchStatuses, gin.H{
			"match_id":     match.ID,
			"match_status": matchStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"scores":         submittedScores,
		"match_statuses": matchStatuses,
	})
}

// GET /api/v1/pairings/:pairing_id/scores
func (h *ScoringHandler) GetPairingScores(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	scores, err := h.repo.GetPairingScores(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get pairing details for context
	pairing, err := h.repo.GetPairing(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get all matches for this pairing and their statuses
	matches, err := h.repo.GetMatchesByPairing(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var matchStatuses []interface{}
	for _, match := range matches {
		matchStatus, err := h.scoringService.CalculateMatchStatus(&match, scores)
		if err != nil {
			// Log error but don't fail the whole request
			continue
		}
		matchStatuses = append(matchStatuses, gin.H{
			"match_id":     match.ID,
			"match_status": matchStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"scores":         scores,
		"pairing":        pairing,
		"match_statuses": matchStatuses,
	})
}

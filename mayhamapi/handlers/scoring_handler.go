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
		score, err := h.repo.SubmitScore(matchID, holeScore.UserID, holeScore.HoleNumber, holeScore.Strokes)
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

	// Calculate match status using scoring service
	scores, err := h.repo.GetMatchScores(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	matchStatus, err := h.scoringService.CalculateMatchStatus(match, scores)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update match if complete
	if matchStatus.MatchComplete {
		err = h.repo.UpdateMatchStatus(matchID, "completed")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
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

	c.JSON(http.StatusOK, gin.H{
		"scores":       scores,
		"match_status": matchStatus,
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
		if holeScore.HoleNumber == holeNumber {
			score, err := h.repo.SubmitScore(matchID, holeScore.UserID, holeScore.HoleNumber, holeScore.Strokes)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			updatedScores = append(updatedScores, *score)
		}
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

	matchStatus, err := h.scoringService.CalculateMatchStatus(match, allScores)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"updated_scores": updatedScores,
		"match_status":   matchStatus,
	})
}

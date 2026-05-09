package scoring

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"mayhamapi/models"
)

// fakeRepo implements only the repository methods used by CalculateAndStoreMatchResults
type fakeRepo struct {
	savedHoleResults   []*models.HoleResult
	updatedMatchPoints struct {
		matchID string
		t1      float64
		t2      float64
	}
	updatedMatchStatus struct {
		matchID string
		status  string
	}
}

func (r *fakeRepo) SaveHoleResult(h *models.HoleResult) error {
	r.savedHoleResults = append(r.savedHoleResults, h)
	return nil
}

func (r *fakeRepo) UpdateMatchPoints(matchID string, team1Points, team2Points float64) error {
	r.updatedMatchPoints.matchID = matchID
	r.updatedMatchPoints.t1 = team1Points
	r.updatedMatchPoints.t2 = team2Points
	return nil
}

func (r *fakeRepo) UpdateMatchStatus(matchID, status string) error {
	r.updatedMatchStatus.matchID = matchID
	r.updatedMatchStatus.status = status
	return nil
}

// Minimal implementations of methods called by calculateHoleResult
func (r *fakeRepo) GetMatchFormat(formatID string) (*models.MatchFormatEntity, error) {
	// Return a simple singles match_play format (1 player per side)
	return &models.MatchFormatEntity{ID: formatID, PlayersPerSide: 1, ScoringType: "match_play"}, nil
}

func (r *fakeRepo) GetMatchHoleResults(matchID string) ([]models.HoleResult, error) {
	// No stored results in this fake
	return []models.HoleResult{}, nil
}

// The repository interface in production contains many methods; tests embed our fakeRepo into
// a Repository-like struct that the service expects (pointer receiver type names only matter).

func TestCalculateAndStoreMatchResults_SubRangeCompleted(t *testing.T) {
	fr := &fakeRepo{}
	s := &ScoringService{repo: fr}

	// Build a match that covers holes 1-9 (sub-range)
	start := 1
	end := 9
	match := &models.Match{
		ID:              "match-1",
		Holes:           18, // total holes in match template, but Start/End specify sub-range
		StartHole:       &start,
		EndHole:         &end,
		PointsAvailable: 1.0,
		Team1ID:         "team1",
		Team2ID:         "team2",
		Status:          "not_started",
	}

	// Create scores for holes 1..9. For match_play singles, we need one score per team per hole.
	var scores []models.Score
	for h := 1; h <= 9; h++ {
		// Team1 player (user t1)
		scores = append(scores, models.Score{UserID: "u1", HoleNumber: h, Strokes: 4})
		// Team2 player (user t2) - give worse strokes so team1 wins each hole
		scores = append(scores, models.Score{UserID: "u2", HoleNumber: h, Strokes: 5})
	}

	// Call the method under test
	status, err := s.CalculateAndStoreMatchResults(match, scores)
	assert.NoError(t, err)
	assert.NotNil(t, status)

	// All 9 holes should have been saved
	assert.Equal(t, 9, len(fr.savedHoleResults), "expected 9 saved hole results for sub-range")

	// Match should be marked complete
	assert.True(t, status.MatchComplete, "match status should be complete")
	assert.Equal(t, 0, status.HolesRemaining, "no holes remaining for completed sub-range")

	// UpdateMatchStatus should have been called with "completed"
	assert.Equal(t, "match-1", fr.updatedMatchStatus.matchID)
	assert.Equal(t, "completed", fr.updatedMatchStatus.status)

	// Match points: since team1 won all holes, they should receive full PointsAvailable
	assert.Equal(t, 1.0, fr.updatedMatchPoints.t1)
	assert.Equal(t, 0.0, fr.updatedMatchPoints.t2)
	assert.Equal(t, "match-1", fr.updatedMatchPoints.matchID)
}

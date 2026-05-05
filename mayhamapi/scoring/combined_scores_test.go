package scoring

import (
	"testing"

	"mayhamapi/models"

	"github.com/stretchr/testify/assert"
)

// Tests for calculateCombinedScoresHole covering gross and stableford behavior
func TestCalculateCombinedScores_GrossWinAndTie(t *testing.T) {
	svc := NewScoringService(nil)

	match := &models.Match{
		Team1ID: "team1",
		Team2ID: "team2",
		Players: []models.MatchPlayer{
			{UserID: "u1", TeamID: "team1"},
			{UserID: "u2", TeamID: "team1"},
			{UserID: "u3", TeamID: "team2"},
			{UserID: "u4", TeamID: "team2"},
		},
	}

	// Gross case: lower summed strokes wins
	scores := []models.Score{
		{UserID: "u1", Strokes: 4},
		{UserID: "u2", Strokes: 5},
		{UserID: "u3", Strokes: 5},
		{UserID: "u4", Strokes: 6},
	}

	res, err := svc.calculateCombinedScoresHole(match, 1, scores)
	assert.NoError(t, err)
	assert.NotNil(t, res.Team1Score)
	assert.NotNil(t, res.Team2Score)
	assert.Equal(t, 9, *res.Team1Score)  // 4 + 5
	assert.Equal(t, 11, *res.Team2Score) // 5 + 6
	assert.Equal(t, 1.0, res.Team1Points)
	assert.Equal(t, 0.0, res.Team2Points)
	if assert.NotNil(t, res.WinnerTeamID) {
		assert.Equal(t, match.Team1ID, *res.WinnerTeamID)
	}

	// Gross tie
	scoresTie := []models.Score{
		{UserID: "u1", Strokes: 4},
		{UserID: "u2", Strokes: 5},
		{UserID: "u3", Strokes: 4},
		{UserID: "u4", Strokes: 5},
	}

	res2, err := svc.calculateCombinedScoresHole(match, 1, scoresTie)
	assert.NoError(t, err)
	assert.Equal(t, 9, *res2.Team1Score)
	assert.Equal(t, 9, *res2.Team2Score)
	assert.Equal(t, 0.5, res2.Team1Points)
	assert.Equal(t, 0.5, res2.Team2Points)
	assert.Nil(t, res2.WinnerTeamID)
}

func TestCalculateCombinedScores_StablefordWinTieAndMissingPoints(t *testing.T) {
	svc := NewScoringService(nil)

	match := &models.Match{
		Team1ID: "team1",
		Team2ID: "team2",
		Players: []models.MatchPlayer{
			{UserID: "u1", TeamID: "team1"},
			{UserID: "u2", TeamID: "team1"},
			{UserID: "u3", TeamID: "team2"},
			{UserID: "u4", TeamID: "team2"},
		},
	}

	// Stableford case: higher summed StablefordPoints wins
	sp1 := 3
	sp2 := 2
	sp3 := 1
	sp4 := 1

	scores := []models.Score{
		{UserID: "u1", Strokes: 4, StablefordPoints: &sp1},
		{UserID: "u2", Strokes: 5, StablefordPoints: &sp2},
		{UserID: "u3", Strokes: 5, StablefordPoints: &sp3},
		{UserID: "u4", Strokes: 6, StablefordPoints: &sp4},
	}

	res, err := svc.calculateCombinedScoresHole(match, 1, scores)
	assert.NoError(t, err)
	assert.Equal(t, 5, *res.Team1Score) // 3 + 2
	assert.Equal(t, 2, *res.Team2Score) // 1 + 1
	assert.Equal(t, 1.0, res.Team1Points)
	assert.Equal(t, 0.0, res.Team2Points)
	if assert.NotNil(t, res.WinnerTeamID) {
		assert.Equal(t, match.Team1ID, *res.WinnerTeamID)
	}

	// Stableford tie
	spA := 2
	spB := 3
	spC := 1
	spD := 4
	scoresTie := []models.Score{
		{UserID: "u1", Strokes: 4, StablefordPoints: &spA},
		{UserID: "u2", Strokes: 5, StablefordPoints: &spB},
		{UserID: "u3", Strokes: 5, StablefordPoints: &spC},
		{UserID: "u4", Strokes: 6, StablefordPoints: &spD},
	}

	res2, err := svc.calculateCombinedScoresHole(match, 1, scoresTie)
	assert.NoError(t, err)
	assert.Equal(t, 5, *res2.Team1Score) // 2 + 3
	assert.Equal(t, 5, *res2.Team2Score) // 1 + 4
	assert.Equal(t, 0.5, res2.Team1Points)
	assert.Equal(t, 0.5, res2.Team2Points)
	assert.Nil(t, res2.WinnerTeamID)

	// Stableford but missing StablefordPoints for a player -> error
	// One player's StablefordPoints is nil
	incomplete := []models.Score{
		{UserID: "u1", Strokes: 4, StablefordPoints: &sp1},
		{UserID: "u2", Strokes: 5, StablefordPoints: nil},
		{UserID: "u3", Strokes: 5, StablefordPoints: &sp3},
		{UserID: "u4", Strokes: 6, StablefordPoints: &sp4},
	}

	_, err = svc.calculateCombinedScoresHole(match, 1, incomplete)
	assert.Error(t, err)
}

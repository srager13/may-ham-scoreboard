package scoring

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestMatchPlayCalculator(t *testing.T) {
	calc := NewMatchPlayCalculator()
	
	team1Scores := []HoleScore{
		{UserID: "player1", Strokes: 4},
		{UserID: "player2", Strokes: 5},
	}
	
	team2Scores := []HoleScore{
		{UserID: "player3", Strokes: 5},
		{UserID: "player4", Strokes: 6},
	}
	
	result, err := calc.CalculateHoleResult(1, team1Scores, team2Scores, "team1", "team2")
	
	assert.NoError(t, err)
	assert.Equal(t, 4, *result.Team1Score)
	assert.Equal(t, 5, *result.Team2Score)
	assert.Equal(t, "team1", *result.WinnerTeamID)
	assert.Equal(t, 1.0, result.Team1Points)
	assert.Equal(t, 0.0, result.Team2Points)
}

func TestHighLowCalculator(t *testing.T) {
	calc := NewHighLowCalculator()
	
	team1Scores := []HoleScore{
		{UserID: "player1", Strokes: 4},
		{UserID: "player2", Strokes: 6},
	}
	
	team2Scores := []HoleScore{
		{UserID: "player3", Strokes: 5},
		{UserID: "player4", Strokes: 5},
	}
	
	result, err := calc.CalculateHoleResult(1, team1Scores, team2Scores, "team1", "team2")
	
	assert.NoError(t, err)
	assert.Equal(t, 10, *result.Team1Score) // 4 + 6 = 10
	assert.Equal(t, 10, *result.Team2Score) // 5 + 5 = 10
	assert.Nil(t, result.WinnerTeamID)      // Tie
	assert.Equal(t, 0.5, result.Team1Points)
	assert.Equal(t, 0.5, result.Team2Points)
}

func TestDormieDetection(t *testing.T) {
	calc := NewMatchPlayCalculator()
	
	// Team 1 wins first 4 holes of a 6-hole match
	results := []HoleResult{
		{HoleNumber: 1, Team1Points: 1.0, Team2Points: 0.0},
		{HoleNumber: 2, Team1Points: 1.0, Team2Points: 0.0},
		{HoleNumber: 3, Team1Points: 1.0, Team2Points: 0.0},
		{HoleNumber: 4, Team1Points: 1.0, Team2Points: 0.0},
	}
	
	status, err := calc.CalculateMatchStatus(results, 6, "team1", "team2")
	
	assert.NoError(t, err)
	assert.True(t, status.MatchComplete)
	assert.Equal(t, "team1", *status.WinnerTeamID)
	assert.Equal(t, 4.0, status.Team1TotalPoints)
	assert.Equal(t, 2, status.HolesRemaining)
}

func TestAlternateShot(t *testing.T) {
	calc := NewAlternateShotCalculator()
	
	team1Scores := []HoleScore{{UserID: "team1", Strokes: 4}}
	team2Scores := []HoleScore{{UserID: "team2", Strokes: 5}}
	
	result, err := calc.CalculateHoleResult(1, team1Scores, team2Scores, "team1", "team2")
	
	assert.NoError(t, err)
	assert.Equal(t, 4, *result.Team1Score)
	assert.Equal(t, 1.0, result.Team1Points)
}
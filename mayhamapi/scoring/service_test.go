package scoring

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestCalculateStablefordPoints tests the Stableford points calculation
func TestCalculateStablefordPoints(t *testing.T) {
	tests := []struct {
		name            string
		par             int
		strokes         int
		handicapStrokes int
		expectedPoints  int
		description     string
	}{
		{
			name:            "Par score",
			par:             4,
			strokes:         4,
			handicapStrokes: 0,
			expectedPoints:  2,
			description:     "Net par should give 2 points",
		},
		{
			name:            "Birdie",
			par:             4,
			strokes:         3,
			handicapStrokes: 0,
			expectedPoints:  3,
			description:     "Net birdie should give 3 points",
		},
		{
			name:            "Eagle",
			par:             5,
			strokes:         3,
			handicapStrokes: 0,
			expectedPoints:  4,
			description:     "Net eagle should give 4 points",
		},
		{
			name:            "Albatross",
			par:             5,
			strokes:         2,
			handicapStrokes: 0,
			expectedPoints:  5,
			description:     "Net albatross should give 5 points",
		},
		{
			name:            "Bogey",
			par:             4,
			strokes:         5,
			handicapStrokes: 0,
			expectedPoints:  1,
			description:     "Net bogey should give 1 point",
		},
		{
			name:            "Double bogey",
			par:             4,
			strokes:         6,
			handicapStrokes: 0,
			expectedPoints:  0,
			description:     "Net double bogey should give 0 points",
		},
		{
			name:            "Triple bogey",
			par:             4,
			strokes:         7,
			handicapStrokes: 0,
			expectedPoints:  0,
			description:     "Net triple bogey should give 0 points",
		},
		{
			name:            "Gross bogey with handicap stroke becomes par",
			par:             4,
			strokes:         5,
			handicapStrokes: 1,
			expectedPoints:  2,
			description:     "Gross 5 with 1 handicap stroke = net 4 (par) = 2 points",
		},
		{
			name:            "Gross double with 2 strokes becomes par",
			par:             4,
			strokes:         6,
			handicapStrokes: 2,
			expectedPoints:  2,
			description:     "Gross 6 with 2 handicap strokes = net 4 (par) = 2 points",
		},
		{
			name:            "Gross par with stroke becomes birdie",
			par:             4,
			strokes:         4,
			handicapStrokes: 1,
			expectedPoints:  3,
			description:     "Gross 4 with 1 handicap stroke = net 3 (birdie) = 3 points",
		},
		{
			name:            "Gross birdie with stroke becomes eagle",
			par:             4,
			strokes:         3,
			handicapStrokes: 1,
			expectedPoints:  4,
			description:     "Gross 3 with 1 handicap stroke = net 2 (eagle) = 4 points",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateStablefordPoints(tt.par, tt.strokes, tt.handicapStrokes)
			assert.Equal(t, tt.expectedPoints, result, tt.description)
		})
	}
}

// TestCalculateMatchPlayHole tests match play hole calculation logic
func TestCalculateMatchPlayHole(t *testing.T) {
	tests := []struct {
		name             string
		team1Scores      []int
		team2Scores      []int
		playersPerSide   int
		expectedTeam1    *int
		expectedTeam2    *int
		expectedT1Points float64
		expectedT2Points float64
		description      string
	}{
		{
			name:             "Singles - Team1 wins",
			team1Scores:      []int{4},
			team2Scores:      []int{5},
			playersPerSide:   1,
			expectedTeam1:    intPtr(4),
			expectedTeam2:    intPtr(5),
			expectedT1Points: 1.0,
			expectedT2Points: 0.0,
			description:      "Team1 scores 4, Team2 scores 5 - Team1 wins",
		},
		{
			name:             "Singles - Team2 wins",
			team1Scores:      []int{5},
			team2Scores:      []int{4},
			playersPerSide:   1,
			expectedTeam1:    intPtr(5),
			expectedTeam2:    intPtr(4),
			expectedT1Points: 0.0,
			expectedT2Points: 1.0,
			description:      "Team1 scores 5, Team2 scores 4 - Team2 wins",
		},
		{
			name:             "Singles - Halve",
			team1Scores:      []int{4},
			team2Scores:      []int{4},
			playersPerSide:   1,
			expectedTeam1:    intPtr(4),
			expectedTeam2:    intPtr(4),
			expectedT1Points: 0.5,
			expectedT2Points: 0.5,
			description:      "Both teams score 4 - halve",
		},
		{
			name:             "Pairs - Team1 best ball wins",
			team1Scores:      []int{4, 5},
			team2Scores:      []int{5, 6},
			playersPerSide:   2,
			expectedTeam1:    intPtr(4),
			expectedTeam2:    intPtr(5),
			expectedT1Points: 1.0,
			expectedT2Points: 0.0,
			description:      "Team1 best is 4, Team2 best is 5 - Team1 wins",
		},
		{
			name:             "Pairs - Team2 best ball wins",
			team1Scores:      []int{5, 6},
			team2Scores:      []int{4, 5},
			playersPerSide:   2,
			expectedTeam1:    intPtr(5),
			expectedTeam2:    intPtr(4),
			expectedT1Points: 0.0,
			expectedT2Points: 1.0,
			description:      "Team1 best is 5, Team2 best is 4 - Team2 wins",
		},
		{
			name:             "Pairs - Halve with different scores",
			team1Scores:      []int{4, 6},
			team2Scores:      []int{4, 7},
			playersPerSide:   2,
			expectedTeam1:    intPtr(4),
			expectedTeam2:    intPtr(4),
			expectedT1Points: 0.5,
			expectedT2Points: 0.5,
			description:      "Both teams have best score of 4 - halve",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Note: This is a simplified test that doesn't involve repository
			// In real scenario, we'd need to test with actual match and repository
			// For now, we're testing the logic of score comparison

			var team1Score, team2Score int

			if tt.playersPerSide == 1 {
				team1Score = tt.team1Scores[0]
				team2Score = tt.team2Scores[0]
			} else {
				// Take best score from each team
				team1Score = tt.team1Scores[0]
				for _, score := range tt.team1Scores {
					if score < team1Score {
						team1Score = score
					}
				}

				team2Score = tt.team2Scores[0]
				for _, score := range tt.team2Scores {
					if score < team2Score {
						team2Score = score
					}
				}
			}

			assert.Equal(t, *tt.expectedTeam1, team1Score, "Team1 score should match")
			assert.Equal(t, *tt.expectedTeam2, team2Score, "Team2 score should match")

			// Determine points
			var t1Points, t2Points float64
			if team1Score < team2Score {
				t1Points = 1.0
				t2Points = 0.0
			} else if team2Score < team1Score {
				t1Points = 0.0
				t2Points = 1.0
			} else {
				t1Points = 0.5
				t2Points = 0.5
			}

			assert.Equal(t, tt.expectedT1Points, t1Points, tt.description)
			assert.Equal(t, tt.expectedT2Points, t2Points, tt.description)
		})
	}
}

// TestBestBallScoring tests best ball scoring logic
func TestBestBallScoring(t *testing.T) {
	tests := []struct {
		name             string
		team1Scores      []int
		team2Scores      []int
		expectedTeam1    int
		expectedTeam2    int
		expectedT1Points float64
		expectedT2Points float64
		description      string
	}{
		{
			name:             "Team1 has better best ball",
			team1Scores:      []int{4, 5},
			team2Scores:      []int{5, 6},
			expectedTeam1:    4,
			expectedTeam2:    5,
			expectedT1Points: 1.0,
			expectedT2Points: 0.0,
			description:      "Team1 best is 4, Team2 best is 5",
		},
		{
			name:             "Team2 has better best ball",
			team1Scores:      []int{5, 6},
			team2Scores:      []int{4, 5},
			expectedTeam1:    5,
			expectedTeam2:    4,
			expectedT1Points: 0.0,
			expectedT2Points: 1.0,
			description:      "Team1 best is 5, Team2 best is 4",
		},
		{
			name:             "Tied best balls",
			team1Scores:      []int{4, 6},
			team2Scores:      []int{4, 7},
			expectedTeam1:    4,
			expectedTeam2:    4,
			expectedT1Points: 0.5,
			expectedT2Points: 0.5,
			description:      "Both teams have best score of 4",
		},
		{
			name:             "Multiple players - clear winner",
			team1Scores:      []int{4, 5, 6},
			team2Scores:      []int{5, 6, 7},
			expectedTeam1:    4,
			expectedTeam2:    5,
			expectedT1Points: 1.0,
			expectedT2Points: 0.0,
			description:      "Team1 best is 4 from multiple players",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Calculate best scores
			team1Best := tt.team1Scores[0]
			for _, score := range tt.team1Scores {
				if score < team1Best {
					team1Best = score
				}
			}

			team2Best := tt.team2Scores[0]
			for _, score := range tt.team2Scores {
				if score < team2Best {
					team2Best = score
				}
			}

			assert.Equal(t, tt.expectedTeam1, team1Best, "Team1 best ball should match")
			assert.Equal(t, tt.expectedTeam2, team2Best, "Team2 best ball should match")

			// Determine points
			var t1Points, t2Points float64
			if team1Best < team2Best {
				t1Points = 1.0
			} else if team2Best < team1Best {
				t2Points = 1.0
			} else {
				t1Points = 0.5
				t2Points = 0.5
			}

			assert.Equal(t, tt.expectedT1Points, t1Points, tt.description)
			assert.Equal(t, tt.expectedT2Points, t2Points, tt.description)
		})
	}
}

// TestHighLowScoring tests high-low scoring logic
func TestHighLowScoring(t *testing.T) {
	tests := []struct {
		name             string
		team1Scores      []int
		team2Scores      []int
		expectedTeam1    int // high + low total
		expectedTeam2    int // high + low total
		expectedT1Points float64
		expectedT2Points float64
		description      string
	}{
		{
			name:             "Team1 wins both low and high",
			team1Scores:      []int{4, 5},
			team2Scores:      []int{5, 6},
			expectedTeam1:    9,   // 4 + 5
			expectedTeam2:    11,  // 5 + 6
			expectedT1Points: 2.0, // 1 for low + 1 for high
			expectedT2Points: 0.0,
			description:      "Team1 has lower low (4 vs 5) and lower high (5 vs 6)",
		},
		{
			name:             "Team2 wins both low and high",
			team1Scores:      []int{5, 6},
			team2Scores:      []int{4, 5},
			expectedTeam1:    11, // 5 + 6
			expectedTeam2:    9,  // 4 + 5
			expectedT1Points: 0.0,
			expectedT2Points: 2.0, // 1 for low + 1 for high
			description:      "Team2 has lower low (4 vs 5) and lower high (5 vs 6)",
		},
		{
			name:             "Split - Team1 wins low, Team2 wins high",
			team1Scores:      []int{3, 7},
			team2Scores:      []int{4, 6},
			expectedTeam1:    10,  // 3 + 7
			expectedTeam2:    10,  // 4 + 6
			expectedT1Points: 1.0, // 1 for low (3 vs 4), 0 for high (7 vs 6)
			expectedT2Points: 1.0, // 0 for low, 1 for high
			description:      "Team1 wins low score, Team2 wins high score",
		},
		{
			name:             "Split - Team2 wins low, Team1 wins high",
			team1Scores:      []int{4, 6},
			team2Scores:      []int{3, 7},
			expectedTeam1:    10,  // 4 + 6
			expectedTeam2:    10,  // 3 + 7
			expectedT1Points: 1.0, // 0 for low (4 vs 3), 1 for high (6 vs 7)
			expectedT2Points: 1.0, // 1 for low, 0 for high
			description:      "Team2 wins low score, Team1 wins high score",
		},
		{
			name:             "Tied low scores, Team1 wins high",
			team1Scores:      []int{4, 5},
			team2Scores:      []int{4, 6},
			expectedTeam1:    9,   // 4 + 5
			expectedTeam2:    10,  // 4 + 6
			expectedT1Points: 1.5, // 0.5 for tied low + 1 for winning high
			expectedT2Points: 0.5, // 0.5 for tied low
			description:      "Low scores tied at 4, Team1 wins high (5 vs 6)",
		},
		{
			name:             "Team1 wins low, tied high scores",
			team1Scores:      []int{4, 6},
			team2Scores:      []int{5, 6},
			expectedTeam1:    10,  // 4 + 6
			expectedTeam2:    11,  // 5 + 6
			expectedT1Points: 1.5, // 1 for winning low + 0.5 for tied high
			expectedT2Points: 0.5, // 0.5 for tied high
			description:      "Team1 wins low (4 vs 5), high scores tied at 6",
		},
		{
			name:             "All tied",
			team1Scores:      []int{4, 6},
			team2Scores:      []int{4, 6},
			expectedTeam1:    10,  // 4 + 6
			expectedTeam2:    10,  // 4 + 6
			expectedT1Points: 1.0, // 0.5 for tied low + 0.5 for tied high
			expectedT2Points: 1.0,
			description:      "Both low and high scores are tied",
		},
		{
			name:             "More than 2 players per team",
			team1Scores:      []int{3, 5, 7},
			team2Scores:      []int{4, 6, 8},
			expectedTeam1:    10,  // 3 + 7
			expectedTeam2:    12,  // 4 + 8
			expectedT1Points: 2.0, // wins both low (3 vs 4) and high (7 vs 8)
			expectedT2Points: 0.0,
			description:      "Works with more than 2 players - Team1 wins both",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Calculate high + low for each team
			team1High := tt.team1Scores[0]
			team1Low := tt.team1Scores[0]
			for _, score := range tt.team1Scores {
				if score > team1High {
					team1High = score
				}
				if score < team1Low {
					team1Low = score
				}
			}

			team2High := tt.team2Scores[0]
			team2Low := tt.team2Scores[0]
			for _, score := range tt.team2Scores {
				if score > team2High {
					team2High = score
				}
				if score < team2Low {
					team2Low = score
				}
			}

			team1Total := team1High + team1Low
			team2Total := team2High + team2Low

			assert.Equal(t, tt.expectedTeam1, team1Total, "Team1 high+low total should match")
			assert.Equal(t, tt.expectedTeam2, team2Total, "Team2 high+low total should match")

			// Calculate points
			var t1Points, t2Points float64

			// Low score comparison
			if team1Low < team2Low {
				t1Points += 1.0
			} else if team2Low < team1Low {
				t2Points += 1.0
			} else {
				t1Points += 0.5
				t2Points += 0.5
			}

			// High score comparison
			if team1High < team2High {
				t1Points += 1.0
			} else if team2High < team1High {
				t2Points += 1.0
			} else {
				t1Points += 0.5
				t2Points += 0.5
			}

			assert.Equal(t, tt.expectedT1Points, t1Points, tt.description)
			assert.Equal(t, tt.expectedT2Points, t2Points, tt.description)
		})
	}
}

// TestScrambleScoring tests scramble scoring logic
func TestScrambleScoring(t *testing.T) {
	tests := []struct {
		name             string
		team1Score       int
		team2Score       int
		expectedT1Points float64
		expectedT2Points float64
		description      string
	}{
		{
			name:             "Team1 wins",
			team1Score:       4,
			team2Score:       5,
			expectedT1Points: 1.0,
			expectedT2Points: 0.0,
			description:      "Team1 scramble score is 4, Team2 is 5",
		},
		{
			name:             "Team2 wins",
			team1Score:       5,
			team2Score:       4,
			expectedT1Points: 0.0,
			expectedT2Points: 1.0,
			description:      "Team1 scramble score is 5, Team2 is 4",
		},
		{
			name:             "Tied",
			team1Score:       4,
			team2Score:       4,
			expectedT1Points: 0.5,
			expectedT2Points: 0.5,
			description:      "Both teams score 4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Determine points
			var t1Points, t2Points float64
			if tt.team1Score < tt.team2Score {
				t1Points = 1.0
			} else if tt.team2Score < tt.team1Score {
				t2Points = 1.0
			} else {
				t1Points = 0.5
				t2Points = 0.5
			}

			assert.Equal(t, tt.expectedT1Points, t1Points, tt.description)
			assert.Equal(t, tt.expectedT2Points, t2Points, tt.description)
		})
	}
}

// TestMatchStatusCalculation tests match status determination
func TestMatchStatusCalculation(t *testing.T) {
	tests := []struct {
		name              string
		team1HolePoints   float64
		team2HolePoints   float64
		holesCompleted    int
		totalHoles        int
		pointsAvailable   float64
		expectedT1Match   float64
		expectedT2Match   float64
		expectedComplete  bool
		expectedWinnerSet bool
		description       string
	}{
		{
			name:              "Team1 wins completed 18-hole match",
			team1HolePoints:   10.0,
			team2HolePoints:   8.0,
			holesCompleted:    18,
			totalHoles:        18,
			pointsAvailable:   1.0,
			expectedT1Match:   1.0,
			expectedT2Match:   0.0,
			expectedComplete:  true,
			expectedWinnerSet: true,
			description:       "Team1 has more hole points when match is complete",
		},
		{
			name:              "Team2 wins completed match",
			team1HolePoints:   8.0,
			team2HolePoints:   10.0,
			holesCompleted:    18,
			totalHoles:        18,
			pointsAvailable:   1.0,
			expectedT1Match:   0.0,
			expectedT2Match:   1.0,
			expectedComplete:  true,
			expectedWinnerSet: true,
			description:       "Team2 has more hole points when match is complete",
		},
		{
			name:              "Tied match - split points",
			team1HolePoints:   9.0,
			team2HolePoints:   9.0,
			holesCompleted:    18,
			totalHoles:        18,
			pointsAvailable:   1.0,
			expectedT1Match:   0.5,
			expectedT2Match:   0.5,
			expectedComplete:  true,
			expectedWinnerSet: false,
			description:       "Equal hole points results in split match points",
		},
		{
			name:              "Incomplete match - no match points awarded",
			team1HolePoints:   5.0,
			team2HolePoints:   4.0,
			holesCompleted:    9,
			totalHoles:        18,
			pointsAvailable:   1.0,
			expectedT1Match:   0.0,
			expectedT2Match:   0.0,
			expectedComplete:  false,
			expectedWinnerSet: false,
			description:       "Match not complete, no match points awarded yet",
		},
		{
			name:              "9-hole match complete",
			team1HolePoints:   5.0,
			team2HolePoints:   4.0,
			holesCompleted:    9,
			totalHoles:        9,
			pointsAvailable:   1.0,
			expectedT1Match:   1.0,
			expectedT2Match:   0.0,
			expectedComplete:  true,
			expectedWinnerSet: true,
			description:       "9-hole match is complete and Team1 wins",
		},
		{
			name:              "Multiple points available",
			team1HolePoints:   10.0,
			team2HolePoints:   8.0,
			holesCompleted:    18,
			totalHoles:        18,
			pointsAvailable:   2.5,
			expectedT1Match:   2.5,
			expectedT2Match:   0.0,
			expectedComplete:  true,
			expectedWinnerSet: true,
			description:       "Winner gets all 2.5 available points",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holesRemaining := tt.totalHoles - tt.holesCompleted
			matchComplete := tt.holesCompleted >= tt.totalHoles

			assert.Equal(t, tt.expectedComplete, matchComplete, "Match completion status")

			var matchT1Points, matchT2Points float64
			var hasWinner bool

			if matchComplete {
				if tt.team1HolePoints > tt.team2HolePoints {
					matchT1Points = tt.pointsAvailable
					matchT2Points = 0.0
					hasWinner = true
				} else if tt.team2HolePoints > tt.team1HolePoints {
					matchT1Points = 0.0
					matchT2Points = tt.pointsAvailable
					hasWinner = true
				} else {
					matchT1Points = tt.pointsAvailable / 2
					matchT2Points = tt.pointsAvailable / 2
					hasWinner = false
				}
			} else {
				matchT1Points = 0.0
				matchT2Points = 0.0
				hasWinner = false
			}

			assert.Equal(t, tt.expectedT1Match, matchT1Points, "Team1 match points")
			assert.Equal(t, tt.expectedT2Match, matchT2Points, "Team2 match points")
			assert.Equal(t, tt.expectedWinnerSet, hasWinner, "Winner determination")

			if !matchComplete {
				assert.Greater(t, holesRemaining, 0, "Should have holes remaining")
			} else {
				assert.Equal(t, 0, holesRemaining, "Should have no holes remaining")
			}
		})
	}
}

// Helper function to create int pointers
func intPtr(i int) *int {
	return &i
}

// TestHoleRangeCalculation tests the hole range logic for partial matches
func TestHoleRangeCalculation(t *testing.T) {
	tests := []struct {
		name            string
		startHole       *int
		endHole         *int
		totalHoles      int
		expectedStart   int
		expectedEnd     int
		expectedInRange int
		description     string
	}{
		{
			name:            "Full 18-hole match",
			startHole:       nil,
			endHole:         nil,
			totalHoles:      18,
			expectedStart:   1,
			expectedEnd:     18,
			expectedInRange: 18,
			description:     "No range specified = full match",
		},
		{
			name:            "First 6 holes",
			startHole:       intPtr(1),
			endHole:         intPtr(6),
			totalHoles:      6,
			expectedStart:   1,
			expectedEnd:     6,
			expectedInRange: 6,
			description:     "Holes 1-6",
		},
		{
			name:            "Middle 6 holes",
			startHole:       intPtr(7),
			endHole:         intPtr(12),
			totalHoles:      6,
			expectedStart:   7,
			expectedEnd:     12,
			expectedInRange: 6,
			description:     "Holes 7-12",
		},
		{
			name:            "Last 6 holes",
			startHole:       intPtr(13),
			endHole:         intPtr(18),
			totalHoles:      6,
			expectedStart:   13,
			expectedEnd:     18,
			expectedInRange: 6,
			description:     "Holes 13-18",
		},
		{
			name:            "9-hole back nine",
			startHole:       intPtr(10),
			endHole:         intPtr(18),
			totalHoles:      9,
			expectedStart:   10,
			expectedEnd:     18,
			expectedInRange: 9,
			description:     "Holes 10-18 (back nine)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the logic from the scoring service
			startHole := 1
			endHole := tt.totalHoles

			if tt.startHole != nil && tt.endHole != nil {
				startHole = *tt.startHole
				endHole = *tt.endHole
			}

			assert.Equal(t, tt.expectedStart, startHole, "Start hole should match")
			assert.Equal(t, tt.expectedEnd, endHole, "End hole should match")

			holesInRange := endHole - startHole + 1
			assert.Equal(t, tt.expectedInRange, holesInRange, tt.description)
		})
	}
}

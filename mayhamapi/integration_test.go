package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mayhamapi/handlers"
	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)
	m.Run()
}

func TestGetMatchesByRound_Integration(t *testing.T) {
	// Setup test database
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	// Create repository and handlers
	repo := repository.NewRepository(testDB.DB)
	tournamentHandler := handlers.NewTournamentHandler(repo)

	// Create test data
	testData := CreateTestData(t, testDB, repo)

	// Setup test router
	router := gin.New()
	router.GET("/api/v1/rounds/:round_id/matches", tournamentHandler.GetMatches)

	// Create test request
	req, _ := http.NewRequest("GET", "/api/v1/rounds/"+testData.RoundID+"/matches", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.Match
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	matches := response["matches"]
	require.Len(t, matches, 1, "Should return exactly one match")

	match := matches[0]

	// Verify match basic data
	assert.Equal(t, testData.MatchID, match.ID)
	assert.Equal(t, testData.RoundID, match.RoundID)
	assert.Equal(t, testData.Team1ID, match.Team1ID)
	assert.Equal(t, testData.Team2ID, match.Team2ID)
	assert.Equal(t, 9, match.Holes)

	// Verify team data is populated
	require.NotNil(t, match.Team1, "Team1 should be populated")
	require.NotNil(t, match.Team2, "Team2 should be populated")
	assert.Equal(t, "Team Alpha", match.Team1.Name)
	assert.Equal(t, "#FF0000", *match.Team1.Color)
	assert.Equal(t, "Team Beta", match.Team2.Name)
	assert.Equal(t, "#0000FF", *match.Team2.Color)

	// Verify format data is populated
	require.NotNil(t, match.Format, "Format should be populated")
	assert.NotEmpty(t, match.Format.Name, "Format name should not be empty")

	// Verify players data is populated
	require.NotEmpty(t, match.Players, "Players should be populated")
	assert.Equal(t, 4, len(match.Players), "Should have 4 players (2 per team)")

	// Verify player data structure
	for _, player := range match.Players {
		assert.NotEmpty(t, player.ID, "Player ID should not be empty")
		assert.NotEmpty(t, player.UserID, "Player UserID should not be empty")
		assert.NotEmpty(t, player.TeamID, "Player TeamID should not be empty")
		assert.True(t, player.TeamID == testData.Team1ID || player.TeamID == testData.Team2ID, "Player should belong to one of the teams")
		assert.Greater(t, player.Position, 0, "Player position should be positive")

		// Verify user data is populated
		require.NotNil(t, player.User, "Player User should be populated")
		assert.NotEmpty(t, player.User.ID, "Player User ID should not be empty")
		assert.NotEmpty(t, player.User.Name, "Player User Name should not be empty")
		assert.NotEmpty(t, player.User.Email, "Player User Email should not be empty")
	}

	// Verify team distribution
	team1Players := 0
	team2Players := 0
	for _, player := range match.Players {
		if player.TeamID == testData.Team1ID {
			team1Players++
		} else if player.TeamID == testData.Team2ID {
			team2Players++
		}
	}
	assert.Equal(t, 2, team1Players, "Team1 should have 2 players")
	assert.Equal(t, 2, team2Players, "Team2 should have 2 players")
}

func TestGetMatchesByRound_EmptyResult(t *testing.T) {
	// Setup test database
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	// Create repository and handlers
	repo := repository.NewRepository(testDB.DB)
	tournamentHandler := handlers.NewTournamentHandler(repo)

	// Setup test router
	router := gin.New()
	router.GET("/api/v1/rounds/:round_id/matches", tournamentHandler.GetMatches)

	// Create test request with non-existent round ID (but valid UUID format)
	req, _ := http.NewRequest("GET", "/api/v1/rounds/00000000-0000-0000-0000-000000000000/matches", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Debug: print response if not 200
	if w.Code != http.StatusOK {
		t.Logf("Response status: %d", w.Code)
		t.Logf("Response body: %s", w.Body.String())
	}

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.Match
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	matches := response["matches"]
	assert.Len(t, matches, 0, "Should return empty array for non-existent round")
}

func TestGetMatchesByRound_MultipleMatches(t *testing.T) {
	// Setup test database
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	// Create repository and handlers
	repo := repository.NewRepository(testDB.DB)
	tournamentHandler := handlers.NewTournamentHandler(repo)

	// Create test data
	testData := CreateTestData(t, testDB, repo)

	// Create additional teams
	team3Req := &models.CreateTeamRequest{
		Name:  "Team Gamma",
		Color: stringPtr("#00FF00"),
	}
	team3, err := repo.CreateTeam(testData.TournamentID, team3Req)
	require.NoError(t, err)

	team4Req := &models.CreateTeamRequest{
		Name:  "Team Delta",
		Color: stringPtr("#FFFF00"),
	}
	team4, err := repo.CreateTeam(testData.TournamentID, team4Req)
	require.NoError(t, err)

	// Create second match
	matchReq2 := &models.CreateMatchRequest{
		Team1ID:       team3.ID,
		Team2ID:       team4.ID,
		MatchFormatID: testData.FormatID,
		Holes:         18,
	}
	_, err = repo.CreateMatch(testData.RoundID, matchReq2)
	require.NoError(t, err)

	// Setup test router
	router := gin.New()
	router.GET("/api/v1/rounds/:round_id/matches", tournamentHandler.GetMatches)

	// Create test request
	req, _ := http.NewRequest("GET", "/api/v1/rounds/"+testData.RoundID+"/matches", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.Match
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	matches := response["matches"]
	assert.Len(t, matches, 2, "Should return both matches")

	// Verify matches are ordered by match_number
	assert.Equal(t, 1, matches[0].MatchNumber)
	assert.Equal(t, 2, matches[1].MatchNumber)

	// Verify both matches have complete data
	for i, match := range matches {
		assert.NotNil(t, match.Team1, "Match %d Team1 should be populated", i+1)
		assert.NotNil(t, match.Team2, "Match %d Team2 should be populated", i+1)
		assert.NotNil(t, match.Format, "Match %d Format should be populated", i+1)
		// Note: Second match won't have players because we didn't add team members to teams 3&4
		if match.ID == testData.MatchID {
			assert.NotEmpty(t, match.Players, "First match should have players")
		}
	}
}

func TestCreateMatch_WithPlayerAssignments(t *testing.T) {
	// Setup test database
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	// Create repository and handlers
	repo := repository.NewRepository(testDB.DB)
	tournamentHandler := handlers.NewTournamentHandler(repo)

	// Create test data
	testData := CreateTestData(t, testDB, repo)

	// Setup test router
	router := gin.New()
	router.POST("/api/v1/rounds/:round_id/matches", tournamentHandler.CreateMatch)

	// Create match request with specific player assignments
	matchReq := models.CreateMatchRequest{
		Team1ID:       testData.Team1ID,
		Team2ID:       testData.Team2ID,
		MatchFormatID: testData.FormatID,
		Holes:         9,
		PlayerAssignments: &models.PlayerAssignments{
			Team1Players: []string{testData.UserIDs[0]}, // Only assign first user from team1
			Team2Players: []string{testData.UserIDs[2]}, // Only assign first user from team2
		},
	}

	// Convert to JSON
	requestBody, _ := json.Marshal(matchReq)

	// Create test request
	req, _ := http.NewRequest("POST", "/api/v1/rounds/"+testData.RoundID+"/matches", strings.NewReader(string(requestBody)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusCreated, w.Code)

	// Parse response
	var match models.Match
	err := json.Unmarshal(w.Body.Bytes(), &match)
	require.NoError(t, err)

	// Get the created match with players
	matches, err := repo.GetMatchesByRound(testData.RoundID)
	require.NoError(t, err)

	// Find our created match (should be match number 2)
	var createdMatch *models.Match
	for _, m := range matches {
		if m.ID == match.ID {
			createdMatch = &m
			break
		}
	}
	require.NotNil(t, createdMatch, "Should find the created match")

	// Verify specific player assignments
	assert.Len(t, createdMatch.Players, 2, "Should have exactly 2 players as assigned")

	userIDsFound := make(map[string]bool)
	for _, player := range createdMatch.Players {
		userIDsFound[player.UserID] = true
	}

	assert.True(t, userIDsFound[testData.UserIDs[0]], "Should include assigned team1 player")
	assert.True(t, userIDsFound[testData.UserIDs[2]], "Should include assigned team2 player")
	assert.False(t, userIDsFound[testData.UserIDs[1]], "Should not include unassigned team1 player")
	assert.False(t, userIDsFound[testData.UserIDs[3]], "Should not include unassigned team2 player")
}

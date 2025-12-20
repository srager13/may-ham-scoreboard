package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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

func TestGetPairingsByRound_Integration(t *testing.T) {
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
	router.GET("/api/v1/rounds/:round_id/pairings", tournamentHandler.GetPairings)

	// Create test request
	req, _ := http.NewRequest("GET", "/api/v1/rounds/"+testData.RoundID+"/pairings", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.Pairing
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	pairings := response["pairings"]
	require.Len(t, pairings, 1, "Should return exactly one pairing")

	pairing := pairings[0]

	// Verify pairing basic data
	assert.Equal(t, testData.PairingID, pairing.ID)
	assert.Equal(t, testData.RoundID, pairing.RoundID)
	assert.Equal(t, 1, pairing.PairingNumber)
}

func TestGetPairingPlayers_Integration(t *testing.T) {
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
	router.GET("/api/v1/pairings/:pairing_id/players", tournamentHandler.GetPairingPlayers)

	// Create test request
	req, _ := http.NewRequest("GET", "/api/v1/pairings/"+testData.PairingID+"/players", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.PairingPlayer
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	players := response["players"]
	require.Len(t, players, 4, "Should return exactly 4 players")

	// Verify all players have required data
	for _, player := range players {
		assert.NotEmpty(t, player.UserID, "Player UserID should not be empty")
		assert.NotEmpty(t, player.TeamID, "Player TeamID should not be empty")
		assert.Greater(t, player.PlayerOrder, 0, "Player order should be positive")

		// Verify user data is populated
		require.NotNil(t, player.User, "Player User should be populated")
		assert.NotEmpty(t, player.User.ID, "Player User ID should not be empty")
		assert.NotEmpty(t, player.User.Name, "Player User Name should not be empty")

		// Verify team data is populated
		require.NotNil(t, player.Team, "Player Team should be populated")
		assert.NotEmpty(t, player.Team.ID, "Player Team ID should not be empty")
		assert.NotEmpty(t, player.Team.Name, "Player Team Name should not be empty")
	}

	// Verify team distribution
	team1Players := 0
	team2Players := 0
	for _, player := range players {
		if player.TeamID == testData.Team1ID {
			team1Players++
		} else if player.TeamID == testData.Team2ID {
			team2Players++
		}
	}
	assert.Equal(t, 2, team1Players, "Team1 should have 2 players")
	assert.Equal(t, 2, team2Players, "Team2 should have 2 players")
}

func TestGetPairingMatches_Integration(t *testing.T) {
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
	router.GET("/api/v1/pairings/:pairing_id/matches", tournamentHandler.GetPairingMatches)

	// Create test request
	req, _ := http.NewRequest("GET", "/api/v1/pairings/"+testData.PairingID+"/matches", nil)
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
	assert.Equal(t, testData.PairingID, match.PairingID)
	assert.Equal(t, testData.Team1ID, match.Team1ID)
	assert.Equal(t, testData.Team2ID, match.Team2ID)
	assert.Equal(t, 9, match.Holes)

	// Verify team data is populated
	require.NotNil(t, match.Team1, "Team1 should be populated")
	require.NotNil(t, match.Team2, "Team2 should be populated")
	assert.Equal(t, "Team Alpha", match.Team1.Name)
	assert.Equal(t, "Team Beta", match.Team2.Name)

	// Verify format data is populated
	require.NotNil(t, match.Format, "Format should be populated")
	assert.NotEmpty(t, match.Format.Name, "Format name should not be empty")
}

func TestGetPairingsByRound_EmptyResult(t *testing.T) {
	// Setup test database
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	// Create repository and handlers
	repo := repository.NewRepository(testDB.DB)
	tournamentHandler := handlers.NewTournamentHandler(repo)

	// Setup test router
	router := gin.New()
	router.GET("/api/v1/rounds/:round_id/pairings", tournamentHandler.GetPairings)

	// Create test request with non-existent round ID (but valid UUID format)
	req, _ := http.NewRequest("GET", "/api/v1/rounds/00000000-0000-0000-0000-000000000000/pairings", nil)
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string][]models.Pairing
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	pairings := response["pairings"]
	assert.Len(t, pairings, 0, "Should return empty array for non-existent round")
}

func TestCreatePairing_Integration(t *testing.T) {
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
	router.POST("/api/v1/rounds/:round_id/pairings", tournamentHandler.CreatePairing)

	// Create pairing request
	teeTime := time.Now().Add(30 * time.Minute)
	pairingReq := models.CreatePairingRequest{
		PairingNumber: 2,
		TeeTime:       &teeTime,
		Players: []models.PairingPlayerRequest{
			{UserID: testData.UserIDs[0], TeamID: testData.Team1ID, PlayerOrder: 1},
			{UserID: testData.UserIDs[2], TeamID: testData.Team2ID, PlayerOrder: 2},
		},
		Matches: []models.PairingMatchRequest{
			{
				Team1ID:         testData.Team1ID,
				Team2ID:         testData.Team2ID,
				MatchFormatID:   testData.FormatID,
				Holes:           18,
				PointsAvailable: floatPtr(1.0),
			},
		},
	}

	// Convert to JSON
	requestBody, _ := json.Marshal(pairingReq)

	// Create test request
	req, _ := http.NewRequest("POST", "/api/v1/rounds/"+testData.RoundID+"/pairings", strings.NewReader(string(requestBody)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// Execute request
	router.ServeHTTP(w, req)

	// Assert response
	assert.Equal(t, http.StatusCreated, w.Code)

	// Parse response
	var pairing models.Pairing
	err := json.Unmarshal(w.Body.Bytes(), &pairing)
	require.NoError(t, err)

	// Verify pairing data
	assert.NotEmpty(t, pairing.ID, "Pairing ID should not be empty")
	assert.Equal(t, 2, pairing.PairingNumber)
	assert.Equal(t, testData.RoundID, pairing.RoundID)

	// Get the pairing players to verify
	players, err := repo.GetPairingPlayers(pairing.ID)
	require.NoError(t, err)
	assert.Len(t, players, 2, "Should have exactly 2 players")

	// Get the pairing matches to verify
	matches, err := repo.GetMatchesByPairing(pairing.ID)
	require.NoError(t, err)
	assert.Len(t, matches, 1, "Should have exactly 1 match")
	assert.Equal(t, 18, matches[0].Holes)
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
	require.Len(t, matches, 1, "Should return exactly one match (from the pairing)")

	match := matches[0]

	// Verify match basic data
	assert.Equal(t, testData.MatchID, match.ID)
	assert.Equal(t, testData.RoundID, match.RoundID)
	assert.NotEmpty(t, match.PairingID, "Match should have a pairing ID")
	assert.Equal(t, testData.PairingID, match.PairingID)
	assert.Equal(t, testData.Team1ID, match.Team1ID)
	assert.Equal(t, testData.Team2ID, match.Team2ID)
	assert.Equal(t, 9, match.Holes)

	// Verify team data is populated
	require.NotNil(t, match.Team1, "Team1 should be populated")
	require.NotNil(t, match.Team2, "Team2 should be populated")
	assert.Equal(t, "Team Alpha", match.Team1.Name)
	assert.Equal(t, "Team Beta", match.Team2.Name)

	// Verify format data is populated
	require.NotNil(t, match.Format, "Format should be populated")
	assert.NotEmpty(t, match.Format.Name, "Format name should not be empty")
}

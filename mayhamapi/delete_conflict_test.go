package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"mayhamapi/handlers"
	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// Verify repository-level guards and handler mapping for deletion conflicts
func TestDeleteConflictRepository(t *testing.T) {
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	repo := repository.NewRepository(testDB.DB)

	// Create full test data
	td := CreateTestData(t, testDB, repo)

	// Insert a hole_result for the match so destructive deletes should be guarded
	one := 1
	two := 2
	winner := td.Team2ID
	hr := &models.HoleResult{
		MatchID:      td.MatchID,
		HoleNumber:   1,
		Team1Score:   &one,
		Team2Score:   &two,
		WinnerTeamID: &winner,
		Team1Points:  0,
		Team2Points:  1,
	}
	require.NoError(t, repo.SaveHoleResult(hr))

	// DeleteMatch should be blocked when allowDestructive=false
	err := repo.DeleteMatch(td.MatchID, false)
	require.Error(t, err)
	require.True(t, errors.Is(err, repository.ErrHasHoleResults))

	// DeleteRound should be blocked when allowDestructive=false
	err = repo.DeleteRound(td.RoundID, false)
	require.Error(t, err)
	require.True(t, errors.Is(err, repository.ErrHasHoleResults))

	// DeleteTeam should be blocked when allowDestructive=false
	err = repo.DeleteTeam(td.Team1ID, false)
	require.Error(t, err)
	require.True(t, errors.Is(err, repository.ErrHasHoleResults))

	// Allow destructive delete for match should succeed
	require.NoError(t, repo.DeleteMatch(td.MatchID, true))
}

func TestDeleteConflictHandler(t *testing.T) {
	testDB := SetupTestDatabase(t)
	defer testDB.Cleanup(t)

	repo := repository.NewRepository(testDB.DB)
	uploadDir := t.TempDir()
	h := handlers.NewTournamentHandler(repo, uploadDir)

	td := CreateTestData(t, testDB, repo)

	// Add a hole result so delete is guarded
	one2 := 1
	two2 := 2
	winner2 := td.Team2ID
	hr := &models.HoleResult{
		MatchID:      td.MatchID,
		HoleNumber:   1,
		Team1Score:   &one2,
		Team2Score:   &two2,
		WinnerTeamID: &winner2,
		Team1Points:  0,
		Team2Points:  1,
	}
	require.NoError(t, repo.SaveHoleResult(hr))

	router := gin.New()
	router.DELETE("/api/v1/matches/:match_id", h.DeleteMatch)
	router.DELETE("/api/v1/rounds/:round_id", h.DeleteRound)
	router.DELETE("/api/v1/teams/:team_id", h.DeleteTeam)

	// Attempt delete match without allow_destructive -> expect 409 and structured JSON
	req := httptest.NewRequest("DELETE", "/api/v1/matches/"+td.MatchID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusConflict, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "HAS_HOLE_RESULTS", resp["code"])

	// Retry match delete with allow_destructive=true -> expect 200 OK
	req = httptest.NewRequest("DELETE", "/api/v1/matches/"+td.MatchID+"?allow_destructive=true", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Now verify round-level delete is guarded (we need to re-insert a hole result on a new match)
	// Create another match under the same round to attach a hole result for the round-level test
	// For simplicity reuse the existing match by creating a fresh hole result on a new match
	// CreateMatch helpers are available via repo but to keep the test minimal we will
	// re-create a hole result attached to the same round's match id (td.MatchID) and test round delete
	// Add a hole result again so round delete is guarded
	one3 := 1
	two3 := 2
	winner3 := td.Team2ID
	hr2 := &models.HoleResult{
		MatchID:      td.MatchID,
		HoleNumber:   2,
		Team1Score:   &one3,
		Team2Score:   &two3,
		WinnerTeamID: &winner3,
		Team1Points:  0,
		Team2Points:  1,
	}
	require.NoError(t, repo.SaveHoleResult(hr2))

	// Attempt delete round without allow_destructive -> expect 409
	req = httptest.NewRequest("DELETE", "/api/v1/rounds/"+td.RoundID, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusConflict, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "HAS_HOLE_RESULTS", resp["code"])

	// Retry round delete with allow_destructive=true -> expect 200 OK
	req = httptest.NewRequest("DELETE", "/api/v1/rounds/"+td.RoundID+"?allow_destructive=true", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	// For team-level delete: re-insert a hole result referencing the same match so team delete is guarded
	one4 := 1
	two4 := 2
	winner4 := td.Team2ID
	hr3 := &models.HoleResult{
		MatchID:      td.MatchID,
		HoleNumber:   3,
		Team1Score:   &one4,
		Team2Score:   &two4,
		WinnerTeamID: &winner4,
		Team1Points:  0,
		Team2Points:  1,
	}
	require.NoError(t, repo.SaveHoleResult(hr3))

	// Attempt delete team without allow_destructive -> expect 409
	req = httptest.NewRequest("DELETE", "/api/v1/teams/"+td.Team1ID, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusConflict, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "HAS_HOLE_RESULTS", resp["code"])

	// Retry team delete with allow_destructive=true -> expect 200 OK
	req = httptest.NewRequest("DELETE", "/api/v1/teams/"+td.Team1ID+"?allow_destructive=true", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

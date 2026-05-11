package scoring

import (
	"fmt"
	"testing"

	"mayhamapi/models"
)

// Helper to get pointer to int
func ip(i int) *int { return &i }

// fakeRepo implements the subset of repoInterface needed for tests
type fakeRepoFmt struct {
	savedHoleResults []*models.HoleResult
	matchPoints      map[string]struct{ t1, t2 float64 }
	matchStatuses    map[string]string
	matchFormats     map[string]*models.MatchFormatEntity
}

func newFakeRepoFmt() *fakeRepoFmt {
	return &fakeRepoFmt{
		savedHoleResults: []*models.HoleResult{},
		matchPoints:      map[string]struct{ t1, t2 float64 }{},
		matchStatuses:    map[string]string{},
		matchFormats:     map[string]*models.MatchFormatEntity{},
	}
}

func (r *fakeRepoFmt) SaveHoleResult(hr *models.HoleResult) error {
	r.savedHoleResults = append(r.savedHoleResults, hr)
	return nil
}

func (r *fakeRepoFmt) UpdateMatchPoints(matchID string, team1Points, team2Points float64) error {
	r.matchPoints[matchID] = struct{ t1, t2 float64 }{team1Points, team2Points}
	return nil
}

func (r *fakeRepoFmt) UpdateMatchStatus(matchID, status string) error {
	r.matchStatuses[matchID] = status
	return nil
}

func (r *fakeRepoFmt) GetMatchHoleResults(matchID string) ([]models.HoleResult, error) {
	// Not used in these tests
	return nil, fmt.Errorf("not implemented")
}

func (r *fakeRepoFmt) GetMatchFormat(formatID string) (*models.MatchFormatEntity, error) {
	if f, ok := r.matchFormats[formatID]; ok {
		return f, nil
	}
	return nil, fmt.Errorf("format not found: %s", formatID)
}

func TestCombinedScores_MatchPlay_HoleByHole(t *testing.T) {
	repo := newFakeRepoFmt()
	// register match format for combined_scores (hole-by-hole)
	repo.matchFormats["fmt_matchplay"] = &models.MatchFormatEntity{ID: "fmt_matchplay", ScoringType: "combined_scores", PlayersPerSide: 2}

	svc := NewScoringService(repo)

	match := &models.Match{
		ID:              "m1",
		MatchFormatID:   "fmt_matchplay",
		Team1ID:         "t1",
		Team2ID:         "t2",
		Holes:           2,
		PointsAvailable: 1.0,
		Pairing:         &models.Pairing{Players: []models.PairingPlayer{{UserID: "u1"}, {UserID: "u2"}, {UserID: "u3"}, {UserID: "u4"}}},
		Players: []models.MatchPlayer{
			{UserID: "u1", TeamID: "t1"},
			{UserID: "u2", TeamID: "t1"},
			{UserID: "u3", TeamID: "t2"},
			{UserID: "u4", TeamID: "t2"},
		},
	}

	// Hole 1: team1 sum 4, team2 sum 3 -> team1 wins hole
	// Hole 2: team1 sum 2, team2 sum 4 -> team2 wins hole
	scores := []models.Score{
		{UserID: "u1", HoleNumber: 1, Strokes: 5, StablefordPoints: ip(3)},
		{UserID: "u2", HoleNumber: 1, Strokes: 6, StablefordPoints: ip(1)},
		{UserID: "u3", HoleNumber: 1, Strokes: 5, StablefordPoints: ip(2)},
		{UserID: "u4", HoleNumber: 1, Strokes: 6, StablefordPoints: ip(1)},

		{UserID: "u1", HoleNumber: 2, Strokes: 4, StablefordPoints: ip(1)},
		{UserID: "u2", HoleNumber: 2, Strokes: 4, StablefordPoints: ip(1)},
		{UserID: "u3", HoleNumber: 2, Strokes: 5, StablefordPoints: ip(2)},
		{UserID: "u4", HoleNumber: 2, Strokes: 5, StablefordPoints: ip(2)},
	}

	status, err := svc.CalculateAndStoreMatchResults(match, scores)
	if err != nil {
		t.Fatalf("CalculateAndStoreMatchResults error: %v", err)
	}

	// Each team won one hole -> hole points each = 1
	if status.Team1HolePoints != 1.0 || status.Team2HolePoints != 1.0 {
		t.Fatalf("unexpected hole points: got team1 %v team2 %v", status.Team1HolePoints, status.Team2HolePoints)
	}

	// Match should be tied -> each gets half of available points
	if status.Team1MatchPoints != 0.5 || status.Team2MatchPoints != 0.5 {
		t.Fatalf("unexpected match points: got team1 %v team2 %v", status.Team1MatchPoints, status.Team2MatchPoints)
	}

	// Ensure two hole results were saved
	if len(repo.savedHoleResults) != 2 {
		t.Fatalf("expected 2 saved hole results, got %d", len(repo.savedHoleResults))
	}
}

func TestCombinedScoresTotal_Aggregate_Gross(t *testing.T) {
	repo := newFakeRepoFmt()
	repo.matchFormats["fmt_total"] = &models.MatchFormatEntity{ID: "fmt_total", ScoringType: "combined_scores_total", PlayersPerSide: 2}

	svc := NewScoringService(repo)

	match := &models.Match{
		ID:              "m2",
		MatchFormatID:   "fmt_total",
		Team1ID:         "t1",
		Team2ID:         "t2",
		Holes:           2,
		PointsAvailable: 1.0,
		Pairing:         &models.Pairing{Players: []models.PairingPlayer{{UserID: "u1"}, {UserID: "u2"}, {UserID: "u3"}, {UserID: "u4"}}},
		Players: []models.MatchPlayer{
			{UserID: "u1", TeamID: "t1"},
			{UserID: "u2", TeamID: "t1"},
			{UserID: "u3", TeamID: "t2"},
			{UserID: "u4", TeamID: "t2"},
		},
	}

	// Hole 1: team1 4+4=8, team2 5+5=10
	// Hole 2: team1 5+5=10, team2 5+5=10
	// Totals: team1=18, team2=20 -> gross lower total wins -> team1 wins match
	scores := []models.Score{
		{UserID: "u1", HoleNumber: 1, Strokes: 4},
		{UserID: "u2", HoleNumber: 1, Strokes: 4},
		{UserID: "u3", HoleNumber: 1, Strokes: 5},
		{UserID: "u4", HoleNumber: 1, Strokes: 5},

		{UserID: "u1", HoleNumber: 2, Strokes: 5},
		{UserID: "u2", HoleNumber: 2, Strokes: 5},
		{UserID: "u3", HoleNumber: 2, Strokes: 5},
		{UserID: "u4", HoleNumber: 2, Strokes: 5},
	}

	status, err := svc.CalculateAndStoreMatchResults(match, scores)
	if err != nil {
		t.Fatalf("CalculateAndStoreMatchResults error: %v", err)
	}

	// Hole totals should have been aggregated into Team1HolePoints/Team2HolePoints
	if status.Team1HolePoints != 18.0 || status.Team2HolePoints != 20.0 {
		t.Fatalf("unexpected aggregate hole points: got team1 %v team2 %v", status.Team1HolePoints, status.Team2HolePoints)
	}

	// Team 1 should win the match (lower aggregate strokes)
	if status.Team1MatchPoints != 1.0 || status.Team2MatchPoints != 0.0 {
		t.Fatalf("unexpected match points: got team1 %v team2 %v", status.Team1MatchPoints, status.Team2MatchPoints)
	}

	// WinnerTeamID should be set to team1
	if status.WinnerTeamID == nil || *status.WinnerTeamID != "t1" {
		t.Fatalf("unexpected winner: %v", status.WinnerTeamID)
	}

	// Ensure two hole results were saved
	if len(repo.savedHoleResults) != 2 {
		t.Fatalf("expected 2 saved hole results, got %d", len(repo.savedHoleResults))
	}
}

func TestCombinedScoresTotal_Aggregate_Stableford(t *testing.T) {
	repo := newFakeRepoFmt()
	repo.matchFormats["fmt_total_sf"] = &models.MatchFormatEntity{ID: "fmt_total_sf", ScoringType: "combined_scores_total", PlayersPerSide: 2}

	svc := NewScoringService(repo)

	match := &models.Match{
		ID:              "m3",
		MatchFormatID:   "fmt_total_sf",
		Team1ID:         "t1",
		Team2ID:         "t2",
		Holes:           2,
		PointsAvailable: 1.0,
		Pairing:         &models.Pairing{Players: []models.PairingPlayer{{UserID: "u1"}, {UserID: "u2"}, {UserID: "u3"}, {UserID: "u4"}}},
		Players: []models.MatchPlayer{
			{UserID: "u1", TeamID: "t1"},
			{UserID: "u2", TeamID: "t1"},
			{UserID: "u3", TeamID: "t2"},
			{UserID: "u4", TeamID: "t2"},
		},
	}

	// Hole 1: team1 points 3+2=5, team2 points 2+2=4
	// Hole 2: team1 points 2+2=4, team2 points 2+3=5
	// Totals: team1=9, team2=9 -> tie -> split match points
	scores := []models.Score{
		{UserID: "u1", HoleNumber: 1, StablefordPoints: ip(3)},
		{UserID: "u2", HoleNumber: 1, StablefordPoints: ip(2)},
		{UserID: "u3", HoleNumber: 1, StablefordPoints: ip(2)},
		{UserID: "u4", HoleNumber: 1, StablefordPoints: ip(2)},

		{UserID: "u1", HoleNumber: 2, StablefordPoints: ip(2)},
		{UserID: "u2", HoleNumber: 2, StablefordPoints: ip(2)},
		{UserID: "u3", HoleNumber: 2, StablefordPoints: ip(2)},
		{UserID: "u4", HoleNumber: 2, StablefordPoints: ip(3)},
	}

	status, err := svc.CalculateAndStoreMatchResults(match, scores)
	if err != nil {
		t.Fatalf("CalculateAndStoreMatchResults error: %v", err)
	}

	// Aggregate Stableford totals should be stored in Team1HolePoints/Team2HolePoints
	if status.Team1HolePoints != 9.0 || status.Team2HolePoints != 9.0 {
		t.Fatalf("unexpected aggregate stableford totals: got team1 %v team2 %v", status.Team1HolePoints, status.Team2HolePoints)
	}

	// Match tied -> split points
	if status.Team1MatchPoints != 0.5 || status.Team2MatchPoints != 0.5 {
		t.Fatalf("unexpected match points for stableford tie: got team1 %v team2 %v", status.Team1MatchPoints, status.Team2MatchPoints)
	}

	if len(repo.savedHoleResults) != 2 {
		t.Fatalf("expected 2 saved hole results, got %d", len(repo.savedHoleResults))
	}
}

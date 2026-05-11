package repository

import (
	"testing"
	"time"

	"mayhamapi/models"
)

func TestCreateMatchForPairing_WithExplicitPlayerUserIDs_Truncates(t *testing.T) {
	td := SetupTestDatabase(t)
	defer td.Cleanup(t)

	repo := NewRepository(td.DB)

	admin, err := repo.CreateUser("admin2@example.com", "Admin2", "", nil)
	if err != nil {
		t.Fatalf("CreateUser admin: %v", err)
	}
	grp, err := repo.CreateGroup(&models.CreateGroupRequest{Name: "Group2"}, admin.ID)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	startDate := time.Now()
	endDate := startDate.AddDate(0, 0, 1)
	tourReq := &models.CreateTournamentRequest{Name: "Tourney2", StartDate: startDate, EndDate: endDate, GroupID: grp.ID}
	tour, err := repo.CreateTournament(tourReq, admin.ID)
	if err != nil {
		t.Fatalf("CreateTournament: %v", err)
	}

	team1, err := repo.CreateTeam(tour.ID, &models.CreateTeamRequest{Name: "T1"})
	if err != nil {
		t.Fatalf("CreateTeam t1: %v", err)
	}
	team2, err := repo.CreateTeam(tour.ID, &models.CreateTeamRequest{Name: "T2"})
	if err != nil {
		t.Fatalf("CreateTeam t2: %v", err)
	}

	// Create three users per team (more than players_per_side=1)
	u1, err := repo.CreateUser("a1@example.com", "A1", "", nil)
	if err != nil {
		t.Fatalf("CreateUser a1: %v", err)
	}
	u2, err := repo.CreateUser("a2@example.com", "A2", "", nil)
	if err != nil {
		t.Fatalf("CreateUser a2: %v", err)
	}
	u3, err := repo.CreateUser("a3@example.com", "A3", "", nil)
	if err != nil {
		t.Fatalf("CreateUser a3: %v", err)
	}
	u4, err := repo.CreateUser("b1@example.com", "B1", "", nil)
	if err != nil {
		t.Fatalf("CreateUser b1: %v", err)
	}
	u5, err := repo.CreateUser("b2@example.com", "B2", "", nil)
	if err != nil {
		t.Fatalf("CreateUser b2: %v", err)
	}
	u6, err := repo.CreateUser("b3@example.com", "B3", "", nil)
	if err != nil {
		t.Fatalf("CreateUser b3: %v", err)
	}

	if _, err := repo.AddTeamMember(team1.ID, u1.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team1.ID, u2.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team1.ID, u3.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team2.ID, u4.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team2.ID, u5.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team2.ID, u6.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}

	roundReq := &models.CreateRoundRequest{Name: "R2", RoundNumber: 1, RoundDate: startDate.Format("2006-01-02")}
	round, err := repo.CreateRound(tour.ID, roundReq)
	if err != nil {
		t.Fatalf("CreateRound: %v", err)
	}

	formats, err := repo.GetAllMatchFormats()
	if err != nil {
		t.Fatalf("GetAllMatchFormats: %v", err)
	}
	var singlesFormatID string
	for _, f := range formats {
		if f["name"] == "Singles Match Play" {
			singlesFormatID = f["id"].(string)
			break
		}
	}
	if singlesFormatID == "" {
		t.Fatalf("Singles Match Play format not found")
	}

	// Create pairing with many players, but create match with explicit PlayerUserIDs
	pairingReq := &models.CreatePairingRequest{
		PairingNumber: 1,
		Players: []models.PairingPlayerRequest{
			{UserID: u1.ID, TeamID: team1.ID, PlayerOrder: 1},
			{UserID: u2.ID, TeamID: team1.ID, PlayerOrder: 2},
			{UserID: u3.ID, TeamID: team1.ID, PlayerOrder: 3},
			{UserID: u4.ID, TeamID: team2.ID, PlayerOrder: 1},
			{UserID: u5.ID, TeamID: team2.ID, PlayerOrder: 2},
			{UserID: u6.ID, TeamID: team2.ID, PlayerOrder: 3},
		},
	}

	pairing, err := repo.CreatePairing(round.ID, pairingReq)
	if err != nil {
		t.Fatalf("CreatePairing: %v", err)
	}

	// Create a match for the pairing but explicitly pass three user IDs per team
	matchReq := &models.CreateMatchRequest{
		Team1ID:       team1.ID,
		Team2ID:       team2.ID,
		MatchFormatID: singlesFormatID,
		Holes:         18,
		PlayerUserIDs: []string{u1.ID, u2.ID, u3.ID, u4.ID, u5.ID, u6.ID},
	}

	// Directly call CreateMatchForPairing to simulate pairing match creation
	match, err := repo.CreateMatchForPairing(pairing.ID, round.ID, 1, matchReq)
	if err != nil {
		t.Fatalf("CreateMatchForPairing: %v", err)
	}

	players, err := repo.GetMatchPlayersByMatch(match.ID)
	if err != nil {
		t.Fatalf("GetMatchPlayersByMatch: %v", err)
	}
	if len(players) != 2 {
		t.Fatalf("expected 2 match players after truncation, got %d", len(players))
	}

	// Ensure one per team and player_order normalized to 1
	counts := map[string]int{}
	for _, p := range players {
		counts[p.TeamID]++
		if p.PlayerOrder != 1 {
			t.Fatalf("expected player_order 1 after normalization, got %d", p.PlayerOrder)
		}
	}
	if counts[team1.ID] != 1 || counts[team2.ID] != 1 {
		t.Fatalf("expected one player per team after truncation, got %+v", counts)
	}
}

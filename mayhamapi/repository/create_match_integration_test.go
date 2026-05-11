package repository

import (
	"testing"
	"time"

	"mayhamapi/models"
)

// TestCreateMatchForPairing_EnforcesPlayersPerSide verifies that when a pairing
// contains multiple players per team but the match format only allows one
// player per side, CreateMatchForPairing will create only one match_player per
// team and normalize player_order to 1.
func TestCreateMatchForPairing_EnforcesPlayersPerSide(t *testing.T) {
	td := SetupTestDatabase(t)
	defer td.Cleanup(t)

	repo := NewRepository(td.DB)

	// Create an admin user, group, tournament, teams, and users
	admin, err := repo.CreateUser("admin@example.com", "Admin", "", nil)
	if err != nil {
		t.Fatalf("CreateUser admin: %v", err)
	}

	grp, err := repo.CreateGroup(&models.CreateGroupRequest{Name: "Test Group"}, admin.ID)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	startDate := time.Now()
	endDate := startDate.AddDate(0, 0, 1)
	tourReq := &models.CreateTournamentRequest{Name: "Tourney", StartDate: startDate, EndDate: endDate, GroupID: grp.ID}
	tour, err := repo.CreateTournament(tourReq, admin.ID)
	if err != nil {
		t.Fatalf("CreateTournament: %v", err)
	}

	team1, err := repo.CreateTeam(tour.ID, &models.CreateTeamRequest{Name: "Team One"})
	if err != nil {
		t.Fatalf("CreateTeam team1: %v", err)
	}
	team2, err := repo.CreateTeam(tour.ID, &models.CreateTeamRequest{Name: "Team Two"})
	if err != nil {
		t.Fatalf("CreateTeam team2: %v", err)
	}

	// Create users and add to teams
	u1, err := repo.CreateUser("u1@example.com", "User 1", "", nil)
	if err != nil {
		t.Fatalf("CreateUser u1: %v", err)
	}
	u2, err := repo.CreateUser("u2@example.com", "User 2", "", nil)
	if err != nil {
		t.Fatalf("CreateUser u2: %v", err)
	}
	u3, err := repo.CreateUser("u3@example.com", "User 3", "", nil)
	if err != nil {
		t.Fatalf("CreateUser u3: %v", err)
	}
	u4, err := repo.CreateUser("u4@example.com", "User 4", "", nil)
	if err != nil {
		t.Fatalf("CreateUser u4: %v", err)
	}

	if _, err := repo.AddTeamMember(team1.ID, u1.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team1.ID, u2.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team2.ID, u3.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}
	if _, err := repo.AddTeamMember(team2.ID, u4.ID); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}

	// Create a round
	roundReq := &models.CreateRoundRequest{Name: "R1", RoundNumber: 1, RoundDate: startDate.Format("2006-01-02")}
	round, err := repo.CreateRound(tour.ID, roundReq)
	if err != nil {
		t.Fatalf("CreateRound: %v", err)
	}

	// Find Singles Match Play format
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

	// Create a pairing with two players per team
	pairingReq := &models.CreatePairingRequest{
		PairingNumber: 1,
		Players: []models.PairingPlayerRequest{
			{UserID: u1.ID, TeamID: team1.ID, PlayerOrder: 1},
			{UserID: u2.ID, TeamID: team1.ID, PlayerOrder: 2},
			{UserID: u3.ID, TeamID: team2.ID, PlayerOrder: 1},
			{UserID: u4.ID, TeamID: team2.ID, PlayerOrder: 2},
		},
		Matches: []models.PairingMatchRequest{
			{Team1ID: team1.ID, Team2ID: team2.ID, MatchFormatID: singlesFormatID, Holes: 18},
		},
	}

	pairing, err := repo.CreatePairing(round.ID, pairingReq)
	if err != nil {
		t.Fatalf("CreatePairing: %v", err)
	}

	matches, err := repo.GetMatchesByPairing(pairing.ID)
	if err != nil {
		t.Fatalf("GetMatchesByPairing: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}

	match := matches[0]
	if len(match.Players) != 2 {
		t.Fatalf("expected 2 match players, got %d", len(match.Players))
	}

	team1Count := 0
	team2Count := 0
	for _, p := range match.Players {
		if p.TeamID == team1.ID {
			team1Count++
			if p.PlayerOrder != 1 {
				t.Fatalf("expected team1 player_order 1, got %d", p.PlayerOrder)
			}
		} else if p.TeamID == team2.ID {
			team2Count++
			if p.PlayerOrder != 1 {
				t.Fatalf("expected team2 player_order 1, got %d", p.PlayerOrder)
			}
		} else {
			t.Fatalf("unexpected team id on match player: %s", p.TeamID)
		}
	}
	if team1Count != 1 || team2Count != 1 {
		t.Fatalf("expected 1 player per team, got team1=%d team2=%d", team1Count, team2Count)
	}
}

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mayhamapi/models"
	"mayhamapi/repository"

	"github.com/gin-gonic/gin"
)

type TournamentHandler struct {
	repo      *repository.Repository
	uploadDir string
}

func NewTournamentHandler(repo *repository.Repository, uploadDir string) *TournamentHandler {
	return &TournamentHandler{repo: repo, uploadDir: uploadDir}
}

// POST /api/v1/tournaments
func (h *TournamentHandler) CreateTournament(c *gin.Context) {
	var req models.CreateTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate scoring_method if provided
	if req.ScoringMethod != nil && *req.ScoringMethod != "" {
		if *req.ScoringMethod != "gross" && *req.ScoringMethod != "stableford" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scoring_method. Must be 'gross' or 'stableford'"})
			return
		}
	}

	// Get user ID from JWT token
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	createdBy, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	tournament, err := h.repo.CreateTournament(&req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tournament)
}

// GET /api/v1/tournaments/:tournament_id
func (h *TournamentHandler) GetTournament(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	tournament, err := h.repo.GetTournament(tournamentID)
	if err != nil {
		if err.Error() == "tournament not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tournament)
}

// GET /api/v1/tournaments
func (h *TournamentHandler) ListTournaments(c *gin.Context) {
	tournaments, err := h.repo.ListTournaments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tournaments": tournaments})
}

// GET /api/v1/user/tournaments
func (h *TournamentHandler) GetUserTournaments(c *gin.Context) {
	// Get user ID from JWT token
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	tournaments, err := h.repo.GetUserTournaments(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Ensure we send [] not null when the user has no tournaments.
	if tournaments == nil {
		tournaments = []models.Tournament{}
	}

	c.JSON(http.StatusOK, tournaments)
}

// PATCH /api/v1/matches/:match_id/status
func (h *TournamentHandler) UpdateMatchStatus(c *gin.Context) {
	matchID := c.Param("match_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate status
	validStatuses := []string{"not_started", "in_progress", "completed"}
	isValid := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be one of: not_started, in_progress, completed"})
		return
	}

	err := h.repo.UpdateMatchStatus(matchID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match status updated successfully"})
}

// POST /api/v1/tournaments/:tournament_id/teams
func (h *TournamentHandler) CreateTeam(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	var req models.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team, err := h.repo.CreateTeam(tournamentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, team)
}

// GET /api/v1/tournaments/:tournament_id/teams
func (h *TournamentHandler) GetTeams(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	teams, err := h.repo.GetTeamsByTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"teams": teams})
}

// POST /api/v1/teams/:team_id/members
func (h *TournamentHandler) AddTeamMember(c *gin.Context) {
	teamID := c.Param("team_id")

	var req models.AddTeamMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	member, err := h.repo.AddTeamMember(teamID, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, member)
}

// POST /api/v1/tournaments/:tournament_id/rounds
func (h *TournamentHandler) CreateRound(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	var req models.CreateRoundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	round, err := h.repo.CreateRound(tournamentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, round)
}

// GET /api/v1/tournaments/:tournament_id/rounds
func (h *TournamentHandler) GetRounds(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	rounds, err := h.repo.GetRoundsByTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rounds": rounds})
}

// POST /api/v1/rounds/:round_id/pairings
func (h *TournamentHandler) CreatePairing(c *gin.Context) {
	roundID := c.Param("round_id")

	var req models.CreatePairingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate hole ranges for each match in the pairing
	for i, match := range req.Matches {
		if match.StartHole != nil && match.EndHole != nil {
			if *match.StartHole < 1 || *match.StartHole > 18 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Match " + fmt.Sprint(i+1) + ": start_hole must be between 1 and 18"})
				return
			}
			if *match.EndHole < 1 || *match.EndHole > 18 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Match " + fmt.Sprint(i+1) + ": end_hole must be between 1 and 18"})
				return
			}
			if *match.StartHole > *match.EndHole {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Match " + fmt.Sprint(i+1) + ": start_hole must be less than or equal to end_hole"})
				return
			}
		} else if (match.StartHole != nil && match.EndHole == nil) || (match.StartHole == nil && match.EndHole != nil) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Match " + fmt.Sprint(i+1) + ": Both start_hole and end_hole must be provided together, or neither"})
			return
		}
	}

	pairing, err := h.repo.CreatePairing(roundID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pairing)
}

// GET /api/v1/rounds/:round_id/pairings
func (h *TournamentHandler) GetPairings(c *gin.Context) {
	roundID := c.Param("round_id")

	pairings, err := h.repo.GetPairingsByRound(roundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"pairings": pairings})
}

// GET /api/v1/pairings/:pairing_id
func (h *TournamentHandler) GetPairing(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	pairing, err := h.repo.GetPairing(pairingID)
	if err != nil {
		if err.Error() == "pairing not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pairing not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pairing)
}

// GET /api/v1/pairings/:pairing_id/matches
func (h *TournamentHandler) GetPairingMatches(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	matches, err := h.repo.GetMatchesByPairing(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"matches": matches})
}

// PATCH /api/v1/pairings/:pairing_id/status
func (h *TournamentHandler) UpdatePairingStatus(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate status
	validStatuses := []string{"not_started", "in_progress", "completed"}
	isValid := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be one of: not_started, in_progress, completed"})
		return
	}

	err := h.repo.UpdatePairingStatus(pairingID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pairing status updated successfully"})
}

// POST /api/v1/rounds/:round_id/matches
func (h *TournamentHandler) CreateMatch(c *gin.Context) {
	roundID := c.Param("round_id")

	var req models.CreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate hole range if provided
	if req.StartHole != nil && req.EndHole != nil {
		if *req.StartHole < 1 || *req.StartHole > 18 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_hole must be between 1 and 18"})
			return
		}
		if *req.EndHole < 1 || *req.EndHole > 18 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "end_hole must be between 1 and 18"})
			return
		}
		if *req.StartHole > *req.EndHole {
			c.JSON(http.StatusBadRequest, gin.H{"error": "start_hole must be less than or equal to end_hole"})
			return
		}
	} else if (req.StartHole != nil && req.EndHole == nil) || (req.StartHole == nil && req.EndHole != nil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both start_hole and end_hole must be provided together, or neither"})
		return
	}

	match, err := h.repo.CreateMatch(roundID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, match)
}

// GET /api/v1/rounds/:round_id/matches
func (h *TournamentHandler) GetMatches(c *gin.Context) {
	roundID := c.Param("round_id")

	matches, err := h.repo.GetMatchesByRound(roundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"matches": matches})
}

// GET /api/v1/matches/:match_id
func (h *TournamentHandler) GetMatch(c *gin.Context) {
	matchID := c.Param("match_id")

	match, err := h.repo.GetMatch(matchID)
	if err != nil {
		if err.Error() == "match not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Match not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, match)
}

// GET /api/v1/match-formats
func (h *TournamentHandler) GetMatchFormats(c *gin.Context) {
	formats, err := h.repo.GetAllMatchFormats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"formats": formats})
}

// DELETE /api/v1/tournaments/:tournament_id
func (h *TournamentHandler) DeleteTournament(c *gin.Context) {
	tournamentID := c.Param("tournament_id")

	err := h.repo.DeleteTournament(tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament deleted successfully"})
}

// DELETE /api/v1/teams/:team_id
func (h *TournamentHandler) DeleteTeam(c *gin.Context) {
	teamID := c.Param("team_id")

	err := h.repo.DeleteTeam(teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team deleted successfully"})
}

// DELETE /api/v1/rounds/:round_id
func (h *TournamentHandler) DeleteRound(c *gin.Context) {
	roundID := c.Param("round_id")

	err := h.repo.DeleteRound(roundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Round deleted successfully"})
}

// DELETE /api/v1/matches/:match_id
func (h *TournamentHandler) DeleteMatch(c *gin.Context) {
	matchID := c.Param("match_id")

	err := h.repo.DeleteMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match deleted successfully"})
}

// DELETE /api/v1/teams/:team_id/members/:user_id
func (h *TournamentHandler) DeleteTeamMember(c *gin.Context) {
	teamID := c.Param("team_id")
	userID := c.Param("user_id")

	err := h.repo.DeleteTeamMember(teamID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team member removed successfully"})
}

// GET /api/v1/teams/:team_id/members
func (h *TournamentHandler) GetTeamMembers(c *gin.Context) {
	teamID := c.Param("team_id")

	members, err := h.repo.GetTeamMembers(teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// GET /api/v1/matches/:match_id/players
func (h *TournamentHandler) GetMatchPlayers(c *gin.Context) {
	matchID := c.Param("match_id")

	// Get match players directly
	players, err := h.repo.GetMatchPlayersByMatch(matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"players": players})
}

// GET /api/v1/pairings/:pairing_id/players
func (h *TournamentHandler) GetPairingPlayers(c *gin.Context) {
	pairingID := c.Param("pairing_id")

	players, err := h.repo.GetPairingPlayers(pairingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"players": players})
}

// POST /api/v1/teams/:team_id/logo
// Accepts multipart/form-data with field name "logo" and stores file on filesystem
func (h *TournamentHandler) UploadTeamLogo(c *gin.Context) {
	teamID := c.Param("team_id")

	// Max upload size: 5MB
	const maxFileSize = 5 * 1024 * 1024

	file, header, err := c.Request.FormFile("logo")
	if err != nil {
		log.Printf("UploadTeamLogo: team=%s no file provided: %v", teamID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "logo file is required"})
		return
	}
	defer file.Close()

	log.Printf("UploadTeamLogo: team=%s received upload: filename=%s size=%d", teamID, header.Filename, header.Size)

	if header.Size > maxFileSize {
		log.Printf("UploadTeamLogo: team=%s file too large: %d bytes", teamID, header.Size)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 5MB)"})
		return
	}

	// Peek first 512 bytes to detect content type
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	allowed := map[string]bool{"image/png": true, "image/jpeg": true, "image/webp": true}
	if !allowed[contentType] {
		log.Printf("UploadTeamLogo: team=%s unsupported content type: %s", teamID, contentType)
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}

	// Ensure upload directory exists. Use the handler's configured uploadDir so
	// the location is environment-configurable.
	// Keep the public URL as /static/team_logos/<file> so DB entries and
	// clients don't need to change.
	uploadDir := h.uploadDir
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("UploadTeamLogo: team=%s failed to create upload dir %s: %v", teamID, uploadDir, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare upload directory"})
		return
	}

	// Generate unique filename using random bytes + original extension
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		switch contentType {
		case "image/png":
			ext = ".png"
		case "image/jpeg":
			ext = ".jpg"
		case "image/webp":
			ext = ".webp"
		}
	}
	rb := make([]byte, 16)
	if _, err := rand.Read(rb); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate filename"})
		return
	}
	filename := fmt.Sprintf("team_%s_%s%s", teamID, hex.EncodeToString(rb), ext)
	destPath := filepath.Join(uploadDir, filename)
	log.Printf("UploadTeamLogo: team=%s saving to %s", teamID, destPath)

	// Rewind the file reader (we already read some bytes)
	if seeker, ok := file.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	} else {
		// If not seekable, reopen via header (fallback)
		// But Gin's multipart gives a File which supports Seek, so this should rarely happen
	}

	out, err := os.Create(destPath)
	if err != nil {
		log.Printf("UploadTeamLogo: team=%s failed to create file %s: %v", teamID, destPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create file"})
		return
	}
	defer out.Close()

	written, err := io.Copy(out, file)
	if err != nil || written == 0 {
		log.Printf("UploadTeamLogo: team=%s failed to save file %s (written=%d): %v", teamID, destPath, written, err)
		// Attempt to remove partially written file
		if removeErr := os.Remove(destPath); removeErr != nil {
			log.Printf("UploadTeamLogo: team=%s failed to remove partial file %s: %v", teamID, destPath, removeErr)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	log.Printf("UploadTeamLogo: team=%s wrote %d bytes to %s", teamID, written, destPath)

	// Construct public URL path
	logoURL := fmt.Sprintf("/static/team_logos/%s", filename)

	// Update DB
	updatedTeam, err := h.repo.UpdateTeamLogo(teamID, logoURL)
	if err != nil {
		// If update failed, remove file and log
		if removeErr := os.Remove(destPath); removeErr != nil {
			log.Printf("UploadTeamLogo: team=%s failed to remove file %s after DB error: %v", teamID, destPath, removeErr)
		} else {
			log.Printf("UploadTeamLogo: team=%s removed file %s after DB error", teamID, destPath)
		}
		log.Printf("UploadTeamLogo: team=%s failed to update DB with logo_url %s: %v", teamID, logoURL, err)
		if err.Error() == "team not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("UploadTeamLogo: team=%s successfully updated logo_url=%s", teamID, logoURL)

	c.JSON(http.StatusCreated, updatedTeam)
}

// PATCH /api/v1/teams/:team_id/logo
// Accepts JSON body { "logo_url": "/static/team_logos/filename.jpg" }
// This endpoint allows the client to set a team's logo_url to an existing
// uploaded asset (e.g., when recreating team records during an edit without
// re-uploading the original file). For security we validate that the provided
// path is within the configured /static/team_logos prefix.
func (h *TournamentHandler) SetTeamLogoUrl(c *gin.Context) {
	teamID := c.Param("team_id")

	var req struct {
		LogoURL string `json:"logo_url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation: must be a path under /static/team_logos/
	if !strings.HasPrefix(req.LogoURL, "/static/team_logos/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "logo_url must be a /static/team_logos/ path"})
		return
	}

	// Optionally ensure the file actually exists on disk
	// The uploadDir is the filesystem directory that backs /static/team_logos
	// so we can check for the existence of the referenced file.
	filename := strings.TrimPrefix(req.LogoURL, "/static/team_logos/")
	fullPath := filepath.Join(h.uploadDir, filename)
	if _, err := os.Stat(fullPath); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "referenced logo file does not exist on server"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate logo file"})
		return
	}

	updatedTeam, err := h.repo.UpdateTeamLogo(teamID, req.LogoURL)
	if err != nil {
		if err.Error() == "team not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedTeam)
}

// GET /api/v1/debug/team-logos
// Returns a JSON list of files under ./uploads/team_logos for quick verification
func (h *TournamentHandler) ListTeamLogos(c *gin.Context) {
	uploadDir := h.uploadDir

	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		if os.IsNotExist(err) {
			// Directory doesn't exist yet — return empty list
			c.JSON(http.StatusOK, gin.H{"files": []interface{}{}})
			return
		}
		log.Printf("ListTeamLogos: failed to read directory %s: %v", uploadDir, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read upload directory"})
		return
	}

	type fileEntry struct {
		Name    string `json:"name"`
		Size    int64  `json:"size"`
		ModTime string `json:"mod_time"`
		URL     string `json:"url"`
	}

	files := []fileEntry{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			log.Printf("ListTeamLogos: failed to stat file %s: %v", e.Name(), err)
			continue
		}
		files = append(files, fileEntry{
			Name:    e.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format(time.RFC3339),
			URL:     "/static/team_logos/" + e.Name(),
		})
	}

	c.JSON(http.StatusOK, gin.H{"files": files})
}

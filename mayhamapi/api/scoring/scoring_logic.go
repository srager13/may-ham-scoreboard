package scoring

import (
	"errors"
	"math"
	"sort"
	"mayhamapi/models"
)

// ============================================
// Types and Models
// ============================================

type MatchFormat string

const (
	MatchPlay      MatchFormat = "match_play"
	Scramble       MatchFormat = "scramble"
	BestBall       MatchFormat = "best_ball"
	AlternateShot  MatchFormat = "alternate_shot"
	HighLow        MatchFormat = "high_low"
	Shamble        MatchFormat = "shamble"
)

type HoleScore struct {
	UserID string
	Strokes int
}

type HoleResult struct {
	HoleNumber    int
	Team1Score    *int    // nil if format doesn't produce team score
	Team2Score    *int
	WinnerTeamID  *string // nil for tie
	Team1Points   float64
	Team2Points   float64
	Scores        []HoleScore
}

type MatchStatus struct {
	Team1TotalPoints float64
	Team2TotalPoints float64
	HolesCompleted   int
	HolesRemaining   int
	MatchComplete    bool
	WinnerTeamID     *string
}

// ============================================
// Scoring Calculator Interface
// ============================================

type ScoringCalculator interface {
	CalculateHoleResult(
		holeNumber int,
		team1Scores []HoleScore,
		team2Scores []HoleScore,
		team1ID string,
		team2ID string,
	) (*HoleResult, error)
	
	CalculateMatchStatus(
		holeResults []HoleResult,
		totalHoles int,
		team1ID string,
		team2ID string,
	) (*MatchStatus, error)
}

// ============================================
// Match Play Scoring
// ============================================

type MatchPlayCalculator struct{}

func NewMatchPlayCalculator() *MatchPlayCalculator {
	return &MatchPlayCalculator{}
}

func (c *MatchPlayCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	if len(team1Scores) == 0 || len(team2Scores) == 0 {
		return nil, errors.New("both teams must have at least one score")
	}

	// In match play, use the best (lowest) score from each team
	team1Best := getLowestScore(team1Scores)
	team2Best := getLowestScore(team2Scores)

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Best,
		Team2Score: &team2Best,
		Scores:     append(team1Scores, team2Scores...),
	}

	// Determine winner and points
	if team1Best < team2Best {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
		result.Team2Points = 0.0
	} else if team2Best < team1Best {
		result.WinnerTeamID = &team2ID
		result.Team1Points = 0.0
		result.Team2Points = 1.0
	} else {
		// Tie - half point each
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *MatchPlayCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	var team1Total, team2Total float64
	for _, result := range holeResults {
		team1Total += result.Team1Points
		team2Total += result.Team2Points
	}

	holesCompleted := len(holeResults)
	holesRemaining := totalHoles - holesCompleted

	status := &MatchStatus{
		Team1TotalPoints: team1Total,
		Team2TotalPoints: team2Total,
		HolesCompleted:   holesCompleted,
		HolesRemaining:   holesRemaining,
	}

	// Check if match is complete (dormie situation)
	pointDiff := math.Abs(team1Total - team2Total)
	if pointDiff > float64(holesRemaining) {
		status.MatchComplete = true
		if team1Total > team2Total {
			status.WinnerTeamID = &team1ID
		} else {
			status.WinnerTeamID = &team2ID
		}
	} else if holesRemaining == 0 {
		status.MatchComplete = true
		if team1Total > team2Total {
			status.WinnerTeamID = &team1ID
		} else if team2Total > team1Total {
			status.WinnerTeamID = &team2ID
		}
		// If tied after all holes, it's a tie (WinnerTeamID remains nil)
	}

	return status, nil
}

// ============================================
// Scramble Scoring
// ============================================

type ScrambleCalculator struct{}

func NewScrambleCalculator() *ScrambleCalculator {
	return &ScrambleCalculator{}
}

func (c *ScrambleCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	// In scramble, teams play best ball on every shot
	// For hole result, use the best score from each team
	team1Best := getLowestScore(team1Scores)
	team2Best := getLowestScore(team2Scores)

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Best,
		Team2Score: &team2Best,
		Scores:     append(team1Scores, team2Scores...),
	}

	if team1Best < team2Best {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
	} else if team2Best < team1Best {
		result.WinnerTeamID = &team2ID
		result.Team2Points = 1.0
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *ScrambleCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	return calculateStandardMatchStatus(holeResults, totalHoles, team1ID, team2ID)
}

// ============================================
// Best Ball Scoring
// ============================================

type BestBallCalculator struct{}

func NewBestBallCalculator() *BestBallCalculator {
	return &BestBallCalculator{}
}

func (c *BestBallCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	// Best ball uses the lowest score from each team
	team1Best := getLowestScore(team1Scores)
	team2Best := getLowestScore(team2Scores)

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Best,
		Team2Score: &team2Best,
		Scores:     append(team1Scores, team2Scores...),
	}

	if team1Best < team2Best {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
	} else if team2Best < team1Best {
		result.WinnerTeamID = &team2ID
		result.Team2Points = 1.0
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *BestBallCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	return calculateStandardMatchStatus(holeResults, totalHoles, team1ID, team2ID)
}

// ============================================
// High-Low Scoring (Best and Worst)
// ============================================

type HighLowCalculator struct{}

func NewHighLowCalculator() *HighLowCalculator {
	return &HighLowCalculator{}
}

func (c *HighLowCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	if len(team1Scores) < 2 || len(team2Scores) < 2 {
		return nil, errors.New("high-low requires at least 2 players per team")
	}

	// High-Low: Add best score (low) + worst score (high) from each team
	team1Best := getLowestScore(team1Scores)
	team1Worst := getHighestScore(team1Scores)
	team1Total := team1Best + team1Worst

	team2Best := getLowestScore(team2Scores)
	team2Worst := getHighestScore(team2Scores)
	team2Total := team2Best + team2Worst

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Total,
		Team2Score: &team2Total,
		Scores:     append(team1Scores, team2Scores...),
	}

	if team1Total < team2Total {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
	} else if team2Total < team1Total {
		result.WinnerTeamID = &team2ID
		result.Team2Points = 1.0
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *HighLowCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	return calculateStandardMatchStatus(holeResults, totalHoles, team1ID, team2ID)
}

// ============================================
// Shamble Scoring
// ============================================

type ShambleCalculator struct{}

func NewShambleCalculator() *ShambleCalculator {
	return &ShambleCalculator{}
}

func (c *ShambleCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	// Shamble: All players drive, select best drive, then play individual balls
	// For scoring purposes, we use best ball (lowest score)
	// In a real implementation, you might track drive selection separately
	team1Best := getLowestScore(team1Scores)
	team2Best := getLowestScore(team2Scores)

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Best,
		Team2Score: &team2Best,
		Scores:     append(team1Scores, team2Scores...),
	}

	if team1Best < team2Best {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
	} else if team2Best < team1Best {
		result.WinnerTeamID = &team2ID
		result.Team2Points = 1.0
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *ShambleCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	return calculateStandardMatchStatus(holeResults, totalHoles, team1ID, team2ID)
}

// ============================================
// Alternate Shot Scoring
// ============================================

type AlternateShotCalculator struct{}

func NewAlternateShotCalculator() *AlternateShotCalculator {
	return &AlternateShotCalculator{}
}

func (c *AlternateShotCalculator) CalculateHoleResult(
	holeNumber int,
	team1Scores []HoleScore,
	team2Scores []HoleScore,
	team1ID string,
	team2ID string,
) (*HoleResult, error) {
	// In alternate shot, teams record a single score
	// Expect only one score per team
	if len(team1Scores) != 1 || len(team2Scores) != 1 {
		return nil, errors.New("alternate shot requires exactly one score per team")
	}

	team1Score := team1Scores[0].Strokes
	team2Score := team2Scores[0].Strokes

	result := &HoleResult{
		HoleNumber: holeNumber,
		Team1Score: &team1Score,
		Team2Score: &team2Score,
		Scores:     append(team1Scores, team2Scores...),
	}

	if team1Score < team2Score {
		result.WinnerTeamID = &team1ID
		result.Team1Points = 1.0
	} else if team2Score < team1Score {
		result.WinnerTeamID = &team2ID
		result.Team2Points = 1.0
	} else {
		result.Team1Points = 0.5
		result.Team2Points = 0.5
	}

	return result, nil
}

func (c *AlternateShotCalculator) CalculateMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	return calculateStandardMatchStatus(holeResults, totalHoles, team1ID, team2ID)
}

// ============================================
// Calculator Factory
// ============================================

func GetCalculator(format MatchFormat) (ScoringCalculator, error) {
	switch format {
	case MatchPlay:
		return NewMatchPlayCalculator(), nil
	case Scramble:
		return NewScrambleCalculator(), nil
	case BestBall:
		return NewBestBallCalculator(), nil
	case HighLow:
		return NewHighLowCalculator(), nil
	case Shamble:
		return NewShambleCalculator(), nil
	case AlternateShot:
		return NewAlternateShotCalculator(), nil
	default:
		return nil, errors.New("unsupported match format")
	}
}

// ============================================
// Helper Functions
// ============================================

func getLowestScore(scores []HoleScore) int {
	if len(scores) == 0 {
		return 0
	}
	
	lowest := scores[0].Strokes
	for _, score := range scores[1:] {
		if score.Strokes < lowest {
			lowest = score.Strokes
		}
	}
	return lowest
}

func getHighestScore(scores []HoleScore) int {
	if len(scores) == 0 {
		return 0
	}
	
	highest := scores[0].Strokes
	for _, score := range scores[1:] {
		if score.Strokes > highest {
			highest = score.Strokes
		}
	}
	return highest
}

func calculateStandardMatchStatus(
	holeResults []HoleResult,
	totalHoles int,
	team1ID string,
	team2ID string,
) (*MatchStatus, error) {
	var team1Total, team2Total float64
	for _, result := range holeResults {
		team1Total += result.Team1Points
		team2Total += result.Team2Points
	}

	holesCompleted := len(holeResults)
	holesRemaining := totalHoles - holesCompleted

	status := &MatchStatus{
		Team1TotalPoints: team1Total,
		Team2TotalPoints: team2Total,
		HolesCompleted:   holesCompleted,
		HolesRemaining:   holesRemaining,
	}

	// Check for match completion
	pointDiff := math.Abs(team1Total - team2Total)
	if pointDiff > float64(holesRemaining) {
		status.MatchComplete = true
		if team1Total > team2Total {
			status.WinnerTeamID = &team1ID
		} else {
			status.WinnerTeamID = &team2ID
		}
	} else if holesRemaining == 0 {
		status.MatchComplete = true
		if team1Total > team2Total {
			status.WinnerTeamID = &team1ID
		} else if team2Total > team1Total {
			status.WinnerTeamID = &team2ID
		}
	}

	return status, nil
}

// ============================================
// Scoring Service (API Layer)
// ============================================

type ScoringService struct {
	// Add dependencies like DB, WebSocket hub, etc.
}

type SubmitScoresRequest struct {
	MatchID    string
	HoleNumber int
	Scores     []HoleScore
}

type SubmitScoresResponse struct {
	HoleResult  *HoleResult
	MatchStatus *MatchStatus
}

func (s *ScoringService) SubmitHoleScores(req *SubmitScoresRequest) (*SubmitScoresResponse, error) {
	// 1. Load match details from database
	match, err := s.getMatch(req.MatchID)
	if err != nil {
		return nil, err
	}

	// 2. Validate scores
	if err := s.validateScores(match, req.Scores); err != nil {
		return nil, err
	}

	// 3. Separate scores by team
	team1Scores, team2Scores := s.separateScoresByTeam(match, req.Scores)

	// 4. Get the appropriate calculator
	calculator, err := GetCalculator(match.Format)
	if err != nil {
		return nil, err
	}

	// 5. Calculate hole result
	holeResult, err := calculator.CalculateHoleResult(
		req.HoleNumber,
		team1Scores,
		team2Scores,
		match.Team1ID,
		match.Team2ID,
	)
	if err != nil {
		return nil, err
	}

	// 6. Save hole scores and result to database
	if err := s.saveHoleResult(req.MatchID, holeResult); err != nil {
		return nil, err
	}

	// 7. Load all hole results and calculate match status
	allResults, err := s.getMatchHoleResults(req.MatchID)
	if err != nil {
		return nil, err
	}

	matchStatus, err := calculator.CalculateMatchStatus(
		allResults,
		match.TotalHoles,
		match.Team1ID,
		match.Team2ID,
	)
	if err != nil {
		return nil, err
	}

	// 8. Update match points in database
	if err := s.updateMatchPoints(req.MatchID, matchStatus); err != nil {
		return nil, err
	}

	// 9. If match is complete, update player and team statistics
	if matchStatus.MatchComplete {
		if err := s.updateStatistics(match, allResults); err != nil {
			return nil, err
		}
	}

	// 10. Broadcast WebSocket update
	// wsHub.BroadcastToTournament(match.TournamentID, "score_updated", payload)

	return &SubmitScoresResponse{
		HoleResult:  holeResult,
		MatchStatus: matchStatus,
	}, nil
}

// Mock methods - implement with actual database calls
func (s *ScoringService) getMatch(matchID string) (*Match, error) {
	// Load from database
	return nil, nil
}

func (s *ScoringService) validateScores(match *Match, scores []HoleScore) error {
	// Validate score values (1-15), player participation, etc.
	return nil
}

func (s *ScoringService) separateScoresByTeam(match *Match, scores []HoleScore) ([]HoleScore, []HoleScore) {
	// Separate based on match player assignments
	return nil, nil
}

func (s *ScoringService) saveHoleResult(matchID string, result *HoleResult) error {
	// Save to hole_scores and hole_results tables
	return nil
}

func (s *ScoringService) getMatchHoleResults(matchID string) ([]HoleResult, error) {
	// Load from database
	return nil, nil
}

func (s *ScoringService) updateMatchPoints(matchID string, status *MatchStatus) error {
	// Update matches table
	return nil
}

func (s *ScoringService) updateStatistics(match *Match, results []HoleResult) error {
	// Update player_stats table
	return nil
}

type Match struct {
	ID           string
	TournamentID string
	Format       MatchFormat
	TotalHoles   int
	Team1ID      string
	Team2ID      string
}

// ============================================
// Advanced Scoring Variations
// ============================================

// Stableford scoring (points based on score vs par)
type StablefordCalculator struct {
	Pars []int // Par for each hole
}

func (c *StablefordCalculator) CalculateStablefordPoints(strokes int, par int) int {
	diff := par - strokes
	switch {
	case diff >= 2: // Eagle or better
		return 4 + (diff - 2)
	case diff == 1: // Birdie
		return 3
	case diff == 0: // Par
		return 2
	case diff == -1: // Bogey
		return 1
	default: // Double bogey or worse
		return 0
	}
}

// Modified Stableford (different point system)
func (c *StablefordCalculator) CalculateModifiedStableford(strokes int, par int) int {
	diff := par - strokes
	switch {
	case diff >= 3: // Albatross or better
		return 8 + ((diff - 3) * 2)
	case diff == 2: // Eagle
		return 5
	case diff == 1: // Birdie
		return 2
	case diff == 0: // Par
		return 0
	case diff == -1: // Bogey
		return -1
	default: // Double bogey or worse
		return -3
	}
}

// Nassau scoring (front 9, back 9, and total)
type NassauScoring struct {
	FrontNine  *MatchStatus
	BackNine   *MatchStatus
	Overall    *MatchStatus
	PointValue float64 // Dollar value per point
}

func CalculateNassau(allResults []HoleResult, team1ID, team2ID string) *NassauScoring {
	// Split results into front 9 and back 9
	var front, back []HoleResult
	for _, r := range allResults {
		if r.HoleNumber <= 9 {
			front = append(front, r)
		} else {
			back = append(back, r)
		}
	}

	// Calculate each part
	frontStatus, _ := calculateStandardMatchStatus(front, 9, team1ID, team2ID)
	backStatus, _ := calculateStandardMatchStatus(back, 9, team1ID, team2ID)
	overallStatus, _ := calculateStandardMatchStatus(allResults, 18, team1ID, team2ID)

	return &NassauScoring{
		FrontNine:  frontStatus,
		BackNine:   backStatus,
		Overall:    overallStatus,
		PointValue: 1.0, // Can be configured
	}
}

// Skins game (carry over ties)
func CalculateSkins(allResults []HoleResult) map[int]string {
	skins := make(map[int]string)
	carryOver := 0

	for _, result := range allResults {
		if result.WinnerTeamID != nil {
			// Someone won this hole - they get this hole plus any carry over
			skins[result.HoleNumber] = *result.WinnerTeamID
			for i := 0; i < carryOver; i++ {
				skins[result.HoleNumber-i-1] = *result.WinnerTeamID
			}
			carryOver = 0
		} else {
			// Tie - carry over to next hole
			carryOver++
		}
	}

	return skins
}
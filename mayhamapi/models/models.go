package models

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// ============================================
// Core Entity Models
// ============================================

type User struct {
	ID        string    `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Name      string    `json:"name" db:"name"`
	Handicap  *float64  `json:"handicap,omitempty" db:"handicap"`
	IsAdmin   bool      `json:"is_admin" db:"is_admin"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Tournament struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description,omitempty" db:"description"`
	StartDate   time.Time `json:"start_date" db:"start_date"`
	EndDate     time.Time `json:"end_date" db:"end_date"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type Team struct {
	ID           string    `json:"id" db:"id"`
	TournamentID string    `json:"tournament_id" db:"tournament_id"`
	Name         string    `json:"name" db:"name"`
	Color        *string   `json:"color,omitempty" db:"color"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type TeamMember struct {
	ID        string    `json:"id" db:"id"`
	TeamID    string    `json:"team_id" db:"team_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Round struct {
	ID           string     `json:"id" db:"id"`
	TournamentID string     `json:"tournament_id" db:"tournament_id"`
	Name         string     `json:"name" db:"name"`
	RoundNumber  int        `json:"round_number" db:"round_number"`
	RoundDate    time.Time  `json:"round_date" db:"round_date"`
	StartTime    *time.Time `json:"start_time,omitempty" db:"start_time"`
	Status       string     `json:"status" db:"status"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// MatchFormat represents the type of golf match format
type MatchFormat string

const (
	MatchPlay     MatchFormat = "match_play"
	Scramble      MatchFormat = "scramble"
	BestBall      MatchFormat = "best_ball"
	AlternateShot MatchFormat = "alternate_shot"
	HighLow       MatchFormat = "high_low"
	Shamble       MatchFormat = "shamble"
)

// Implement driver.Valuer interface for database storage
func (mf MatchFormat) Value() (driver.Value, error) {
	return string(mf), nil
}

// Implement sql.Scanner interface for database retrieval
func (mf *MatchFormat) Scan(value interface{}) error {
	if value == nil {
		*mf = ""
		return nil
	}
	switch s := value.(type) {
	case string:
		*mf = MatchFormat(s)
	case []byte:
		*mf = MatchFormat(s)
	default:
		return fmt.Errorf("cannot scan %T into MatchFormat", value)
	}
	return nil
}

type Match struct {
	ID           string      `json:"id" db:"id"`
	RoundID      string      `json:"round_id" db:"round_id"`
	Team1ID      string      `json:"team1_id" db:"team1_id"`
	Team2ID      string      `json:"team2_id" db:"team2_id"`
	Format       MatchFormat `json:"format" db:"format"`
	Holes        int         `json:"holes" db:"holes"`
	Status       string      `json:"status" db:"status"`
	WinnerTeamID *string     `json:"winner_team_id,omitempty" db:"winner_team_id"`
	StartTime    *time.Time  `json:"start_time,omitempty" db:"start_time"`
	EndTime      *time.Time  `json:"end_time,omitempty" db:"end_time"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" db:"updated_at"`
}

type MatchPlayer struct {
	ID       string `json:"id" db:"id"`
	MatchID  string `json:"match_id" db:"match_id"`
	UserID   string `json:"user_id" db:"user_id"`
	TeamID   string `json:"team_id" db:"team_id"`
	Position int    `json:"position" db:"position"`
}

type Score struct {
	ID         string    `json:"id" db:"id"`
	MatchID    string    `json:"match_id" db:"match_id"`
	UserID     string    `json:"user_id" db:"user_id"`
	HoleNumber int       `json:"hole_number" db:"hole_number"`
	Strokes    int       `json:"strokes" db:"strokes"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// ============================================
// Request/Response Models
// ============================================

type CreateTournamentRequest struct {
	Name        string    `json:"name" binding:"required"`
	Description *string   `json:"description,omitempty"`
	StartDate   time.Time `json:"start_date" binding:"required"`
	EndDate     time.Time `json:"end_date" binding:"required"`
}

type CreateTeamRequest struct {
	Name  string  `json:"name" binding:"required"`
	Color *string `json:"color,omitempty"`
}

type CreateRoundRequest struct {
	Name        string     `json:"name" binding:"required"`
	RoundNumber int        `json:"round_number" binding:"required"`
	RoundDate   string     `json:"round_date" binding:"required"`
	StartTime   *time.Time `json:"start_time,omitempty"`
}

type CreateMatchRequest struct {
	Team1ID string      `json:"team1_id" binding:"required"`
	Team2ID string      `json:"team2_id" binding:"required"`
	Format  MatchFormat `json:"format" binding:"required"`
	Holes   int         `json:"holes" binding:"required,min=6,max=18"`
}

type AddTeamMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

type SubmitScoreRequest struct {
	Scores []HoleScore `json:"scores" binding:"required"`
}

type HoleScore struct {
	UserID     string `json:"user_id" binding:"required"`
	HoleNumber int    `json:"hole_number" binding:"required"`
	Strokes    int    `json:"strokes" binding:"required,min=1"`
}

// ============================================
// Leaderboard and Statistics Models
// ============================================

type LeaderboardEntry struct {
	TeamID      string  `json:"team_id"`
	TeamName    string  `json:"team_name"`
	Points      float64 `json:"points"`
	MatchesWon  int     `json:"matches_won"`
	MatchesLost int     `json:"matches_lost"`
	MatchesTied int     `json:"matches_tied"`
}

type MatchResult struct {
	MatchID        string  `json:"match_id"`
	Team1Name      string  `json:"team1_name"`
	Team2Name      string  `json:"team2_name"`
	Team1Points    float64 `json:"team1_points"`
	Team2Points    float64 `json:"team2_points"`
	WinnerTeamID   *string `json:"winner_team_id"`
	Status         string  `json:"status"`
	Format         string  `json:"format"`
	HolesCompleted int     `json:"holes_completed"`
}

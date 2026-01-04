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

type Group struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description,omitempty" db:"description"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type GroupMember struct {
	ID        string    `json:"id" db:"id"`
	GroupID   string    `json:"group_id" db:"group_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	User      *User     `json:"user,omitempty"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Tournament struct {
	ID            string    `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Description   *string   `json:"description,omitempty" db:"description"`
	StartDate     time.Time `json:"start_date" db:"start_date"`
	EndDate       time.Time `json:"end_date" db:"end_date"`
	GroupID       string    `json:"group_id" db:"group_id"`
	CreatedBy     string    `json:"created_by" db:"created_by"`
	Status        string    `json:"status" db:"status"`
	ScoringMethod string    `json:"scoring_method" db:"scoring_method"` // "gross" or "stableford"
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
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
	ID           string      `json:"id" db:"id"`
	TournamentID string      `json:"tournament_id" db:"tournament_id"`
	GolfCourseID *string     `json:"golf_course_id,omitempty" db:"golf_course_id"`
	Name         string      `json:"name" db:"name"`
	RoundNumber  int         `json:"round_number" db:"round_number"`
	RoundDate    time.Time   `json:"round_date" db:"round_date"`
	StartTime    *time.Time  `json:"start_time,omitempty" db:"start_time"`
	Status       string      `json:"status" db:"status"`
	GolfCourse   *GolfCourse `json:"golf_course,omitempty"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" db:"updated_at"`
}

type Pairing struct {
	ID              string     `json:"id" db:"id"`
	RoundID         string     `json:"round_id" db:"round_id"`
	PairingNumber   int        `json:"pairing_number" db:"pairing_number"`
	TeeTime         *time.Time `json:"tee_time,omitempty" db:"tee_time"`
	GolfCourseTeeID *string    `json:"golf_course_tee_id,omitempty" db:"golf_course_tee_id"`
	Status          string     `json:"status" db:"status"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
	// Related data (not in DB table)
	Players       []PairingPlayer `json:"players,omitempty"`
	GolfCourseTee *GolfCourseTee  `json:"golf_course_tee,omitempty"`
}

type PairingPlayer struct {
	ID          string    `json:"id" db:"id"`
	PairingID   string    `json:"pairing_id" db:"pairing_id"`
	UserID      string    `json:"user_id" db:"user_id"`
	TeamID      string    `json:"team_id" db:"team_id"`
	PlayerOrder int       `json:"player_order" db:"player_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	// Related data (not in DB table)
	User *User `json:"user,omitempty"`
	Team *Team `json:"team,omitempty"`
}

type GolfCourse struct {
	ID         string    `json:"id" db:"id"`
	ExternalID *int      `json:"external_id,omitempty" db:"external_id"`
	ClubName   string    `json:"club_name" db:"club_name"`
	CourseName string    `json:"course_name" db:"course_name"`
	Address    *string   `json:"address,omitempty" db:"address"`
	City       *string   `json:"city,omitempty" db:"city"`
	State      *string   `json:"state,omitempty" db:"state"`
	Country    *string   `json:"country,omitempty" db:"country"`
	Latitude   *float64  `json:"latitude,omitempty" db:"latitude"`
	Longitude  *float64  `json:"longitude,omitempty" db:"longitude"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type GolfCourseTee struct {
	ID                string    `json:"id" db:"id"`
	CourseID          string    `json:"course_id" db:"course_id"`
	TeeName           string    `json:"tee_name" db:"tee_name"`
	Gender            *string   `json:"gender,omitempty" db:"gender"`
	CourseRating      *float64  `json:"course_rating,omitempty" db:"course_rating"`
	SlopeRating       *int      `json:"slope_rating,omitempty" db:"slope_rating"`
	BogeyRating       *float64  `json:"bogey_rating,omitempty" db:"bogey_rating"`
	TotalYards        *int      `json:"total_yards,omitempty" db:"total_yards"`
	TotalMeters       *int      `json:"total_meters,omitempty" db:"total_meters"`
	NumberOfHoles     *int      `json:"number_of_holes,omitempty" db:"number_of_holes"`
	ParTotal          *int      `json:"par_total,omitempty" db:"par_total"`
	FrontCourseRating *float64  `json:"front_course_rating,omitempty" db:"front_course_rating"`
	FrontSlopeRating  *int      `json:"front_slope_rating,omitempty" db:"front_slope_rating"`
	FrontBogeyRating  *float64  `json:"front_bogey_rating,omitempty" db:"front_bogey_rating"`
	BackCourseRating  *float64  `json:"back_course_rating,omitempty" db:"back_course_rating"`
	BackSlopeRating   *int      `json:"back_slope_rating,omitempty" db:"back_slope_rating"`
	BackBogeyRating   *float64  `json:"back_bogey_rating,omitempty" db:"back_bogey_rating"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type GolfCourseHole struct {
	ID         string    `json:"id" db:"id"`
	TeeID      string    `json:"tee_id" db:"tee_id"`
	HoleNumber int       `json:"hole_number" db:"hole_number"`
	Par        int       `json:"par" db:"par"`
	Yards      *int      `json:"yards,omitempty" db:"yards"`
	Handicap   *int      `json:"handicap,omitempty" db:"handicap"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
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

// MatchFormatEntity represents a match format from the database
type MatchFormatEntity struct {
	ID             string    `json:"id" db:"id"`
	Name           string    `json:"name" db:"name"`
	Description    string    `json:"description" db:"description"`
	PlayersPerSide int       `json:"players_per_side" db:"players_per_side"`
	ScoringType    string    `json:"scoring_type" db:"scoring_type"`
	ScoreInputType string    `json:"score_input_type" db:"score_input_type"` // "individual" or "team"
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type Match struct {
	ID              string    `json:"id" db:"id"`
	PairingID       string    `json:"pairing_id" db:"pairing_id"`
	RoundID         string    `json:"round_id" db:"round_id"`
	Team1ID         string    `json:"team1_id" db:"team1_id"`
	Team2ID         string    `json:"team2_id" db:"team2_id"`
	MatchFormatID   string    `json:"match_format_id" db:"match_format_id"`
	MatchNumber     int       `json:"match_number" db:"match_number"`
	Holes           int       `json:"holes" db:"holes"`
	StartHole       *int      `json:"start_hole,omitempty" db:"start_hole"` // First hole of match (1-18), nil for 18-hole
	EndHole         *int      `json:"end_hole,omitempty" db:"end_hole"`     // Last hole of match (1-18), nil for 18-hole
	Status          string    `json:"status" db:"status"`
	PointsAvailable float64   `json:"points_available" db:"points_available"`
	Team1Points     float64   `json:"team1_points" db:"team1_points"`
	Team2Points     float64   `json:"team2_points" db:"team2_points"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
	// Related data (not in DB table)
	Team1   *Team              `json:"team1,omitempty"`
	Team2   *Team              `json:"team2,omitempty"`
	Format  *MatchFormatEntity `json:"format,omitempty"`
	Pairing *Pairing           `json:"pairing,omitempty"`
	Players []MatchPlayer      `json:"players,omitempty"`
}

type MatchPlayer struct {
	ID          string    `json:"id" db:"id"`
	MatchID     string    `json:"match_id" db:"match_id"`
	UserID      string    `json:"user_id" db:"user_id"`
	TeamID      string    `json:"team_id" db:"team_id"`
	PlayerOrder int       `json:"player_order" db:"player_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	// Related data (not in DB table)
	User *User `json:"user,omitempty"`
}

type Score struct {
	ID               string    `json:"id" db:"id"`
	PairingID        string    `json:"pairing_id" db:"pairing_id"`
	UserID           string    `json:"user_id" db:"user_id"`
	HoleNumber       int       `json:"hole_number" db:"hole_number"`
	Strokes          int       `json:"strokes" db:"strokes"`
	StablefordPoints *int      `json:"stableford_points,omitempty" db:"stableford_points"` // nil if gross scoring
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
	// Related data (not in DB table)
	User *User `json:"user,omitempty"`
}

type HoleResult struct {
	ID           string    `json:"id" db:"id"`
	MatchID      string    `json:"match_id" db:"match_id"`
	HoleNumber   int       `json:"hole_number" db:"hole_number"`
	Team1Score   *int      `json:"team1_score,omitempty" db:"team1_score"`
	Team2Score   *int      `json:"team2_score,omitempty" db:"team2_score"`
	WinnerTeamID *string   `json:"winner_team_id,omitempty" db:"winner_team_id"`
	Team1Points  float64   `json:"team1_points" db:"team1_points"`
	Team2Points  float64   `json:"team2_points" db:"team2_points"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// ============================================
// Request/Response Models
// ============================================

type CreateGroupRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description,omitempty"`
}

type AddGroupMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Role   string `json:"role,omitempty"`
}

type CreateTournamentRequest struct {
	Name          string    `json:"name" binding:"required"`
	Description   *string   `json:"description,omitempty"`
	StartDate     time.Time `json:"start_date" binding:"required"`
	EndDate       time.Time `json:"end_date" binding:"required"`
	GroupID       string    `json:"group_id" binding:"required"`
	ScoringMethod *string   `json:"scoring_method,omitempty"` // "gross" or "stableford", defaults to "gross"
}

type CreateTeamRequest struct {
	Name  string  `json:"name" binding:"required"`
	Color *string `json:"color,omitempty"`
}

type CreateRoundRequest struct {
	Name         string     `json:"name" binding:"required"`
	RoundNumber  int        `json:"round_number" binding:"required"`
	RoundDate    string     `json:"round_date" binding:"required"`
	StartTime    *time.Time `json:"start_time,omitempty"`
	GolfCourseID *string    `json:"golf_course_id,omitempty"`
}

type CreatePairingRequest struct {
	PairingNumber   int                    `json:"pairing_number" binding:"required"`
	TeeTime         *time.Time             `json:"tee_time,omitempty"`
	GolfCourseTeeID *string                `json:"golf_course_tee_id,omitempty"`
	Players         []PairingPlayerRequest `json:"players" binding:"required,min=1"`
	Matches         []PairingMatchRequest  `json:"matches,omitempty"`
}

type PairingPlayerRequest struct {
	UserID      string `json:"user_id" binding:"required"`
	TeamID      string `json:"team_id" binding:"required"`
	PlayerOrder int    `json:"player_order"`
}

type PairingMatchRequest struct {
	Team1ID         string   `json:"team1_id" binding:"required"`
	Team2ID         string   `json:"team2_id" binding:"required"`
	MatchFormatID   string   `json:"match_format_id" binding:"required"`
	Holes           int      `json:"holes" binding:"required,min=6,max=18"`
	StartHole       *int     `json:"start_hole,omitempty" binding:"omitempty,min=1,max=18"`
	EndHole         *int     `json:"end_hole,omitempty" binding:"omitempty,min=1,max=18"`
	PointsAvailable *float64 `json:"points_available,omitempty"`
	PlayerUserIDs   []string `json:"player_user_ids,omitempty"` // Specific player user IDs for this match
}

type CreateMatchRequest struct {
	Team1ID         string   `json:"team1_id" binding:"required"`
	Team2ID         string   `json:"team2_id" binding:"required"`
	MatchFormatID   string   `json:"match_format_id" binding:"required"`
	Holes           int      `json:"holes" binding:"required,min=6,max=18"`
	StartHole       *int     `json:"start_hole,omitempty" binding:"omitempty,min=1,max=18"`
	EndHole         *int     `json:"end_hole,omitempty" binding:"omitempty,min=1,max=18"`
	PointsAvailable *float64 `json:"points_available,omitempty"`
	PlayerUserIDs   []string `json:"player_user_ids,omitempty"` // Specific player user IDs for this match
}

type AddTeamMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

type SubmitScoreRequest struct {
	HoleNumber int         `json:"hole_number" binding:"required"`
	Scores     []HoleScore `json:"scores" binding:"required"`
}

type HoleScore struct {
	UserID  string `json:"user_id" binding:"required"`
	Strokes int    `json:"strokes" binding:"required,min=1"`
}

// ============================================
// Leaderboard and Statistics Models
// ============================================

type TeamStanding struct {
	Team        Team    `json:"team"`
	PointsWon   float64 `json:"points_won"`
	PointsLost  float64 `json:"points_lost"`
	MatchesWon  int     `json:"matches_won"`
	MatchesLost int     `json:"matches_lost"`
	MatchesTied int     `json:"matches_tied"`
	HolesWon    int     `json:"holes_won"`
	HolesLost   int     `json:"holes_lost"`
	HolesTied   int     `json:"holes_tied"`
}

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

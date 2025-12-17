package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"mayhamapi/models"
	"mayhamapi/repository"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
)

type GolfCourseHandler struct {
	repo   *repository.Repository
	apiKey string
}

func NewGolfCourseHandler(repo *repository.Repository) *GolfCourseHandler {
	apiKey := os.Getenv("GOLF_COURSE_API_KEY")
	if apiKey == "" {
		panic("GOLF_COURSE_API_KEY environment variable is required")
	}
	return &GolfCourseHandler{
		repo:   repo,
		apiKey: apiKey,
	}
}

// SearchGolfCourses proxies the search request to the Golf Course API
// GET /api/v1/golf-courses/search?q=tidewater
func (h *GolfCourseHandler) SearchGolfCourses(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	// Call the golf course API
	apiURL := fmt.Sprintf("https://api.golfcourseapi.com/v1/search?search_query=%s", url.QueryEscape(query))
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	req.Header.Set("Authorization", fmt.Sprintf("Key %s", h.apiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search golf courses"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Parse the response to return just the courses array
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetGolfCourseDetails fetches detailed course information from the API
// GET /api/v1/golf-courses/external/:id
func (h *GolfCourseHandler) GetGolfCourseDetails(c *gin.Context) {
	externalID := c.Param("id")
	if externalID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Course ID is required"})
		return
	}

	// Call the golf course API
	url := fmt.Sprintf("https://api.golfcourseapi.com/v1/courses/%s", externalID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	req.Header.Set("Authorization", fmt.Sprintf("Key %s", h.apiKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get course details"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SaveGolfCourse stores a golf course from the external API into our database
// POST /api/v1/golf-courses
func (h *GolfCourseHandler) SaveGolfCourse(c *gin.Context) {
	var req struct {
		ExternalID int `json:"external_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if course already exists
	existingCourse, err := h.repo.GetGolfCourseByExternalID(req.ExternalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing course"})
		return
	}

	if existingCourse != nil {
		c.JSON(http.StatusOK, existingCourse)
		return
	}

	// Fetch course details from external API
	url := fmt.Sprintf("https://api.golfcourseapi.com/v1/courses/%d", req.ExternalID)
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Key %s", h.apiKey))

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch course details"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Parse the API response
	var apiResponse struct {
		Course struct {
			ID         int    `json:"id"`
			ClubName   string `json:"club_name"`
			CourseName string `json:"course_name"`
			Location   struct {
				Address   string  `json:"address"`
				City      string  `json:"city"`
				State     string  `json:"state"`
				Country   string  `json:"country"`
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"location"`
			Tees struct {
				Male   []TeeData `json:"male"`
				Female []TeeData `json:"female"`
			} `json:"tees"`
		} `json:"course"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse course data"})
		return
	}

	// Create the golf course record
	course := &models.GolfCourse{
		ExternalID: &apiResponse.Course.ID,
		ClubName:   apiResponse.Course.ClubName,
		CourseName: apiResponse.Course.CourseName,
		Address:    &apiResponse.Course.Location.Address,
		City:       &apiResponse.Course.Location.City,
		State:      &apiResponse.Course.Location.State,
		Country:    &apiResponse.Course.Location.Country,
		Latitude:   &apiResponse.Course.Location.Latitude,
		Longitude:  &apiResponse.Course.Location.Longitude,
	}

	if err := h.repo.CreateGolfCourse(course); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create golf course"})
		return
	}

	// Save tees and holes for male tees
	for _, teeData := range apiResponse.Course.Tees.Male {
		gender := "male"
		if err := h.saveTee(course.ID, gender, teeData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to save tee: %v", err)})
			return
		}
	}

	// Save tees and holes for female tees
	for _, teeData := range apiResponse.Course.Tees.Female {
		gender := "female"
		if err := h.saveTee(course.ID, gender, teeData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to save tee: %v", err)})
			return
		}
	}

	c.JSON(http.StatusCreated, course)
}

type TeeData struct {
	TeeName           string     `json:"tee_name"`
	CourseRating      float64    `json:"course_rating"`
	SlopeRating       int        `json:"slope_rating"`
	BogeyRating       float64    `json:"bogey_rating"`
	TotalYards        int        `json:"total_yards"`
	TotalMeters       int        `json:"total_meters"`
	NumberOfHoles     int        `json:"number_of_holes"`
	ParTotal          int        `json:"par_total"`
	FrontCourseRating float64    `json:"front_course_rating"`
	FrontSlopeRating  int        `json:"front_slope_rating"`
	FrontBogeyRating  float64    `json:"front_bogey_rating"`
	BackCourseRating  float64    `json:"back_course_rating"`
	BackSlopeRating   int        `json:"back_slope_rating"`
	BackBogeyRating   float64    `json:"back_bogey_rating"`
	Holes             []HoleData `json:"holes"`
}

type HoleData struct {
	HoleNumber int `json:"hole_number"`
	Par        int `json:"par"`
	Yards      int `json:"yards"`
	Meters     int `json:"meters"`
	Handicap   int `json:"handicap"`
}

func (h *GolfCourseHandler) saveTee(courseID string, gender string, teeData TeeData) error {
	tee := &models.GolfCourseTee{
		CourseID:          courseID,
		TeeName:           teeData.TeeName,
		Gender:            &gender,
		CourseRating:      &teeData.CourseRating,
		SlopeRating:       &teeData.SlopeRating,
		BogeyRating:       &teeData.BogeyRating,
		TotalYards:        &teeData.TotalYards,
		TotalMeters:       &teeData.TotalMeters,
		NumberOfHoles:     &teeData.NumberOfHoles,
		ParTotal:          &teeData.ParTotal,
		FrontCourseRating: &teeData.FrontCourseRating,
		FrontSlopeRating:  &teeData.FrontSlopeRating,
		FrontBogeyRating:  &teeData.FrontBogeyRating,
		BackCourseRating:  &teeData.BackCourseRating,
		BackSlopeRating:   &teeData.BackSlopeRating,
		BackBogeyRating:   &teeData.BackBogeyRating,
	}

	if err := h.repo.CreateGolfCourseTee(tee); err != nil {
		return err
	}

	// Save holes for this tee
	for _, holeData := range teeData.Holes {
		hole := &models.GolfCourseHole{
			TeeID:      tee.ID,
			HoleNumber: holeData.HoleNumber,
			Par:        holeData.Par,
			Yards:      &holeData.Yards,
			Meters:     &holeData.Meters,
			Handicap:   &holeData.Handicap,
		}

		if err := h.repo.CreateGolfCourseHole(hole); err != nil {
			return err
		}
	}

	return nil
}

// GetStoredGolfCourses returns all golf courses stored in our database
// GET /api/v1/golf-courses
func (h *GolfCourseHandler) GetStoredGolfCourses(c *gin.Context) {
	courses, err := h.repo.GetGolfCourses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve golf courses"})
		return
	}

	c.JSON(http.StatusOK, courses)
}

// GetStoredGolfCourse returns a specific golf course from our database
// GET /api/v1/golf-courses/:id
func (h *GolfCourseHandler) GetStoredGolfCourse(c *gin.Context) {
	courseID := c.Param("id")

	course, err := h.repo.GetGolfCourseByID(courseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Golf course not found"})
		return
	}

	c.JSON(http.StatusOK, course)
}

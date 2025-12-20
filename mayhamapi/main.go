package main

import (
	"log"
	"os"
	"strings"

	"mayhamapi/db"
	"mayhamapi/handlers"
	"mayhamapi/middleware"
	"mayhamapi/repository"
	"mayhamapi/scoring"
	"mayhamapi/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize database
	database, err := db.NewConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize repository
	repo := repository.NewRepository(database)

	// Initialize services
	scoringService := scoring.NewScoringService(repo)

	// Initialize WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(repo)
	tournamentHandler := handlers.NewTournamentHandler(repo)
	scoringHandler := handlers.NewScoringHandler(repo, scoringService)
	groupHandler := handlers.NewGroupHandler(repo)
	leaderboardHandler := handlers.NewLeaderboardHandler(repo)
	golfCourseHandler := handlers.NewGolfCourseHandler(repo)

	// Setup router
	router := setupRouter(authHandler, tournamentHandler, scoringHandler, groupHandler, leaderboardHandler, golfCourseHandler, wsHub)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRouter(
	authHandler *handlers.AuthHandler,
	tournamentHandler *handlers.TournamentHandler,
	scoringHandler *handlers.ScoringHandler,
	groupHandler *handlers.GroupHandler,
	leaderboardHandler *handlers.LeaderboardHandler,
	golfCourseHandler *handlers.GolfCourseHandler,
	wsHub *websocket.Hub,
) *gin.Engine {
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())
	r.Use(middleware.RequestID())

	// Serve static files
	r.Static("/static", "./static")
	r.StaticFile("/", "./static/index.html")

	// Handle client-side routing for SPA
	r.NoRoute(func(c *gin.Context) {
		// If it's an API route, return 404
		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		// Otherwise serve the React app
		c.File("./static/index.html")
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// API routes
	api := r.Group("/api/v1")
	{
		// Authentication routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.POST("/register", authHandler.Register)
			auth.GET("/me", middleware.JWTAuth(), authHandler.GetCurrentUser)
			auth.POST("/refresh", middleware.JWTAuth(), authHandler.RefreshToken)
		}

		// Protected routes (authentication required)
		protected := api.Group("/")
		protected.Use(middleware.JWTAuth())
		{
			// User management
			protected.GET("/users", authHandler.GetUsers)
			protected.GET("/user/tournaments", tournamentHandler.GetUserTournaments)

			// Tournament data (user-scoped)
			protected.GET("/tournaments", tournamentHandler.ListTournaments)
			protected.GET("/tournaments/:tournament_id", tournamentHandler.GetTournament)
			protected.GET("/tournaments/:tournament_id/teams", tournamentHandler.GetTeams)
			protected.GET("/tournaments/:tournament_id/rounds", tournamentHandler.GetRounds)
			protected.GET("/tournaments/:tournament_id/leaderboard", leaderboardHandler.GetTournamentLeaderboard)
			protected.GET("/rounds/:round_id/matches", tournamentHandler.GetMatches)
			protected.GET("/rounds/:round_id/pairings", tournamentHandler.GetPairings)
			protected.GET("/pairings/:pairing_id", tournamentHandler.GetPairing)
			protected.GET("/pairings/:pairing_id/players", tournamentHandler.GetPairingPlayers)
			protected.GET("/pairings/:pairing_id/matches", tournamentHandler.GetPairingMatches)
			protected.GET("/pairings/:pairing_id/scores", scoringHandler.GetPairingScores)
			protected.PATCH("/pairings/:pairing_id/status", tournamentHandler.UpdatePairingStatus)
			protected.GET("/matches/:match_id", tournamentHandler.GetMatch)
			protected.GET("/matches/:match_id/scores", scoringHandler.GetMatchScores)
			protected.GET("/match-formats", tournamentHandler.GetMatchFormats)

			// Group management
			protected.POST("/groups", groupHandler.CreateGroup)
			protected.GET("/groups", groupHandler.GetUserGroups)
			protected.GET("/groups/:groupId/members", groupHandler.GetGroupMembers)
			protected.POST("/groups/:groupId/members", groupHandler.AddGroupMember)
			protected.GET("/groups/:groupId/users", groupHandler.GetGroupUsers)

			// Tournament management (admin or tournament creator)
			protected.POST("/tournaments", tournamentHandler.CreateTournament)
			protected.DELETE("/tournaments/:tournament_id", tournamentHandler.DeleteTournament)
			protected.POST("/tournaments/:tournament_id/teams", tournamentHandler.CreateTeam)
			protected.DELETE("/teams/:team_id", tournamentHandler.DeleteTeam)
			protected.GET("/teams/:team_id/members", tournamentHandler.GetTeamMembers)
			protected.POST("/teams/:team_id/members", tournamentHandler.AddTeamMember)
			protected.DELETE("/teams/:team_id/members/:user_id", tournamentHandler.DeleteTeamMember)
			protected.POST("/tournaments/:tournament_id/rounds", tournamentHandler.CreateRound)
			protected.DELETE("/rounds/:round_id", tournamentHandler.DeleteRound)
			protected.POST("/rounds/:round_id/pairings", tournamentHandler.CreatePairing)
			protected.POST("/rounds/:round_id/matches", tournamentHandler.CreateMatch)
			protected.DELETE("/matches/:match_id", tournamentHandler.DeleteMatch)
			protected.GET("/matches/:match_id/players", tournamentHandler.GetMatchPlayers)
			protected.PATCH("/matches/:match_id/status", tournamentHandler.UpdateMatchStatus)

			// Scoring (players can submit their own scores)
			protected.POST("/matches/:match_id/scores", scoringHandler.SubmitScores)
			protected.POST("/pairings/:pairing_id/scores", scoringHandler.SubmitPairingScores)
			protected.PATCH("/matches/:match_id/scores/:hole_number", scoringHandler.UpdateHoleScore)

			// Golf courses
			protected.GET("/golf-courses", golfCourseHandler.GetStoredGolfCourses)
			protected.GET("/golf-courses/:id", golfCourseHandler.GetStoredGolfCourse)
			protected.GET("/golf-courses/:id/tees", golfCourseHandler.GetGolfCourseTees)
		}

		// Admin-only routes
		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth(), middleware.AdminOnly())
		{
			admin.GET("/golf-courses/search", golfCourseHandler.SearchGolfCourses)
			admin.GET("/golf-courses/external/:id", golfCourseHandler.GetGolfCourseDetails)
			admin.POST("/golf-courses", golfCourseHandler.SaveGolfCourse)
		}

		// WebSocket endpoint (optional auth for real-time updates)
		api.GET("/ws/tournaments/:tournament_id", func(c *gin.Context) {
			wsHub.HandleWebSocket(c)
		})
	}

	return r
}

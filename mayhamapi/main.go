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

	// Setup router
	router := setupRouter(authHandler, tournamentHandler, scoringHandler, wsHub)

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

		// Public tournament data (read-only)
		public := api.Group("/public")
		public.Use(middleware.OptionalAuth())
		{
			public.GET("/tournaments", tournamentHandler.ListTournaments)
			public.GET("/tournaments/:tournament_id", tournamentHandler.GetTournament)
			public.GET("/tournaments/:tournament_id/teams", tournamentHandler.GetTeams)
			public.GET("/tournaments/:tournament_id/rounds", tournamentHandler.GetRounds)
			public.GET("/rounds/:round_id/matches", tournamentHandler.GetMatches)
			public.GET("/matches/:match_id", tournamentHandler.GetMatch)
			public.GET("/matches/:match_id/scores", scoringHandler.GetMatchScores)
			public.GET("/match-formats", tournamentHandler.GetMatchFormats)
		}

		// Protected routes (authentication required)
		protected := api.Group("/")
		protected.Use(middleware.JWTAuth())
		{
			// User management
			protected.GET("/users", authHandler.GetUsers)

			// Tournament management (admin or tournament creator)
			protected.POST("/tournaments", tournamentHandler.CreateTournament)
			protected.POST("/tournaments/:tournament_id/teams", tournamentHandler.CreateTeam)
			protected.POST("/teams/:team_id/members", tournamentHandler.AddTeamMember)
			protected.POST("/tournaments/:tournament_id/rounds", tournamentHandler.CreateRound)
			protected.POST("/rounds/:round_id/matches", tournamentHandler.CreateMatch)

			// Scoring (players can submit their own scores)
			protected.POST("/matches/:match_id/scores", scoringHandler.SubmitScores)
			protected.PATCH("/matches/:match_id/scores/:hole_number", scoringHandler.UpdateHoleScore)
		}

		// WebSocket endpoint (optional auth for real-time updates)
		api.GET("/ws/tournaments/:tournament_id", func(c *gin.Context) {
			wsHub.HandleWebSocket(c)
		})
	}

	return r
}

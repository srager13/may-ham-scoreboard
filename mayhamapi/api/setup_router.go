package main

import (
	"mayhamapi/handlers"
	"mayhamapi/middleware"
	"mayhamapi/websocket"

	"github.com/gin-gonic/gin"
)

func setupRouter(
	authHandler *handlers.AuthHandler,
	tournamentHandler *handlers.TournamentHandler,
	scoringHandler *handlers.ScoringHandler,
	groupHandler *handlers.GroupHandler,
	wsHub *websocket.Hub,
) *gin.Engine {
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())
	r.Use(middleware.RequestID())

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

			// Group management
			protected.POST("/groups", groupHandler.CreateGroup)
			protected.GET("/groups", groupHandler.GetUserGroups)
			protected.GET("/groups/:groupId/members", groupHandler.GetGroupMembers)
			protected.POST("/groups/:groupId/members", groupHandler.AddGroupMember)
			protected.GET("/groups/:groupId/users", groupHandler.GetGroupUsers)

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

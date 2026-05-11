package main

import (
	"log"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"

	"mayhamapi/db"
	"mayhamapi/email"
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
	// Check for ENV_FILE environment variable to support multiple environments
	envFile := os.Getenv("ENV_FILE")
	if envFile == "" {
		envFile = ".env" // fallback to default
	}

	if err := godotenv.Load(envFile); err != nil {
		log.Printf("No %s file found, using system environment variables\n", envFile)
	} else {
		log.Printf("Loaded environment from %s\n", envFile)
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

	// Initialize email mailer (nil if SMTP env vars are not set)
	mailer := email.NewMailer()

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(repo, mailer)
	// Configure upload directory via environment (default to ./uploads/team_logos)
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads/team_logos"
	}

	// Resolve to an absolute path for clarity in logs and to avoid surprises
	resolvedUploadDir, err := filepath.Abs(uploadDir)
	if err != nil {
		log.Printf("Using upload dir %s (failed to resolve absolute path: %v)", uploadDir, err)
		resolvedUploadDir = uploadDir
	} else {
		// Normalize with Clean
		resolvedUploadDir = filepath.Clean(resolvedUploadDir)
		log.Printf("Using upload dir: %s (resolved absolute path: %s)", uploadDir, resolvedUploadDir)
	}

	// Ensure the upload directory exists and has sensible permissions
	if err := os.MkdirAll(resolvedUploadDir, 0755); err != nil {
		log.Fatalf("Failed to create upload directory %s: %v", resolvedUploadDir, err)
	}
	if err := os.Chmod(resolvedUploadDir, 0755); err != nil {
		log.Printf("Warning: failed to set permissions on upload dir %s: %v", resolvedUploadDir, err)
	}

	// Optional: set ownership if requested. Supports either numeric UID/GID via
	// UPLOAD_DIR_UID and UPLOAD_DIR_GID, or a username (optionally with group)
	// via UPLOAD_DIR_OWNER (format: user or user:group).
	if uidStr := os.Getenv("UPLOAD_DIR_UID"); uidStr != "" {
		if gidStr := os.Getenv("UPLOAD_DIR_GID"); gidStr != "" {
			if uid, err := strconv.Atoi(uidStr); err == nil {
				if gid, err := strconv.Atoi(gidStr); err == nil {
					if err := os.Chown(resolvedUploadDir, uid, gid); err != nil {
						log.Printf("Warning: failed to chown %s to %d:%d: %v", resolvedUploadDir, uid, gid, err)
					} else {
						log.Printf("Set ownership of upload dir %s to %d:%d", resolvedUploadDir, uid, gid)
					}
				}
			}
		}
	} else if owner := os.Getenv("UPLOAD_DIR_OWNER"); owner != "" {
		// owner may be "user" or "user:group"
		var uid, gid int
		var uidSet, gidSet bool
		if strings.Contains(owner, ":") {
			parts := strings.SplitN(owner, ":", 2)
			uStr, gStr := parts[0], parts[1]
			if u, err := user.Lookup(uStr); err == nil {
				if uID, err := strconv.Atoi(u.Uid); err == nil {
					uid = uID
					uidSet = true
				}
			}
			if g, err := user.LookupGroup(gStr); err == nil {
				if gID, err := strconv.Atoi(g.Gid); err == nil {
					gid = gID
					gidSet = true
				}
			}
		} else {
			if u, err := user.Lookup(owner); err == nil {
				if uID, err := strconv.Atoi(u.Uid); err == nil {
					uid = uID
					uidSet = true
				}
				if gID, err := strconv.Atoi(u.Gid); err == nil {
					gid = gID
					gidSet = true
				}
			}
		}
		if uidSet && gidSet {
			if err := os.Chown(resolvedUploadDir, uid, gid); err != nil {
				log.Printf("Warning: failed to chown %s to %s: %v", resolvedUploadDir, owner, err)
			} else {
				log.Printf("Set ownership of upload dir %s to %s", resolvedUploadDir, owner)
			}
		} else {
			log.Printf("UPLOAD_DIR_OWNER=%s provided but could not resolve to numeric uid:gid; skipping chown", owner)
		}
	}

	tournamentHandler := handlers.NewTournamentHandler(repo, resolvedUploadDir)
	scoringHandler := handlers.NewScoringHandler(repo, scoringService)
	groupHandler := handlers.NewGroupHandler(repo)
	leaderboardHandler := handlers.NewLeaderboardHandler(repo)
	golfCourseHandler := handlers.NewGolfCourseHandler(repo)

	// Setup router (pass resolved upload dir so the static handler serves the same path)
	router := setupRouter(authHandler, tournamentHandler, scoringHandler, groupHandler, leaderboardHandler, golfCourseHandler, wsHub, resolvedUploadDir)

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
	uploadDir string,
) *gin.Engine {
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())
	r.Use(middleware.RequestID())

	// Serve static files from root (assets, vite.svg, etc.)
	// This must come before other routes
	r.Static("/assets", "./static/assets")
	r.StaticFile("/vite.svg", "./static/vite.svg")
	r.StaticFile("/favicon.ico", "./static/favicon.ico")

	// Serve uploaded team logos
	// Expose the configured upload directory at the public path
	// /static/team_logos so existing DB entries and clients continue to work.
	r.Static("/static/team_logos", uploadDir)
	// Serve index.html at root
	r.GET("/", func(c *gin.Context) {
		c.File("./static/index.html")
	})

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
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.GET("/verify-email", authHandler.VerifyEmail)
			auth.GET("/me", middleware.JWTAuth(), authHandler.GetCurrentUser)
			auth.POST("/refresh", middleware.JWTAuth(), authHandler.RefreshToken)
			auth.POST("/resend-verification", middleware.JWTAuth(), authHandler.ResendVerification)
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
			protected.GET("/groups/search", groupHandler.SearchGroups)
			protected.GET("/groups/:groupId", groupHandler.GetGroupByID)
			protected.PUT("/groups/:groupId", groupHandler.UpdateGroup)
			protected.POST("/groups/:groupId/join", groupHandler.JoinGroup)
			protected.POST("/groups/:groupId/request-join", groupHandler.RequestToJoin)
			protected.GET("/groups/:groupId/members", groupHandler.GetGroupMembers)
			protected.POST("/groups/:groupId/members", groupHandler.AddGroupMember)
			protected.PUT("/groups/:groupId/members/:userId/role", groupHandler.UpdateMemberRole)
			protected.DELETE("/groups/:groupId/members/:userId", groupHandler.RemoveGroupMember)
			protected.GET("/groups/:groupId/users", groupHandler.GetGroupUsers)
			protected.GET("/groups/:groupId/join-requests", groupHandler.GetJoinRequests)
			protected.POST("/groups/:groupId/join-requests/:requestId/approve", groupHandler.ApproveJoinRequest)
			protected.POST("/groups/:groupId/join-requests/:requestId/reject", groupHandler.RejectJoinRequest)
			protected.POST("/groups/:groupId/invitations", groupHandler.CreateInvitation)
			protected.GET("/groups/join", groupHandler.AcceptInvitation)

			// Tournament management (admin or tournament creator)
			protected.POST("/tournaments", tournamentHandler.CreateTournament)
			protected.DELETE("/tournaments/:tournament_id", tournamentHandler.DeleteTournament)
			protected.POST("/tournaments/:tournament_id/teams", tournamentHandler.CreateTeam)
			// Upload team logo (multipart/form-data: field name "logo")
			protected.POST("/teams/:team_id/logo", tournamentHandler.UploadTeamLogo)
			// Allow setting an existing uploaded logo URL on a team without re-uploading
			// (PATCH with JSON body { "logo_url": "/static/team_logos/..." }). This is
			// used by the frontend when recreating teams during tournament edits to
			// preserve previously uploaded logos.
			protected.PATCH("/teams/:team_id/logo", tournamentHandler.SetTeamLogoUrl)
			// Debug: list files in the team_logos upload directory
			protected.GET("/debug/team-logos", tournamentHandler.ListTeamLogos)
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
			protected.GET("/golf-courses/tees/:tee_id/holes", golfCourseHandler.GetGolfCourseHoles)
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

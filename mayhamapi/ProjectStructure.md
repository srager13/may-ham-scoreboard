
### Project Structure

```
may-ham-scoreboard/
├── mayhamapi/                    # Backend API server and frontend
│   ├── main.go                  # Backend API server entry point
│   ├── go.mod                   # Go module definition
│   ├── go.sum                   # Go module dependencies
│   ├── mayhamapi               # Compiled backend binary
│   ├── .env                    # Environment variables (for API and database)
│   ├── .env.example            # Example environment configuration
│   ├── .env.test               # Test environment configuration
│   ├── Makefile                # Build and test automation
│   ├── README.md               # Project documentation
│   ├── TESTING.md              # Integration testing guide
│   ├── integration_test.go     # API integration tests
│   ├── test_config.go          # Test database setup utilities
│   ├── run-integration-tests.sh # Automated test runner script
│   ├── db/
│   │   ├── connection.go       # Database connection and migrations
│   │   ├── golf_db_schema.sql  # Database schema
│   │   ├── add_groups_migration.sql # Groups feature migration
│   │   └── reset_database.sql  # SQL to clear database and initialize users
│   ├── models/
│   │   └── models.go          # Data models and DTOs
│   ├── repository/
│   │   ├── repository.go      # Database operations
│   │   ├── repository_test.go # Repository integration test templates
│   ├── handlers/
│   │   ├── auth_handler.go        # Authentication endpoints
│   │   ├── group_handler.go       # Group management endpoints
│   │   ├── tournament_handler.go  # Tournament management
│   │   └── scoring_handler.go     # Scoring endpoints
│   ├── scoring/
│   │   └── service.go         # Scoring business logic
│   ├── middleware/
│   │   └── auth.go           # JWT and CORS middleware
│   ├── websocket/
│   │   └── hub.go            # WebSocket hub for real-time updates
│   ├── frontend/                 # React frontend application
│   │   ├── index.html           # HTML entry point
│   │   ├── package.json         # Node.js dependencies
│   │   ├── package-lock.json    # Dependency lock file
│   │   ├── vite.config.ts       # Vite build configuration
│   │   ├── tailwind.config.js   # Tailwind CSS configuration
│   │   ├── postcss.config.js    # PostCSS configuration
│   │   ├── tsconfig.json        # TypeScript configuration
│   │   ├── tsconfig.node.json   # TypeScript Node configuration
│   │   └── src/
│   │       ├── main.tsx         # React application entry point
│   │       ├── App.tsx          # Main application component
│   │       ├── index.css        # Global styles
│   │       ├── components/
│   │       │   ├── AdminPortal.tsx    # Tournament administration
│   │       │   ├── Auth.tsx           # Authentication component
│   │       │   ├── ErrorBoundary.tsx  # Error handling wrapper
│   │       │   ├── Groups.tsx         # Group management interface
│   │       │   ├── LandingPage.tsx    # Landing page component
│   │       │   ├── Leaderboard.tsx    # Tournament leaderboard
│   │       │   └── ScoreInterface.tsx # Score entry interface
│   │       └── services/
│   │           └── api.ts             # API client and type definitions
│   ├── static/                   # Built frontend assets (served by backend)
│   │   ├── index.html           # Production HTML
│   │   └── assets/              # Built CSS/JS assets
│   ├── nginx-proxy-config/       # Nginx configuration for production
│   │   ├── nginx.conf           # Main nginx configuration
│   │   ├── upstream.conf        # Upstream server configuration
│   │   ├── performance.conf     # Performance optimizations
│   │   ├── logging.conf         # Logging configuration
│   │   ├── setup-nginx.sh       # Nginx setup script
│   │   ├── reload-nginx.sh      # Nginx reload script
│   │   ├── test-nginx.sh        # Nginx test script
│   │   └── commands-reference.txt # Nginx commands reference
│   └── system-service/           # Production deployment configuration
│       ├── docker-compose.yaml  # Docker deployment configuration
│       ├── Dockerfile.backend   # Backend container definition
│       ├── Dockerfile.frontend  # Frontend container definition
│       ├── golf-api.service     # Systemd service for backend
│       ├── golf-frontend.service # Systemd service for frontend
│       ├── setup-linux.sh       # Linux deployment setup
│       ├── setup-guide.txt      # Deployment guide
│       └── useful-commands.txt  # Useful deployment commands
├── Notes.txt                     # Development notes
│── TODOs.yaml                   # Development TODOs
└── LANDING_PAGE_README.md       # Project overview and landing page
```
# Mayham Golf Tournament API

A Go-based REST API for managing Ryder Cup-style golf tournaments with custom match formats, real-time scoring, and leaderboard tracking.

## Features

- 🏆 **Tournament Management**: Create and manage tournaments, teams, rounds, and matches
- ⛳ **Multiple Match Formats**: Support for Match Play, Scramble, Best Ball, Alternate Shot, High-Low, and Shamble formats
- 📊 **Real-time Scoring**: Live score updates with WebSocket support
- 🏅 **Leaderboard Tracking**: Dynamic tournament standings and statistics
- 🔐 **Authentication**: JWT-based authentication and authorization
- 📱 **API-First Design**: RESTful API ready for React/React Native frontends

## Tech Stack

- **Backend**: Go (Gin framework)
- **Database**: PostgreSQL
- **Real-time**: WebSockets (Gorilla WebSocket)
- **Authentication**: JWT tokens
- **Documentation**: OpenAPI 3.0 specification

## Getting Started

### Prerequisites

- Go 1.22+ installed
- PostgreSQL database running
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd may-ham-scoring-app/mayhamapi
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up PostgreSQL database**
   ```bash
   createdb mayham_golf
   # The application will run migrations automatically on startup
   ```

5. **Run the application**
   ```bash
   go run .
   ```

The API server will start on `http://localhost:8080` by default.

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=8080

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=mayham_golf
DB_SSL_MODE=disable

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Environment
GIN_MODE=debug
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Tournaments
- `GET /api/v1/public/tournaments` - List all tournaments
- `POST /api/v1/tournaments` - Create new tournament (auth required)
- `GET /api/v1/public/tournaments/:id` - Get tournament details

### Teams
- `GET /api/v1/public/tournaments/:tournament_id/teams` - Get tournament teams
- `POST /api/v1/tournaments/:tournament_id/teams` - Create team (auth required)
- `POST /api/v1/teams/:team_id/members` - Add team member (auth required)

### Rounds & Matches
- `GET /api/v1/public/tournaments/:tournament_id/rounds` - Get tournament rounds
- `POST /api/v1/tournaments/:tournament_id/rounds` - Create round (auth required)
- `GET /api/v1/public/rounds/:round_id/matches` - Get round matches
- `POST /api/v1/rounds/:round_id/matches` - Create match (auth required)

### Scoring
- `GET /api/v1/public/matches/:match_id/scores` - Get match scores
- `POST /api/v1/matches/:match_id/scores` - Submit scores (auth required)
- `PATCH /api/v1/matches/:match_id/scores/:hole_number` - Update hole score (auth required)

### Match Formats
- `GET /api/v1/public/match-formats` - Get available match formats

### Real-time Updates
- `WS /api/v1/ws/tournaments/:tournament_id` - WebSocket connection for live updates

## Match Formats Supported

1. **Match Play** - Head-to-head match where each hole is won, lost, or halved
2. **Scramble** - Team plays from the best shot on each stroke
3. **Best Ball** - Team uses the lowest score from any team member on each hole
4. **Alternate Shot** - Team members alternate shots throughout the hole
5. **High-Low** - Combines highest and lowest scores from each team
6. **Shamble** - Team tees off, selects best drive, then plays individual balls

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - Player/user information
- `tournaments` - Tournament details
- `teams` - Tournament teams
- `team_members` - Team membership
- `rounds` - Tournament rounds
- `matches` - Individual matches
- `match_players` - Match participants
- `scores` - Individual hole scores

## WebSocket Events

The application broadcasts real-time updates via WebSocket:

- `connected` - Initial connection confirmation
- `score_updated` - When scores are submitted/updated
- `match_completed` - When a match is finished
- `leaderboard_updated` - When tournament standings change

## Development

### Project Structure

```
mayhamapi/
├── main.go                 # Application entry point
├── go.mod                  # Go module definition
├── .env.example           # Environment variables template
├── db/
│   ├── connection.go      # Database connection and migrations
│   └── golf_db_schema.sql # Database schema
├── models/
│   └── models.go         # Data models and DTOs
├── repository/
│   └── repository.go     # Database operations
├── handlers/
│   ├── auth_handler.go       # Authentication endpoints
│   ├── tournament_handler.go # Tournament management
│   └── scoring_handler.go    # Scoring endpoints
├── scoring/
│   ├── service.go        # Scoring business logic
│   └── scoring_logic.go  # Match format calculations
├── middleware/
│   └── auth.go          # JWT and CORS middleware
└── websocket/
    └── hub.go           # WebSocket hub for real-time updates
```

### Running Tests

```bash
go test ./...
```

### Building for Production

```bash
go build -ldflags="-s -w" -o mayham-api .
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Next Steps

To complete your golf tournament application:

1. **Frontend Development**: Build React/React Native components using this API
2. **Advanced Features**: Add handicap calculations, course management, weather integration
3. **Admin Dashboard**: Create tournament management interface
4. **Mobile App**: Develop React Native scoring app for players
5. **Analytics**: Add tournament statistics and reporting
6. **Testing**: Add comprehensive unit and integration tests

The API is now fully functional and ready to support your frontend development!
// API client for connecting React frontend to Go backend

const API_BASE_URL = '/api/v1';

// Types based on Go backend models
export interface User {
  id: string;
  email: string;
  name: string;
  handicap?: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  user?: User;
  created_at: string;
}

export interface Round {
  id: string;
  tournament_id: string;
  name: string;
  round_number: number;
  round_date: string;
  status: string;
  created_at: string;
}

export interface MatchFormat {
  id: string;
  name: string;
  description?: string;
  players_per_side: number;
  scoring_type: string;
  created_at: string;
}

export interface Match {
  id: string;
  round_id: string;
  match_format_id: string;
  match_number: number;
  holes: number;
  status: string;
  team1_id: string;
  team2_id: string;
  points_available: number;
  team1_points: number;
  team2_points: number;
  team1?: Team;
  team2?: Team;
  format?: MatchFormat;
  players?: MatchPlayer[];
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  user_id: string;
  team_id: string;
  position: number;
  user?: User;
}

export interface Score {
  id: string;
  match_id: string;
  user_id: string;
  hole_number: number;
  strokes: number;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateTournamentRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
}

export interface CreateTeamRequest {
  name: string;
  color?: string;
}

export interface CreateRoundRequest {
  name: string;
  round_number: number;
  start_time: string;
}

export interface CreateMatchRequest {
  match_format_id: string;
  match_number: number;
  holes: number;
  team1_id: string;
  team2_id: string;
  player_assignments: {
    team1_players: string[];
    team2_players: string[];
  };
}

export interface SubmitScoresRequest {
  hole_number: number;
  scores: Array<{
    user_id: string;
    strokes: number;
  }>;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  handicap?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Try to get token from localStorage
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || `HTTP ${response.status}`
      );
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(response.token);
    return response;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    this.setToken(response.token);
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Tournaments
  async getTournaments(): Promise<Tournament[]> {
    return this.request<Tournament[]>('/public/tournaments');
  }

  async getTournament(id: string): Promise<Tournament> {
    return this.request<Tournament>(`/public/tournaments/${id}`);
  }

  async createTournament(data: CreateTournamentRequest): Promise<Tournament> {
    return this.request<Tournament>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Teams
  async getTournamentTeams(tournamentId: string): Promise<Team[]> {
    return this.request<Team[]>(`/public/tournaments/${tournamentId}/teams`);
  }

  async createTeam(tournamentId: string, data: CreateTeamRequest): Promise<Team> {
    return this.request<Team>(`/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addTeamMember(teamId: string, userId: string): Promise<TeamMember> {
    return this.request<TeamMember>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // Rounds
  async getTournamentRounds(tournamentId: string): Promise<Round[]> {
    return this.request<Round[]>(`/public/tournaments/${tournamentId}/rounds`);
  }

  async createRound(tournamentId: string, data: CreateRoundRequest): Promise<Round> {
    return this.request<Round>(`/tournaments/${tournamentId}/rounds`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Matches
  async getRoundMatches(roundId: string): Promise<Match[]> {
    return this.request<Match[]>(`/public/rounds/${roundId}/matches`);
  }

  async getMatch(matchId: string): Promise<Match> {
    return this.request<Match>(`/public/matches/${matchId}`);
  }

  async createMatch(roundId: string, data: CreateMatchRequest): Promise<Match> {
    return this.request<Match>(`/rounds/${roundId}/matches`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Match Formats
  async getMatchFormats(): Promise<MatchFormat[]> {
    return this.request<MatchFormat[]>('/public/match-formats');
  }

  // Scoring
  async getMatchScores(matchId: string): Promise<Score[]> {
    return this.request<Score[]>(`/public/matches/${matchId}/scores`);
  }

  async submitScores(matchId: string, data: SubmitScoresRequest): Promise<void> {
    return this.request<void>(`/matches/${matchId}/scores`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHoleScore(
    matchId: string,
    holeNumber: number,
    userId: string,
    strokes: number
  ): Promise<void> {
    return this.request<void>(`/matches/${matchId}/scores/${holeNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: userId, strokes }),
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();
export { ApiError };
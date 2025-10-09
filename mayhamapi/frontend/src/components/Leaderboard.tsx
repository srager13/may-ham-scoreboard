import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';

import { Trophy, Users } from 'lucide-react';

import { apiClient, ApiError, Tournament, Team } from '../services/api';import { Trophy, Users, User, Clock } from 'lucide-react';



const Leaderboard = () => {import { apiClient, ApiError, Tournament, Team, Match } from '../services/api';import { Trophy, TrendingUp, TrendingDown, Minus, Users, User, Award, Clock } from 'lucide-react';import { Trophy, TrendingUp, TrendingDown, Minus, Users, User, Award, Clock } from 'lucide-react';

  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

interface LeaderboardData {import { apiClient, ApiError, Tournament, Team, Match, Round } from '../services/api';import { apiClient, ApiError, Tournament, Team, Match, Round } from '../services/api';

  useEffect(() => {

    loadTournaments();  tournament: Tournament | null;

  }, []);

  teams: Team[];

  const loadTournaments = async () => {

    try {  matches: Match[];

      setLoading(true);

      setError(null);}interface TeamStanding {interface TeamStanding {

      const tournamentList = await apiClient.getTournaments();

      setTournaments(tournamentList);

    } catch (err) {

      console.error('Error loading tournaments:', err);const TournamentLeaderboard = ({ tournamentId }: { tournamentId: string }) => {  team: Team;  team: Team;

      setError(err instanceof ApiError ? err.message : 'Failed to load tournaments');

    } finally {  const [data, setData] = useState<LeaderboardData>({

      setLoading(false);

    }    tournament: null,  points_won: number;  points_won: number;

  };

    teams: [],

  if (loading) {

    return (    matches: []  points_lost: number;  points_lost: number;

      <div className="flex items-center justify-center min-h-screen bg-gray-50">

        <div className="text-center">  });

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>

          <p className="text-gray-600">Loading tournaments...</p>  const [loading, setLoading] = useState(true);  matches_won: number;  matches_won: number;

        </div>

      </div>  const [error, setError] = useState<string | null>(null);

    );

  }  matches_lost: number;  matches_lost: number;



  return (  useEffect(() => {

    <div className="min-h-screen bg-gray-50">

      {/* Header */}    loadLeaderboardData();  matches_tied: number;  matches_tied: number;

      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">

        <div className="max-w-7xl mx-auto px-6 py-8">  }, [tournamentId]);

          <div className="flex items-center">

            <Trophy className="h-12 w-12 mr-4" />  holes_won: number;  holes_won: number;

            <div>

              <h1 className="text-3xl font-bold mb-2">Golf Tournament Leaderboard</h1>  const loadLeaderboardData = async () => {

              <p className="text-green-100">Tournament standings and results</p>

            </div>    try {  holes_lost: number;  holes_lost: number;

          </div>

        </div>      setLoading(true);

      </div>

      setError(null);  holes_tied: number;  holes_tied: number;

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* API Status */}

        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">

          <p className="text-sm">      // Try to get tournament details - this will likely fail for demo data}}

            <strong>✅ API Connected:</strong> This component is now connected to your Go backend. 

            Create tournaments through the Admin Portal to see them here.      // but shows the API integration

          </p>

        </div>      try {



        {error && (        const tournament = await apiClient.getTournament(tournamentId);

          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">

            <p>{error}</p>        const teams = await apiClient.getTournamentTeams(tournamentId);interface PlayerStanding {interface PlayerStanding {

            <button

              onClick={loadTournaments}        

              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"

            >        setData({  user: { id: string; name: string; handicap?: number };  user: { id: string; name: string; handicap?: number };

              Retry

            </button>          tournament,

          </div>

        )}          teams,  team: Team;  team: Team;



        {/* Tournaments */}          matches: []

        <div className="bg-white rounded-lg shadow-sm p-6">

          <h2 className="text-lg font-semibold mb-4 flex items-center">        });  points_won: number;  points_won: number;

            <Users className="w-5 h-5 mr-2 text-green-600" />

            Available Tournaments      } catch (apiErr) {

          </h2>

        // If API fails, show demo data but indicate it's demo mode  points_lost: number;  points_lost: number;

          {tournaments.length === 0 ? (

            <div className="text-center py-8">        console.log('API call failed, using demo data:', apiErr);

              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />

              <h3 className="text-lg font-medium text-gray-900 mb-2">No Tournaments Found</h3>        setData({  matches_played: number;  matches_played: number;

              <p className="text-gray-500 mb-4">

                Create your first tournament using the Admin Portal to get started.          tournament: {

              </p>

              <a            id: 'demo',  matches_won: number;  matches_won: number;

                href="/admin"

                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"            name: 'Demo Tournament - Connect Your Database',

              >

                Go to Admin Portal            description: 'This is demo data. Create a tournament via the Admin Portal to see real data.',  matches_lost: number;  matches_lost: number;

              </a>

            </div>            status: 'draft',

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">            start_date: '2025-10-09',  matches_tied: number;  matches_tied: number;

              {tournaments.map((tournament) => (

                <div key={tournament.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">            end_date: '2025-10-10',

                  <div className="flex items-start justify-between mb-3">

                    <div>            created_by: 'demo',  holes_won: number;  holes_won: number;

                      <h3 className="font-medium text-lg text-gray-900">{tournament.name}</h3>

                      {tournament.description && (            created_at: '2025-10-09',

                        <p className="text-sm text-gray-600 mt-1">{tournament.description}</p>

                      )}            updated_at: '2025-10-09'  holes_lost: number;  holes_lost: number;

                    </div>

                    <span className={`px-2 py-1 text-xs rounded-full ${          },

                      tournament.status === 'active' 

                        ? 'bg-green-100 text-green-800'          teams: [  holes_tied: number;  holes_tied: number;

                        : tournament.status === 'completed'

                        ? 'bg-gray-100 text-gray-800'            {

                        : 'bg-yellow-100 text-yellow-800'

                    }`}>              id: '1',}}

                      {tournament.status}

                    </span>              tournament_id: 'demo',

                  </div>

                                name: 'Team USA',

                  <div className="text-sm text-gray-500">

                    <div>Start: {new Date(tournament.start_date).toLocaleDateString()}</div>              color: '#DC2626',

                    <div>End: {new Date(tournament.end_date).toLocaleDateString()}</div>

                  </div>              created_at: '2025-10-09'interface LeaderboardData {interface LeaderboardData {

                  

                  <div className="mt-4 pt-4 border-t border-gray-100">            },

                    <div className="text-xs text-gray-500">Tournament ID: {tournament.id}</div>

                  </div>            {  tournament: Tournament;  tournament: Tournament;

                </div>

              ))}              id: '2',

            </div>

          )}              tournament_id: 'demo',  team_standings: TeamStanding[];  team_standings: TeamStanding[];

        </div>

              name: 'Team Europe',

        {/* Available Endpoints */}

        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">              color: '#2563EB',  individual_standings: PlayerStanding[];  individual_standings: PlayerStanding[];

          <h2 className="text-lg font-semibold mb-4">API Integration Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">              created_at: '2025-10-09'

            <div>

              <h3 className="font-medium text-green-600 mb-2">✅ Connected Endpoints:</h3>            }  live_matches: Match[];  live_matches: Match[];

              <ul className="space-y-1 font-mono text-xs">

                <li>GET /api/v1/public/tournaments</li>          ],

                <li>GET /api/v1/public/tournaments/:id</li>

                <li>GET /api/v1/public/match-formats</li>          matches: []}}

                <li>POST /api/v1/tournaments</li>

                <li>POST /api/v1/matches/:id/scores</li>        });

              </ul>

            </div>      }      team_standings: [

            <div>

              <h3 className="font-medium text-blue-600 mb-2">🔄 How to Test:</h3>

              <ol className="space-y-1 text-xs">

                <li>1. Go to Admin Portal</li>    } catch (err) {const TournamentLeaderboard = ({ tournamentId }: { tournamentId: string }) => {        {

                <li>2. Create a new tournament</li>

                <li>3. Add teams and players</li>      console.error('Error loading leaderboard:', err);

                <li>4. Return here to see live data</li>

                <li>5. Use Score Entry to submit scores</li>      setError(err instanceof ApiError ? err.message : 'Failed to load leaderboard data');  const [data, setData] = useState<LeaderboardData | null>(null);          team: { id: '1', name: 'Team USA', color: '#DC2626' },

              </ol>

            </div>    } finally {

          </div>

        </div>      setLoading(false);  const [view, setView] = useState<'team' | 'individual'>('team');          points_won: 12.5,

      </div>

    </div>    }

  );

};  };  const [loading, setLoading] = useState(true);          points_lost: 7.5,



export default Leaderboard;

  if (loading) {  const [error, setError] = useState<string | null>(null);          matches_won: 8,

    return (

      <div className="flex items-center justify-center min-h-screen bg-gray-50">          matches_lost: 4,

        <div className="text-center">

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>  useEffect(() => {          matches_tied: 3,

          <p className="text-gray-600">Loading leaderboard...</p>

        </div>    loadLeaderboardData();          holes_won: 45,

      </div>

    );  }, [tournamentId]);          holes_lost: 32,

  }

          holes_tied: 18

  if (error) {

    return (  const loadLeaderboardData = async () => {        },

      <div className="flex items-center justify-center min-h-screen bg-gray-50">

        <div className="text-center">    try {        {

          <p className="text-red-600 mb-4">{error}</p>

          <button      setLoading(true);          team: { id: '2', name: 'Team Europe', color: '#2563EB' },

            onClick={loadLeaderboardData}

            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"      setError(null);          points_won: 7.5,

          >

            Retry          points_lost: 12.5,

          </button>

        </div>      // Get tournament details          matches_won: 4,

      </div>

    );      const tournament = await apiClient.getTournament(tournamentId);          matches_lost: 8,

  }

                matches_tied: 3,

  return (

    <div className="min-h-screen bg-gray-50">      // Get teams          holes_won: 32,

      {/* Tournament Header */}

      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">      const teams = await apiClient.getTournamentTeams(tournamentId);          holes_lost: 45,

        <div className="max-w-7xl mx-auto px-6 py-8">

          <div className="flex items-center justify-between">                holes_tied: 18

            <div>

              <h1 className="text-3xl font-bold mb-2">      // Get rounds and matches for live match data        }

                {data.tournament?.name || 'Golf Tournament Leaderboard'}

              </h1>      const rounds = await apiClient.getTournamentRounds(tournamentId);      ],

              <p className="text-green-100">

                {data.tournament?.description || 'Tournament leaderboard and standings'}      const liveMatches: Match[] = [];      individual_standings: [

              </p>

            </div>              {

            <div className="text-right">

              <div className="bg-green-700 px-4 py-2 rounded-lg">      for (const round of rounds) {          user: { id: '1', name: 'John Doe', handicap: 12.5 },

                <span className="text-sm font-medium">

                  {data.tournament?.status || 'Demo Mode'}        const matches = await apiClient.getRoundMatches(round.id);          team: { id: '1', name: 'Team USA', color: '#DC2626' },

                </span>

              </div>        // Filter for in-progress matches          points_won: 3.5,

            </div>

          </div>        liveMatches.push(...matches.filter(m => m.status === 'in_progress'));          points_lost: 1.5,

        </div>

      </div>      }          matches_played: 4,



      <div className="max-w-7xl mx-auto px-6 py-6">          matches_won: 3,

        {/* API Status Banner */}

        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">      // For now, create mock standings since we don't have player stats endpoint          matches_lost: 1,

          <p className="text-sm">

            <strong>API Integration Active:</strong> This component is now connected to your Go backend API.       // In a real app, you'd want to add a GET /api/v1/tournaments/:id/leaderboard endpoint          matches_tied: 0,

            Create tournaments through the Admin Portal to see real data here.

          </p>      const teamStandings: TeamStanding[] = teams.map(team => ({          holes_won: 15,

        </div>

        team,          holes_lost: 8,

        {/* Teams Display */}

        {data.teams.length > 0 && (        points_won: Math.random() * 10,          holes_tied: 4,

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">

            <h2 className="text-lg font-semibold mb-4 flex items-center">        points_lost: Math.random() * 10,          win_percentage: 0.75

              <Users className="w-5 h-5 mr-2 text-green-600" />

              Tournament Teams        matches_won: Math.floor(Math.random() * 8),        },

            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">        matches_lost: Math.floor(Math.random() * 8),        {

              {data.teams.map((team) => (

                <div key={team.id} className="border border-gray-200 rounded-lg p-4">        matches_tied: Math.floor(Math.random() * 3),          user: { id: '2', name: 'Jane Smith', handicap: 8.0 },

                  <div className="flex items-center space-x-3">

                    <div        holes_won: Math.floor(Math.random() * 50),          team: { id: '1', name: 'Team USA', color: '#DC2626' },

                      className="w-6 h-6 rounded-full"

                      style={{ backgroundColor: team.color }}        holes_lost: Math.floor(Math.random() * 50),          points_won: 3.0,

                    ></div>

                    <div>        holes_tied: Math.floor(Math.random() * 20),          points_lost: 2.0,

                      <h3 className="font-medium text-lg">{team.name}</h3>

                      <p className="text-sm text-gray-500">Team ID: {team.id}</p>      }));          matches_played: 4,

                    </div>

                  </div>          matches_won: 2,

                </div>

              ))}      const individualStandings: PlayerStanding[] = [          matches_lost: 1,

            </div>

          </div>        // Mock individual player data - replace with real data when available          matches_tied: 1,

        )}

        {          holes_won: 12,

        {/* API Endpoints Available */}

        <div className="bg-white rounded-lg shadow-sm p-6">          user: { id: '1', name: 'John Doe', handicap: 12.5 },          holes_lost: 10,

          <h2 className="text-lg font-semibold mb-4">Available API Endpoints</h2>

          <div className="space-y-2 text-sm font-mono">          team: teams[0] || { id: '1', name: 'Team 1', tournament_id: tournamentId, color: '#DC2626', created_at: '' },          holes_tied: 5,

            <div><span className="text-green-600">GET</span> /api/v1/public/tournaments</div>

            <div><span className="text-green-600">GET</span> /api/v1/public/tournaments/:id</div>          points_won: 3.5,          win_percentage: 0.625

            <div><span className="text-green-600">GET</span> /api/v1/public/tournaments/:id/teams</div>

            <div><span className="text-green-600">GET</span> /api/v1/public/tournaments/:id/rounds</div>          points_lost: 1.5,        },

            <div><span className="text-green-600">GET</span> /api/v1/public/match-formats</div>

            <div><span className="text-blue-600">POST</span> /api/v1/tournaments (auth required)</div>          matches_played: 4,        {

            <div><span className="text-blue-600">POST</span> /api/v1/tournaments/:id/teams (auth required)</div>

            <div><span className="text-blue-600">POST</span> /api/v1/matches/:id/scores (auth required)</div>          matches_won: 3,          user: { id: '3', name: 'Bob Johnson', handicap: 15.2 },

          </div>

          <p className="text-sm text-gray-600 mt-4">          matches_lost: 1,          team: { id: '1', name: 'Team USA', color: '#DC2626' },

            Use the Admin Portal to create tournaments and populate real data.

          </p>          matches_tied: 0,          points_won: 3.0,

        </div>

      </div>          holes_won: 15,          points_lost: 2.0,

    </div>

  );          holes_lost: 8,          matches_played: 3,

};

          holes_tied: 2,          matches_won: 2,

const Leaderboard = () => {

  return <TournamentLeaderboard tournamentId="demo-tournament" />;        }          matches_lost: 1,

};

      ];          matches_tied: 0,

export default Leaderboard;
          holes_won: 10,

      setData({          holes_lost: 8,

        tournament,          holes_tied: 3,

        team_standings: teamStandings,          win_percentage: 0.667

        individual_standings: individualStandings,        },

        live_matches: liveMatches,        {

      });          user: { id: '4', name: 'Alice Williams', handicap: 10.5 },

          team: { id: '2', name: 'Team Europe', color: '#2563EB' },

    } catch (err) {          points_won: 2.5,

      console.error('Error loading leaderboard:', err);          points_lost: 2.5,

      setError(err instanceof ApiError ? err.message : 'Failed to load leaderboard data');          matches_played: 4,

    } finally {          matches_won: 2,

      setLoading(false);          matches_lost: 2,

    }          matches_tied: 0,

  };          holes_won: 11,

          holes_lost: 11,

  if (loading) {          holes_tied: 5,

    return (          win_percentage: 0.5

      <div className="flex items-center justify-center min-h-screen bg-gray-50">        },

        <div className="text-center">        {

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>          user: { id: '5', name: 'Charlie Brown', handicap: 18.0 },

          <p className="text-gray-600">Loading leaderboard...</p>          team: { id: '2', name: 'Team Europe', color: '#2563EB' },

        </div>          points_won: 2.0,

      </div>          points_lost: 3.0,

    );          matches_played: 4,

  }          matches_won: 1,

          matches_lost: 3,

  if (error) {          matches_tied: 0,

    return (          holes_won: 9,

      <div className="flex items-center justify-center min-h-screen bg-gray-50">          holes_lost: 14,

        <div className="text-center">          holes_tied: 4,

          <p className="text-red-600 mb-4">{error}</p>          win_percentage: 0.25

          <button        },

            onClick={loadLeaderboardData}        {

            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"          user: { id: '6', name: 'Diana Prince', handicap: 6.5 },

          >          team: { id: '2', name: 'Team Europe', color: '#2563EB' },

            Retry          points_won: 3.0,

          </button>          points_lost: 2.0,

        </div>          matches_played: 3,

      </div>          matches_won: 2,

    );          matches_lost: 1,

  }          matches_tied: 0,

          holes_won: 12,

  if (!data) {          holes_lost: 10,

    return (          holes_tied: 5,

      <div className="flex items-center justify-center min-h-screen bg-gray-50">          win_percentage: 0.667

        <p className="text-gray-600">Unable to load leaderboard</p>        }

      </div>      ],

    );      live_matches: [

  }        {

          id: 'm1',

  return (          match_number: 1,

    <div className="min-h-screen bg-gray-50">          format: '2v2 Scramble',

      {/* Tournament Header */}          current_hole: 4,

      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">          total_holes: 6,

        <div className="max-w-7xl mx-auto px-6 py-8">          team1: { name: 'Team USA', color: '#DC2626', players: ['John Doe', 'Jane Smith'] },

          <div className="flex items-center justify-between">          team2: { name: 'Team Europe', color: '#2563EB', players: ['Alice Williams', 'Diana Prince'] },

            <div>          team1_up: 1,

              <h1 className="text-3xl font-bold mb-2">{data.tournament.name}</h1>          status: 'in_progress',

              <p className="text-green-100">          last_update: '2 minutes ago'

                {data.tournament.start_date} - {data.tournament.end_date}        },

              </p>        {

            </div>          id: 'm2',

            <div className="text-right">          match_number: 2,

              <div className="bg-green-700 px-4 py-2 rounded-lg">          format: 'Singles Match Play',

                <span className="text-sm font-medium">          current_hole: 5,

                  {data.tournament.status === 'in_progress' ? 'In Progress' : 'Completed'}          total_holes: 6,

                </span>          team1: { name: 'Team USA', color: '#DC2626', players: ['Bob Johnson'] },

              </div>          team2: { name: 'Team Europe', color: '#2563EB', players: ['Charlie Brown'] },

            </div>          team1_up: -2,

          </div>          status: 'in_progress',

        </div>          last_update: '5 minutes ago'

      </div>        }

      ]

      <div className="max-w-7xl mx-auto px-6 py-6">    };

        {/* Team Score Banner */}  }

        <TeamScoreBanner teams={data.team_standings} />};



        {/* Live Matches */}const TournamentLeaderboard = ({ tournamentId }) => {

        {data.live_matches && data.live_matches.length > 0 && (  const [data, setData] = useState(null);

          <LiveMatchesSection matches={data.live_matches} />  const [view, setView] = useState('team'); // 'team' or 'individual'

        )}  const [loading, setLoading] = useState(true);



        {/* View Toggle */}  useEffect(() => {

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">    loadLeaderboard();

          <div className="border-b border-gray-200">    const interval = setInterval(loadLeaderboard, 30000); // Refresh every 30 seconds

            <nav className="-mb-px flex space-x-8">    return () => clearInterval(interval);

              <button  }, [tournamentId]);

                onClick={() => setView('team')}

                className={`py-2 px-1 border-b-2 font-medium text-sm ${  const loadLeaderboard = async () => {

                  view === 'team'    try {

                    ? 'border-green-500 text-green-600'      const result = await mockAPI.getTournamentLeaderboard(tournamentId);

                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'      setData(result);

                }`}    } catch (error) {

              >      console.error('Error loading leaderboard:', error);

                <Users className="inline-block w-4 h-4 mr-2" />    } finally {

                Team Standings      setLoading(false);

              </button>    }

              <button  };

                onClick={() => setView('individual')}

                className={`py-2 px-1 border-b-2 font-medium text-sm ${  if (loading) {

                  view === 'individual'    return (

                    ? 'border-green-500 text-green-600'      <div className="flex items-center justify-center min-h-screen bg-gray-50">

                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'        <div className="text-center">

                }`}          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>

              >          <p className="text-gray-600">Loading leaderboard...</p>

                <User className="inline-block w-4 h-4 mr-2" />        </div>

                Individual Standings      </div>

              </button>    );

            </nav>  }

          </div>

  if (!data) {

          {view === 'team' ? (    return (

            <TeamStandings teams={data.team_standings} />      <div className="flex items-center justify-center min-h-screen bg-gray-50">

          ) : (        <p className="text-gray-600">Unable to load leaderboard</p>

            <IndividualStandings players={data.individual_standings} />      </div>

          )}    );

        </div>  }

      </div>

    </div>  return (

  );    <div className="min-h-screen bg-gray-50">

};      {/* Header */}

      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">

const TeamScoreBanner = ({ teams }: { teams: TeamStanding[] }) => {        <div className="max-w-7xl mx-auto px-6 py-8">

  // Sort teams by points won (descending)          <div className="flex items-center justify-between">

  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);            <div>

              <h1 className="text-3xl font-bold mb-2">{data.tournament.name}</h1>

  return (              <p className="text-green-100">

    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">                {data.tournament.start_date} - {data.tournament.end_date}

      <div className="flex items-center justify-center space-x-8">              </p>

        {sortedTeams.map((standing, index) => (            </div>

          <div key={standing.team.id} className="text-center">            <div className="text-right">

            <div              <div className="text-sm text-green-100 mb-1">Tournament Status</div>

              className="w-20 h-20 rounded-full flex items-center justify-center mb-2 mx-auto"              <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-lg">

              style={{ backgroundColor: standing.team.color }}                <Clock size={16} className="mr-2" />

            >                {data.tournament.status === 'in_progress' ? 'In Progress' : 'Completed'}

              <Trophy className="w-8 h-8 text-white" />              </div>

            </div>            </div>

            <h3 className="font-bold text-lg mb-1">{standing.team.name}</h3>          </div>

            <div className="bg-gray-100 px-4 py-2 rounded-lg">        </div>

              <div className="text-2xl font-bold text-gray-900">      </div>

                {standing.points_won.toFixed(1)}

              </div>      <div className="max-w-7xl mx-auto px-6 py-8">

              <div className="text-sm text-gray-600">Points</div>        {/* Team Score Banner */}

            </div>        <TeamScoreBanner teams={data.team_standings} />

            {index === 0 && (

              <div className="mt-2">        {/* Live Matches */}

                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">        {data.live_matches && data.live_matches.length > 0 && (

                  Leading          <LiveMatchesSection matches={data.live_matches} />

                </span>        )}

              </div>

            )}        {/* View Toggle */}

          </div>        <div className="flex items-center justify-center mb-6">

        ))}          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">

      </div>            <button

    </div>              onClick={() => setView('team')}

  );              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${

};                view === 'team'

                  ? 'bg-green-600 text-white'

const LiveMatchesSection = ({ matches }: { matches: Match[] }) => {                  : 'text-gray-700 hover:text-gray-900'

  return (              }`}

    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">            >

      <h2 className="text-lg font-semibold mb-4 flex items-center">              <Users size={18} className="mr-2" />

        <Clock className="w-5 h-5 mr-2 text-green-600" />              Team Standings

        Live Matches            </button>

      </h2>            <button

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">              onClick={() => setView('individual')}

        {matches.map((match) => (              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${

          <LiveMatchCard key={match.id} match={match} />                view === 'individual'

        ))}                  ? 'bg-green-600 text-white'

      </div>                  : 'text-gray-700 hover:text-gray-900'

    </div>              }`}

  );            >

};              <User size={18} className="mr-2" />

              Individual Standings

const LiveMatchCard = ({ match }: { match: Match }) => {            </button>

  return (          </div>

    <div className="border border-gray-200 rounded-lg p-4">        </div>

      <div className="flex justify-between items-start mb-3">

        <div>        {/* Leaderboard Content */}

          <div className="font-medium text-sm text-gray-600">        {view === 'team' ? (

            {match.format?.name}          <TeamStandings teams={data.team_standings} />

          </div>        ) : (

          <div className="text-xs text-gray-500">Match {match.match_number}</div>          <IndividualStandings players={data.individual_standings} />

        </div>        )}

        <div className="flex items-center space-x-1">      </div>

          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>    </div>

          <span className="text-xs text-gray-500">Live</span>  );

        </div>};

      </div>

// Team Score Banner

      <div className="space-y-2">const TeamScoreBanner = ({ teams }) => {

        <div className="flex justify-between items-center">  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);

          <div className="flex items-center space-x-2">  const leader = sortedTeams[0];

            <div  const trailer = sortedTeams[1];

              className="w-3 h-3 rounded-full"  const pointDifference = leader.points_won - trailer.points_won;

              style={{ backgroundColor: match.team1?.color }}

            ></div>  return (

            <span className="font-medium text-sm">{match.team1?.name}</span>    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">

          </div>      <div className="flex items-center justify-between">

          <span className="font-bold">{match.team1_points}</span>        <div className="flex-1 text-center">

        </div>          <div

                    className="text-6xl font-bold mb-2"

        <div className="flex justify-between items-center">            style={{ color: leader.team.color }}

          <div className="flex items-center space-x-2">          >

            <div            {leader.points_won}

              className="w-3 h-3 rounded-full"          </div>

              style={{ backgroundColor: match.team2?.color }}          <div className="text-xl font-semibold mb-1">{leader.team.name}</div>

            ></div>          <div className="text-sm text-gray-600">

            <span className="font-medium text-sm">{match.team2?.name}</span>            {leader.matches_won}W - {leader.matches_lost}L - {leader.matches_tied}T

          </div>          </div>

          <span className="font-bold">{match.team2_points}</span>        </div>

        </div>

      </div>        <div className="px-8">

          <div className="text-center mb-4">

      <div className="mt-3 pt-3 border-t border-gray-100">            <Trophy size={48} className="text-yellow-500 mx-auto" />

        <div className="text-xs text-gray-500">          </div>

          Status: {match.status}          <div className="text-center">

        </div>            <div className="text-3xl font-bold text-gray-900">

      </div>              {pointDifference.toFixed(1)}

    </div>            </div>

  );            <div className="text-sm text-gray-600">point lead</div>

};          </div>

        </div>

const TeamStandings = ({ teams }: { teams: TeamStanding[] }) => {

  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);        <div className="flex-1 text-center">

          <div

  return (            className="text-6xl font-bold mb-2"

    <div className="mt-6">            style={{ color: trailer.team.color }}

      <div className="overflow-x-auto">          >

        <table className="min-w-full">            {trailer.points_won}

          <thead>          </div>

            <tr className="border-b border-gray-200">          <div className="text-xl font-semibold mb-1">{trailer.team.name}</div>

              <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>          <div className="text-sm text-gray-600">

              <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>            {trailer.matches_won}W - {trailer.matches_lost}L - {trailer.matches_tied}T

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Points Won</th>          </div>

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Points Lost</th>        </div>

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Matches</th>      </div>

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Holes</th>    </div>

            </tr>  );

          </thead>};

          <tbody>

            {sortedTeams.map((standing, index) => (// Live Matches Section

              <tr key={standing.team.id} className="border-b border-gray-100 hover:bg-gray-50">const LiveMatchesSection = ({ matches }) => {

                <td className="py-4 px-4">  return (

                  <span className="font-bold text-lg">{index + 1}</span>    <div className="mb-8">

                </td>      <h2 className="text-2xl font-bold mb-4 flex items-center">

                <td className="py-4 px-4">        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>

                  <div className="flex items-center space-x-3">        Live Matches

                    <div      </h2>

                      className="w-4 h-4 rounded-full"      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      style={{ backgroundColor: standing.team.color }}        {matches.map((match) => (

                    ></div>          <LiveMatchCard key={match.id} match={match} />

                    <span className="font-medium">{standing.team.name}</span>        ))}

                  </div>      </div>

                </td>    </div>

                <td className="py-4 px-4 text-center">  );

                  <span className="font-bold text-green-600">};

                    {standing.points_won.toFixed(1)}

                  </span>const LiveMatchCard = ({ match }) => {

                </td>  const getStatusText = () => {

                <td className="py-4 px-4 text-center">    if (match.team1_up === 0) return 'All Square';

                  <span className="text-red-600">    const absUp = Math.abs(match.team1_up);

                    {standing.points_lost.toFixed(1)}    const holesRemaining = match.total_holes - match.current_hole;

                  </span>    const leadingTeam = match.team1_up > 0 ? match.team1.name : match.team2.name;

                </td>    

                <td className="py-4 px-4 text-center">    if (absUp > holesRemaining) {

                  <div className="text-sm">      return `${leadingTeam} wins ${absUp}&${holesRemaining}`;

                    <span className="text-green-600">{standing.matches_won}W</span>    }

                    <span className="text-gray-400 mx-1">-</span>    

                    <span className="text-red-600">{standing.matches_lost}L</span>    return `${leadingTeam} ${absUp} up`;

                    <span className="text-gray-400 mx-1">-</span>  };

                    <span className="text-gray-600">{standing.matches_tied}T</span>

                  </div>  const getStatusColor = () => {

                </td>    if (match.team1_up === 0) return 'text-gray-900';

                <td className="py-4 px-4 text-center">    return match.team1_up > 0 ? `text-[${match.team1.color}]` : `text-[${match.team2.color}]`;

                  <div className="text-sm">  };

                    <span className="text-green-600">{standing.holes_won}W</span>

                    <span className="text-gray-400 mx-1">-</span>  return (

                    <span className="text-red-600">{standing.holes_lost}L</span>    <div className="bg-white rounded-lg shadow p-4">

                    <span className="text-gray-400 mx-1">-</span>      <div className="flex items-center justify-between mb-3">

                    <span className="text-gray-600">{standing.holes_tied}T</span>        <div className="text-sm font-medium text-gray-600">

                  </div>          Match {match.match_number} - {match.format}

                </td>        </div>

              </tr>        <div className="text-xs text-gray-500">{match.last_update}</div>

            ))}      </div>

          </tbody>

        </table>      <div className="space-y-2 mb-3">

      </div>        <div className="flex items-center justify-between">

    </div>          <div className="flex items-center">

  );            <div

};              className="w-3 h-3 rounded-full mr-2"

              style={{ backgroundColor: match.team1.color }}

const IndividualStandings = ({ players }: { players: PlayerStanding[] }) => {            ></div>

  const sortedPlayers = [...players].sort((a, b) => b.points_won - a.points_won);            <div className="font-medium">{match.team1.players.join(', ')}</div>

          </div>

  return (          {match.team1_up > 0 && (

    <div className="mt-6">            <TrendingUp size={20} style={{ color: match.team1.color }} />

      <div className="overflow-x-auto">          )}

        <table className="min-w-full">        </div>

          <thead>        <div className="flex items-center justify-between">

            <tr className="border-b border-gray-200">          <div className="flex items-center">

              <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>            <div

              <th className="text-left py-3 px-4 font-semibold text-gray-700">Player</th>              className="w-3 h-3 rounded-full mr-2"

              <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>              style={{ backgroundColor: match.team2.color }}

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Points</th>            ></div>

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Record</th>            <div className="font-medium">{match.team2.players.join(', ')}</div>

              <th className="text-center py-3 px-4 font-semibold text-gray-700">Holes</th>          </div>

            </tr>          {match.team1_up < 0 && (

          </thead>            <TrendingUp size={20} style={{ color: match.team2.color }} />

          <tbody>          )}

            {sortedPlayers.map((standing, index) => (        </div>

              <tr key={standing.user.id} className="border-b border-gray-100 hover:bg-gray-50">      </div>

                <td className="py-4 px-4">

                  <div className="flex items-center space-x-2">      <div className="flex items-center justify-between pt-3 border-t">

                    <span className="font-bold text-lg">{index + 1}</span>        <div className="text-sm text-gray-600">

                    {index < 3 && (          Through {match.current_hole} of {match.total_holes}

                      <Award className="w-4 h-4 text-yellow-500" />        </div>

                    )}        <div className={`font-bold ${getStatusColor()}`}>

                  </div>          {getStatusText()}

                </td>        </div>

                <td className="py-4 px-4">      </div>

                  <div>    </div>

                    <div className="font-medium">{standing.user.name}</div>  );

                    {standing.user.handicap && (};

                      <div className="text-sm text-gray-500">

                        Handicap: {standing.user.handicap}// Team Standings

                      </div>const TeamStandings = ({ teams }) => {

                    )}  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);

                  </div>

                </td>  return (

                <td className="py-4 px-4">    <div className="bg-white rounded-lg shadow-lg overflow-hidden">

                  <div className="flex items-center space-x-2">      <div className="overflow-x-auto">

                    <div        <table className="w-full">

                      className="w-3 h-3 rounded-full"          <thead className="bg-gray-50">

                      style={{ backgroundColor: standing.team.color }}            <tr>

                    ></div>              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                    <span className="text-sm">{standing.team.name}</span>                Rank

                  </div>              </th>

                </td>              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

                <td className="py-4 px-4 text-center">                Team

                  <div className="font-bold text-green-600">              </th>

                    {standing.points_won.toFixed(1)}              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                  </div>                Points

                  <div className="text-xs text-gray-500">              </th>

                    -{standing.points_lost.toFixed(1)}              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                  </div>                Matches

                </td>              </th>

                <td className="py-4 px-4 text-center">              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                  <div className="text-sm">                Holes Won

                    <span className="text-green-600">{standing.matches_won}W</span>              </th>

                    <span className="text-gray-400 mx-1">-</span>              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                    <span className="text-red-600">{standing.matches_lost}L</span>                Holes Lost

                    <span className="text-gray-400 mx-1">-</span>              </th>

                    <span className="text-gray-600">{standing.matches_tied}T</span>              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">

                  </div>                Holes Tied

                  <div className="text-xs text-gray-500">              </th>

                    {standing.matches_played} played            </tr>

                  </div>          </thead>

                </td>          <tbody className="bg-white divide-y divide-gray-200">

                <td className="py-4 px-4 text-center">            {sortedTeams.map((team, index) => (

                  <div className="text-sm">              <tr key={team.team.id} className="hover:bg-gray-50">

                    <span className="text-green-600">{standing.holes_won}</span>                <td className="px-6 py-4 whitespace-nowrap">

                    <span className="text-gray-400 mx-1">-</span>                  <div className="flex items-center">

                    <span className="text-red-600">{standing.holes_lost}</span>                    {index === 0 && <Trophy size={20} className="text-yellow-500 mr-2" />}

                    <span className="text-gray-400 mx-1">-</span>                    <span className="text-2xl font-bold text-gray-400">

                    <span className="text-gray-600">{standing.holes_tied}</span>                      {index + 1}

                  </div>                    </span>

                </td>                  </div>

              </tr>                </td>

            ))}                <td className="px-6 py-4 whitespace-nowrap">

          </tbody>                  <div className="flex items-center">

        </table>                    <div

      </div>                      className="w-4 h-4 rounded-full mr-3"

    </div>                      style={{ backgroundColor: team.team.color }}

  );                    ></div>

};                    <div className="text-lg font-semibold">{team.team.name}</div>

                  </div>

const Leaderboard = () => {                </td>

  // For demo purposes, use a hardcoded tournament ID                <td className="px-6 py-4 whitespace-nowrap text-center">

  // In a real app, you'd get this from URL params or tournament selection                  <div className="text-3xl font-bold" style={{ color: team.team.color }}>

  return <TournamentLeaderboard tournamentId="demo-tournament" />;                    {team.points_won}

};                  </div>

                </td>

export default Leaderboard;                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm">
                    <div className="font-semibold">
                      {team.matches_won}-{team.matches_lost}-{team.matches_tied}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {team.holes_won}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-lg font-semibold text-red-600">
                    {team.holes_lost}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-lg font-semibold text-gray-600">
                    {team.holes_tied}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Individual Standings
const IndividualStandings = ({ players }) => {
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points_won !== a.points_won) return b.points_won - a.points_won;
    return b.win_percentage - a.win_percentage;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matches
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Record
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win %
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Holes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedPlayers.map((player, index) => (
              <tr key={player.user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {index === 0 && <Award size={20} className="text-yellow-500 mr-2" />}
                    <span className="text-xl font-bold text-gray-400">
                      {index + 1}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-lg font-semibold">{player.user.name}</div>
                    <div className="text-sm text-gray-500">HCP: {player.user.handicap}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium" 
                       style={{ 
                         backgroundColor: `${player.team.color}20`,
                         color: player.team.color 
                       }}>
                    {player.team.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-2xl font-bold" style={{ color: player.team.color }}>
                    {player.points_won}
                  </div>
                  <div className="text-xs text-gray-500">
                    -{player.points_lost}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-lg font-semibold">{player.matches_played}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm font-medium">
                    {player.matches_won}-{player.matches_lost}-{player.matches_tied}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center">
                    {player.win_percentage > 0.6 && (
                      <TrendingUp size={16} className="text-green-600 mr-1" />
                    )}
                    {player.win_percentage < 0.4 && (
                      <TrendingDown size={16} className="text-red-600 mr-1" />
                    )}
                    {player.win_percentage >= 0.4 && player.win_percentage <= 0.6 && (
                      <Minus size={16} className="text-gray-600 mr-1" />
                    )}
                    <span className="text-lg font-semibold">
                      {(player.win_percentage * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm">
                    <span className="text-green-600 font-semibold">{player.holes_won}</span>
                    <span className="text-gray-400 mx-1">-</span>
                    <span className="text-red-600 font-semibold">{player.holes_lost}</span>
                    <span className="text-gray-400 mx-1">-</span>
                    <span className="text-gray-600 font-semibold">{player.holes_tied}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Leaderboard = () => {
  // Default to first tournament for demo purposes
  return <TournamentLeaderboard tournamentId="demo-tournament" />;
};

export default Leaderboard;
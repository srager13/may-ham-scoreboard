import React, { useState, useEffect } from 'react';
import { Trophy, Users, User, Award, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiClient, ApiError, Tournament, Team, Match } from '../services/api';

interface TeamStanding {
  team: Team;
  points_won: number;
  points_lost: number;
  matches_won: number;
  matches_lost: number;
  matches_tied: number;
  holes_won: number;
  holes_lost: number;
  holes_tied: number;
}

interface PlayerStanding {
  user: { id: string; name: string; handicap?: number };
  team: Team;
  points_won: number;
  points_lost: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_tied: number;
  holes_won: number;
  holes_lost: number;
  holes_tied: number;
  win_percentage: number;
}

interface LeaderboardData {
  tournament: Tournament;
  team_standings: TeamStanding[];
  individual_standings: PlayerStanding[];
  live_matches: Match[];
}

const TournamentLeaderboard = ({ tournamentId }: { tournamentId: string }) => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [view, setView] = useState<'team' | 'individual'>('team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboardData();
    // Refresh leaderboard every 30 seconds for live updates
    const interval = setInterval(loadLeaderboardData, 30000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get tournament details
      const tournament = await apiClient.getTournament(tournamentId);
      
      // Get teams
      const teams = await apiClient.getTournamentTeams(tournamentId);
      
      // Get rounds and matches for live match data
      const rounds = await apiClient.getTournamentRounds(tournamentId);
      const liveMatches: Match[] = [];
      
      for (const round of rounds) {
        const matches = await apiClient.getRoundMatches(round.id);
        // Filter for in-progress matches
        liveMatches.push(...matches.filter(m => m.status === 'in_progress'));
      }

      // For now, create mock standings since we don't have player stats endpoint yet
      // In a real app, you'd want to add a GET /api/v1/tournaments/:id/leaderboard endpoint
      const teamStandings: TeamStanding[] = teams.map((team, index) => ({
        team,
        points_won: Math.random() * 15 + 5,
        points_lost: Math.random() * 10,
        matches_won: Math.floor(Math.random() * 8) + 1,
        matches_lost: Math.floor(Math.random() * 6),
        matches_tied: Math.floor(Math.random() * 3),
        holes_won: Math.floor(Math.random() * 50) + 20,
        holes_lost: Math.floor(Math.random() * 40) + 10,
        holes_tied: Math.floor(Math.random() * 20) + 5,
      }));

      // Create mock individual standings
      const individualStandings: PlayerStanding[] = [
        {
          user: { id: '1', name: 'John Doe', handicap: 12.5 },
          team: teams[0] || { id: '1', name: 'Team 1', tournament_id: tournamentId, color: '#DC2626', created_at: '' },
          points_won: 8.5,
          points_lost: 3.5,
          matches_played: 6,
          matches_won: 5,
          matches_lost: 1,
          matches_tied: 0,
          holes_won: 22,
          holes_lost: 12,
          holes_tied: 8,
          win_percentage: 0.833
        },
        {
          user: { id: '2', name: 'Jane Smith', handicap: 8.0 },
          team: teams[0] || { id: '1', name: 'Team 1', tournament_id: tournamentId, color: '#DC2626', created_at: '' },
          points_won: 7.0,
          points_lost: 4.0,
          matches_played: 5,
          matches_won: 4,
          matches_lost: 1,
          matches_tied: 0,
          holes_won: 18,
          holes_lost: 14,
          holes_tied: 6,
          win_percentage: 0.8
        }
      ];

      setData({
        tournament,
        team_standings: teamStandings,
        individual_standings: individualStandings,
        live_matches: liveMatches,
      });

    } catch (err) {
      console.error('Error loading leaderboard:', err);
      
      // If API fails, show demo data but indicate it's demo mode
      setData({
        tournament: {
          id: 'demo',
          name: 'Demo Tournament - Connect Your Database',
          description: 'This is demo data. Create a tournament via the Admin Portal to see real data.',
          status: 'active',
          start_date: '2025-10-09',
          end_date: '2025-10-10',
          created_by: 'demo',
          created_at: '2025-10-09',
          updated_at: '2025-10-09'
        },
        team_standings: [
          {
            team: { id: '1', name: 'Team USA', color: '#DC2626', tournament_id: 'demo', created_at: '2025-10-09' },
            points_won: 12.5,
            points_lost: 7.5,
            matches_won: 8,
            matches_lost: 4,
            matches_tied: 3,
            holes_won: 45,
            holes_lost: 32,
            holes_tied: 18
          },
          {
            team: { id: '2', name: 'Team Europe', color: '#2563EB', tournament_id: 'demo', created_at: '2025-10-09' },
            points_won: 7.5,
            points_lost: 12.5,
            matches_won: 4,
            matches_lost: 8,
            matches_tied: 3,
            holes_won: 32,
            holes_lost: 45,
            holes_tied: 18
          }
        ],
        individual_standings: [
          {
            user: { id: '1', name: 'John Doe', handicap: 12.5 },
            team: { id: '1', name: 'Team USA', color: '#DC2626', tournament_id: 'demo', created_at: '2025-10-09' },
            points_won: 3.5,
            points_lost: 1.5,
            matches_played: 4,
            matches_won: 3,
            matches_lost: 1,
            matches_tied: 0,
            holes_won: 15,
            holes_lost: 8,
            holes_tied: 4,
            win_percentage: 0.75
          }
        ],
        live_matches: []
      });
      
      setError('Using demo data - create tournaments to see real leaderboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Unable to load leaderboard</p>
          <button
            onClick={loadLeaderboardData}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{data.tournament.name}</h1>
              <p className="text-green-100">
                {data.tournament.start_date} - {data.tournament.end_date}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-100 mb-1">Tournament Status</div>
              <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-lg">
                <Clock size={16} className="mr-2" />
                {data.tournament.status === 'active' ? 'In Progress' : 
                 data.tournament.status === 'completed' ? 'Completed' : 'Demo Mode'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* API Status Banner */}
        {error && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
            <p className="text-sm">
              <strong>API Integration:</strong> {error}
            </p>
          </div>
        )}

        {/* Team Score Banner */}
        <TeamScoreBanner teams={data.team_standings} />

        {/* Live Matches */}
        {data.live_matches && data.live_matches.length > 0 && (
          <LiveMatchesSection matches={data.live_matches} />
        )}

        {/* View Toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setView('team')}
              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${
                view === 'team'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Users size={18} className="mr-2" />
              Team Standings
            </button>
            <button
              onClick={() => setView('individual')}
              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${
                view === 'individual'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <User size={18} className="mr-2" />
              Individual Standings
            </button>
          </div>
        </div>

        {/* Leaderboard Content */}
        {view === 'team' ? (
          <TeamStandings teams={data.team_standings} />
        ) : (
          <IndividualStandings players={data.individual_standings} />
        )}
      </div>
    </div>
  );
};

// Team Score Banner Component
const TeamScoreBanner = ({ teams }: { teams: TeamStanding[] }) => {
  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);
  
  if (sortedTeams.length < 2) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-600">Waiting for teams...</h2>
      </div>
    );
  }

  const leader = sortedTeams[0];
  const trailer = sortedTeams[1];
  const pointDifference = leader.points_won - trailer.points_won;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <div
            className="text-6xl font-bold mb-2"
            style={{ color: leader.team.color }}
          >
            {leader.points_won.toFixed(1)}
          </div>
          <div className="text-xl font-semibold mb-1">{leader.team.name}</div>
          <div className="text-sm text-gray-600">
            {leader.matches_won}W - {leader.matches_lost}L - {leader.matches_tied}T
          </div>
        </div>

        <div className="px-8">
          <div className="text-center mb-4">
            <Trophy size={48} className="text-yellow-500 mx-auto" />
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {pointDifference.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">point lead</div>
          </div>
        </div>

        <div className="flex-1 text-center">
          <div
            className="text-6xl font-bold mb-2"
            style={{ color: trailer.team.color }}
          >
            {trailer.points_won.toFixed(1)}
          </div>
          <div className="text-xl font-semibold mb-1">{trailer.team.name}</div>
          <div className="text-sm text-gray-600">
            {trailer.matches_won}W - {trailer.matches_lost}L - {trailer.matches_tied}T
          </div>
        </div>
      </div>
    </div>
  );
};

// Live Matches Section
const LiveMatchesSection = ({ matches }: { matches: Match[] }) => {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
        Live Matches
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((match) => (
          <LiveMatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
};

const LiveMatchCard = ({ match }: { match: Match }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-600">
          Match {match.match_number} - {match.format?.name}
        </div>
        <div className="text-xs text-gray-500">Live</div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">{match.team1?.name}</div>
          <div className="font-bold">{match.team1_points}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="font-medium">{match.team2?.name}</div>
          <div className="font-bold">{match.team2_points}</div>
        </div>
      </div>

      <div className="pt-3 border-t text-center">
        <div className="text-sm text-gray-600">
          Status: {match.status}
        </div>
      </div>
    </div>
  );
};

// Team Standings Component
const TeamStandings = ({ teams }: { teams: TeamStanding[] }) => {
  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);

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
                Team
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matches
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Holes Won
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Holes Lost
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Holes Tied
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTeams.map((team, index) => (
              <tr key={team.team.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {index === 0 && <Trophy size={20} className="text-yellow-500 mr-2" />}
                    <span className="text-2xl font-bold text-gray-400">
                      {index + 1}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: team.team.color }}
                    ></div>
                    <div className="text-lg font-semibold">{team.team.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-3xl font-bold" style={{ color: team.team.color }}>
                    {team.points_won.toFixed(1)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
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

// Individual Standings Component
const IndividualStandings = ({ players }: { players: PlayerStanding[] }) => {
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
                    {player.points_won.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">
                    -{player.points_lost.toFixed(1)}
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('demo-tournament');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const tournamentList = await apiClient.getTournaments();
      setTournaments(tournamentList);
      
      // If we have real tournaments, select the first one
      if (tournamentList.length > 0) {
        setSelectedTournamentId(tournamentList[0].id);
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
      // Keep default demo tournament if API fails
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tournament Selector */}
      {tournaments.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Select Tournament</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name} ({tournament.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <TournamentLeaderboard tournamentId={selectedTournamentId} />
    </div>
  );
};

export default Leaderboard;
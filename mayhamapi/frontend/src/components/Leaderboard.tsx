import React, { useState, useEffect } from 'react';
import { Trophy, Users, User, Award, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiClient, ApiError, Tournament, Team, Match, TeamStanding, LeaderboardData } from '../services/api';

// Helper function to format date as MM-DD-YYYY
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};

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

      // Get leaderboard data from the API
      const leaderboardData = await apiClient.getTournamentLeaderboard(tournamentId);
      setData(leaderboardData);

    } catch (err) {
      console.error('Error loading leaderboard:', err);
      
      // Show error message instead of demo data
      setError(`Failed to load tournament data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setData(null);
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
          <div>
            <h1 className="text-3xl font-bold mb-2">{data.tournament.name}</h1>
            <p className="text-green-100">
              {formatDate(data.tournament.start_date)} - {formatDate(data.tournament.end_date)}
            </p>
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
        <TeamScoreBanner teams={data.team_standings} totalAvailablePoints={data.total_available_points} />

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
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-600 mb-4">Individual Standings</h3>
            <p className="text-gray-500">Individual player statistics are not yet implemented.</p>
            <p className="text-sm text-gray-400 mt-2">Coming soon: detailed player performance metrics and rankings.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Team Score Banner Component
const TeamScoreBanner = ({ teams, totalAvailablePoints }: { teams: TeamStanding[], totalAvailablePoints: number }) => {
  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);
  
  // Calculate points needed to win (need more than half)
  const halfPoints = totalAvailablePoints / 2;
  const pointsNeededToWin = halfPoints % 1 === 0 ? halfPoints + 0.5 : Math.ceil(halfPoints);
  
  if (sortedTeams.length < 2) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-600">Waiting for teams...</h2>
        {totalAvailablePoints > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Points needed to win: <span className="font-semibold">{pointsNeededToWin}</span>
          </p>
        )}
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
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Points needed to win</div>
            <div className="text-2xl font-bold text-gray-900">{pointsNeededToWin}</div>
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

const Leaderboard = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get tournaments where the current user is a team member
      const tournamentList = await apiClient.getUserTournaments();
      setTournaments(tournamentList);
      
      // If we have tournaments, select the first one
      if (tournamentList.length > 0) {
        setSelectedTournamentId(tournamentList[0].id);
      } else {
        setError('You are not a member of any tournaments. Ask an admin to add you to a tournament team.');
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Failed to load tournaments. Please make sure you are logged in.');
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

  if (error || tournaments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Tournaments Available</h2>
          <p className="text-gray-600 mb-6">
            {error || 'You are not currently participating in any tournaments.'}
          </p>
          <button
            onClick={loadTournaments}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tournament Selector */}
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
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {selectedTournamentId && <TournamentLeaderboard tournamentId={selectedTournamentId} />}
    </div>
  );
};

export default Leaderboard;
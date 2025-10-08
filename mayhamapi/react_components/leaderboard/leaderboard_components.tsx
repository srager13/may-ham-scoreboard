import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Users, User, Award, Clock } from 'lucide-react';

// Mock API - replace with actual API calls
const mockAPI = {
  getTournamentLeaderboard: async (tournamentId) => {
    return {
      tournament: {
        id: tournamentId,
        name: 'Summer Ryder Cup 2025',
        status: 'in_progress',
        start_date: '2025-06-15',
        end_date: '2025-06-16'
      },
      team_standings: [
        {
          team: { id: '1', name: 'Team USA', color: '#DC2626' },
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
          team: { id: '2', name: 'Team Europe', color: '#2563EB' },
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
          team: { id: '1', name: 'Team USA', color: '#DC2626' },
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
        },
        {
          user: { id: '2', name: 'Jane Smith', handicap: 8.0 },
          team: { id: '1', name: 'Team USA', color: '#DC2626' },
          points_won: 3.0,
          points_lost: 2.0,
          matches_played: 4,
          matches_won: 2,
          matches_lost: 1,
          matches_tied: 1,
          holes_won: 12,
          holes_lost: 10,
          holes_tied: 5,
          win_percentage: 0.625
        },
        {
          user: { id: '3', name: 'Bob Johnson', handicap: 15.2 },
          team: { id: '1', name: 'Team USA', color: '#DC2626' },
          points_won: 3.0,
          points_lost: 2.0,
          matches_played: 3,
          matches_won: 2,
          matches_lost: 1,
          matches_tied: 0,
          holes_won: 10,
          holes_lost: 8,
          holes_tied: 3,
          win_percentage: 0.667
        },
        {
          user: { id: '4', name: 'Alice Williams', handicap: 10.5 },
          team: { id: '2', name: 'Team Europe', color: '#2563EB' },
          points_won: 2.5,
          points_lost: 2.5,
          matches_played: 4,
          matches_won: 2,
          matches_lost: 2,
          matches_tied: 0,
          holes_won: 11,
          holes_lost: 11,
          holes_tied: 5,
          win_percentage: 0.5
        },
        {
          user: { id: '5', name: 'Charlie Brown', handicap: 18.0 },
          team: { id: '2', name: 'Team Europe', color: '#2563EB' },
          points_won: 2.0,
          points_lost: 3.0,
          matches_played: 4,
          matches_won: 1,
          matches_lost: 3,
          matches_tied: 0,
          holes_won: 9,
          holes_lost: 14,
          holes_tied: 4,
          win_percentage: 0.25
        },
        {
          user: { id: '6', name: 'Diana Prince', handicap: 6.5 },
          team: { id: '2', name: 'Team Europe', color: '#2563EB' },
          points_won: 3.0,
          points_lost: 2.0,
          matches_played: 3,
          matches_won: 2,
          matches_lost: 1,
          matches_tied: 0,
          holes_won: 12,
          holes_lost: 10,
          holes_tied: 5,
          win_percentage: 0.667
        }
      ],
      live_matches: [
        {
          id: 'm1',
          match_number: 1,
          format: '2v2 Scramble',
          current_hole: 4,
          total_holes: 6,
          team1: { name: 'Team USA', color: '#DC2626', players: ['John Doe', 'Jane Smith'] },
          team2: { name: 'Team Europe', color: '#2563EB', players: ['Alice Williams', 'Diana Prince'] },
          team1_up: 1,
          status: 'in_progress',
          last_update: '2 minutes ago'
        },
        {
          id: 'm2',
          match_number: 2,
          format: 'Singles Match Play',
          current_hole: 5,
          total_holes: 6,
          team1: { name: 'Team USA', color: '#DC2626', players: ['Bob Johnson'] },
          team2: { name: 'Team Europe', color: '#2563EB', players: ['Charlie Brown'] },
          team1_up: -2,
          status: 'in_progress',
          last_update: '5 minutes ago'
        }
      ]
    };
  }
};

const TournamentLeaderboard = ({ tournamentId }) => {
  const [data, setData] = useState(null);
  const [view, setView] = useState('team'); // 'team' or 'individual'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [tournamentId]);

  const loadLeaderboard = async () => {
    try {
      const result = await mockAPI.getTournamentLeaderboard(tournamentId);
      setData(result);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
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
        <p className="text-gray-600">Unable to load leaderboard</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                {data.tournament.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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

// Team Score Banner
const TeamScoreBanner = ({ teams }) => {
  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);
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
            {leader.points_won}
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
            {trailer.points_won}
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
const LiveMatchesSection = ({ matches }) => {
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

const LiveMatchCard = ({ match }) => {
  const getStatusText = () => {
    if (match.team1_up === 0) return 'All Square';
    const absUp = Math.abs(match.team1_up);
    const holesRemaining = match.total_holes - match.current_hole;
    const leadingTeam = match.team1_up > 0 ? match.team1.name : match.team2.name;
    
    if (absUp > holesRemaining) {
      return `${leadingTeam} wins ${absUp}&${holesRemaining}`;
    }
    
    return `${leadingTeam} ${absUp} up`;
  };

  const getStatusColor = () => {
    if (match.team1_up === 0) return 'text-gray-900';
    return match.team1_up > 0 ? `text-[${match.team1.color}]` : `text-[${match.team2.color}]`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-600">
          Match {match.match_number} - {match.format}
        </div>
        <div className="text-xs text-gray-500">{match.last_update}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: match.team1.color }}
            ></div>
            <div className="font-medium">{match.team1.players.join(', ')}</div>
          </div>
          {match.team1_up > 0 && (
            <TrendingUp size={20} style={{ color: match.team1.color }} />
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: match.team2.color }}
            ></div>
            <div className="font-medium">{match.team2.players.join(', ')}</div>
          </div>
          {match.team1_up < 0 && (
            <TrendingUp size={20} style={{ color: match.team2.color }} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t">
        <div className="text-sm text-gray-600">
          Through {match.current_hole} of {match.total_holes}
        </div>
        <div className={`font-bold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>
    </div>
  );
};

// Team Standings
const TeamStandings = ({ teams }) => {
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
                    {team.points_won}
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

export default TournamentLeaderboard;
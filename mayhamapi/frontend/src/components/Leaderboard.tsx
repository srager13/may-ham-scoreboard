import React, { useState, useEffect } from 'react';
import { Trophy, Users, User, Award, Clock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { apiClient, ApiError, Team, Match, TeamStanding, LeaderboardData, Round, Pairing, HoleResult } from '../services/api';
import { useTournament } from './TournamentContext';

// Helper function to format date as MM-DD-YYYY
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};

interface MatchWithResults extends Match {
  hole_results?: HoleResult[];
}

interface PairingWithResults extends Pairing {
  matchResults?: MatchWithResults[];
}

interface RoundWithPairings extends Round {
  pairings?: PairingWithResults[];
}

const TournamentLeaderboard = ({ tournamentId }: { tournamentId: string }) => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [view, setView] = useState<'team' | 'individual'>('team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundWithPairings[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [showRoundHistory, setShowRoundHistory] = useState(false);

  useEffect(() => {
    loadLeaderboardData();
    // Refresh leaderboard every 30 seconds for live updates
    const interval = setInterval(loadLeaderboardData, 30000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  useEffect(() => {
    if (showRoundHistory && rounds.length === 0) {
      loadRoundsData();
    }
  }, [showRoundHistory]);

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roundId)) {
        newSet.delete(roundId);
      } else {
        newSet.add(roundId);
      }
      return newSet;
    });
  };

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

  const loadRoundsData = async () => {
    try {
      setLoadingRounds(true);
      
      // Get all rounds for this tournament
      const roundsData = await apiClient.getTournamentRounds(tournamentId);
      
      // Load pairings and match results for each round
      const roundsWithData: RoundWithPairings[] = await Promise.all(
        roundsData.map(async (round) => {
          try {
            const pairings = await apiClient.getRoundPairings(round.id);
            
            // Only include completed pairings with their match results
            const completedPairings = await Promise.all(
              pairings
                .filter(p => p.status === 'completed')
                .map(async (pairing) => {
                  try {
                    const matches = await apiClient.getPairingMatches(pairing.id);
                    const matchResults = await Promise.all(
                      matches.map(async (match) => {
                        try {
                          const matchScores = await apiClient.getMatchScores(match.id);
                          return {
                            ...match,
                            hole_results: matchScores.hole_results || []
                          };
                        } catch (err) {
                          console.warn('Error loading match results:', match.id, err);
                          return match;
                        }
                      })
                    );
                    return {
                      ...pairing,
                      matchResults
                    };
                  } catch (err) {
                    console.warn('Error loading pairing matches:', pairing.id, err);
                    return pairing;
                  }
                })
            );
            
            return {
              ...round,
              pairings: completedPairings
            };
          } catch (err) {
            console.warn('Error loading round pairings:', round.id, err);
            return { ...round, pairings: [] };
          }
        })
      );
      
      // Filter to only rounds with completed pairings and sort by round number (descending)
      const completedRounds = roundsWithData
        .filter(r => r.pairings && r.pairings.length > 0)
        .sort((a, b) => b.round_number - a.round_number);
      
      setRounds(completedRounds);
    } catch (err) {
      console.error('Error loading rounds data:', err);
    } finally {
      setLoadingRounds(false);
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
          <TeamStandings teams={data.team_standings} totalAvailablePoints={data.total_available_points} />
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-600 mb-4">Individual Standings</h3>
            <p className="text-gray-500">Individual player statistics are not yet implemented.</p>
            <p className="text-sm text-gray-400 mt-2">Coming soon: detailed player performance metrics and rankings.</p>
          </div>
        )}

        {/* Round History Section */}
        <RoundHistorySection 
          showHistory={showRoundHistory}
          onToggle={() => setShowRoundHistory(!showRoundHistory)}
          rounds={rounds}
          loadingRounds={loadingRounds}
          expandedRounds={expandedRounds}
          onToggleRound={toggleRound}
        />
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
  const leaderHasWon = leader.points_won >= pointsNeededToWin;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          {leaderHasWon && (
            <div className="mb-3">
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-lg">
                <Trophy className="h-5 w-5 text-white mr-2" />
                <span className="text-lg font-bold text-white">TOURNAMENT CHAMPION</span>
                <Trophy className="h-5 w-5 text-white ml-2" />
              </div>
            </div>
          )}
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
          {leaderHasWon && (
            <div className="mt-2 text-sm font-semibold text-green-600">
              ✓ Won with {leader.points_won.toFixed(1)} points (needed {pointsNeededToWin})
            </div>
          )}
        </div>

        <div className="px-8">
          <div className="text-center mb-4">
            <Trophy size={48} className={leaderHasWon ? "text-yellow-500 mx-auto animate-pulse" : "text-yellow-500 mx-auto"} />
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {pointDifference.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">point lead</div>
          </div>
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Points needed to win</div>
            <div className={`text-2xl font-bold ${leaderHasWon ? 'text-green-600' : 'text-gray-900'}`}>
              {pointsNeededToWin}
            </div>
            {leaderHasWon && (
              <div className="text-xs text-green-600 mt-1 font-semibold">✓ Achieved!</div>
            )}
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
          <div>
            <div className="font-medium">{match.team1?.name}</div>
            {match.players && match.players.length > 0 && (
              <div className="text-xs text-gray-500">
                {match.players
                  .filter(p => p.team_id === match.team1_id)
                  .sort((a, b) => a.player_order - b.player_order)
                  .map(p => p.user?.name)
                  .join(' & ')}
              </div>
            )}
          </div>
          <div className="font-bold">{match.team1_points}</div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{match.team2?.name}</div>
            {match.players && match.players.length > 0 && (
              <div className="text-xs text-gray-500">
                {match.players
                  .filter(p => p.team_id === match.team2_id)
                  .sort((a, b) => a.player_order - b.player_order)
                  .map(p => p.user?.name)
                  .join(' & ')}
              </div>
            )}
          </div>
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

// Round History Section Component
const RoundHistorySection = ({
  showHistory,
  onToggle,
  rounds,
  loadingRounds,
  expandedRounds,
  onToggleRound
}: {
  showHistory: boolean;
  onToggle: () => void;
  rounds: RoundWithPairings[];
  loadingRounds: boolean;
  expandedRounds: Set<string>;
  onToggleRound: (roundId: string) => void;
}) => {
  return (
    <div className="mb-8">
      <button
        onClick={onToggle}
        className="w-full bg-white rounded-lg shadow-sm p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
      >
        <h2 className="text-2xl font-bold flex items-center">
          <Clock className="mr-3 text-blue-600" size={24} />
          Round History
        </h2>
        {showHistory ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
      </button>

      {showHistory && (
        <div className="mt-4">
          {loadingRounds ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading round history...</p>
            </div>
          ) : rounds.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">No completed rounds yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rounds.map((round) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  isExpanded={expandedRounds.has(round.id)}
                  onToggle={() => onToggleRound(round.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Round Card Component
const RoundCard = ({
  round,
  isExpanded,
  onToggle
}: {
  round: RoundWithPairings;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const completedPairingsCount = round.pairings?.length || 0;
  const totalMatches = round.pairings?.reduce((sum, p) => sum + (p.matchResults?.length || 0), 0) || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center">
          <div className="bg-blue-100 rounded-full p-2 mr-4">
            <Trophy className="text-blue-600" size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">
              Round {round.round_number}: {round.name}
            </h3>
            <p className="text-sm text-gray-600">
              {formatDate(round.round_date)} • {completedPairingsCount} completed pairing{completedPairingsCount !== 1 ? 's' : ''} • {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && round.pairings && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-6">
            {round.pairings.map((pairing) => (
              <PairingResultCard key={pairing.id} pairing={pairing} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Pairing Result Card Component
const PairingResultCard = ({ pairing }: { pairing: PairingWithResults }) => {
  if (!pairing.matchResults || pairing.matchResults.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-md font-semibold text-gray-900 mb-4">
        Pairing {pairing.pairing_number}
        {pairing.tee_time && (
          <span className="text-sm font-normal text-gray-600 ml-2">
            • {new Date(pairing.tee_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </h4>

      <div className="space-y-4">
        {pairing.matchResults.map((match) => (
          <CompactMatchResult key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
};

// Compact Match Result Component
const CompactMatchResult = ({ match }: { match: MatchWithResults }) => {
  const team1Won = match.team1_points > match.team2_points;
  const team2Won = match.team2_points > match.team1_points;
  const tied = match.team1_points === match.team2_points;

  let team1HolesWon = 0;
  let team2HolesWon = 0;
  let holesHalved = 0;

  if (match.hole_results) {
    match.hole_results.forEach(hr => {
      if (hr.winner_team_id === match.team1_id) {
        team1HolesWon++;
      } else if (hr.winner_team_id === match.team2_id) {
        team2HolesWon++;
      } else {
        holesHalved++;
      }
    });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600">
          {match.format?.name || 'Match'}
          {match.start_hole && match.end_hole && (
            <span className="ml-2 text-xs text-gray-500">
              (Holes {match.start_hole}-{match.end_hole})
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {match.points_available.toFixed(1)} pts available
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Team 1 */}
        <div className={`text-center p-2 rounded ${team1Won ? 'bg-green-50 border border-green-300' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-center mb-1">
            {team1Won && <Trophy className="h-3 w-3 text-green-600 mr-1" />}
            <div
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: match.team1?.color }}
            ></div>
            <div className="text-xs font-semibold text-gray-900">{match.team1?.name}</div>
          </div>
          {/* Team 1 Players */}
          {match.players && match.players.length > 0 && (
            <div className="text-xs text-gray-500 mb-1">
              {match.players
                .filter(p => p.team_id === match.team1_id)
                .sort((a, b) => a.player_order - b.player_order)
                .map(p => p.user?.name)
                .join(' & ')}
            </div>
          )}
          <div className="text-xl font-bold" style={{ color: match.team1?.color }}>
            {match.team1_points.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600">
            {team1HolesWon} hole{team1HolesWon !== 1 ? 's' : ''}
          </div>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-sm font-bold text-gray-400">VS</div>
          {tied && (
            <div className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium mt-1">
              Tied
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className={`text-center p-2 rounded ${team2Won ? 'bg-green-50 border border-green-300' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-center mb-1">
            {team2Won && <Trophy className="h-3 w-3 text-green-600 mr-1" />}
            <div
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: match.team2?.color }}
            ></div>
            <div className="text-xs font-semibold text-gray-900">{match.team2?.name}</div>
          </div>
          {/* Team 2 Players */}
          {match.players && match.players.length > 0 && (
            <div className="text-xs text-gray-500 mb-1">
              {match.players
                .filter(p => p.team_id === match.team2_id)
                .sort((a, b) => a.player_order - b.player_order)
                .map(p => p.user?.name)
                .join(' & ')}
            </div>
          )}
          <div className="text-xl font-bold" style={{ color: match.team2?.color }}>
            {match.team2_points.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600">
            {team2HolesWon} hole{team2HolesWon !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

// Team Standings Component
const TeamStandings = ({ teams, totalAvailablePoints }: { teams: TeamStanding[], totalAvailablePoints: number }) => {
  const sortedTeams = [...teams].sort((a, b) => b.points_won - a.points_won);
  
  // Calculate points needed to win (need more than half)
  const halfPoints = totalAvailablePoints / 2;
  const pointsNeededToWin = halfPoints % 1 === 0 ? halfPoints + 0.5 : Math.ceil(halfPoints);

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
            {sortedTeams.map((team, index) => {
              const teamHasWon = team.points_won >= pointsNeededToWin;
              return (
                <tr 
                  key={team.team.id} 
                  className={`hover:bg-gray-50 ${teamHasWon ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {index === 0 && <Trophy size={20} className="text-yellow-500 mr-2" />}
                      {teamHasWon && index !== 0 && (
                        <CheckCircle size={20} className="text-green-600 mr-2" />
                      )}
                      <span className={`text-2xl font-bold ${teamHasWon ? 'text-yellow-700' : 'text-gray-400'}`}>
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
                      <div className="flex items-center gap-2">
                        <div className={`text-lg font-semibold ${teamHasWon ? 'text-yellow-800' : ''}`}>
                          {team.team.name}
                        </div>
                        {teamHasWon && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                            <Trophy className="h-3 w-3 mr-1" />
                            WINNER
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className={`text-3xl font-bold ${teamHasWon ? 'text-yellow-700' : ''}`} style={{ color: teamHasWon ? undefined : team.team.color }}>
                      {team.points_won.toFixed(1)}
                    </div>
                    {teamHasWon && (
                      <div className="text-xs text-green-600 font-semibold mt-1">
                        ✓ Won (needed {pointsNeededToWin})
                      </div>
                    )}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Leaderboard = () => {
  const { selectedTournamentId, loading: tournamentsLoading, error: tournamentError } = useTournament();

  if (tournamentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (tournamentError || !selectedTournamentId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Tournament Selected</h2>
          <p className="text-gray-600 mb-4">
            {tournamentError || 'Please select a tournament from the user menu to view the leaderboard.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedTournamentId && <TournamentLeaderboard tournamentId={selectedTournamentId} />}
    </div>
  );
};

export default Leaderboard;
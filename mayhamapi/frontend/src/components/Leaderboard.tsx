import React, { useState, useEffect } from 'react';
import { Trophy, Users, User, CheckCircle } from 'lucide-react';
import { apiClient, Match, TeamStanding, LeaderboardData, Round, Pairing, HoleResult } from '../services/api';
import { useTournament } from './TournamentContext';
import { MatchesStatusDisplay } from './MatchResultsDisplay';
import { PairingHeaderDetails } from './PairingHeaderDetails';

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
  matches?: Match[];
  round?: Round;
}

interface IndividualStanding {
  user_id: string;
  name: string;
  team_id?: string;
  team_name?: string;
  team_color?: string;
  points_won: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_tied: number;
  holes_won: number;
  holes_lost: number;
  holes_tied: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  double_bogey_or_worse: number;
}

const TournamentLeaderboard = ({ tournamentId }: { tournamentId: string }) => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [view, setView] = useState<'team' | 'individual' | 'completed' | 'live'>('team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedPairings, setCompletedPairings] = useState<PairingWithResults[]>([]);
  const [loadingCompletedPairings, setLoadingCompletedPairings] = useState(false);
  const [completedPairingsError, setCompletedPairingsError] = useState<string | null>(null);
  const [livePairings, setLivePairings] = useState<PairingWithResults[]>([]);
  const [loadingLivePairings, setLoadingLivePairings] = useState(false);
  const [livePairingsError, setLivePairingsError] = useState<string | null>(null);
  const [individualStandings, setIndividualStandings] = useState<IndividualStanding[]>([]);
  const [loadingIndividuals, setLoadingIndividuals] = useState(false);
  const [individualError, setIndividualError] = useState<string | null>(null);

  useEffect(() => {
    setCompletedPairings([]);
    setCompletedPairingsError(null);
    setLivePairings([]);
    setLivePairingsError(null);
    setIndividualStandings([]);
    setIndividualError(null);
    loadLeaderboardData();
    // Refresh leaderboard every 30 seconds for live updates
    const interval = setInterval(loadLeaderboardData, 30000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  useEffect(() => {
    if (view === 'individual' && individualStandings.length === 0 && !loadingIndividuals) {
      loadIndividualStandings();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'completed' && completedPairings.length === 0 && !loadingCompletedPairings) {
      loadCompletedPairings();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'live' && livePairings.length === 0 && !loadingLivePairings) {
      loadLivePairings();
    }
  }, [view]);

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

  const loadCompletedPairings = async () => {
    try {
      setLoadingCompletedPairings(true);
      setCompletedPairingsError(null);

      const roundsData = await apiClient.getTournamentRounds(tournamentId);
      const pairingsByRound = await Promise.all(
        roundsData.map(async (round) => {
          try {
            const pairings = await apiClient.getRoundPairings(round.id);
            const completed = pairings.filter((pairing) => pairing.status === 'completed');

            return Promise.all(
              completed.map(async (pairing) => {
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
                    round,
                    matches,
                    matchResults
                  };
                } catch (err) {
                  console.warn('Error loading pairing matches:', pairing.id, err);
                  return { ...pairing, round };
                }
              })
            );
          } catch (err) {
            console.warn('Error loading round pairings:', round.id, err);
            return [] as PairingWithResults[];
          }
        })
      );

      const completed = pairingsByRound.flat().sort((a, b) => {
        const roundDiff = (b.round?.round_number || 0) - (a.round?.round_number || 0);
        if (roundDiff !== 0) {
          return roundDiff;
        }
        return (b.pairing_number || 0) - (a.pairing_number || 0);
      });

      setCompletedPairings(completed);
    } catch (err) {
      console.error('Error loading completed pairings:', err);
      setCompletedPairingsError(
        `Failed to load completed matches: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoadingCompletedPairings(false);
    }
  };

  const loadLivePairings = async () => {
    try {
      setLoadingLivePairings(true);
      setLivePairingsError(null);

      const roundsData = await apiClient.getTournamentRounds(tournamentId);
      const pairingsByRound = await Promise.all(
        roundsData.map(async (round) => {
          try {
            const pairings = await apiClient.getRoundPairings(round.id);
            const live = pairings.filter((pairing) => pairing.status === 'in_progress');

            return Promise.all(
              live.map(async (pairing) => {
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
                    round,
                    matches,
                    matchResults
                  };
                } catch (err) {
                  console.warn('Error loading pairing matches:', pairing.id, err);
                  return { ...pairing, round };
                }
              })
            );
          } catch (err) {
            console.warn('Error loading round pairings:', round.id, err);
            return [] as PairingWithResults[];
          }
        })
      );

      const live = pairingsByRound.flat().sort((a, b) => {
        const roundDiff = (b.round?.round_number || 0) - (a.round?.round_number || 0);
        if (roundDiff !== 0) {
          return roundDiff;
        }
        return (b.pairing_number || 0) - (a.pairing_number || 0);
      });

      setLivePairings(live);
    } catch (err) {
      console.error('Error loading live pairings:', err);
      setLivePairingsError(
        `Failed to load live matches: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoadingLivePairings(false);
    }
  };

  const loadIndividualStandings = async () => {
    try {
      setLoadingIndividuals(true);
      setIndividualError(null);

      const roundsData = await apiClient.getTournamentRounds(tournamentId);
      const matchesByRound = await Promise.all(
        roundsData.map(async (round) => {
          try {
            return await apiClient.getRoundMatches(round.id);
          } catch (err) {
            console.warn('Error loading round matches:', round.id, err);
            return [] as Match[];
          }
        })
      );

      const matches = matchesByRound.flat();
      const standingsMap = new Map<string, IndividualStanding>();

      await Promise.all(
        matches.map(async (match) => {
          if (!match.players || match.players.length === 0) {
            return;
          }

          let scores: Array<{ user_id: string; strokes: number; par?: number }> = [];
          let holeResults: HoleResult[] = [];
          try {
            const scoreResponse = await apiClient.getMatchScores(match.id);
            scores = scoreResponse.scores || [];
            holeResults = scoreResponse.hole_results || [];
          } catch (err) {
            console.warn('Error loading match scores:', match.id, err);
          }

          const matchWithResults: MatchWithResults = {
            ...match,
            hole_results: holeResults
          };

          const scoresByUser = new Map<string, Array<{ strokes: number; par?: number }>>();
          scores.forEach((score) => {
            const existing = scoresByUser.get(score.user_id) || [];
            existing.push({ strokes: score.strokes, par: score.par });
            scoresByUser.set(score.user_id, existing);
          });

          console.log('Match scores loaded:', { matchId: match.id, scoresCount: scores.length, scoresByUserSize: scoresByUser.size });

          if (scores.length > 0) {
            const firstEntry = scoresByUser.entries().next().value;
            console.log('First map entry:', { firstEntry, isUndefined: firstEntry === undefined });
            const [sampleUserId, sampleScores] = firstEntry || [];
            console.log('After destructure:', { sampleUserId, sampleScores, sampleScoresIsArray: Array.isArray(sampleScores) });
            if (sampleUserId && sampleScores) {
              const sample = sampleScores.slice(0, 3).map((score) => ({
                strokes: score.strokes,
                par: score.par
              }));
              const parCount = sampleScores.filter((score) => typeof score.par === 'number').length;
              console.debug('Individual stats sample:', {
                matchId: match.id,
                sampleUserId,
                sampleScores: sample,
                sampleParCount: parCount,
                sampleScoreCount: sampleScores.length
              });
            } else {
              console.log('Nested condition failed:', { sampleUserIdTruthy: !!sampleUserId, sampleScoresTruthy: !!sampleScores });
            }
          }

          const team1Players = matchWithResults.players.filter((player) => player.team_id === matchWithResults.team1_id);
          const team2Players = matchWithResults.players.filter((player) => player.team_id === matchWithResults.team2_id);
          const team1Share = team1Players.length > 0 ? matchWithResults.team1_points / team1Players.length : 0;
          const team2Share = team2Players.length > 0 ? matchWithResults.team2_points / team2Players.length : 0;

          const holeResultsForMatch = matchWithResults.hole_results || [];
          let team1HolesWon = 0;
          let team2HolesWon = 0;
          let holesTied = 0;
          holeResultsForMatch.forEach((result) => {
            if (result.winner_team_id === match.team1_id) {
              team1HolesWon += 1;
            } else if (result.winner_team_id === match.team2_id) {
              team2HolesWon += 1;
            } else {
              holesTied += 1;
            }
          });

          const team1Won = matchWithResults.team1_points > matchWithResults.team2_points;
          const team2Won = matchWithResults.team2_points > matchWithResults.team1_points;
          const tied = matchWithResults.team1_points === matchWithResults.team2_points;
          const countMatch = match.status !== 'scheduled' || scores.length > 0;

          matchWithResults.players.forEach((player) => {
            const userId = player.user_id;
            const playerScores = scoresByUser.get(userId) || [];
            const scoreBreakdown = playerScores.reduce(
              (totals, score) => {
                if (typeof score.par !== 'number') {
                  return totals;
                }

                const scoreToPar = score.strokes - score.par;
                if (scoreToPar <= -2) {
                  totals.eagles += 1;
                } else if (scoreToPar === -1) {
                  totals.birdies += 1;
                } else if (scoreToPar === 0) {
                  totals.pars += 1;
                } else if (scoreToPar === 1) {
                  totals.bogeys += 1;
                } else {
                  totals.double_bogey_or_worse += 1;
                }

                return totals;
              },
              {
                eagles: 0,
                birdies: 0,
                pars: 0,
                bogeys: 0,
                double_bogey_or_worse: 0
              }
            );
            const existing = standingsMap.get(userId) || {
              user_id: userId,
              name: player.user?.name || 'Player',
              team_id: player.team_id,
              team_name:
                player.team_id === matchWithResults.team1_id ? matchWithResults.team1?.name : matchWithResults.team2?.name,
              team_color:
                player.team_id === matchWithResults.team1_id ? matchWithResults.team1?.color : matchWithResults.team2?.color,
              points_won: 0,
              matches_played: 0,
              matches_won: 0,
              matches_lost: 0,
              matches_tied: 0,
              holes_won: 0,
              holes_lost: 0,
              holes_tied: 0,
              eagles: 0,
              birdies: 0,
              pars: 0,
              bogeys: 0,
              double_bogey_or_worse: 0
            };

            if (countMatch) {
              existing.matches_played += 1;
              if (tied) {
                existing.matches_tied += 1;
              } else if (
                (team1Won && player.team_id === matchWithResults.team1_id) ||
                (team2Won && player.team_id === matchWithResults.team2_id)
              ) {
                existing.matches_won += 1;
              } else {
                existing.matches_lost += 1;
              }
            }

            if (player.team_id === matchWithResults.team1_id) {
              existing.points_won += team1Share;
              existing.holes_won += team1HolesWon;
              existing.holes_lost += team2HolesWon;
              existing.holes_tied += holesTied;
            } else if (player.team_id === matchWithResults.team2_id) {
              existing.points_won += team2Share;
              existing.holes_won += team2HolesWon;
              existing.holes_lost += team1HolesWon;
              existing.holes_tied += holesTied;
            }

            existing.eagles += scoreBreakdown.eagles;
            existing.birdies += scoreBreakdown.birdies;
            existing.pars += scoreBreakdown.pars;
            existing.bogeys += scoreBreakdown.bogeys;
            existing.double_bogey_or_worse += scoreBreakdown.double_bogey_or_worse;

            standingsMap.set(userId, existing);
          });
        })
      );

      const standings = Array.from(standingsMap.values());
      setIndividualStandings(standings);
    } catch (err) {
      console.error('Error loading individual standings:', err);
      setIndividualError(
        `Failed to load individual standings: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoadingIndividuals(false);
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
            <button
              onClick={() => setView('completed')}
              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${
                view === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Trophy size={18} className="mr-2" />
              Completed Matches
            </button>
            <button
              onClick={() => setView('live')}
              className={`flex items-center px-6 py-2 rounded-md font-medium transition-colors ${
                view === 'live'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Users size={18} className="mr-2" />
              Live Matches
            </button>
          </div>
        </div>

        {/* Leaderboard Content */}
        {view === 'team' ? (
          <TeamStandings teams={data.team_standings} totalAvailablePoints={data.total_available_points} />
        ) : view === 'individual' ? (
          <IndividualStandings
            standings={individualStandings}
            loading={loadingIndividuals}
            error={individualError}
            onRefresh={loadIndividualStandings}
          />
        ) : view === 'completed' ? (
          <CompletedMatchesView
            pairings={completedPairings}
            loading={loadingCompletedPairings}
            error={completedPairingsError}
            onRefresh={loadCompletedPairings}
          />
        ) : (
          <LiveMatchesView
            pairings={livePairings}
            loading={loadingLivePairings}
            error={livePairingsError}
            onRefresh={loadLivePairings}
          />
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

const IndividualStandings = ({
  standings,
  loading,
  error,
  onRefresh
}: {
  standings: IndividualStanding[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) => {
  const sortedStandings = [...standings].sort((a, b) => {
    const pointDiff = b.points_won - a.points_won;
    if (pointDiff !== 0) {
      return pointDiff;
    }
    const holeDiff = b.holes_won - a.holes_won;
    if (holeDiff !== 0) {
      return holeDiff;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Individual Standings</h3>
          <p className="text-sm text-gray-500">
            Ranked by points won across matches
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading individual standings...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Retry
          </button>
        </div>
      ) : sortedStandings.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-600">No individual scores available yet.</p>
        </div>
      ) : (
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
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Matches
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points Won
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Holes Record (W-L-T)
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eagles
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birdies
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pars
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bogeys
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Double+
                </th>
                
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStandings.map((player, index) => (
                <tr key={player.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {index === 0 && <Trophy size={18} className="text-yellow-500 mr-2" />}
                      <span className="text-lg font-semibold text-gray-500">{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{player.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: player.team_color || '#9CA3AF' }}
                      ></div>
                      <div className="text-sm text-gray-700">{player.team_name || 'TBD'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold">
                      {player.matches_won}-{player.matches_lost}-{player.matches_tied}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-900">
                      {player.points_won.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">
                      {player.holes_won}-{player.holes_lost}-{player.holes_tied}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">{player.eagles}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">{player.birdies}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">{player.pars}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">{player.bogeys}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-gray-700">{player.double_bogey_or_worse}</div>
                  </td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const CompletedMatchesView = ({
  pairings,
  loading,
  error,
  onRefresh
}: {
  pairings: PairingWithResults[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Completed Matches</h3>
          <p className="text-sm text-gray-500">Pairings with finalized match results</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading completed matches...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Retry
          </button>
        </div>
      ) : pairings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <p className="text-gray-600">No completed pairings yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {pairings.map((pairing) => (
            <div key={pairing.id} className="space-y-4">
              <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-lg shadow-lg p-6">
                <PairingHeaderDetails pairing={pairing} />
              </div>
              <MatchesStatusDisplay pairing={pairing} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LiveMatchesView = ({
  pairings,
  loading,
  error,
  onRefresh
}: {
  pairings: PairingWithResults[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Live Matches</h3>
          <p className="text-sm text-gray-500">Pairings currently in progress</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading live matches...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Retry
          </button>
        </div>
      ) : pairings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow">
          <p className="text-gray-600">No live pairings yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {pairings.map((pairing) => (
            <div key={pairing.id} className="space-y-4">
              <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-lg shadow-lg p-6">
                <PairingHeaderDetails pairing={pairing} />
              </div>
              <MatchesStatusDisplay pairing={pairing} />
            </div>
          ))}
        </div>
      )}
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
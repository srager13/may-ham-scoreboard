import React, { useState, useEffect } from 'react';
import { Users, Target, Award, RefreshCw, Save, AlertCircle, Clock, CheckCircle, Trophy, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient, ApiError, Tournament, Round, Pairing, PairingPlayer, GolfCourseTee, GolfCourseHole, Match, MatchFormat, HoleResult } from '../services/api';

interface MatchWithResults extends Match {
  hole_results?: HoleResult[];
}

interface PairingWithScores extends Pairing {
  round?: Round;
  scores: Record<number, Record<string, number>>; // { holeNumber: { userId: strokes } }
  stablefordPoints?: Record<number, Record<string, number>>; // { holeNumber: { userId: points } } for Stableford scoring
  tee?: GolfCourseTee;
  holes?: GolfCourseHole[]; // Hole-by-hole data (par, yardage, handicap)
  matches?: Match[]; // Matches associated with this pairing
  matchResults?: MatchWithResults[]; // Match results with hole-by-hole breakdown
}

const ScoreInterface: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [pairings, setPairings] = useState<PairingWithScores[]>([]);
  const [selectedPairing, setSelectedPairing] = useState<PairingWithScores | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMyPairingsOnly, setShowMyPairingsOnly] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    loadTournaments();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      loadPairings();
      loadSelectedTournament();
    }
  }, [selectedTournamentId]);

  const loadSelectedTournament = async () => {
    if (!selectedTournamentId) return;
    try {
      const tournament = await apiClient.getTournament(selectedTournamentId);
      setSelectedTournament(tournament);
    } catch (err) {
      console.error('Error loading tournament:', err);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      console.log('[ScoreInterface] Current user loaded:', { userId: user.id, userName: user.name });
      setCurrentUserId(user.id);
    } catch (err) {
      console.error('Error loading current user:', err);
    }
  };

  const loadTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tournamentList = await apiClient.getUserTournaments();
      setTournaments(tournamentList);
      
      if (tournamentList.length > 0) {
        setSelectedTournamentId(tournamentList[0].id);
      } else {
        setError('You are not a member of any tournaments. Ask an admin to add you to a tournament team.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Failed to load tournaments. Please make sure you are logged in.');
      setLoading(false);
    }
  };

  const loadPairings = async () => {
    if (!selectedTournamentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const roundsResponse = await apiClient.getTournamentRounds(selectedTournamentId);
      const rounds = Array.isArray(roundsResponse) ? roundsResponse : [];
      
      const allPairings: PairingWithScores[] = [];
      
      for (const round of rounds) {
        try {
          const pairingsResponse = await apiClient.getRoundPairings(round.id);
          const pairings = Array.isArray(pairingsResponse) ? pairingsResponse : [];
          
          for (const pairing of pairings) {
            // Load players for this pairing
            const players = await apiClient.getPairingPlayers(pairing.id);
            
            // Load matches for this pairing
            const matches = await apiClient.getPairingMatches(pairing.id);
            
            // Load tee information if available
            let tee: GolfCourseTee | undefined;
            let holes: GolfCourseHole[] | undefined;
            if (pairing.golf_course_tee_id && round.golf_course_id) {
              try {
                const tees = await apiClient.getGolfCourseTees(round.golf_course_id);
                tee = tees.find(t => t.id === pairing.golf_course_tee_id);
                
                console.log('[loadPairings] Golf course:', round.golf_course_id);
                console.log('[loadPairings] Tee found:', tee);
                
                // Fetch hole-by-hole data for this tee
                if (tee) {
                  holes = await apiClient.getGolfCourseHoles(tee.id);
                  console.log('[loadPairings] Holes loaded for tee', tee.id, ':', holes);
                  console.log('[loadPairings] Number of holes:', holes.length);
                  if (holes.length > 0) {
                    console.log('[loadPairings] Sample hole:', holes[0]);
                  }
                }
              } catch (err) {
                console.warn('Failed to load tee/hole info:', err);
              }
            }
            
            const pairingWithScores: PairingWithScores = {
              ...pairing,
              players,
              matches,
              scores: {},
              stablefordPoints: {},
              round,
              tee,
              holes
            };
            
            allPairings.push(pairingWithScores);
          }
        } catch (pairingErr) {
          console.warn('Error loading pairings for round:', round.id, pairingErr);
        }
      }
      
      setPairings(allPairings);
      if (allPairings.length > 0) {
        const firstPairing = allPairings[0];
        await loadExistingScores(firstPairing);
      } else {
        setSelectedPairing(null);
      }
    } catch (err) {
      console.error('Error loading pairings:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load pairings');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingScores = async (pairing: PairingWithScores) => {
    try {
      console.log('=== LOADING EXISTING SCORES ===');
      console.log('Pairing being loaded:', pairing.id);
      console.log('Pairing players:', pairing.players?.map(p => ({ user_id: p.user_id, name: p.user?.name })));
      
      const response = await apiClient.getPairingScores(pairing.id);
      const scores = response.scores || [];
      
      // Load match results if pairing is completed
      let matchResults: MatchWithResults[] | undefined;
      if (pairing.status === 'completed' && pairing.matches) {
        setLoadingResults(true);
        try {
          matchResults = await Promise.all(
            pairing.matches.map(async (match) => {
              try {
                const matchScores = await apiClient.getMatchScores(match.id);
                return {
                  ...match,
                  hole_results: matchScores.hole_results || []
                };
              } catch (err) {
                console.warn('Error loading results for match:', match.id, err);
                return match;
              }
            })
          );
        } catch (err) {
          console.warn('Error loading match results:', err);
        } finally {
          setLoadingResults(false);
        }
      }
      
      console.log('Existing scores from API:', scores);
      console.log('User IDs in existing scores:', [...new Set(scores.map(s => s.user_id))]);
      
      // Convert scores array to the format expected by the UI
      const scoresMap: Record<number, Record<string, number>> = {};
      const stablefordMap: Record<number, Record<string, number>> = {};
      
      scores.forEach(score => {
        if (!scoresMap[score.hole_number]) {
          scoresMap[score.hole_number] = {};
          stablefordMap[score.hole_number] = {};
        }
        scoresMap[score.hole_number][score.user_id] = score.strokes;
        if (score.stableford_points !== undefined && score.stableford_points !== null) {
          stablefordMap[score.hole_number][score.user_id] = score.stableford_points;
        }
      });
      
      console.log('Scores map:', scoresMap);
      console.log('==============================');
      
      // Update the pairing with existing scores and match results
      const updatedPairing = {
        ...pairing,
        scores: scoresMap,
        stablefordPoints: stablefordMap,
        matchResults
      };
      
      setSelectedPairing(updatedPairing);
      
      // Pairings represent the physical group playing together for the full round (18 holes)
      // Individual matches within the pairing may cover different hole ranges
      const matches = pairing.matches || await apiClient.getPairingMatches(pairing.id);
      const holes = 18; // Always 18 holes for a pairing
      
      // If there are existing scores, set the current hole to the first incomplete hole
      const completedHoles = Object.keys(scoresMap).map(h => parseInt(h));
      const nextHole = completedHoles.length > 0 
        ? Math.max(...completedHoles) + 1 
        : 1;
      
      if (nextHole <= holes) {
        setCurrentHole(nextHole);
        // Load existing scores for this hole if they exist, otherwise start with empty object
        const nextHoleScores: Record<string, number> = {};
        pairing.players?.forEach(player => {
          if (scoresMap[nextHole]?.[player.user_id]) {
            nextHoleScores[player.user_id] = scoresMap[nextHole][player.user_id];
          }
          // Don't pre-populate with zeros - let users enter scores
        });
        setHoleScores(nextHoleScores);
      } else {
        // All holes completed, show the last hole
        setCurrentHole(holes);
        setHoleScores(scoresMap[holes] || {});
      }
      
    } catch (err) {
      console.warn('Error loading existing scores:', err);
      // Don't show error to user, just proceed without existing scores
      setSelectedPairing(pairing);
      setCurrentHole(1);
      // Pre-populate with empty values (not zeros) for all players
      const initialScores: Record<string, number> = {};
      pairing.players?.forEach(player => {
        if (player.user_id && player.user_id !== '') {
          // Don't pre-populate - let user enter scores
          // initialScores[player.user_id] = 0;
        } else {
          console.warn('Invalid player in pairing:', player);
        }
      });
      setHoleScores(initialScores);
    }
  };

  const handleScoreChange = (playerId: string, score: number) => {
    setHoleScores(prev => ({
      ...prev,
      [playerId]: score
    }));
  };

  // Helper function to get the list of holes to display based on match configuration
  const getHolesForMatch = (match?: Match): number[] => {
    if (!match) return Array.from({ length: 18 }, (_, i) => i + 1);
    
    if (match.start_hole !== undefined && match.end_hole !== undefined) {
      // Match has specific hole range (e.g., holes 1-6, 7-12, 13-18)
      const holes: number[] = [];
      for (let i = match.start_hole; i <= match.end_hole; i++) {
        holes.push(i);
      }
      return holes;
    }
    
    // Default to number of holes specified in match
    return Array.from({ length: match.holes }, (_, i) => i + 1);
  };

  // Helper function to find which match applies to a specific hole
  const getMatchForHole = (pairing: PairingWithScores | null, holeNumber: number): Match | undefined => {
    if (!pairing?.matches) return undefined;
    
    // Find the first match that includes this hole
    return pairing.matches.find(match => {
      if (match.start_hole !== undefined && match.end_hole !== undefined) {
        // Match has specific hole range (e.g., holes 1-6, 7-12, 13-18)
        return holeNumber >= match.start_hole && holeNumber <= match.end_hole;
      }
      // For matches without specific hole ranges, assume they cover all holes
      return true;
    });
  };

  // Helper function to determine if we need team or individual score inputs
  const needsTeamScores = (match?: Match): boolean => {
    if (!match?.format) return false;
    // Team score formats: scramble, alternate_shot
    return match.format.score_input_type === 'team';
  };

  // Get unique teams from pairing players
  const getTeamsFromPairing = (pairing: PairingWithScores | null) => {
    if (!pairing?.players) return [];
    const teamMap = new Map<string, { id: string; name: string; color?: string }>();
    pairing.players.forEach(player => {
      if (player.team) {
        teamMap.set(player.team.id, player.team);
      }
    });
    return Array.from(teamMap.values());
  };

  const startPairing = async (pairingId: string) => {
    try {
      setError(null);
      // Update pairing status to in_progress
      await apiClient.updatePairingStatus(pairingId, 'in_progress');
      
      // Update local state
      setPairings(prev => prev.map(pairing => 
        pairing.id === pairingId 
          ? { ...pairing, status: 'in_progress' }
          : pairing
      ));
      
      // If this is the selected pairing, update it too
      if (selectedPairing?.id === pairingId) {
        setSelectedPairing(prev => prev ? { ...prev, status: 'in_progress' } : null);
      }
    } catch (err) {
      console.error('Error starting pairing:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to start pairing');
    }
  };

  const completePairing = async (pairingId: string) => {
    try {
      setError(null);
      // Update pairing status to completed
      await apiClient.updatePairingStatus(pairingId, 'completed');
      
      // Update local state
      setPairings(prev => prev.map(pairing => 
        pairing.id === pairingId 
          ? { ...pairing, status: 'completed' }
          : pairing
      ));
      
      // If this is the selected pairing, update it too
      if (selectedPairing?.id === pairingId) {
        setSelectedPairing(prev => prev ? { ...prev, status: 'completed' } : null);
      }
      
      alert('Pairing completed! Match results have been calculated.');
    } catch (err) {
      console.error('Error completing pairing:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to complete pairing');
    }
  };

  const submitHoleScores = async () => {
    if (!selectedPairing) return;

    setIsSubmitting(true);
    try {
      console.log('=== SCORE SUBMISSION DEBUG ===');
      console.log('holeScores object:', holeScores);
      console.log('selectedPairing.players:', selectedPairing.players);
      
      // Validate that all user_ids in holeScores correspond to valid players
      const validPlayerIds = new Set(selectedPairing.players?.map(p => p.user_id) || []);
      console.log('Valid player user_ids in pairing:', Array.from(validPlayerIds));
      
      // Convert holeScores to API format
      const scoresArray = Object.entries(holeScores)
        .filter(([userId, strokes]) => {
          // Filter out invalid entries
          if (!userId || userId === '' || strokes === 0 || strokes === null || strokes === undefined) {
            console.warn('Skipping invalid score entry:', { userId, strokes });
            return false;
          }
          // Check if this user_id is actually in the pairing
          if (!validPlayerIds.has(userId)) {
            console.error('ERROR: user_id not in pairing players:', userId);
            return false;
          }
          return true;
        })
        .map(([userId, strokes]) => ({
          user_id: userId,
          strokes: strokes
        }));

      if (scoresArray.length === 0) {
        setError('No valid scores to submit. Please enter scores for all players.');
        setIsSubmitting(false);
        return;
      }

      console.log('Final scores to submit:', scoresArray);
      console.log('Submitting to pairing:', selectedPairing.id, 'hole:', currentHole);

      await apiClient.submitPairingScores(selectedPairing.id, {
        hole_number: currentHole,
        scores: scoresArray
      });
      
      // Update local state
      setSelectedPairing(prev => ({
        ...prev!,
        scores: {
          ...prev!.scores,
          [currentHole]: holeScores
        }
      }));

      // Determine the number of holes
      const matches = await apiClient.getPairingMatches(selectedPairing.id);
      const holes = 18; // Always 18 holes for a pairing

      // Move to next hole or stay on current
      if (currentHole < holes) {
        const nextHole = currentHole + 1;
        setCurrentHole(nextHole);
        
        // Populate existing scores for the next hole, or set to 0 for all players
        const nextHoleScores: Record<string, number> = {};
        const existingNextHoleScores = selectedPairing.scores[nextHole] || {};
        
        selectedPairing.players?.forEach(player => {
          nextHoleScores[player.user_id] = existingNextHoleScores[player.user_id] || 0;
        });
        
        setHoleScores(nextHoleScores);
      }
    } catch (err) {
      console.error('Error submitting scores:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to submit scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to check if current user is in a pairing
  const isUserInPairing = (pairing: PairingWithScores) => {
    if (!currentUserId || !pairing.players) {
      return false;
    }
    
    return pairing.players.some(player => player.user_id === currentUserId);
  };

  // Filter pairings based on the checkbox
  const filteredPairings = showMyPairingsOnly
    ? pairings.filter(pairing => isUserInPairing(pairing))
    : pairings;

  // Group pairings by round
  const pairingsByRound = filteredPairings.reduce((acc, pairing) => {
    const roundId = pairing.round?.id || 'unknown';
    if (!acc[roundId]) {
      acc[roundId] = {
        round: pairing.round,
        pairings: []
      };
    }
    acc[roundId].pairings.push(pairing);
    return acc;
  }, {} as Record<string, { round?: Round; pairings: PairingWithScores[] }>);

  // Sort rounds by round number
  const sortedRounds = Object.values(pairingsByRound).sort((a, b) => {
    const roundA = a.round?.round_number || 0;
    const roundB = b.round?.round_number || 0;
    return roundA - roundB;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">
          {tournaments.length === 0 ? 'Loading tournaments...' : 'Loading pairings...'}
        </span>
      </div>
    );
  }

  if (error || tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Tournaments Available</h3>
        <p className="text-gray-500 mb-6">
          {error || 'You are not currently participating in any tournaments.'}
        </p>
        <button
          onClick={loadTournaments}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pairings.length === 0 && selectedTournamentId) {
    return (
      <div className="space-y-6">
        {/* Tournament Selector */}
        <div className="bg-white border-b border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Select Tournament</h2>
            <div className="flex items-center space-x-4">
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
              <button
                onClick={loadPairings}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
        
        <div className="text-center py-12">
          <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Pairings</h3>
          <p className="text-gray-500">There are no pairings currently available for scoring in this tournament.</p>
        </div>
      </div>
    );
  }

  // Component to display match results for completed pairings
  const MatchResultsDisplay = ({ pairing }: { pairing: PairingWithScores }) => {
    if (!pairing.matchResults || pairing.matchResults.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          <p>Match results are being calculated...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center mb-6">
          <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">Match Results</h2>
        </div>

        {pairing.matchResults.map((match, idx) => {
          const team1Won = match.team1_points > match.team2_points;
          const team2Won = match.team2_points > match.team1_points;
          const tied = match.team1_points === match.team2_points;

          // Calculate holes won/lost/tied from hole results
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
            <div key={match.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-lg">
              {/* Match Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Match {match.match_number}: {match.format?.name || 'Unknown Format'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {match.format?.description || ''} • {match.holes} holes
                      {match.start_hole && match.end_hole && (
                        <span> (Holes {match.start_hole}-{match.end_hole})</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">Match Points</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {match.points_available.toFixed(1)} available
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Score */}
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {/* Team 1 */}
                  <div className={`text-center p-4 rounded-lg ${team1Won ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-center mb-2">
                      {team1Won && <Trophy className="h-5 w-5 text-green-600 mr-2" />}
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: match.team1?.color }}
                      ></div>
                      <div className="font-semibold text-gray-900">{match.team1?.name}</div>
                    </div>
                    <div className="text-4xl font-bold mb-2" style={{ color: match.team1?.color }}>
                      {match.team1_points.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {team1HolesWon} holes won
                    </div>
                  </div>

                  {/* VS / Result */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-gray-400 mb-2">VS</div>
                    {tied && (
                      <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                        Tied
                      </div>
                    )}
                    {holesHalved > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        {holesHalved} hole{holesHalved !== 1 ? 's' : ''} halved
                      </div>
                    )}
                  </div>

                  {/* Team 2 */}
                  <div className={`text-center p-4 rounded-lg ${team2Won ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-center mb-2">
                      {team2Won && <Trophy className="h-5 w-5 text-green-600 mr-2" />}
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: match.team2?.color }}
                      ></div>
                      <div className="font-semibold text-gray-900">{match.team2?.name}</div>
                    </div>
                    <div className="text-4xl font-bold mb-2" style={{ color: match.team2?.color }}>
                      {match.team2_points.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {team2HolesWon} holes won
                    </div>
                  </div>
                </div>

                {/* Hole-by-Hole Results (Optional - can be collapsed/expanded) */}
                {match.hole_results && match.hole_results.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      View Hole-by-Hole Results ({match.hole_results.length} holes)
                    </summary>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hole</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{ color: match.team1?.color }}>
                              {match.team1?.name}
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{ color: match.team2?.color }}>
                              {match.team2?.name}
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Result</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {match.hole_results.map((hr) => {
                            const isHighLow = match.format?.scoring_type === 'high_low';
                            
                            return (
                              <tr key={hr.hole_number} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                  {hr.hole_number}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isHighLow ? (
                                    <span className="text-xs text-gray-500 italic">High-Low</span>
                                  ) : (
                                    <span className={hr.winner_team_id === match.team1_id ? 'font-bold text-green-600' : ''}>
                                      {hr.team1_score !== undefined && hr.team1_score !== null ? hr.team1_score : '-'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isHighLow ? (
                                    <span className="text-xs text-gray-500 italic">Format</span>
                                  ) : (
                                    <span className={hr.winner_team_id === match.team2_id ? 'font-bold text-green-600' : ''}>
                                      {hr.team2_score !== undefined && hr.team2_score !== null ? hr.team2_score : '-'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isHighLow ? (
                                    // High-low shows points breakdown since there are two comparisons (low vs low, high vs high)
                                    <div className="flex items-center justify-center gap-2 text-xs">
                                      <span style={{ color: match.team1?.color }} className="font-semibold">
                                        {hr.team1_points}
                                      </span>
                                      <span className="text-gray-400">-</span>
                                      <span style={{ color: match.team2?.color }} className="font-semibold">
                                        {hr.team2_points}
                                      </span>
                                      <span className="text-gray-500 ml-1">pts</span>
                                    </div>
                                  ) : (
                                    // Standard formats show winner icon
                                    <div>
                                      {hr.winner_team_id === match.team1_id && (
                                        <CheckCircle 
                                          className="h-5 w-5 mx-auto" 
                                          style={{ color: match.team1?.color }}
                                        />
                                      )}
                                      {hr.winner_team_id === match.team2_id && (
                                        <CheckCircle 
                                          className="h-5 w-5 mx-auto" 
                                          style={{ color: match.team2?.color }}
                                        />
                                      )}
                                      {!hr.winner_team_id && (
                                        <span className="text-gray-400">Halved</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}

        {/* Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pairing Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            {(() => {
              // Calculate total points for each team from this pairing
              const teamPoints = new Map<string, number>();
              pairing.matchResults.forEach(match => {
                const team1Id = match.team1_id;
                const team2Id = match.team2_id;
                teamPoints.set(team1Id, (teamPoints.get(team1Id) || 0) + match.team1_points);
                teamPoints.set(team2Id, (teamPoints.get(team2Id) || 0) + match.team2_points);
              });

              return Array.from(teamPoints.entries()).map(([teamId, points]) => {
                const team = pairing.matchResults?.[0]?.team1_id === teamId 
                  ? pairing.matchResults[0].team1 
                  : pairing.matchResults?.[0]?.team2;
                
                if (!team) return null;

                return (
                  <div key={teamId} className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center mb-2">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: team.color }}
                      ></div>
                      <div className="font-semibold text-gray-900">{team.name}</div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: team.color }}>
                      {points.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">
                      total points earned
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Tournament Selector */}
      <div className="bg-white border-b border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Select Tournament</h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadPairings}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scorecard Entry</h1>
            <p className="text-gray-500">Enter scores for your pairing like a traditional golf scorecard</p>
          </div>
        </div>
      </div>

      {/* Pairing Selection */}
      {pairings.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Select Pairing</h3>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showMyPairingsOnly}
                onChange={(e) => setShowMyPairingsOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Show only my pairings</span>
            </label>
          </div>
          {filteredPairings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pairings found. {showMyPairingsOnly && 'Try unchecking "Show only my pairings".'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedRounds.map(({ round, pairings: roundPairings }) => (
                <div key={round?.id || 'unknown'}>
                  <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    Round {round?.round_number || '?'} {round?.name ? `- ${round.name}` : ''}
                    {round?.golf_course && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        @ {round.golf_course.course_name}
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roundPairings.map((pairing) => (
                      <button
                        key={pairing.id}
                        onClick={async () => {
                          console.log('Selected pairing:', pairing);
                          console.log('Pairing players:', pairing.players);
                          pairing.players?.forEach(player => {
                            console.log('Player details:', {
                              id: player.id,
                              user_id: player.user_id,
                              team_id: player.team_id,
                              player_order: player.player_order,
                              user: player.user
                            });
                          });
                          await loadExistingScores(pairing);
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          selectedPairing?.id === pairing.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">
                            Pairing {pairing.pairing_number}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            pairing.status === 'not_started' ? 'bg-gray-200 text-gray-700' :
                            pairing.status === 'in_progress' ? 'bg-green-200 text-green-700' :
                            'bg-blue-200 text-blue-700'
                          }`}>
                            {pairing.status.replace('_', ' ')}
                          </div>
                        </div>
                        
                        {/* Tee Time and Tee Info */}
                        <div className="text-xs text-gray-600 mb-2 space-y-1">
                          {pairing.tee_time && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(pairing.tee_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {pairing.tee && (
                            <div className="italic">
                              {pairing.tee.tee_name} {pairing.tee.total_yards && `(${pairing.tee.total_yards} yds)`}
                            </div>
                          )}
                        </div>
                        
                        {/* Players */}
                        <div className="space-y-1 mt-2">
                          {(pairing.players || []).map(player => (
                            <div key={player.user_id} className="text-xs flex items-center">
                              <div 
                                className="w-2 h-2 rounded-full mr-2" 
                                style={{ backgroundColor: player.team?.color || '#999' }}
                              />
                              <span className={player.user_id === currentUserId ? 'font-semibold' : ''}>
                                {player.user?.name || `Player ${player.user_id}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Score Entry */}
      {selectedPairing && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          {/* Start Pairing Section for not_started pairings */}
          {selectedPairing.status === 'not_started' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-blue-900 mb-2">
                    Pairing {selectedPairing.pairing_number} - Ready to Start
                  </h3>
                  <p className="text-blue-700">
                    Players: {(selectedPairing.players || []).map(p => p.user?.name).join(', ')}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Click "Start Round" to begin entering scores for this pairing.
                  </p>
                </div>
                <button
                  onClick={() => startPairing(selectedPairing.id)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Start Round
                </button>
              </div>
            </div>
          )}

          {selectedPairing.status === 'in_progress' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Pairing {selectedPairing.pairing_number} - Hole {currentHole}
                  </h3>
                  {selectedPairing.tee && (
                    <p className="text-sm text-gray-500">
                      {selectedPairing.tee.tee_name} {selectedPairing.tee.total_yards && `(${selectedPairing.tee.total_yards} yards)`}
                    </p>
                  )}
                  {selectedPairing.matches && selectedPairing.matches.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedPairing.matches.map((m, idx) => {
                        const holeRange = m.start_hole && m.end_hole 
                          ? `Holes ${m.start_hole}-${m.end_hole}`
                          : `${m.holes} holes`;
                        return (
                          <span key={idx} className="mr-3">
                            {m.format?.name || 'Match'}: {holeRange}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2 flex-wrap justify-end">
                  {(() => {
                    // Always show all 18 holes for a pairing (players play the full round)
                    const holesToShow = Array.from({ length: 18 }, (_, i) => i + 1);
                    
                    return holesToShow.map((hole) => (
                      <button
                        key={hole}
                        onClick={() => {
                          setCurrentHole(hole);
                          const existingScores = selectedPairing.scores[hole] || {};
                          const holeScoresMap: Record<string, number> = {};
                          
                          // Determine which match this hole belongs to
                          const holeMatch = getMatchForHole(selectedPairing, hole);
                          
                          if (needsTeamScores(holeMatch)) {
                            // For team scores, use first player from each team
                            getTeamsFromPairing(selectedPairing).forEach(team => {
                              const teamPlayer = selectedPairing.players?.find(p => p.team_id === team.id);
                              if (teamPlayer) {
                                holeScoresMap[teamPlayer.user_id] = existingScores[teamPlayer.user_id] || 0;
                              }
                            });
                          } else {
                            // For individual scores, initialize with player IDs
                            selectedPairing.players?.forEach(player => {
                              holeScoresMap[player.user_id] = existingScores[player.user_id] || 0;
                            });
                          }
                          
                          setHoleScores(holeScoresMap);
                        }}
                        className={`w-8 h-8 rounded-full text-xs font-medium ${
                          hole === currentHole
                            ? 'bg-blue-500 text-white'
                            : selectedPairing.scores[hole]
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {hole}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Score Entry - Team or Individual based on match format */}
              <div className="mb-6">
                {(() => {
                  // Find which match applies to the current hole
                  const currentMatch = getMatchForHole(selectedPairing, currentHole);
                  const isTeamScoring = needsTeamScores(currentMatch);
                  const isStableford = selectedTournament?.scoring_method === 'stableford';
                  
                  // Get course information for the current hole
                  const currentHoleData = selectedPairing.holes?.find(h => h.hole_number === currentHole);
                  
                  return (
                    <div className="space-y-4">
                      {/* Course Information Header */}
                      {selectedPairing.round?.golf_course && (
                        <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4 mb-4">
                          <div className="text-center">
                            <h3 className="text-xl font-bold text-green-900">
                              {selectedPairing.round.golf_course.course_name}
                            </h3>
                            {selectedPairing.round.golf_course.city && selectedPairing.round.golf_course.state && (
                              <p className="text-sm text-green-700">
                                {selectedPairing.round.golf_course.city}, {selectedPairing.round.golf_course.state}
                              </p>
                            )}
                            {selectedPairing.tee && (
                              <p className="text-sm text-green-700 mt-1">
                                <strong>{selectedPairing.tee.tee_name} Tees</strong>
                                {selectedPairing.tee.total_yards && ` - ${selectedPairing.tee.total_yards} yards`}
                                {selectedPairing.tee.course_rating && selectedPairing.tee.slope_rating && 
                                  ` - Rating: ${selectedPairing.tee.course_rating}/${selectedPairing.tee.slope_rating}`}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Match Format Info */}
                      {isTeamScoring && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <p className="text-sm text-blue-800">
                            <strong>Team Scoring:</strong> Enter one combined score per team for {currentMatch?.format?.name || 'this match'}.
                            {currentMatch?.format?.description && (
                              <span className="block mt-1 text-xs">{currentMatch.format.description}</span>
                            )}
                          </p>
                        </div>
                      )}
                      
                      {/* Scorecard Table */}
                      <div className="overflow-x-auto border-2 border-gray-800 rounded-lg">
                        <table className="min-w-full divide-y-2 divide-gray-800 bg-white">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase border-r-2 border-gray-800">
                                Hole
                              </th>
                              <th className="px-4 py-3 text-center text-2xl font-bold text-gray-900 border-r border-gray-300">
                                {currentHole}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-gray-800">
                            {/* Yardage Row */}
                            {currentHoleData?.yards && (
                              <tr className="bg-gray-50">
                                <td className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800">
                                  Yards
                                </td>
                                <td className="px-4 py-2 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                                  {currentHoleData.yards}
                                </td>
                              </tr>
                            )}
                            
                            {/* Par Row */}
                            {currentHoleData?.par && (
                              <tr className="bg-yellow-50">
                                <td className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800">
                                  Par
                                </td>
                                <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-300">
                                  {currentHoleData.par}
                                </td>
                              </tr>
                            )}
                            
                            {/* Handicap Row */}
                            {currentHoleData?.handicap && (
                              <tr className="bg-gray-50">
                                <td className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800">
                                  HCP
                                </td>
                                <td className="px-4 py-2 text-center text-sm text-gray-700 border-r border-gray-300">
                                  {currentHoleData.handicap}
                                </td>
                              </tr>
                            )}
                            
                            {/* Player Score Rows */}
                            {isTeamScoring ? (
                              // Team scoring - one row per team with combined cells
                              getTeamsFromPairing(selectedPairing).map(team => {
                                const teamPlayer = selectedPairing.players?.find(p => p.team_id === team.id);
                                if (!teamPlayer) return null;
                                
                                return (
                                  <tr key={team.id} className="border-t-2 border-gray-400">
                                    <td className="px-4 py-3 border-r-2 border-gray-800">
                                      <div className="flex items-center">
                                        <div 
                                          className="w-4 h-4 rounded-full mr-2" 
                                          style={{ backgroundColor: team.color || '#999' }}
                                        />
                                        <div>
                                          <div className="font-bold text-gray-900">{team.name}</div>
                                          <div className="text-xs text-gray-500">
                                            {selectedPairing.players
                                              ?.filter(p => p.team_id === team.id)
                                              .map(p => p.user?.name)
                                              .join(' & ')}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-gray-300">
                                      <div className="flex flex-col items-center gap-2">
                                        <input
                                          type="number"
                                          min="1"
                                          max="12"
                                          value={holeScores[teamPlayer.user_id] || ''}
                                          onChange={(e) => handleScoreChange(teamPlayer.user_id, parseInt(e.target.value) || 0)}
                                          className="w-16 px-3 py-2 border-2 border-gray-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-bold"
                                          placeholder="-"
                                        />
                                        {isStableford && selectedPairing.stablefordPoints?.[currentHole]?.[teamPlayer.user_id] !== undefined && (
                                          <div className="text-xs font-semibold text-green-700">
                                            {selectedPairing.stablefordPoints[currentHole][teamPlayer.user_id]} pts
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              // Individual scoring - one row per player
                              (selectedPairing.players || []).map((player, idx) => {
                                // Group players by team for visual separation
                                const isFirstInTeam = idx === 0 || 
                                  selectedPairing.players![idx - 1].team_id !== player.team_id;
                                
                                return (
                                  <tr 
                                    key={player.user_id} 
                                    className={isFirstInTeam ? 'border-t-2 border-gray-400' : ''}
                                  >
                                    <td className="px-4 py-3 border-r-2 border-gray-800">
                                      <div className="flex items-center">
                                        <div 
                                          className="w-4 h-4 rounded-full mr-2" 
                                          style={{ backgroundColor: player.team?.color || '#999' }}
                                        />
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {player.user?.name || `Player ${player.user_id}`}
                                          </div>
                                          <div className="text-xs text-gray-500">{player.team?.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-gray-300">
                                      <div className="flex flex-col items-center gap-2">
                                        <input
                                          type="number"
                                          min="1"
                                          max="12"
                                          value={holeScores[player.user_id] || ''}
                                          onChange={(e) => handleScoreChange(player.user_id, parseInt(e.target.value) || 0)}
                                          className="w-16 px-3 py-2 border-2 border-gray-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-bold"
                                          placeholder="-"
                                        />
                                        {isStableford && selectedPairing.stablefordPoints?.[currentHole]?.[player.user_id] !== undefined && (
                                          <div className="text-xs font-semibold text-green-700">
                                            {selectedPairing.stablefordPoints[currentHole][player.user_id]} pts
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Submit Button */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  {Object.keys(holeScores).length > 0 && (
                    <span className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {Object.keys(holeScores).filter(k => holeScores[k] > 0).length} of {selectedPairing.players?.length || getTeamsFromPairing(selectedPairing).length} scores entered
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => completePairing(selectedPairing.id)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700"
                  >
                    Complete Round
                  </button>
                  <button
                    onClick={submitHoleScores}
                    disabled={isSubmitting || Object.keys(holeScores).filter(k => holeScores[k] > 0).length === 0}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSubmitting ? 'Submitting...' : 'Submit Hole'}
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* Show info for completed pairings */}
          {selectedPairing.status === 'completed' && (
            <div>
              {/* Match Results Display */}
              {loadingResults ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500">Loading match results...</p>
                </div>
              ) : (
                <MatchResultsDisplay pairing={selectedPairing} />
              )}

              {/* Reopen Button */}
              <div className="text-center py-6 mt-6 border-t border-gray-200">
                <p className="text-gray-500 mb-4">
                  Need to make changes? You can reopen this pairing for editing.
                </p>
                <button
                  onClick={() => startPairing(selectedPairing.id)}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
                >
                  Reopen for Editing
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreInterface;

import React, { useState, useEffect, useRef } from 'react';
import { Target, RefreshCw, Save, AlertCircle, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient, ApiError, Round, Pairing, PairingPlayer, GolfCourseTee, GolfCourseHole, Match, MatchFormat, HoleResult, MatchPlayer } from '../services/api';
import { useTournament } from './TournamentContext';
import { MatchesStatusDisplay, MatchStatusBox } from './MatchResultsDisplay';
import { PairingHeaderDetails } from './PairingHeaderDetails';

interface MatchWithResults extends Match {
  hole_results?: HoleResult[];
  match_players?: MatchPlayer[];
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
  const { selectedTournamentId, selectedTournament, loading: tournamentsLoading, error: tournamentError } = useTournament();
  const [pairings, setPairings] = useState<PairingWithScores[]>([]);
  const [selectedPairing, setSelectedPairing] = useState<PairingWithScores | null>(null);
  const [holeScores, setHoleScores] = useState<Record<number, Record<string, number>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMyPairingsOnly, setShowMyPairingsOnly] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [showPairingDrawer, setShowPairingDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'hole-by-hole' | 'scorecard' | 'matches'>('hole-by-hole');

  // Ref to preserve horizontal scroll position in scorecard
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  // Save selected pairing to localStorage whenever it changes
  useEffect(() => {
    if (selectedPairing?.id) {
      localStorage.setItem('lastSelectedPairingId', selectedPairing.id);
    }
  }, [selectedPairing?.id]);

  // Restore scroll position after scorecard re-renders
  useEffect(() => {
    if (scrollContainerRef.current && scrollPosition > 0) {
      scrollContainerRef.current.scrollLeft = scrollPosition;
    }
  }, [holeScores, scrollPosition]);

  useEffect(() => {
    if (selectedTournamentId) {
      loadPairings();
    }
  }, [selectedTournamentId]);

  const loadCurrentUser = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      console.log('[ScoreInterface] Current user loaded:', { userId: user.id, userName: user.name });
      setCurrentUserId(user.id);
    } catch (err) {
      console.error('Error loading current user:', err);
    }
  };

  const loadPairings = async () => {
    if (!selectedTournamentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const roundsResponse = await apiClient.getTournamentRounds(selectedTournamentId);
      const rounds = Array.isArray(roundsResponse) ? roundsResponse : (roundsResponse || []);
      
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
        // Try to restore the last selected pairing from localStorage
        const lastSelectedId = localStorage.getItem('lastSelectedPairingId');
        const lastSelectedPairing = lastSelectedId ? allPairings.find(p => p.id === lastSelectedId) : null;
        
        // Use the last selected pairing if it exists, otherwise use the first one
        const pairingToLoad = lastSelectedPairing || allPairings[0];
        await loadExistingScores(pairingToLoad);
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
      
      // Load match results for both in_progress and completed pairings
      let matchResults: MatchWithResults[] = [];
      if (pairing.matches && pairing.matches.length > 0) {
        setLoadingResults(true);
        try {
          matchResults = await Promise.all(
            pairing.matches.map(async (match) => {
              try {
                const matchScores = await apiClient.getMatchScores(match.id);
                const matchPlayers = await apiClient.getMatchPlayers(match.id);
                return {
                  ...match,
                  hole_results: matchScores.hole_results || [],
                  match_players: matchPlayers
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
      
      // Initialize holeScores with existing scores for all holes
      setHoleScores(scoresMap);
      
      // Determine current hole (first hole without scores)
      const completedHoles = new Set(Object.keys(scoresMap).map(h => parseInt(h)));
      let nextHole = 1;
      for (let h = 1; h <= 18; h++) {
        if (!completedHoles.has(h)) {
          nextHole = h;
          break;
        }
      }
      setCurrentHole(nextHole);
      
    } catch (err) {
      console.warn('Error loading existing scores:', err);
      // Don't show error to user, just proceed without existing scores
      setSelectedPairing(pairing);
      // Initialize empty scorecard for all holes
      setHoleScores({});
    }
  };

  const handleScoreChange = (holeNumber: number, playerId: string, score: number) => {
    // Save current scroll position before state update
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollLeft);
    }

    setHoleScores(prev => ({
      ...prev,
      [holeNumber]: {
        ...prev[holeNumber],
        [playerId]: score
      }
    }));
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

  // Helper function to find ALL matches that apply to a specific hole
  const getAllMatchesForHole = (pairing: PairingWithScores | null, holeNumber: number): Match[] => {
    if (!pairing?.matches) return [];
    
    // Find all matches that include this hole
    return pairing.matches.filter(match => {
      if (match.start_hole !== undefined && match.end_hole !== undefined) {
        // Match has specific hole range (e.g., holes 1-6, 7-12, 13-18)
        return holeNumber >= match.start_hole && holeNumber <= match.end_hole;
      }
      // For matches without specific hole ranges, assume they cover all holes
      return true;
    });
  };

  // Helper function to find which match a specific player is in for a specific hole
  const getMatchForPlayerAndHole = (pairing: PairingWithScores | null, playerId: string, holeNumber: number): Match | undefined => {
    if (!pairing?.matches) return undefined;
    
    return pairing.matches.find(match => {
      // Check if this hole is in this match's range
      const inRange = (match.start_hole !== undefined && match.end_hole !== undefined)
        ? holeNumber >= match.start_hole && holeNumber <= match.end_hole
        : true;
      
      if (!inRange) return false;
      
      // Check if this player is in this match
      const playerInMatch = match.players?.some(mp => mp.user_id === playerId);
      
      return playerInMatch;
    });
  };

  // Helper function to get background color class for a match
  const getMatchColorClass = (matchIndex: number): string => {
    const matchColors = ['bg-white-100', 'bg-slate-100', 'bg-blue-50', 'bg-white-100', 'bg-gray-100'];
    return matchColors[matchIndex % matchColors.length];
  };

  // Helper function to get match color hex for display
  const getMatchColorHex = (matchIndex: number): string => {
    const matchColorHexes = ['#f1f5f9', '#dbeafe', '#f1f5f9', '#dbeafe', '#f3f4f6'];
    return matchColorHexes[matchIndex % matchColorHexes.length];
  };

  // Sort players by team_id, then by player_order for consistent display
  const getSortedPlayers = (players: PairingPlayer[] | undefined) => {
    if (!players) return [];
    return [...players].sort((a, b) => {
      if (a.team_id !== b.team_id) {
        return a.team_id.localeCompare(b.team_id);
      }
      return (a.player_order || 0) - (b.player_order || 0);
    });
  };

  // Check if all players have scores for a specific hole
  const holeHasAllScores = (hole: number, pairing: PairingWithScores): boolean => {
    if (!pairing.players || pairing.players.length === 0) return false;
    
    const holeData = holeScores[hole];
    if (!holeData) return false;

    // Check if each player has a score for this hole
    for (const player of pairing.players) {
      const score = holeData[player.user_id];
      if (!score || score === 0) {
        return false; // Missing or zero score
      }
    }
    
    return true; // All players have scores
  };

  // Handle Next button click with auto-submit if all scores are present
  const handleNextHole = async () => {
    if (!selectedPairing) return;

    // Check if current hole has all player scores
    if (holeHasAllScores(currentHole, selectedPairing)) {
      try {
        // Auto-submit the current hole's scores
        const holeData = holeScores[currentHole];
        const validPlayerIds = new Set(selectedPairing.players?.map(p => p.user_id) || []);
        
        const scoresArray = Object.entries(holeData)
          .filter(([userId, strokes]) => {
            if (!userId || userId === '' || strokes === 0 || strokes === null || strokes === undefined) {
              return false;
            }
            if (!validPlayerIds.has(userId)) {
              return false;
            }
            return true;
          })
          .map(([userId, strokes]) => ({
            user_id: userId,
            strokes: strokes
          }));

        if (scoresArray.length > 0) {
          console.log(`Auto-submitting hole ${currentHole}:`, scoresArray);
          await apiClient.submitPairingScores(selectedPairing.id, {
            hole_number: currentHole,
            scores: scoresArray
          });

          // Reload match results to reflect calculated scoring
          if (selectedPairing.matches && selectedPairing.matches.length > 0) {
            try {
              const updatedMatchResults = await Promise.all(
                selectedPairing.matches.map(async (match) => {
                  try {
                    const matchScores = await apiClient.getMatchScores(match.id);
                    const matchPlayers = await apiClient.getMatchPlayers(match.id);
                    return {
                      ...match,
                      hole_results: matchScores.hole_results || [],
                      match_players: matchPlayers
                    };
                  } catch (err) {
                    console.warn('Error loading results for match:', match.id, err);
                    return match;
                  }
                })
              );

              setSelectedPairing(prev => ({
                ...prev!,
                matchResults: updatedMatchResults
              }));
            } catch (err) {
              console.warn('Error reloading match results:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error auto-submitting hole scores:', err);
        // Don't show error to user, just proceed to next hole
      }
    }

    // Advance to next hole
    setCurrentHole(Math.min(18, currentHole + 1));
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
      
      // First, check if there are unsaved scores and submit them
      const hasUnsavedScores = Object.values(holeScores).some(hole => 
        Object.values(hole).filter(score => score > 0).length > 0
      );
      
      if (hasUnsavedScores) {
        console.log('Auto-submitting unsaved scores before completing pairing...');
        setIsSubmitting(true);
        
        // Submit the scores (reusing submitHoleScores logic)
        if (!selectedPairing) {
          throw new Error('No pairing selected');
        }

        const validPlayerIds = new Set(selectedPairing.players?.map(p => p.user_id) || []);
        
        // Submit scores for each hole that has data
        const holesToSubmit = Object.keys(holeScores)
          .map(h => parseInt(h))
          .filter(holeNum => {
            const holeData = holeScores[holeNum];
            return Object.values(holeData || {}).some(score => score > 0);
          });

        if (holesToSubmit.length > 0) {
          for (const holeNum of holesToSubmit) {
            const holeData = holeScores[holeNum];
            
            const scoresArray = Object.entries(holeData)
              .filter(([userId, strokes]) => {
                if (!userId || userId === '' || strokes === 0 || strokes === null || strokes === undefined) {
                  return false;
                }
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

            if (scoresArray.length > 0) {
              console.log(`Auto-submitting hole ${holeNum}:`, scoresArray);
              await apiClient.submitPairingScores(selectedPairing.id, {
                hole_number: holeNum,
                scores: scoresArray
              });
            }
          }
          
          // Update local state with submitted scores
          setSelectedPairing(prev => ({
            ...prev!,
            scores: {
              ...prev!.scores,
              ...holeScores
            }
          }));
          
          console.log('Auto-submit completed successfully');
        }
        
        setIsSubmitting(false);
      }
      
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
      setIsSubmitting(false);
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
      
      // Submit scores for each hole that has data
      const holesToSubmit = Object.keys(holeScores)
        .map(h => parseInt(h))
        .filter(holeNum => {
          const holeData = holeScores[holeNum];
          // Only submit if there are valid scores for this hole
          return Object.values(holeData || {}).some(score => score > 0);
        });

      if (holesToSubmit.length === 0) {
        setError('No scores to submit. Please enter at least one score.');
        setIsSubmitting(false);
        return;
      }

      // Submit each hole's scores
      for (const holeNum of holesToSubmit) {
        const holeData = holeScores[holeNum];
        
        // Convert hole scores to API format
        const scoresArray = Object.entries(holeData)
          .filter(([userId, strokes]) => {
            // Filter out invalid entries
            if (!userId || userId === '' || strokes === 0 || strokes === null || strokes === undefined) {
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

        if (scoresArray.length > 0) {
          console.log(`Submitting hole ${holeNum}:`, scoresArray);
          await apiClient.submitPairingScores(selectedPairing.id, {
            hole_number: holeNum,
            scores: scoresArray
          });
        }
      }
      
      // Reload match results from backend to reflect calculated scoring
      setLoadingResults(true);
      try {
        const updatedMatchResults = await Promise.all(
          selectedPairing.matches?.map(async (match) => {
            try {
              const matchScores = await apiClient.getMatchScores(match.id);
              const matchPlayers = await apiClient.getMatchPlayers(match.id);
              return {
                ...match,
                hole_results: matchScores.hole_results || [],
                match_players: matchPlayers
              };
            } catch (err) {
              console.warn('Error loading results for match:', match.id, err);
              return match;
            }
          }) || []
        );
        
        // Update local state with reloaded match results and scores
        setSelectedPairing(prev => ({
          ...prev!,
          scores: {
            ...prev!.scores,
            ...holeScores
          },
          matchResults: updatedMatchResults
        }));
      } finally {
        setLoadingResults(false);
      }

      // Advance to next hole after successful submission
      const updatedScores = {
        ...selectedPairing.scores,
        ...holeScores
      };
      const completedHoles = new Set(Object.keys(updatedScores).map(h => parseInt(h)));
      let nextHole = currentHole + 1;
      for (let h = nextHole; h <= 18; h++) {
        if (!completedHoles.has(h)) {
          nextHole = h;
          break;
        }
      }
      if (nextHole > 18) {
        nextHole = 18;
      }
      setCurrentHole(nextHole);

      // Clear any previous errors on success
      setError(null);
      
    } catch (err) {
      console.error('Error submitting scores:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to submit scores');
      alert('Error: Failed to submit scores. Please try again.');
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

  // Calculate overall team points from match results
  const calculateOverallTeamPoints = (pairing: PairingWithScores | null) => {
    const teamPoints: Record<string, number> = {};
    
    if (pairing?.matchResults) {
      pairing.matchResults.forEach(match => {
        if (match.team1_points > 0) {
          teamPoints[match.team1_id] = (teamPoints[match.team1_id] || 0) + match.team1_points;
        }
        if (match.team2_points > 0) {
          teamPoints[match.team2_id] = (teamPoints[match.team2_id] || 0) + match.team2_points;
        }
      });
    }
    
    return teamPoints;
  };

  const overallTeamPoints = calculateOverallTeamPoints(selectedPairing);

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

  if (loading || tournamentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">
          {tournamentsLoading ? 'Loading tournaments...' : 'Loading pairings...'}
        </span>
      </div>
    );
  }

  if (tournamentError || !selectedTournamentId) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Tournament Selected</h3>
        <p className="text-gray-500 mb-6">
          {tournamentError || 'Please select a tournament from the user menu to enter scores.'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Pairings</h3>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={loadPairings}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pairings.length === 0 && selectedTournamentId) {
    return (
      <div className="text-center py-12">
        <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Pairings</h3>
        <p className="text-gray-500">There are no pairings currently available for scoring in this tournament.</p>
        <button
          onClick={loadPairings}
          className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>
    );
  }

  // ============================================
  // Reopen Pairing Section Component (Reusable)
  // ============================================
  // Displays option to reopen a completed pairing for editing
  const ReopenPairingSection: React.FC<{ pairingId: string }> = ({ pairingId }) => {
    return (
      <div className="text-center py-6 mt-6 border-t border-gray-200">
        <p className="text-gray-500 mb-4">
          Need to make changes? You can reopen this pairing for editing.
        </p>
        <button
          onClick={() => startPairing(pairingId)}
          className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
        >
          Reopen for Editing
        </button>
      </div>
    );
  };

  // ============================================
  // Hole-by-Hole Score Entry Component
  // ============================================
  const HoleByHoleView: React.FC<{ pairing: PairingWithScores }> = ({ pairing }) => {
    if (!pairing.players || pairing.players.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No players in this pairing</p>
        </div>
      );
    }

    // If pairing is completed, show the reopen option instead of score entry
    if (pairing.status === 'completed') {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Pairing Completed</h3>
            <p className="text-gray-600 mb-4">
              This pairing has been completed. View the results in the Scorecard or Matches tab.
            </p>
          </div>
          <ReopenPairingSection pairingId={pairing.id} />
        </div>
      );
    }

    // Get hole information
    const holeInfo = pairing.holes?.find(h => h.hole_number === currentHole);
    const holePar = holeInfo?.par || 4;
    const holeYards = holeInfo?.yards || 0;

    // Get current hole scores or initialize with empty
    const currentHoleScores = holeScores[currentHole] || {};
    const getPlayerScore = (playerId: string) => {
      return currentHoleScores[playerId] ?? 0;
    };

    const handleScoreUpdate = (playerId: string, newScore: number) => {
      if (newScore < 1) return; // Minimum score is 1
      handleScoreChange(currentHole, playerId, newScore);
    };

    const handleNavigateHole = async (direction: 'prev' | 'next') => {
      // Auto-submit current hole scores if they've changed
      const hasScores = Object.keys(currentHoleScores).length > 0;
      if (hasScores) {
        try {
          const validPlayerIds = new Set(pairing.players?.map(p => p.user_id) || []);
          const scores = Object.entries(currentHoleScores)
            .filter(([userId, strokes]) => validPlayerIds.has(userId) && strokes > 0)
            .map(([userId, strokes]) => ({
              user_id: userId,
              strokes: strokes
            }));

          if (scores.length === 0) {
            setError('Please enter at least one score before leaving this hole.');
            return;
          }

          await apiClient.submitPairingScores(pairing.id, {
            hole_number: currentHole,
            scores
          });

          // Reload match results
          if (pairing.matches && pairing.matches.length > 0) {
            const matchResults: MatchWithResults[] = [];
            for (const match of pairing.matches) {
              try {
                const scoresResponse = await apiClient.getMatchScores(match.id);
                matchResults.push({
                  ...match,
                  hole_results: scoresResponse.hole_results || []
                });
              } catch (err) {
                console.warn('Error loading match scores:', err);
              }
            }
            setSelectedPairing(prev => prev ? { ...prev, matchResults } : null);
          }
        } catch (err) {
          console.error('Error auto-submitting scores:', err);
          setError(err instanceof ApiError ? err.message : 'Failed to save scores');
          return;
        }
      }

      // Navigate to new hole
      const newHole = direction === 'prev' ? Math.max(1, currentHole - 1) : Math.min(18, currentHole + 1);
      setCurrentHole(newHole);
    };

    const handleSubmitCurrentHole = async () => {
      try {
        setIsSubmitting(true);
        const validPlayerIds = new Set(pairing.players?.map(p => p.user_id) || []);
        const scores = Object.entries(currentHoleScores)
          .filter(([userId, strokes]) => validPlayerIds.has(userId) && strokes > 0)
          .map(([userId, strokes]) => ({
            user_id: userId,
            strokes: strokes
          }));

        if (scores.length === 0) {
          setError('Please enter at least one score before submitting.');
          return;
        }

        await apiClient.submitPairingScores(pairing.id, {
          hole_number: currentHole,
          scores
        });

        // Reload match results
        if (pairing.matches && pairing.matches.length > 0) {
          const matchResults: MatchWithResults[] = [];
          for (const match of pairing.matches) {
            try {
              const scoresResponse = await apiClient.getMatchScores(match.id);
              matchResults.push({
                ...match,
                hole_results: scoresResponse.hole_results || []
              });
            } catch (err) {
              console.warn('Error loading match scores:', err);
            }
          }
          setSelectedPairing(prev => prev ? { ...prev, matchResults } : null);
        }

        setError(null);

        if (currentHole === 18) {
          const shouldComplete = window.confirm('Complete the round now?');
          if (shouldComplete) {
            await completePairing(pairing.id);
          }
        }
      } catch (err) {
        console.error('Error submitting scores:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to submit scores');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Hole Information */}
        <div className="bg-gray-50 border-b-2 border-gray-300 p-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-1">Hole {currentHole}</div>
            <div className="flex items-center justify-center space-x-8 text-gray-700">
              <div>
                <span className="font-semibold">Par</span> <span className="text-2xl font-bold">{holePar}</span>
              </div>
              {holeYards > 0 && (
                <div>
                  <span className="font-semibold">{holeYards}</span> <span className="text-sm">yds</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Entry */}
        <div className="p-6">
          <div className="space-y-4 max-w-2xl mx-auto">
            {getSortedPlayers(pairing.players).map(player => (
              <div key={player.user_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{player.user?.name}</div>
                  {player.team && (
                    <div className="text-sm text-gray-600" style={{ color: player.team.color }}>
                      {player.team.name}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleScoreUpdate(player.user_id, getPlayerScore(player.user_id) - 1)}
                    className="w-10 h-10 flex items-center justify-center bg-gray-300 hover:bg-gray-400 rounded-lg text-xl font-bold text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={currentHoleScores[player.user_id] ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        handleScoreUpdate(player.user_id, val);
                      }
                    }}
                    className="w-20 h-10 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                    disabled={isSubmitting}
                  />
                  <button
                    onClick={() => handleScoreUpdate(player.user_id, getPlayerScore(player.user_id) + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-gray-300 hover:bg-gray-400 rounded-lg text-xl font-bold text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="border-t-2 border-gray-300 p-4">
          <div className="flex items-center justify-center space-x-4 max-w-2xl mx-auto">
            <button
              onClick={() => handleNavigateHole('prev')}
              disabled={currentHole === 1 || isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="mr-2" size={20} />
              Hole {Math.max(1, currentHole - 1)}
            </button>
            <button
              onClick={handleSubmitCurrentHole}
              disabled={isSubmitting}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-bold text-lg transition-colors"
            >
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT'}
            </button>
            <button
              onClick={() => handleNavigateHole('next')}
              disabled={currentHole === 18 || isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              Hole {Math.min(18, currentHole + 1)}
              <ChevronRight className="ml-2" size={20} />
            </button>
          </div>
        </div>

        {/* Match Status Summary - Matches for Current Hole */}
        {(() => {
          // Find all matches that apply to the current hole
          const currentMatches = getAllMatchesForHole(pairing, currentHole);
          if (currentMatches.length === 0) return null;

          return (
            <div className="border-t-2 border-gray-300 bg-gray-50 p-6">
              <div className="max-w-2xl mx-auto space-y-3">
                {currentMatches.map((currentMatch) => {
                  // Find the match index for display
                  const matchIdx = pairing.matches?.findIndex(m => m.id === currentMatch.id) ?? 0;

                  return (
                    <MatchStatusBox
                      key={currentMatch.id}
                      match={currentMatch}
                      matchIndex={matchIdx}
                      pairing={pairing}
                      variant="compact"
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ============================================
  // Scorecard Color Configuration
  // ============================================
  // Easily adjust these colors to change the entire scorecard appearance
  // Using grayscale to let team colors stand out when shading hole winners/match status
  const SCORECARD_COLORS = {
    // Course info box text colors
    courseInfoHeading: 'text-gray-900',
    courseInfoSubtext: 'text-gray-700',
    
    // Par row styling
    parRowBg: 'bg-gray-100',
    parRowHeaderBg: 'bg-gray-100',
    parOutInBg: 'bg-gray-100',
    parTotalBg: 'bg-gray-200',
    
    // Out/In/Total column styling
    outBg: 'bg-gray-100',
    inBg: 'bg-gray-100',
    totalBg: 'bg-gray-200',
    
    // Yardage row styling
    yardageOutInBg: 'bg-gray-100',
    yardageTotalBg: 'bg-gray-200',
    
    // Status row styling (now per-match)
    statusRowHeaderBg: 'bg-gray-100',
    statusRowHeaderText: 'text-gray-900',
    
    // Match colors for per-cell shading
    match0: 'bg-blue-50',
    match1: 'bg-amber-50',
    match2: 'bg-purple-50',
    match3: 'bg-green-50',
    match4: 'bg-pink-50',
    match5: 'bg-cyan-50',
  };

  // ============================================
  // Reusable Scorecard Table Component
  // ============================================
  // Shared scorecard rendering for both entry and display modes
  interface ScorecardTableProps {
    pairing: PairingWithScores;
    mode: 'entry' | 'display';
    holeScores?: Record<number, Record<string, number>>;
    onScoreChange?: (holeNumber: number, playerId: string, score: number) => void;
  }

  const ScorecardTable: React.FC<ScorecardTableProps> = ({ 
    pairing, 
    mode, 
    holeScores = {}, 
    onScoreChange 
  }) => {
    // Component for diagonal split cell showing points (display mode only)
    const DiagonalPointsCell = ({ team1Points, team2Points, team1Color, team2Color }: { team1Points: number; team2Points: number; team1Color?: string; team2Color?: string }) => {
      return (
        <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 100,0 0,100" fill={team1Color || '#999'} opacity="0.3" />
            <polygon points="100,0 100,100 0,100" fill={team2Color || '#999'} opacity="0.3" />
            <line x1="0" y1="100" x2="100" y2="0" stroke="#333" strokeWidth="1" />
          </svg>
          <div className="relative z-10 flex items-center justify-between w-full h-full px-2">
            <div className="absolute top-1 left-1 text-xs font-bold text-gray-900">
              {team1Points.toFixed(1)} pts
            </div>
            <div className="absolute bottom-1 right-1 text-xs font-bold text-gray-900">
              {team2Points.toFixed(1)} pts
            </div>
          </div>
        </div>
      );
    };

    // Helper to check if team won hole (display mode)
    const didTeamWinHole = (holeNumber: number, teamId: string): boolean => {
      const match = getMatchForHole(pairing, holeNumber);
      if (!match) return false;
      const matchResult = pairing.matchResults?.find(mr => mr.id === match.id);
      if (!matchResult?.hole_results) return false;
      const holeResult = matchResult.hole_results.find(hr => hr.hole_number === holeNumber);
      if (!holeResult) return false;
      return holeResult.winner_team_id === teamId && holeResult.winner_team_id !== null && holeResult.winner_team_id !== undefined;
    };

    // Helper to calculate points in range (display mode)
    const calculateTeamPointsInRange = (team1Id: string, team2Id: string, startHole: number, endHole: number) => {
      let team1Points = 0;
      let team2Points = 0;
      for (let h = startHole; h <= endHole; h++) {
        const match = getMatchForHole(pairing, h);
        if (!match) continue;
        const matchResult = pairing.matchResults?.find(mr => mr.id === match.id);
        if (!matchResult?.hole_results) continue;
        const holeResult = matchResult.hole_results.find(hr => hr.hole_number === h);
        if (!holeResult) continue;
        team1Points += holeResult.team1_points || 0;
        team2Points += holeResult.team2_points || 0;
      }
      return { team1Points, team2Points };
    };

    return (
      <>
        {/* Golf Course Information Box */}
        {pairing.round?.golf_course && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b-2 border-gray-300 mb-4 rounded-t-lg">
            <p className={`text-sm font-medium ${SCORECARD_COLORS.courseInfoHeading}`}>
              {pairing.round.golf_course.course_name}
            </p>
            {pairing.round.golf_course.city && pairing.round.golf_course.state && (
              <p className={`text-xs ${SCORECARD_COLORS.courseInfoSubtext}`}>
                {pairing.round.golf_course.city}, {pairing.round.golf_course.state}
              </p>
            )}
            {pairing.tee && (
              <p className={`text-xs ${SCORECARD_COLORS.courseInfoSubtext} mt-1`}>
                {pairing.tee.tee_name} Tees
                {pairing.tee.total_yards && ` - ${pairing.tee.total_yards} yards`}
                {pairing.tee.course_rating && pairing.tee.slope_rating && 
                  ` - Rating: ${pairing.tee.course_rating}/${pairing.tee.slope_rating}`}
              </p>
            )}
          </div>
        )}
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <table className="min-w-full divide-y-2 divide-gray-800 bg-white text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="sticky left-0 z-10 px-3 py-2 text-left text-xs font-bold text-gray-900 uppercase border-r-2 border-gray-800 bg-gray-100">
                Hole
              </th>
              {Array.from({ length: 9 }, (_, i) => i + 1).map(hole => (
                <th key={hole} className="px-3 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-300 min-w-[50px]">
                  {hole}
                </th>
              ))}
              <th className={`px-3 py-2 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-800 ${SCORECARD_COLORS.outBg} min-w-[60px]`}>
                Out
              </th>
              {Array.from({ length: 9 }, (_, i) => i + 10).map(hole => (
                <th key={hole} className="px-3 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-300 min-w-[50px]">
                  {hole}
                </th>
              ))}
              <th className={`px-3 py-2 text-center text-sm font-bold text-gray-900 ${SCORECARD_COLORS.inBg} min-w-[60px] border-r-2 border-gray-800`}>
                In
              </th>
              <th className={`px-3 py-2 text-center text-sm font-bold text-gray-900 ${SCORECARD_COLORS.totalBg} min-w-[60px]`}>
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-gray-800">
            {/* Yardage Row */}
            {pairing.holes && pairing.holes.length > 0 && (
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800 bg-gray-50">
                  Yardage
                </td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 1);
                  return (
                    <td key={i + 1} className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-300">
                      {hole?.yards || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-sm font-semibold text-gray-900 border-r-2 border-gray-800 ${SCORECARD_COLORS.yardageOutInBg}`}>
                  {pairing.holes?.slice(0, 9).reduce((sum, h) => sum + (h.yards || 0), 0)}
                </td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 10);
                  return (
                    <td key={i + 10} className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-300">
                      {hole?.yards || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-sm font-semibold text-gray-900 ${SCORECARD_COLORS.yardageOutInBg} border-r-2 border-gray-800`}>
                  {pairing.holes?.slice(9, 18).reduce((sum, h) => sum + (h.yards || 0), 0)}
                </td>
                <td className={`px-3 py-2 text-center text-sm font-semibold text-gray-900 ${SCORECARD_COLORS.yardageTotalBg}`}>
                  {pairing.holes?.reduce((sum, h) => sum + (h.yards || 0), 0)}
                </td>
              </tr>
            )}
            
            {/* Par Row */}
            {pairing.holes && pairing.holes.length > 0 && (
              <tr className={SCORECARD_COLORS.parRowBg}>
                <td className={`sticky left-0 z-10 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800 ${SCORECARD_COLORS.parRowHeaderBg}`}>
                  Par
                </td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 1);
                  return (
                    <td key={i + 1} className="px-3 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-300">
                      {hole?.par || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-800 ${SCORECARD_COLORS.parOutInBg}`}>
                  {pairing.holes?.slice(0, 9).reduce((sum, h) => sum + (h.par || 0), 0)}
                </td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 10);
                  return (
                    <td key={i + 10} className="px-3 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-300">
                      {hole?.par || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-800 ${SCORECARD_COLORS.parOutInBg}`}>
                  {pairing.holes?.slice(9, 18).reduce((sum, h) => sum + (h.par || 0), 0)}
                </td>
                <td className={`px-3 py-2 text-center text-sm font-bold text-gray-900 ${SCORECARD_COLORS.parTotalBg}`}>
                  {pairing.holes?.reduce((sum, h) => sum + (h.par || 0), 0)}
                </td>
              </tr>
            )}
            
            {/* Handicap Row */}
            {pairing.holes && pairing.holes.length > 0 && pairing.holes.some(h => h.handicap) && (
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800 bg-gray-50">
                  HCP
                </td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 1);
                  return (
                    <td key={i + 1} className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-300">
                      {hole?.handicap || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-xs text-gray-600 border-r-2 border-gray-800 ${SCORECARD_COLORS.outBg}`}></td>
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = pairing.holes?.find(h => h.hole_number === i + 10);
                  return (
                    <td key={i + 10} className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-300">
                      {hole?.handicap || '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-center text-xs text-gray-600 border-r-2 border-gray-800 ${SCORECARD_COLORS.inBg}`}></td>
                <td className={`px-3 py-2 text-center text-xs text-gray-600 ${SCORECARD_COLORS.totalBg}`}></td>
              </tr>
            )}
            
            {/* Player Score Rows - One row per player, merged cells for team scoring */}
            {(() => {
              // Sort players by team, then by player_order
              const sortedPlayers = getSortedPlayers(pairing.players);

              return sortedPlayers.map((player, playerIdx) => {
                const playerScores = mode === 'entry' ? holeScores : pairing.scores;
                const isTeam1 = player.team_id === pairing.matchResults?.[0]?.team1_id;
                const teamColor = isTeam1 ? pairing.matchResults?.[0]?.team1?.color : pairing.matchResults?.[0]?.team2?.color;
                
                // Get all teammates on this player's team
                const teamPlayers = (pairing.players || []).filter(p => p.team_id === player.team_id);
                const isFirstPlayerOnTeam = teamPlayers[0]?.id === player.id;
                const teamSize = teamPlayers.length;
                const isFirstInTeam = playerIdx === 0 || sortedPlayers[playerIdx - 1].team_id !== player.team_id;

                return (
                  <tr 
                    key={player.id}
                    className={`${playerIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isFirstInTeam && playerIdx > 0 ? 'border-t-2 border-gray-800' : ''}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase border-r-2 border-gray-800 ${playerIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: player.team?.color }}
                        ></div>
                        <span className="text-xs font-medium text-gray-900 whitespace-nowrap">
                          {player.user?.name || 'Player'}
                        </span>
                      </div>
                    </td>
                    {/* Front 9 scores (holes 1-9) */}
                    {Array.from({ length: 9 }, (_, i) => {
                      const holeNum = i + 1;
                      const match = getMatchForHole(pairing, holeNum);
                      const isTeamScoring = match?.format?.score_input_type === 'team' || false;
                      
                      // For team scoring, skip rendering for non-first teammates (return null)
                      if (isTeamScoring && !isFirstPlayerOnTeam) {
                        return null;
                      }

                      // For team scoring, use first player's ID; otherwise use current player
                      const scoreKey = isTeamScoring ? teamPlayers[0]?.user_id : player.user_id;
                      const score = playerScores?.[holeNum]?.[scoreKey];
                      
                      const hasWon = mode === 'display' && didTeamWinHole(holeNum, player.team_id);
                      
                      // Determine what to render based on entry mode and currentHole
                      const isCurrentHole = mode === 'entry' && holeNum === currentHole;
                      const hasScore = score !== undefined && score > 0;
                      const holeParValue = pairing.holes?.find(h => h.hole_number === holeNum)?.par;
                      const scoreToPar = hasScore && holeParValue ? score - holeParValue : null;
                      
                      // Determine shape based on score to par
                      let shapeClass = '';
                      if (scoreToPar !== null) {
                        if (scoreToPar <= -1) {
                          // Under par: circle
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-900';
                        } else if (scoreToPar === 1) {
                          // Bogey: square
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 border-2 border-gray-900';
                        } else if (scoreToPar >= 2) {
                          // Double bogey or worse: double box
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 border-2 border-gray-900 relative';
                        }
                      }

                      // Determine per-cell background color based on match assignment
                      const playerMatch = getMatchForPlayerAndHole(pairing, player.user_id, holeNum);
                      const matchIndex = playerMatch ? (pairing.matches?.indexOf(playerMatch) || 0) : -1;
                      const matchBgClass = matchIndex >= 0 ? getMatchColorClass(matchIndex) : '';

                      return (
                        <td
                          key={holeNum}
                          className={`px-3 py-2 text-center text-xs border-r border-gray-300 ${isCurrentHole ? 'bg-blue-100' : matchBgClass}`}
                          rowSpan={isTeamScoring ? teamSize : 1}
                          style={hasWon && teamColor ? { backgroundColor: `${teamColor}4D` } : {}}
                        >
                          {isCurrentHole ? (
                            <input
                              type="number"
                              min="0"
                              max="15"
                              value={score || ''}
                              onChange={(e) => onScoreChange?.(holeNum, scoreKey || player.user_id, parseInt(e.target.value) || 0)}
                              className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-xs font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          ) : hasScore ? (
                            scoreToPar !== null && shapeClass ? (
                              <span className={shapeClass}>
                                {scoreToPar >= 2 && (
                                  <span className="absolute inset-0 border border-gray-900 m-0.5"></span>
                                )}
                                <span className="text-xs font-semibold text-gray-900 relative z-10">
                                  {score}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-900">
                                {score}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    {/* Out total */}
                    {(() => {
                      const front9Match = getMatchForHole(pairing, 1);
                      const front9IsTeamScoring = front9Match?.format?.score_input_type === 'team' || false;
                      
                      // Skip for non-first teammates in team format
                      if (front9IsTeamScoring && !isFirstPlayerOnTeam) {
                        return null;
                      }

                      const outTotal = Array.from({ length: 9 }, (_, i) => {
                        const holeNum = i + 1;
                        const match = getMatchForHole(pairing, holeNum);
                        const isTeamScoring = match?.format?.score_input_type === 'team' || false;
                        const scoreKey = isTeamScoring ? teamPlayers[0]?.user_id : player.user_id;
                        return playerScores?.[holeNum]?.[scoreKey] || 0;
                      }).reduce((a, b) => a + b, 0);

                      return (
                        <td 
                          className={`px-3 py-2 text-center font-semibold border-r-2 border-gray-800 ${SCORECARD_COLORS.outBg}`}
                          rowSpan={front9IsTeamScoring ? teamSize : 1}
                        >
                          {outTotal}
                        </td>
                      );
                    })()}
                    {/* Back 9 scores (holes 10-18) */}
                    {Array.from({ length: 9 }, (_, i) => {
                      const holeNum = i + 10;
                      const match = getMatchForHole(pairing, holeNum);
                      const isTeamScoring = match?.format?.score_input_type === 'team' || false;
                      
                      // Skip rendering for non-first teammates in team format
                      if (isTeamScoring && !isFirstPlayerOnTeam) {
                        return null;
                      }

                      const scoreKey = isTeamScoring ? teamPlayers[0]?.user_id : player.user_id;
                      const score = playerScores?.[holeNum]?.[scoreKey];
                      
                      const hasWon = mode === 'display' && didTeamWinHole(holeNum, player.team_id);
                      
                      // Determine what to render based on entry mode and currentHole
                      const isCurrentHole = mode === 'entry' && holeNum === currentHole;
                      const hasScore = score !== undefined && score > 0;
                      const holeParValue = pairing.holes?.find(h => h.hole_number === holeNum)?.par;
                      const scoreToPar = hasScore && holeParValue ? score - holeParValue : null;
                      
                      // Determine shape based on score to par
                      let shapeClass = '';
                      if (scoreToPar !== null) {
                        if (scoreToPar <= -1) {
                          // Under par: circle
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-900';
                        } else if (scoreToPar === 1) {
                          // Bogey: square
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 border-2 border-gray-900';
                        } else if (scoreToPar >= 2) {
                          // Double bogey or worse: double box
                          shapeClass = 'inline-flex items-center justify-center w-6 h-6 border-2 border-gray-900 relative';
                        }
                      }

                      // Determine per-cell background color based on match assignment
                      const playerMatch = getMatchForPlayerAndHole(pairing, player.user_id, holeNum);
                      const matchIndex = playerMatch ? (pairing.matches?.indexOf(playerMatch) || 0) : -1;
                      const matchBgClass = matchIndex >= 0 ? getMatchColorClass(matchIndex) : '';

                      return (
                        <td
                          key={holeNum}
                          className={`px-3 py-2 text-center text-xs border-r border-gray-300 ${isCurrentHole ? 'bg-blue-100' : matchBgClass}`}
                          rowSpan={isTeamScoring ? teamSize : 1}
                          style={hasWon && teamColor ? { backgroundColor: `${teamColor}4D` } : {}}
                        >
                          {isCurrentHole ? (
                            <input
                              type="number"
                              min="0"
                              max="15"
                              value={score || ''}
                              onChange={(e) => onScoreChange?.(holeNum, scoreKey || player.user_id, parseInt(e.target.value) || 0)}
                              className="w-10 px-1 py-1 border border-gray-300 rounded text-center text-xs font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          ) : hasScore ? (
                            scoreToPar !== null && shapeClass ? (
                              <span className={shapeClass}>
                                {scoreToPar >= 2 && (
                                  <span className="absolute inset-0 border border-gray-900 m-0.5"></span>
                                )}
                                <span className="text-xs font-semibold text-gray-900 relative z-10">
                                  {score}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-900">
                                {score}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    {/* In total */}
                    {(() => {
                      const back9Match = getMatchForHole(pairing, 10);
                      const back9IsTeamScoring = back9Match?.format?.score_input_type === 'team' || false;
                      
                      // Skip for non-first teammates in team format
                      if (back9IsTeamScoring && !isFirstPlayerOnTeam) {
                        return null;
                      }

                      const inTotal = Array.from({ length: 9 }, (_, i) => {
                        const holeNum = i + 10;
                        const match = getMatchForHole(pairing, holeNum);
                        const isTeamScoring = match?.format?.score_input_type === 'team' || false;
                        const scoreKey = isTeamScoring ? teamPlayers[0]?.user_id : player.user_id;
                        return playerScores?.[holeNum]?.[scoreKey] || 0;
                      }).reduce((a, b) => a + b, 0);

                      return (
                        <td 
                          className={`px-3 py-2 text-center font-semibold border-r-2 border-gray-800 ${SCORECARD_COLORS.inBg}`}
                          rowSpan={back9IsTeamScoring ? teamSize : 1}
                        >
                          {inTotal}
                        </td>
                      );
                    })()}
                    {/* Total */}
                    {(() => {
                      const back9Match = getMatchForHole(pairing, 10);
                      const back9IsTeamScoring = back9Match?.format?.score_input_type === 'team' || false;
                      
                      // Skip for non-first teammates in team format
                      if (back9IsTeamScoring && !isFirstPlayerOnTeam) {
                        return null;
                      }

                      const total = Array.from({ length: 18 }, (_, i) => {
                        const holeNum = i + 1;
                        const match = getMatchForHole(pairing, holeNum);
                        const isTeamScoring = match?.format?.score_input_type === 'team' || false;
                        const scoreKey = isTeamScoring ? teamPlayers[0]?.user_id : player.user_id;
                        return playerScores?.[holeNum]?.[scoreKey] || 0;
                      }).reduce((a, b) => a + b, 0);

                      return (
                        <td 
                          className={`px-3 py-2 text-center font-bold ${SCORECARD_COLORS.totalBg}`}
                          rowSpan={back9IsTeamScoring ? teamSize : 1}
                        >
                          {total}
                        </td>
                      );
                    })()}
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        </div>
      </>
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

      {/* Pairing Drawer Modal */}
      {showPairingDrawer && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowPairingDrawer(false)}
          />
          {/* Drawer Panel */}
          <div className="relative ml-auto w-full max-w-md bg-white shadow-lg overflow-y-auto max-h-screen">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Select Pairing</h2>
              <button
                onClick={() => setShowPairingDrawer(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMyPairingsOnly}
                  onChange={(e) => setShowMyPairingsOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Show only my pairings</span>
              </label>

              {filteredPairings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No pairings found. {showMyPairingsOnly && 'Try unchecking "Show only my pairings".'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedRounds.map(({ round, pairings: roundPairings }) => (
                    <div key={round?.id || 'unknown'}>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-200">
                        Round {round?.round_number || '?'} {round?.name ? `- ${round.name}` : ''}
                      </h4>
                      <div className="space-y-2">
                        {roundPairings.map((pairing) => (
                          <button
                            key={pairing.id}
                            onClick={async () => {
                              await loadExistingScores(pairing);
                              setShowPairingDrawer(false);
                            }}
                            className={`w-full p-3 rounded-lg border-2 text-left text-sm transition-colors ${
                              selectedPairing?.id === pairing.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-medium">Pairing {pairing.pairing_number}</div>
                              <div className={`text-xs px-2 py-1 rounded-full ${
                                pairing.status === 'not_started' ? 'bg-gray-200 text-gray-700' :
                                pairing.status === 'in_progress' ? 'bg-green-200 text-green-700' :
                                'bg-blue-200 text-blue-700'
                              }`}>
                                {pairing.status.replace('_', ' ')}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 mb-1">
                              {getSortedPlayers(pairing.players).map(p => p.user?.name).join(', ')}
                            </div>
                            {(pairing.round?.golf_course || pairing.tee_time) && (
                              <div className="text-xs text-gray-500 space-y-0.5 mt-2 pt-2 border-t border-gray-200">
                                {pairing.round?.golf_course && (
                                  <div className="flex items-center">
                                    <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{pairing.round.golf_course.course_name}</span>
                                  </div>
                                )}
                                {pairing.tee_time && (
                                  <div className="flex items-center">
                                    <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{new Date(pairing.tee_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header - Only show if no pairing selected */}
      {!selectedPairing && pairings.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Select a Pairing</h1>
              <p className="text-gray-500">Choose a pairing to enter scores</p>
            </div>
            <button
              onClick={() => setShowPairingDrawer(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Choose Pairing
            </button>
          </div>
        </div>
      )}

      {/* No Pairing Selected Placeholder */}
      {!selectedPairing && pairings.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg p-12">
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pairing Selected</h3>
            <p className="text-gray-500 mb-6">Select a pairing to begin entering scores</p>
            <button
              onClick={() => setShowPairingDrawer(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Choose a Pairing
            </button>
          </div>
        </div>
      )}

      {/* Empty State - No Pairings Available */}
      {pairings.length === 0 && (
        <div className="bg-white shadow-sm rounded-lg p-12">
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pairings Available</h3>
            <p className="text-gray-500">No pairings have been created for your tournaments yet. Create a tournament and pairings to get started.</p>
          </div>
        </div>
      )}

      {/* Score Entry */}
      {selectedPairing && (
        <div className="space-y-6">
          {/* Tournament Header */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold">
                    {selectedTournament?.name || 'Tournament'}
                  </h2>
                  <button
                    onClick={() => setShowPairingDrawer(true)}
                    className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Change Pairing
                  </button>
                </div>
                <PairingHeaderDetails
                  pairing={selectedPairing}
                  overallTeamPoints={overallTeamPoints}
                />
              </div>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-center">
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
                <button
                  onClick={() => setViewMode('hole-by-hole')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    viewMode === 'hole-by-hole'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Hole-by-Hole
                </button>
                <button
                  onClick={() => setViewMode('scorecard')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    viewMode === 'scorecard'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Scorecard
                </button>
                <button
                  onClick={() => setViewMode('matches')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    viewMode === 'matches'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Matches
                </button>
              </div>
            </div>
          </div>

          {/* Hole-by-Hole View */}
          {viewMode === 'hole-by-hole' && (
            <HoleByHoleView pairing={selectedPairing} />
          )}

          {/* Scorecard View */}
          {viewMode === 'scorecard' && (
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
              {/* Full Scorecard Table - Entry Mode */}
              <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b-2 border-gray-300">
                  <h3 className="text-lg font-semibold text-gray-900">Pairing {selectedPairing.pairing_number} Scorecard</h3>
                </div>
                <ScorecardTable 
                  mode="entry"
                  pairing={selectedPairing}
                  holeScores={holeScores}
                  onScoreChange={handleScoreChange}
                />
              </div>

              {/* Matches Status Display */}
              <MatchesStatusDisplay pairing={selectedPairing} />

              {/* Hole Navigation & Submit Button */}
              <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
                {/* Navigation Controls */}
                <div className="flex justify-center items-center gap-3 bg-gray-50 p-3 rounded">
                  <button
                    onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
                    disabled={currentHole === 1}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    ← Previous
                  </button>
                  <div className="text-center min-w-[200px]">
                    <div className="text-sm font-semibold text-gray-900">Hole {currentHole}</div>
                    <div className="text-xs text-gray-600">
                      Par {selectedPairing.holes?.find(h => h.hole_number === currentHole)?.par || '—'}
                    </div>
                  </div>
                  <button
                    onClick={handleNextHole}
                    disabled={currentHole === 18}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Next →
                  </button>
                </div>

                {/* Par-Relative Symbol Legend */}
                <div className="flex justify-center gap-6 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <span className="text-[10px] font-semibold">3</span>
                    </div>
                    <span>Under par (Eagle/Birdie)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-gray-900 flex items-center justify-center">
                      <span className="text-[10px] font-semibold">5</span>
                    </div>
                    <span>Bogey</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-gray-900 relative flex items-center justify-center">
                      <div className="absolute inset-0 border border-gray-900 m-0.5"></div>
                      <span className="text-[10px] font-semibold relative z-10">6</span>
                    </div>
                    <span>Double bogey+</span>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {(() => {
                      const totalScores = Object.values(holeScores).reduce((acc, hole) => 
                        acc + Object.values(hole).filter(score => score > 0).length, 0
                      );
                      return totalScores > 0 && (
                        <span className="flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {totalScores} score{totalScores !== 1 ? 's' : ''} entered
                        </span>
                      );
                    })()}
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
                      disabled={isSubmitting || Object.values(holeScores).every(hole => Object.values(hole).filter(score => score > 0).length === 0)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isSubmitting ? 'Submitting...' : 'Submit Scores'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Show info for completed pairings */}
          {selectedPairing.status === 'completed' && (
            <div>
              {/* Scorecard Display */}
              <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg mb-6">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b-2 border-gray-300">
                  <h3 className="text-lg font-semibold text-gray-900">Final Scorecard</h3>
                </div>
                <ScorecardTable 
                  mode="display"
                  pairing={selectedPairing}
                />
              </div>

              {/* Match Status Summary */}
              <MatchesStatusDisplay pairing={selectedPairing} />

              {/* Reopen Button */}
              <ReopenPairingSection pairingId={selectedPairing.id} />
            </div>
          )}
        </div>
          )}

          {/* Matches View */}
          {viewMode === 'matches' && (
            <div className="space-y-6">
              {selectedPairing.status === 'completed' || selectedPairing.status === 'in_progress' ? (
                <MatchesStatusDisplay pairing={selectedPairing} />
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-600">Match results will be available once the pairing is in progress</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreInterface;

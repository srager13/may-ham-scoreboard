import React, { useState, useEffect } from 'react';
import { Users, Target, Award, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { apiClient, ApiError, Match as ApiMatch, Tournament, Team, Round, Score } from '../services/api';

interface MatchWithScores extends ApiMatch {
  current_hole: number;
  scores: Record<number, Record<string, number>>;
  round?: Round;
}

const ScoreInterface: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [matches, setMatches] = useState<MatchWithScores[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithScores | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      loadMatches();
    }
  }, [selectedTournamentId]);

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
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Failed to load tournaments. Please make sure you are logged in.');
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    if (!selectedTournamentId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get rounds for the selected tournament
      const roundsResponse = await apiClient.getTournamentRounds(selectedTournamentId);
      const rounds = Array.isArray(roundsResponse) ? roundsResponse : [];
      
      const allMatches: MatchWithScores[] = [];
      
      for (const round of rounds) {
        try {
          const matchesResponse = await apiClient.getRoundMatches(round.id);
          const matches = Array.isArray(matchesResponse) ? matchesResponse : [];
          
          // Show scheduled, not_started, and in_progress matches (exclude completed)
          const matchesWithScores: MatchWithScores[] = matches
            .filter(m => m.status !== 'completed')
            .map(match => ({
              ...match,
              current_hole: 1,
              scores: {},
              players: match.players || [], // Ensure players array exists
              round: round // Add round info to match
            }));
          
          allMatches.push(...matchesWithScores);
        } catch (matchErr) {
          console.warn('Error loading matches for round:', round.id, matchErr);
        }
      }
      
      setMatches(allMatches);
      if (allMatches.length > 0) {
        const firstMatch = allMatches[0];
        await loadExistingScores(firstMatch);
      } else {
        setSelectedMatch(null);
      }
    } catch (err) {
      console.error('Error loading matches:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingScores = async (match: MatchWithScores) => {
    try {
      const response = await apiClient.getMatchScores(match.id);
      const scores = response.scores || [];
      
      // Convert scores array to the format expected by the UI
      const scoresMap: Record<number, Record<string, number>> = {};
      
      scores.forEach(score => {
        if (!scoresMap[score.hole_number]) {
          scoresMap[score.hole_number] = {};
        }
        scoresMap[score.hole_number][score.user_id] = score.strokes;
      });
      
      // Update the match with existing scores
      const updatedMatch = {
        ...match,
        scores: scoresMap
      };
      
      setSelectedMatch(updatedMatch);
      
      // If there are existing scores, set the current hole to the first incomplete hole
      const completedHoles = Object.keys(scoresMap).map(h => parseInt(h));
      const nextHole = completedHoles.length > 0 
        ? Math.max(...completedHoles) + 1 
        : 1;
      
      if (nextHole <= match.holes) {
        setCurrentHole(nextHole);
        setHoleScores(scoresMap[nextHole] || {});
      } else {
        // All holes completed, show the last hole
        setCurrentHole(match.holes);
        setHoleScores(scoresMap[match.holes] || {});
      }
      
    } catch (err) {
      console.warn('Error loading existing scores:', err);
      // Don't show error to user, just proceed without existing scores
      setSelectedMatch(match);
      setCurrentHole(1);
      setHoleScores({});
    }
  };

  const handleScoreChange = (playerId: string, score: number) => {
    setHoleScores(prev => ({
      ...prev,
      [playerId]: score
    }));
  };

  const startMatch = async (matchId: string) => {
    try {
      setError(null);
      // Update match status to in_progress
      // Note: You'll need to add this endpoint to your API
      await apiClient.updateMatchStatus(matchId, 'in_progress');
      
      // Update local state
      setMatches(prev => prev.map(match => 
        match.id === matchId 
          ? { ...match, status: 'in_progress' }
          : match
      ));
      
      // If this is the selected match, update it too
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, status: 'in_progress' } : null);
      }
    } catch (err) {
      console.error('Error starting match:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to start match');
    }
  };

  const submitHoleScores = async () => {
    if (!selectedMatch) return;

    setIsSubmitting(true);
    try {
      // Convert holeScores to API format
      const scoresArray = Object.entries(holeScores).map(([userId, strokes]) => ({
        user_id: userId,
        strokes: strokes
      }));

      await apiClient.submitScores(selectedMatch.id, {
        hole_number: currentHole,
        scores: scoresArray
      });
      
      // Update local state
      setSelectedMatch(prev => ({
        ...prev!,
        scores: {
          ...prev!.scores,
          [currentHole]: holeScores
        },
        current_hole: currentHole < selectedMatch.holes ? currentHole + 1 : currentHole
      }));

      // Move to next hole or stay on current
      if (currentHole < selectedMatch.holes) {
        setCurrentHole(currentHole + 1);
        setHoleScores({});
      }
    } catch (err) {
      console.error('Error submitting scores:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to submit scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTeamPlayers = (teamId: string) => {
    if (!selectedMatch?.players) {
      return [];
    }
    return selectedMatch.players.filter(p => p.team_id === teamId) || [];
  };

  // Helper function to check if we have player data
  const hasPlayerData = () => {
    return selectedMatch?.players && selectedMatch.players.length > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">
          {tournaments.length === 0 ? 'Loading tournaments...' : 'Loading matches...'}
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

  if (matches.length === 0 && selectedTournamentId) {
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
                onClick={loadMatches}
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Matches</h3>
          <p className="text-gray-500">There are no matches currently available for scoring in this tournament.</p>
        </div>
      </div>
    );
  }

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
              onClick={loadMatches}
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
            <h1 className="text-2xl font-bold text-gray-900">Score Entry</h1>
            <p className="text-gray-500">Record scores for active matches</p>
          </div>
        </div>
      </div>

      {/* Match Selection */}
      {matches.length > 1 && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Match</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match) => (
              <button
                key={match.id}
                onClick={async () => {
                  await loadExistingScores(match);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedMatch?.id === match.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium">
                    Round {match.round?.round_number || '?'} - Match {match.match_number}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    match.status === 'not_started' || match.status === 'scheduled' ? 'bg-gray-200 text-gray-700' :
                    match.status === 'in_progress' ? 'bg-green-200 text-green-700' :
                    'bg-blue-200 text-blue-700'
                  }`}>
                    {match.status === 'scheduled' ? 'ready to start' : match.status.replace('_', ' ')}
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-3">{match.format?.name}</div>
                
                {/* Team 1 Players */}
                <div className="mb-2">
                  <div className="text-xs font-medium mb-1" style={{ color: match.team1?.color }}>
                    {match.team1?.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {getTeamPlayers(match.team1?.id || '').map(p => p.user?.name || `Player ${p.user_id}`).join(', ') || 'No players assigned'}
                  </div>
                </div>
                
                {/* Team 2 Players */}
                <div className="mb-2">
                  <div className="text-xs font-medium mb-1" style={{ color: match.team2?.color }}>
                    {match.team2?.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {getTeamPlayers(match.team2?.id || '').map(p => p.user?.name || `Player ${p.user_id}`).join(', ') || 'No players assigned'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score Entry */}
      {selectedMatch && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          {/* Start Match Section for scheduled and not_started matches */}
          {(selectedMatch.status === 'not_started' || selectedMatch.status === 'scheduled') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-blue-900 mb-2">
                    Match {selectedMatch.match_number} - Ready to Start
                  </h3>
                  <p className="text-blue-700">
                    {selectedMatch.team1?.name} vs {selectedMatch.team2?.name}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Click "Start Match" to begin entering scores for this {selectedMatch.format?.name} match.
                  </p>
                </div>
                <button
                  onClick={() => startMatch(selectedMatch.id)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Start Match
                </button>
              </div>
            </div>
          )}

          {selectedMatch.status === 'in_progress' && (
            <>
              {!hasPlayerData() && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                  <p className="text-sm">
                    <strong>Note:</strong> Player data not available for this match. 
                    You may need to assign team members before entering scores.
                  </p>
                </div>
              )}
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Match {selectedMatch.match_number} - Hole {currentHole}
              </h3>
              <p className="text-sm text-gray-500">{selectedMatch.format.name}</p>
            </div>
            <div className="flex space-x-2">
              {Array.from({ length: selectedMatch.holes }, (_, i) => i + 1).map((hole) => (
                <button
                  key={hole}
                  onClick={() => {
                    setCurrentHole(hole);
                    setHoleScores(selectedMatch.scores[hole] || {});
                  }}
                  className={`w-8 h-8 rounded-full text-xs font-medium ${
                    hole === currentHole
                      ? 'bg-blue-500 text-white'
                      : selectedMatch.scores[hole]
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {hole}
                </button>
              ))}
            </div>
          </div>

          {/* Team 1 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3" style={{ color: selectedMatch.team1.color }}>
              {selectedMatch.team1.name}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getTeamPlayers(selectedMatch.team1.id).map((player) => (
                <div key={player.id} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{player.user?.name || `Player ${player.user_id}`}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={holeScores[player.user_id] || ''}
                      onChange={(e) => handleScoreChange(player.user_id, parseInt(e.target.value) || 0)}
                      className="w-16 px-3 py-2 border border-gray-300 rounded-md text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team 2 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3" style={{ color: selectedMatch.team2.color }}>
              {selectedMatch.team2.name}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getTeamPlayers(selectedMatch.team2.id).map((player) => (
                <div key={player.id} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{player.user?.name || `Player ${player.user_id}`}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={holeScores[player.user_id] || ''}
                      onChange={(e) => handleScoreChange(player.user_id, parseInt(e.target.value) || 0)}
                      className="w-16 px-3 py-2 border border-gray-300 rounded-md text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {hasPlayerData() && Object.keys(holeScores).length > 0 && (
                <span className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {Object.keys(holeScores).length} of {selectedMatch.players.length} scores entered
                </span>
              )}
              {!hasPlayerData() && (
                <span className="flex items-center text-yellow-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  No player data available
                </span>
              )}
            </div>
            <button
              onClick={submitHoleScores}
              disabled={isSubmitting || Object.keys(holeScores).length === 0 || !hasPlayerData()}
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
            </>
          )}
          
          {/* Show info for other statuses */}
          {selectedMatch.status !== 'not_started' && selectedMatch.status !== 'scheduled' && selectedMatch.status !== 'in_progress' && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                This match is {selectedMatch.status.replace('_', ' ')}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreInterface;
import React, { useState, useEffect } from 'react';
import { Users, Target, Award, RefreshCw, Save, AlertCircle } from 'lucide-react';

// Mock API - replace with actual API calls
const mockAPI = {
  getActiveMatches: async () => [
    {
      id: '1',
      match_number: 1,
      holes: 6,
      status: 'in_progress',
      team1: { id: '1', name: 'Team USA', color: '#DC2626' },
      team2: { id: '2', name: 'Team Europe', color: '#2563EB' },
      players: [
        { id: '1', name: 'John Doe', team_id: '1' },
        { id: '2', name: 'Jane Smith', team_id: '1' },
        { id: '3', name: 'Bob Johnson', team_id: '2' },
        { id: '4', name: 'Alice Williams', team_id: '2' },
      ],
      format: { name: '2v2 Scramble', scoring_type: 'scramble' },
      current_hole: 3,
      scores: {
        1: { '1': 4, '2': 5, '3': 3, '4': 4 },
        2: { '1': 3, '2': 4, '3': 4, '4': 3 },
      }
    }
  ],
  submitScores: async (matchId: string, holeNumber: number, scores: Record<string, number>) => {
    console.log('Submitting scores:', { matchId, holeNumber, scores });
    return { success: true };
  }
};

interface Match {
  id: string;
  match_number: number;
  holes: number;
  status: string;
  team1: { id: string; name: string; color: string };
  team2: { id: string; name: string; color: string };
  players: Array<{ id: string; name: string; team_id: string }>;
  format: { name: string; scoring_type: string };
  current_hole: number;
  scores: Record<number, Record<string, number>>;
}

const ScoreInterface: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const activeMatches = await mockAPI.getActiveMatches();
      setMatches(activeMatches);
      if (activeMatches.length > 0) {
        setSelectedMatch(activeMatches[0]);
        setCurrentHole(activeMatches[0].current_hole);
      }
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (playerId: string, score: number) => {
    setHoleScores(prev => ({
      ...prev,
      [playerId]: score
    }));
  };

  const submitHoleScores = async () => {
    if (!selectedMatch) return;

    setIsSubmitting(true);
    try {
      await mockAPI.submitScores(selectedMatch.id, currentHole, holeScores);
      
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
    } catch (error) {
      console.error('Error submitting scores:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTeamPlayers = (teamId: string) => {
    return selectedMatch?.players.filter(p => p.team_id === teamId) || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Loading matches...</span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Matches</h3>
        <p className="text-gray-500">There are no matches currently in progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Score Entry</h1>
            <p className="text-gray-500">Record scores for active matches</p>
          </div>
          <button
            onClick={loadMatches}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
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
                onClick={() => {
                  setSelectedMatch(match);
                  setCurrentHole(match.current_hole);
                  setHoleScores({});
                }}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedMatch?.id === match.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Match {match.match_number}</div>
                <div className="text-sm text-gray-500">{match.format.name}</div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm" style={{ color: match.team1.color }}>
                    {match.team1.name}
                  </span>
                  <span className="text-sm text-gray-400">vs</span>
                  <span className="text-sm" style={{ color: match.team2.color }}>
                    {match.team2.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score Entry */}
      {selectedMatch && (
        <div className="bg-white shadow-sm rounded-lg p-6">
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
                    <div className="font-medium text-gray-900">{player.name}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={holeScores[player.id] || ''}
                      onChange={(e) => handleScoreChange(player.id, parseInt(e.target.value) || 0)}
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
                    <div className="font-medium text-gray-900">{player.name}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={holeScores[player.id] || ''}
                      onChange={(e) => handleScoreChange(player.id, parseInt(e.target.value) || 0)}
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
              {Object.keys(holeScores).length > 0 && (
                <span className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {Object.keys(holeScores).length} of {selectedMatch.players.length} scores entered
                </span>
              )}
            </div>
            <button
              onClick={submitHoleScores}
              disabled={isSubmitting || Object.keys(holeScores).length === 0}
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
      )}
    </div>
  );
};

export default ScoreInterface;
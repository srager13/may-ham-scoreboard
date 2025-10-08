// ============================================
// Types & Interfaces
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface MatchFormat {
  id: string;
  name: string;
  scoring_type: string;
  players_per_side: number;
}

interface Match {
  id: string;
  match_number: number;
  holes: number;
  status: string;
  format: MatchFormat;
  team1: Team;
  team2: Team;
  team1_points: number;
  team2_points: number;
}

interface Player {
  user: User;
  team: Team;
  player_order: number;
}

interface HoleScore {
  user_id: string;
  strokes: number;
}

interface HoleResult {
  hole_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team_id: string | null;
  team1_points: number;
  team2_points: number;
  scores: Array<{ user_id: string; name: string; strokes: number }>;
}

// ============================================
// API Service
// ============================================

import axios from 'axios';

const API_BASE_URL = 'https://your-api.com/api/v1';

class GolfAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };
  }

  async getMatch(matchId: string) {
    const response = await axios.get(`${API_BASE_URL}/matches/${matchId}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async submitHoleScores(matchId: string, holeNumber: number, scores: HoleScore[]) {
    const response = await axios.post(
      `${API_BASE_URL}/matches/${matchId}/scores`,
      { hole_number: holeNumber, scores },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getMatchScores(matchId: string) {
    const response = await axios.get(`${API_BASE_URL}/matches/${matchId}/scores`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async updateHoleScore(matchId: string, holeNumber: number, scores: HoleScore[]) {
    const response = await axios.patch(
      `${API_BASE_URL}/matches/${matchId}/scores/${holeNumber}`,
      { scores },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const golfAPI = new GolfAPI();

// ============================================
// Score Input Component
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
} from 'react-native';

interface ScoreInputProps {
  player: Player;
  currentScore: number | null;
  onScoreChange: (userId: string, score: number) => void;
}

const ScoreInput: React.FC<ScoreInputProps> = ({ player, currentScore, onScoreChange }) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [tempScore, setTempScore] = useState(currentScore?.toString() || '');

  const handleNumberPress = (num: string) => {
    if (tempScore.length < 2) {
      setTempScore(tempScore + num);
    }
  };

  const handleBackspace = () => {
    setTempScore(tempScore.slice(0, -1));
  };

  const handleConfirm = () => {
    const score = parseInt(tempScore);
    if (score > 0 && score <= 15) {
      onScoreChange(player.user.id, score);
      setShowKeypad(false);
    }
  };

  return (
    <View style={[styles.scoreInputContainer, { borderColor: player.team.color }]}>
      <Text style={styles.playerName}>{player.user.name}</Text>
      <TouchableOpacity
        style={[styles.scoreButton, { backgroundColor: player.team.color }]}
        onPress={() => {
          setTempScore(currentScore?.toString() || '');
          setShowKeypad(true);
        }}
      >
        <Text style={styles.scoreButtonText}>
          {currentScore !== null ? currentScore : '-'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showKeypad}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKeypad(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.keypadContainer}>
            <View style={styles.keypadHeader}>
              <Text style={styles.keypadTitle}>{player.user.name}</Text>
              <Text style={styles.keypadScore}>{tempScore || '0'}</Text>
            </View>

            <View style={styles.keypadGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.keypadButton}
                  onPress={() => handleNumberPress(num.toString())}
                >
                  <Text style={styles.keypadButtonText}>{num}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.keypadButton}
                onPress={handleBackspace}
              >
                <Text style={styles.keypadButtonText}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadButton}
                onPress={() => handleNumberPress('0')}
              >
                <Text style={styles.keypadButtonText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keypadButton, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={[styles.keypadButtonText, styles.confirmButtonText]}>✓</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowKeypad(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================
// Hole Scoring Screen
// ============================================

interface HoleScoringScreenProps {
  match: Match;
  players: { team1: Player[]; team2: Player[] };
  currentHole: number;
  onSubmitScores: (scores: HoleScore[]) => Promise<void>;
}

const HoleScoringScreen: React.FC<HoleScoringScreenProps> = ({
  match,
  players,
  currentHole,
  onSubmitScores,
}) => {
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allPlayers = [...players.team1, ...players.team2];

  const handleScoreChange = (userId: string, score: number) => {
    setScores(new Map(scores.set(userId, score)));
  };

  const handleSubmit = async () => {
    if (scores.size !== allPlayers.length) {
      alert('Please enter scores for all players');
      return;
    }

    setIsSubmitting(true);
    try {
      const scoreArray = Array.from(scores.entries()).map(([user_id, strokes]) => ({
        user_id,
        strokes,
      }));
      await onSubmitScores(scoreArray);
      setScores(new Map()); // Clear for next hole
    } catch (error) {
      alert('Error submitting scores. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allScoresEntered = scores.size === allPlayers.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{match.format.name}</Text>
        <Text style={styles.holeNumber}>Hole {currentHole}</Text>
      </View>

      <View style={styles.matchScore}>
        <View style={[styles.teamScore, { borderColor: match.team1.color }]}>
          <Text style={styles.teamName}>{match.team1.name}</Text>
          <Text style={styles.teamPoints}>{match.team1_points}</Text>
        </View>
        <View style={styles.scoreDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={[styles.teamScore, { borderColor: match.team2.color }]}>
          <Text style={styles.teamName}>{match.team2.name}</Text>
          <Text style={styles.teamPoints}>{match.team2_points}</Text>
        </View>
      </View>

      <View style={styles.scoringSection}>
        <View style={styles.teamSection}>
          <Text style={[styles.teamSectionTitle, { color: match.team1.color }]}>
            {match.team1.name}
          </Text>
          {players.team1.map((player) => (
            <ScoreInput
              key={player.user.id}
              player={player}
              currentScore={scores.get(player.user.id) || null}
              onScoreChange={handleScoreChange}
            />
          ))}
        </View>

        <View style={styles.teamSection}>
          <Text style={[styles.teamSectionTitle, { color: match.team2.color }]}>
            {match.team2.name}
          </Text>
          {players.team2.map((player) => (
            <ScoreInput
              key={player.user.id}
              player={player}
              currentScore={scores.get(player.user.id) || null}
              onScoreChange={handleScoreChange}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!allScoresEntered || isSubmitting) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!allScoresEntered || isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Submit Hole Score'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================
// Scorecard View Component
// ============================================

interface ScorecardProps {
  match: Match;
  holeResults: HoleResult[];
  players: { team1: Player[]; team2: Player[] };
}

const Scorecard: React.FC<ScorecardProps> = ({ match, holeResults, players }) => {
  const allPlayers = [...players.team1, ...players.team2];
  const holes = Array.from({ length: match.holes }, (_, i) => i + 1);

  const getPlayerScore = (holeResult: HoleResult, userId: string) => {
    const score = holeResult.scores.find((s) => s.user_id === userId);
    return score ? score.strokes : null;
  };

  const getHoleWinner = (holeResult: HoleResult) => {
    if (!holeResult.winner_team_id) return 'tie';
    return holeResult.winner_team_id === match.team1.id ? 'team1' : 'team2';
  };

  return (
    <View style={styles.scorecardContainer}>
      <Text style={styles.scorecardTitle}>Scorecard</Text>
      
      <View style={styles.scorecardTable}>
        {/* Header Row */}
        <View style={styles.scorecardRow}>
          <View style={styles.scorecardNameCell}>
            <Text style={styles.scorecardHeaderText}>Player</Text>
          </View>
          {holes.map((hole) => (
            <View key={hole} style={styles.scorecardHoleCell}>
              <Text style={styles.scorecardHeaderText}>{hole}</Text>
            </View>
          ))}
          <View style={styles.scorecardTotalCell}>
            <Text style={styles.scorecardHeaderText}>Pts</Text>
          </View>
        </View>

        {/* Team 1 Players */}
        {players.team1.map((player) => (
          <View key={player.user.id} style={styles.scorecardRow}>
            <View style={[styles.scorecardNameCell, { borderLeftColor: match.team1.color }]}>
              <Text style={styles.playerNameText}>{player.user.name}</Text>
            </View>
            {holes.map((hole) => {
              const result = holeResults.find((r) => r.hole_number === hole);
              const score = result ? getPlayerScore(result, player.user.id) : null;
              const winner = result ? getHoleWinner(result) : null;
              return (
                <View
                  key={hole}
                  style={[
                    styles.scorecardScoreCell,
                    winner === 'team1' && styles.winningHole,
                  ]}
                >
                  <Text style={styles.scorecardScoreText}>{score ?? '-'}</Text>
                </View>
              );
            })}
            <View style={styles.scorecardTotalCell}>
              <Text style={styles.scorecardTotalText}>{match.team1_points}</Text>
            </View>
          </View>
        ))}

        {/* Team 2 Players */}
        {players.team2.map((player) => (
          <View key={player.user.id} style={styles.scorecardRow}>
            <View style={[styles.scorecardNameCell, { borderLeftColor: match.team2.color }]}>
              <Text style={styles.playerNameText}>{player.user.name}</Text>
            </View>
            {holes.map((hole) => {
              const result = holeResults.find((r) => r.hole_number === hole);
              const score = result ? getPlayerScore(result, player.user.id) : null;
              const winner = result ? getHoleWinner(result) : null;
              return (
                <View
                  key={hole}
                  style={[
                    styles.scorecardScoreCell,
                    winner === 'team2' && styles.winningHole,
                  ]}
                >
                  <Text style={styles.scorecardScoreText}>{score ?? '-'}</Text>
                </View>
              );
            })}
            <View style={styles.scorecardTotalCell}>
              <Text style={styles.scorecardTotalText}>{match.team2_points}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// ============================================
// Main Match Screen Container
// ============================================

interface MatchScreenProps {
  matchId: string;
}

const MatchScreen: React.FC<MatchScreenProps> = ({ matchId }) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<{ team1: Player[]; team2: Player[] } | null>(null);
  const [holeResults, setHoleResults] = useState<HoleResult[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showScorecard, setShowScorecard] = useState(false);

  React.useEffect(() => {
    loadMatchData();
  }, [matchId]);

  const loadMatchData = async () => {
    try {
      const data = await golfAPI.getMatch(matchId);
      setMatch(data.match);
      setPlayers(data.players);
      
      const scoresData = await golfAPI.getMatchScores(matchId);
      setHoleResults(scoresData.hole_scores);
      
      // Calculate next hole to play
      const completedHoles = scoresData.hole_scores.length;
      setCurrentHole(completedHoles + 1);
    } catch (error) {
      console.error('Error loading match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitScores = async (scores: HoleScore[]) => {
    const result = await golfAPI.submitHoleScores(matchId, currentHole, scores);
    
    // Update local state with result
    setHoleResults([...holeResults, result.hole_result]);
    setMatch((prev) => prev ? {
      ...prev,
      team1_points: result.match_status.team1_total_points,
      team2_points: result.match_status.team2_total_points,
    } : null);
    
    // Move to next hole if not finished
    if (currentHole < (match?.holes || 18)) {
      setCurrentHole(currentHole + 1);
    } else {
      setShowScorecard(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading match...</Text>
      </View>
    );
  }

  if (!match || !players) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Error loading match</Text>
      </View>
    );
  }

  if (showScorecard || currentHole > match.holes) {
    return <Scorecard match={match} holeResults={holeResults} players={players} />;
  }

  return (
    <HoleScoringScreen
      match={match}
      players={players}
      currentHole={currentHole}
      onSubmitScores={handleSubmitScores}
    />
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1a472a',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  holeNumber: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  matchScore: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 4,
    paddingLeft: 10,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  teamPoints: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreDivider: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  scoringSection: {
    flex: 1,
    padding: 20,
  },
  teamSection: {
    marginBottom: 30,
  },
  teamSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  scoreInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  scoreButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keypadContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  keypadHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  keypadTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  keypadScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1a472a',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 10,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#1a472a',
  },
  confirmButtonText: {
    color: 'white',
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#1a472a',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scorecardContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  scorecardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  scorecardTable: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scorecardRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scorecardNameCell: {
    width: 100,
    padding: 10,
    justifyContent: 'center',
    borderLeftWidth: 4,
  },
  scorecardHoleCell: {
    width: 40,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  scorecardScoreCell: {
    width: 40,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  scorecardTotalCell: {
    width: 50,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  scorecardHeaderText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  playerNameText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scorecardScoreText: {
    fontSize: 14,
  },
  scorecardTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  winningHole: {
    backgroundColor: '#e8f5e9',
  },
});

export default MatchScreen;

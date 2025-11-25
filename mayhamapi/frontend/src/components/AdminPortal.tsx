import React, { useState, useEffect } from 'react';
import { Calendar, Users, Trophy, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { apiClient, ApiError, User, MatchFormat, Tournament, Team, Round, CreateTournamentRequest } from '../services/api';

interface TeamData {
  id?: string;
  name: string;
  color: string;
  players: User[];
}

interface RoundData {
  id?: string;
  name: string;
  round_number: number;
  date: string;
  matches: MatchData[];
}

interface MatchData {
  id?: string;
  match_number: number;
  format_id: string;
  holes: number;
  team1_players: number[];
  team2_players: number[];
}

const AdminPortal = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [tournament, setTournament] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });
  
  const [teams, setTeams] = useState<TeamData[]>([
    { name: 'Team USA', color: '#DC2626', players: [] },
    { name: 'Team Europe', color: '#2563EB', players: [] }
  ]);
  
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [matchFormats, setMatchFormats] = useState<MatchFormat[]>([]);
  const [createdTournament, setCreatedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load users and match formats from API
      console.log('Loading initial data...');
      
      try {
        const users = await apiClient.getUsers();
        console.log('Users loaded:', users);
        setAvailableUsers(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error('Error loading users:', err);
        setAvailableUsers([]);
      }
      
      try {
        const formats = await apiClient.getMatchFormats();
        console.log('Match formats loaded:', formats);
        setMatchFormats(Array.isArray(formats) ? formats : []);
      } catch (err) {
        console.error('Error loading match formats:', err);
        setMatchFormats([]);
      }
      
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load initial data');
      // Set safe defaults on error
      setAvailableUsers([]);
      setMatchFormats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Create tournament
      const tournamentData: CreateTournamentRequest = {
        name: tournament.name,
        description: tournament.description || undefined,
        start_date: tournament.start_date,
        end_date: tournament.end_date,
      };

      const newTournament = await apiClient.createTournament(tournamentData);
      setCreatedTournament(newTournament);

      // Step 2: Create teams
      const createdTeams = [];
      for (const team of teams) {
        const newTeam = await apiClient.createTeam(newTournament.id, {
          name: team.name,
          color: team.color,
        });
        createdTeams.push(newTeam);

        // Add team members
        for (const player of team.players) {
          await apiClient.addTeamMember(newTeam.id, player.id);
        }
      }

      // Step 3: Create rounds
      const createdRounds = [];
      for (const round of rounds) {
        const newRound = await apiClient.createRound(newTournament.id, {
          name: round.name,
          round_number: round.round_number,
          start_time: round.date,
        });
        createdRounds.push(newRound);

        // Create matches for this round
        for (const match of round.matches) {
          // Convert player indices to player IDs
          const team1PlayerIds = match.team1_players
            .filter(playerIdx => playerIdx !== undefined)
            .map(playerIdx => teams[0].players[playerIdx]?.id)
            .filter(id => id !== undefined);
          
          const team2PlayerIds = match.team2_players
            .filter(playerIdx => playerIdx !== undefined)
            .map(playerIdx => teams[1].players[playerIdx]?.id)
            .filter(id => id !== undefined);

          await apiClient.createMatch(newRound.id, {
            match_format_id: match.format_id,
            match_number: match.match_number,
            holes: match.holes,
            team1_id: createdTeams[0].id,
            team2_id: createdTeams[1].id,
            player_assignments: {
              team1_players: team1PlayerIds,
              team2_players: team2PlayerIds,
            },
          });
        }
      }

      alert('Tournament created successfully!');
      // Reset form or redirect
      setStep(1);
      
    } catch (err) {
      console.error('Error creating tournament:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-800 text-white p-6">
        <h1 className="text-3xl font-bold">Tournament Setup</h1>
        <p className="text-green-100 mt-2">Create and configure your Ryder Cup style tournament</p>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Loading Display */}
        {loading && (
          <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
            Creating tournament... Please wait.
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {s}
                  </div>
                  <span className="ml-2 font-medium">
                    {s === 1 && 'Tournament Info'}
                    {s === 2 && 'Teams & Players'}
                    {s === 3 && 'Rounds & Matches'}
                    {s === 4 && 'Review'}
                  </span>
                </div>
                {s < 4 && <div className={`flex-1 h-1 mx-4 ${step > s ? 'bg-green-600' : 'bg-gray-300'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <TournamentInfoStep tournament={tournament} setTournament={setTournament} />
        )}
        {step === 2 && (
          <TeamsStep teams={teams} setTeams={setTeams} availableUsers={availableUsers} />
        )}
        {step === 3 && (
          <RoundsStep 
            rounds={rounds} 
            setRounds={setRounds} 
            teams={teams}
            matchFormats={matchFormats}
            loading={loading}
          />
        )}
        {step === 4 && (
          <ReviewStep tournament={tournament} teams={teams} rounds={rounds} />
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Tournament
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 1: Tournament Info
const TournamentInfoStep = ({ tournament, setTournament }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Calendar className="mr-2" />
        Tournament Information
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Tournament Name *</label>
          <input
            type="text"
            value={tournament.name}
            onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
            className="w-full p-3 border rounded-lg"
            placeholder="Summer Ryder Cup 2025"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={tournament.description}
            onChange={(e) => setTournament({ ...tournament, description: e.target.value })}
            className="w-full p-3 border rounded-lg"
            rows={3}
            placeholder="Annual summer golf tournament..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date *</label>
            <input
              type="date"
              value={tournament.start_date}
              onChange={(e) => setTournament({ ...tournament, start_date: e.target.value })}
              className="w-full p-3 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">End Date *</label>
            <input
              type="date"
              value={tournament.end_date}
              onChange={(e) => setTournament({ ...tournament, end_date: e.target.value })}
              className="w-full p-3 border rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 2: Teams & Players
const TeamsStep = ({ teams, setTeams, availableUsers }) => {
  const [selectedTeam, setSelectedTeam] = useState(0);

  const addPlayerToTeam = (teamIdx, player) => {
    const newTeams = [...teams];
    if (!newTeams[teamIdx].players.find(p => p.id === player.id)) {
      newTeams[teamIdx].players.push(player);
      setTeams(newTeams);
    }
  };

  const removePlayerFromTeam = (teamIdx, playerId) => {
    const newTeams = [...teams];
    newTeams[teamIdx].players = newTeams[teamIdx].players.filter(p => p.id !== playerId);
    setTeams(newTeams);
  };

  const updateTeam = (teamIdx, field, value) => {
    const newTeams = [...teams];
    newTeams[teamIdx][field] = value;
    setTeams(newTeams);
  };

  const assignedPlayerIds = teams.flatMap(t => t.players.map(p => p.id));
  const unassignedUsers = availableUsers.filter(u => !assignedPlayerIds.includes(u.id));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Users className="mr-2" />
        Teams & Players
      </h2>

      <div className="grid grid-cols-3 gap-6">
        {/* Team Configuration */}
        <div className="col-span-2 space-y-4">
          {teams.map((team, idx) => (
            <div key={idx} className="border rounded-lg p-4" style={{ borderLeftWidth: '4px', borderLeftColor: team.color }}>
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => updateTeam(idx, 'name', e.target.value)}
                  className="text-xl font-bold border-b-2 border-transparent hover:border-gray-300 px-2 py-1"
                />
                <input
                  type="color"
                  value={team.color}
                  onChange={(e) => updateTeam(idx, 'color', e.target.value)}
                  className="w-12 h-12 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                {team.players.length === 0 ? (
                  <p className="text-gray-500 italic">No players assigned</p>
                ) : (
                  team.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div>
                        <span className="font-medium">{player.name}</span>
                        <span className="text-sm text-gray-500 ml-2">HCP: {player.handicap}</span>
                      </div>
                      <button
                        onClick={() => removePlayerFromTeam(idx, player.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Available Players */}
        <div className="border rounded-lg p-4">
          <h3 className="font-bold mb-4">Available Players</h3>
          <div className="space-y-2">
            {unassignedUsers.map((user) => (
              <div key={user.id} className="bg-gray-50 p-3 rounded">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-gray-500 mb-2">HCP: {user.handicap}</div>
                <div className="flex gap-2">
                  {teams.map((team, idx) => (
                    <button
                      key={idx}
                      onClick={() => addPlayerToTeam(idx, user)}
                      className="flex-1 text-xs py-1 rounded text-white"
                      style={{ backgroundColor: team.color }}
                    >
                      Add to {team.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 3: Rounds & Matches
const RoundsStep = ({ rounds, setRounds, teams, matchFormats, loading }) => {
  // Show loading message if data is still being fetched
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Trophy className="mr-2" />
          Rounds & Matches
        </h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading match formats...</p>
        </div>
      </div>
    );
  }

  // Ensure matchFormats is an array
  const safeMatchFormats = Array.isArray(matchFormats) ? matchFormats : [];

  // Show warning if no match formats are available
  if (safeMatchFormats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Trophy className="mr-2" />
          Rounds & Matches
        </h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <p>No match formats available. Please ensure your API is running and try refreshing the page.</p>
        </div>
      </div>
    );
  }
  const addRound = () => {
    setRounds([...rounds, {
      name: `Round ${rounds.length + 1}`,
      round_number: rounds.length + 1,
      date: '',
      matches: []
    }]);
  };

  const updateRound = (idx, field, value) => {
    const newRounds = [...rounds];
    newRounds[idx][field] = value;
    setRounds(newRounds);
  };

  const deleteRound = (idx) => {
    setRounds(rounds.filter((_, i) => i !== idx));
  };

  const addMatch = (roundIdx) => {
    const newRounds = [...rounds];
    const safeMatchFormats = Array.isArray(matchFormats) ? matchFormats : [];
    newRounds[roundIdx].matches.push({
      match_number: newRounds[roundIdx].matches.length + 1,
      format_id: safeMatchFormats.length > 0 ? safeMatchFormats[0].id : '',
      holes: 6,
      team1_players: [],
      team2_players: []
    });
    setRounds(newRounds);
  };

  const updateMatch = (roundIdx, matchIdx, field, value) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].matches[matchIdx][field] = value;
    setRounds(newRounds);
  };

  const deleteMatch = (roundIdx, matchIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].matches = newRounds[roundIdx].matches.filter((_, i) => i !== matchIdx);
    setRounds(newRounds);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Trophy className="mr-2" />
          Rounds & Matches
        </h2>
        <button
          onClick={addRound}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus size={20} className="mr-2" />
          Add Round
        </button>
      </div>

      <div className="space-y-6">
        {rounds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Trophy size={48} className="mx-auto mb-4 opacity-50" />
            <p>No rounds created yet. Click "Add Round" to get started.</p>
          </div>
        ) : (
          rounds.map((round, roundIdx) => (
            <RoundConfig
              key={roundIdx}
              round={round}
              roundIdx={roundIdx}
              teams={teams}
              matchFormats={matchFormats}
              updateRound={updateRound}
              deleteRound={deleteRound}
              addMatch={addMatch}
              updateMatch={updateMatch}
              deleteMatch={deleteMatch}
            />
          ))
        )}
      </div>
    </div>
  );
};

const RoundConfig = ({
  round,
  roundIdx,
  teams,
  matchFormats,
  updateRound,
  deleteRound,
  addMatch,
  updateMatch,
  deleteMatch
}) => {
  return (
    <div className="border-2 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            value={round.name}
            onChange={(e) => updateRound(roundIdx, 'name', e.target.value)}
            className="text-lg font-bold border-b-2 px-2 py-1"
            placeholder="Round name"
          />
          <input
            type="date"
            value={round.date}
            onChange={(e) => updateRound(roundIdx, 'date', e.target.value)}
            className="border rounded px-3 py-1"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addMatch(roundIdx)}
            className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={16} className="mr-1" />
            Add Match
          </button>
          <button
            onClick={() => deleteRound(roundIdx)}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-3 ml-4">
        {round.matches.map((match, matchIdx) => (
          <MatchConfig
            key={matchIdx}
            match={match}
            matchIdx={matchIdx}
            roundIdx={roundIdx}
            teams={teams}
            matchFormats={matchFormats}
            updateMatch={updateMatch}
            deleteMatch={deleteMatch}
          />
        ))}
      </div>
    </div>
  );
};

const MatchConfig = ({
  match,
  matchIdx,
  roundIdx,
  teams,
  matchFormats,
  updateMatch,
  deleteMatch
}) => {
  // Ensure matchFormats is always an array
  const safeMatchFormats = Array.isArray(matchFormats) ? matchFormats : [];
  const selectedFormat = safeMatchFormats.find(f => f.id === match.format_id);
  const playersNeeded = selectedFormat?.players_per_side || 1;

  return (
    <div className="bg-gray-50 rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">Match {matchIdx + 1}</span>
        <button
          onClick={() => deleteMatch(roundIdx, matchIdx)}
          className="text-red-600 hover:text-red-800"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Format</label>
          <select
            value={match.format_id}
            onChange={(e) => updateMatch(roundIdx, matchIdx, 'format_id', e.target.value)}
            className="w-full p-2 border rounded"
            disabled={safeMatchFormats.length === 0}
          >
            <option value="">
              {safeMatchFormats.length === 0 ? 'No formats available' : 'Select format...'}
            </option>
            {safeMatchFormats.map(format => (
              <option key={format.id} value={format.id}>{format.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Holes</label>
          <select
            value={match.holes}
            onChange={(e) => updateMatch(roundIdx, matchIdx, 'holes', parseInt(e.target.value))}
            className="w-full p-2 border rounded"
          >
            <option value={6}>6 holes</option>
            <option value={9}>9 holes</option>
            <option value={18}>18 holes</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3">
        {teams.map((team, teamIdx) => (
          <div key={teamIdx}>
            <label className="block text-sm font-medium mb-1" style={{ color: team.color }}>
              {team.name} Players
            </label>
            <div className="space-y-2">
              {Array.from({ length: playersNeeded }).map((_, playerSlot) => (
                <select
                  key={playerSlot}
                  value={teamIdx === 0 ? (match.team1_players[playerSlot] !== undefined ? match.team1_players[playerSlot].toString() : '') : (match.team2_players[playerSlot] !== undefined ? match.team2_players[playerSlot].toString() : '')}
                  onChange={(e) => {
                    const newPlayers = [...(teamIdx === 0 ? match.team1_players : match.team2_players)];
                    if (e.target.value === '') {
                      newPlayers[playerSlot] = undefined;
                    } else {
                      newPlayers[playerSlot] = parseInt(e.target.value);
                    }
                    updateMatch(roundIdx, matchIdx, teamIdx === 0 ? 'team1_players' : 'team2_players', newPlayers);
                  }}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">Select player...</option>
                  {team.players.map((player, pIdx) => (
                    <option key={player.id} value={pIdx.toString()}>
                      {player.name} (HCP: {player.handicap})
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 4: Review
const ReviewStep = ({ tournament, teams, rounds }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Review Tournament Setup</h2>

      <div className="space-y-6">
        {/* Tournament Info */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-bold mb-3">Tournament Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Name:</span> {tournament.name}
            </div>
            <div>
              <span className="font-medium">Dates:</span> {tournament.start_date} to {tournament.end_date}
            </div>
            {tournament.description && (
              <div className="col-span-2">
                <span className="font-medium">Description:</span> {tournament.description}
              </div>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-bold mb-3">Teams</h3>
          <div className="grid grid-cols-2 gap-4">
            {teams.map((team, idx) => (
              <div key={idx} className="border rounded p-3" style={{ borderLeftWidth: '4px', borderLeftColor: team.color }}>
                <h4 className="font-bold mb-2">{team.name}</h4>
                <ul className="text-sm space-y-1">
                  {team.players.map(player => (
                    <li key={player.id}>{player.name} (HCP: {player.handicap})</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Rounds Summary */}
        <div>
          <h3 className="text-lg font-bold mb-3">Rounds & Matches</h3>
          <div className="space-y-3">
            {rounds.map((round, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold">{round.name}</h4>
                  <span className="text-sm text-gray-600">{round.date}</span>
                </div>
                <div className="text-sm text-gray-700">
                  {round.matches.length} match{round.matches.length !== 1 ? 'es' : ''} configured
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
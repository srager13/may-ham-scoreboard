import React, { useState, useEffect } from 'react';
import { Calendar, Users, Trophy, Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
import { apiClient, ApiError, User, MatchFormat, Tournament, Team, Round, CreateTournamentRequest, Group, GolfCourse, GolfCourseTee, Pairing, CreatePairingRequest, PairingPlayerRequest, PairingMatchRequest } from '../services/api';

interface TeamData {
  id?: string;
  name: string;
  color: string;
  players: User[];
}

interface PairingData {
  id?: string;
  pairing_number: number;
  tee_time?: string;
  golf_course_tee_id?: string;
  players: PairingPlayerData[];
  matches: MatchData[];
  collapsed?: boolean;
}

interface PairingPlayerData {
  user_id: string;
  team_id: string;
  player_order: number;
  user?: User;
  team?: Team;
}

interface RoundData {
  id?: string;
  name: string;
  round_number: number;
  date: string;
  golf_course_id?: string;
  pairings: PairingData[];
  collapsed?: boolean;
}

interface MatchData {
  id?: string;
  match_number: number;
  format_id: string;
  holes: number;
  start_hole?: number;  // First hole of match (1-18)
  end_hole?: number;    // Last hole of match (1-18)
  points_available?: number;
  team1_players: number[];
  team2_players: number[];
  collapsed?: boolean;
}

const TournamentSetup = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [existingTournaments, setExistingTournaments] = useState<Tournament[]>([]);
  
  const [tournament, setTournament] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    group_id: '',
    scoring_method: 'gross', // Default to gross scoring
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Default to browser timezone
  });
  
  const [teams, setTeams] = useState<TeamData[]>([
    { name: 'Team USA', color: '#DC2626', players: [] },
    { name: 'Team Europe', color: '#2563EB', players: [] }
  ]);
  
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [matchFormats, setMatchFormats] = useState<MatchFormat[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<User[]>([]);
  const [createdTournament, setCreatedTournament] = useState<Tournament | null>(null);
  const [golfCourses, setGolfCourses] = useState<GolfCourse[]>([]);
  const [availableTees, setAvailableTees] = useState<{ [courseId: string]: GolfCourseTee[] }>({});


  useEffect(() => {
    loadInitialData();
  }, []);

  // Check for draft data after users are loaded
  useEffect(() => {
    if (availableUsers.length > 0) {
      checkForDraftData();
    }
  }, [availableUsers]);

  // Save tournament data to localStorage
  const saveDraft = () => {
    const draftData = {
      tournament,
      teams,
      rounds,
      step,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('tournament_draft', JSON.stringify(draftData));
    setLastSaved(new Date());
  };

  // Load tournament data from localStorage
  const loadDraft = () => {
    const draftData = localStorage.getItem('tournament_draft');
    if (draftData) {
      try {
        const parsed = JSON.parse(draftData);
        setTournament(parsed.tournament || tournament);
        
        // When loading teams, we need to ensure player objects are properly reconstructed
        // by matching them with the current availableUsers
        if (parsed.teams && availableUsers.length > 0) {
          const reconstructedTeams = parsed.teams.map(team => ({
            ...team,
            players: (team.players || []).map(savedPlayer => {
              // Find the full user object from availableUsers by ID
              const fullUser = availableUsers.find(user => user.id === savedPlayer.id);
              return fullUser || savedPlayer; // Fallback to saved player if not found
            }).filter(player => player.id && player.id !== 'user-id-placeholder') // Filter out invalid players
          }));
          setTeams(reconstructedTeams);
        } else {
          setTeams(parsed.teams || teams);
        }
        
        setRounds(parsed.rounds || rounds);
        setStep(parsed.step || 1);
        setShowDraftDialog(false);
      } catch (err) {
        console.error('Failed to load draft data:', err);
      }
    }
  };

  // Clear saved draft
  const clearDraft = () => {
    localStorage.removeItem('tournament_draft');
    setShowDraftDialog(false);
  };

  // Check if there's existing draft data
  const checkForDraftData = () => {
    const draftData = localStorage.getItem('tournament_draft');
    if (draftData) {
      try {
        const parsed = JSON.parse(draftData);
        // Only show dialog if there's meaningful data
        if (parsed.tournament?.name || parsed.teams?.some(t => t.players?.length > 0) || parsed.rounds?.length > 0) {
          setShowDraftDialog(true);
        }
      } catch (err) {
        console.error('Failed to parse draft data:', err);
        localStorage.removeItem('tournament_draft');
      }
    }
  };

  // Auto-save when important data changes
  useEffect(() => {
    if (tournament.name || teams.some(t => t.players.length > 0) || rounds.length > 0) {
      const timeoutId = setTimeout(saveDraft, 1000); // Debounce saves
      return () => clearTimeout(timeoutId);
    }
  }, [tournament, teams, rounds, step]);

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
      
      try {
        const groups = await apiClient.getUserGroups();
        console.log('Groups loaded:', groups);
        setUserGroups(Array.isArray(groups) ? groups : []);
      } catch (err) {
        console.error('Error loading groups:', err);
        setUserGroups([]);
      }

      // Load existing tournaments (only tournaments the user is part of)
      try {
        const tournaments = await apiClient.getUserTournaments();
        console.log('User tournaments loaded:', tournaments);
        setExistingTournaments(Array.isArray(tournaments) ? tournaments : []);
      } catch (err) {
        console.error('Error loading user tournaments:', err);
        setExistingTournaments([]);
      }

      // Load golf courses
      try {
        const courses = await apiClient.getStoredGolfCourses();
        console.log('Golf courses loaded:', courses);
        setGolfCourses(Array.isArray(courses) ? courses : []);
      } catch (err) {
        console.error('Error loading golf courses:', err);
        setGolfCourses([]);
      }
      
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load initial data');
      // Set safe defaults on error
      setAvailableUsers([]);
      setMatchFormats([]);
      setUserGroups([]);
      setExistingTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTournament = async (tournamentId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load tournament details
      const tournamentData = await apiClient.getTournament(tournamentId);
      setTournament({
        name: tournamentData.name,
        description: tournamentData.description || '',
        start_date: tournamentData.start_date.split('T')[0],
        end_date: tournamentData.end_date.split('T')[0],
        group_id: tournamentData.group_id || '',
        scoring_method: tournamentData.scoring_method || 'gross',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (tournamentData.group_id) {
        await loadGroupUsers(tournamentData.group_id);
      }

      // Ensure golf courses are loaded
      if (golfCourses.length === 0) {
        try {
          const courses = await apiClient.getStoredGolfCourses();
          setGolfCourses(Array.isArray(courses) ? courses : []);
        } catch (err) {
          console.error('Error loading golf courses:', err);
        }
      }

      // Load teams
      const teamsData = await apiClient.getTournamentTeams(tournamentId);
      const loadedTeams: TeamData[] = [];
      
      // First, load all users if not already loaded
      const allUsers = availableUsers.length > 0 ? availableUsers : await apiClient.getUsers();
      if (availableUsers.length === 0) {
        setAvailableUsers(allUsers);
      }
      
      for (const team of teamsData) {
        const membersData = await apiClient.getTeamMembers(team.id);
        // Map user_id to actual User objects from availableUsers
        const players = membersData
          .map(member => allUsers.find(user => user.id === member.user_id))
          .filter((user): user is User => user !== undefined && user !== null);
        
        loadedTeams.push({
          id: team.id,
          name: team.name,
          color: team.color || '#000000',
          players
        });
      }
      setTeams(loadedTeams);

      // Load rounds and pairings
      const roundsData = await apiClient.getTournamentRounds(tournamentId);
      const loadedRounds: RoundData[] = [];
      const teesCache: { [courseId: string]: GolfCourseTee[] } = {};

      for (const round of roundsData) {
        // Load tees for this course if not already loaded
        if (round.golf_course_id && !teesCache[round.golf_course_id]) {
          try {
            const tees = await apiClient.getGolfCourseTees(round.golf_course_id);
            teesCache[round.golf_course_id] = tees;
          } catch (err) {
            console.error('Failed to load tees for course:', err);
            teesCache[round.golf_course_id] = [];
          }
        }

        const pairingsData = await apiClient.getRoundPairings(round.id);
        const loadedPairings: PairingData[] = [];

        for (const pairing of pairingsData) {
          const playersData = await apiClient.getPairingPlayers(pairing.id);
          const matchesData = await apiClient.getPairingMatches(pairing.id);

          const loadedPairingPlayers: PairingPlayerData[] = playersData.map(p => ({
            user_id: p.user_id,
            team_id: p.team_id,
            player_order: p.player_order,
            user: p.user,
            team: p.team
          }));

          const loadedMatches: MatchData[] = matchesData.map(match => ({
            id: match.id,
            match_number: match.match_number,
            format_id: match.match_format_id,
            holes: match.holes,
            team1_players: [],
            team2_players: []
          }));

          // Convert UTC tee_time to local HH:MM format for the time input
          let localTeeTime = '';
          if (pairing.tee_time) {
            const date = new Date(pairing.tee_time);
            localTeeTime = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          }

          loadedPairings.push({
            id: pairing.id,
            pairing_number: pairing.pairing_number,
            tee_time: localTeeTime,
            golf_course_tee_id: pairing.golf_course_tee_id,
            players: loadedPairingPlayers,
            matches: loadedMatches
          });
        }

        loadedRounds.push({
          id: round.id,
          name: round.name,
          round_number: round.round_number,
          date: round.round_date.split('T')[0],
          golf_course_id: round.golf_course_id || undefined, // Convert null to undefined
          pairings: loadedPairings
        });
      }
      setRounds(loadedRounds);
      setAvailableTees(teesCache);

      setEditMode(true);
      setSelectedTournamentId(tournamentId);
      setStep(1);

    } catch (err) {
      console.error('Error loading tournament:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const createNewTournament = () => {
    setEditMode(false);
    setSelectedTournamentId('');
    setTournament({ 
      name: '', 
      description: '', 
      start_date: '', 
      end_date: '', 
      group_id: '',
      scoring_method: 'gross',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
    });
    setTeams([
      { name: 'Team USA', color: '#DC2626', players: [] },
      { name: 'Team Europe', color: '#2563EB', players: [] }
    ]);
    setRounds([]);
    setStep(1);
    clearDraft();
  };

  const loadGroupUsers = async (groupId: string) => {
    if (!groupId) {
      setSelectedGroupUsers([]);
      return;
    }
    
    try {
      const groupUsers = await apiClient.getGroupUsers(groupId);
      setSelectedGroupUsers(Array.isArray(groupUsers) ? groupUsers : []);
    } catch (err) {
      console.error('Error loading group users:', err);
      setSelectedGroupUsers([]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate that all pairings have players assigned
      const invalidPairings: string[] = [];
      rounds.forEach((round, rIdx) => {
        round.pairings?.forEach((pairing, pIdx) => {
          const validPlayers = (pairing.players || []).filter(p => p.user_id && p.team_id);
          if (validPlayers.length === 0) {
            invalidPairings.push(`${round.name} - Pairing ${pairing.pairing_number}`);
          }
        });
      });

      if (invalidPairings.length > 0) {
        const message = `The following pairings have no players assigned:\n\n${invalidPairings.join('\n')}\n\nPlease assign players to all pairings or delete empty pairings before submitting.`;
        setError(message);
        setLoading(false);
        return;
      }

      if (editMode && selectedTournamentId) {
        // EDIT MODE: Update existing tournament
        // For simplicity, we'll delete all existing rounds/matches and recreate them
        // This ensures consistency and avoids complex diffing logic
        
        // Step 1: Delete all existing rounds (cascades to matches)
        const existingRounds = await apiClient.getTournamentRounds(selectedTournamentId);
        for (const round of existingRounds) {
          await apiClient.deleteRound(round.id);
        }

        // Step 2: Delete all existing teams (cascades to team members)
        const existingTeams = await apiClient.getTournamentTeams(selectedTournamentId);
        for (const team of existingTeams) {
          await apiClient.deleteTeam(team.id);
        }

        // Step 3: Recreate teams with new data and create mapping from old to new team IDs
        const teamIdMapping: { [oldTeamId: string]: string } = {}; // Map old team ID to new team ID
        const createdTeams = [];
        for (const team of teams) {
          const newTeam = await apiClient.createTeam(selectedTournamentId, {
            name: team.name,
            color: team.color,
          });
          createdTeams.push(newTeam);

          // Map old team ID to new team ID for pairing player updates
          if (team.id) {
            teamIdMapping[team.id] = newTeam.id;
          }

          // Add team members
          for (const player of team.players) {
            if (!player.id) {
              console.warn('Skipping player with no ID:', player);
              continue;
            }
            try {
              await apiClient.addTeamMember(newTeam.id, player.id);
            } catch (memberError) {
              console.error(`Failed to add player ${player.name} (${player.id}) to team:`, memberError);
            }
          }
        }

        // Step 4: Recreate rounds and pairings
        for (const round of rounds) {
          const newRound = await apiClient.createRound(selectedTournamentId, {
            name: round.name,
            round_number: round.round_number,
            round_date: round.date,
            golf_course_id: round.golf_course_id,
          });

          // Create pairings for this round
          for (const pairing of round.pairings || []) {
            const pairingPlayers: PairingPlayerRequest[] = (pairing.players || [])
              .filter(p => p.user_id && p.team_id) // Filter out invalid players
              .map(p => ({
                user_id: p.user_id,
                team_id: teamIdMapping[p.team_id] || p.team_id, // Use mapped new team ID or fall back to original
                player_order: p.player_order
              }));

            const pairingMatches: PairingMatchRequest[] = (pairing.matches || []).map(match => {
              // Collect user IDs for this match from team1_players and team2_players indices
              // Note: team1_players/team2_players contain indices into teams[].players, not pairing.players
              const playerUserIds: string[] = [];
              if (match.team1_players && Array.isArray(match.team1_players)) {
                match.team1_players.forEach(teamPlayerIdx => {
                  // teamPlayerIdx is an index into teams[0].players
                  if (teams[0] && teams[0].players[teamPlayerIdx]) {
                    playerUserIds.push(teams[0].players[teamPlayerIdx].id);
                  }
                });
              }
              if (match.team2_players && Array.isArray(match.team2_players)) {
                match.team2_players.forEach(teamPlayerIdx => {
                  // teamPlayerIdx is an index into teams[1].players
                  if (teams[1] && teams[1].players[teamPlayerIdx]) {
                    playerUserIds.push(teams[1].players[teamPlayerIdx].id);
                  }
                });
              }

              return {
                team1_id: createdTeams[0].id,
                team2_id: createdTeams[1].id,
                match_format_id: match.format_id,
                holes: match.holes,
                start_hole: match.start_hole,
                end_hole: match.end_hole,
                points_available: match.points_available,
                player_user_ids: playerUserIds.length > 0 ? playerUserIds : undefined
              };
            });

            // Convert tee_time (HH:MM) to full RFC3339 timestamp in UTC
            let fullTeeTime: string | undefined;
            if (pairing.tee_time) {
              // Create date in the tournament's timezone, then convert to UTC
              const localDateTime = new Date(`${round.date}T${pairing.tee_time}:00`);
              fullTeeTime = localDateTime.toISOString();
            }

            await apiClient.createPairing(newRound.id, {
              pairing_number: pairing.pairing_number,
              tee_time: fullTeeTime,
              golf_course_tee_id: pairing.golf_course_tee_id || undefined, // Convert empty string to undefined
              players: pairingPlayers,
              matches: pairingMatches
            });
          }
        }

        alert('Tournament updated successfully!');
        localStorage.removeItem('tournament_draft');
        
      } else {
        // CREATE MODE: Create new tournament
        const tournamentData: CreateTournamentRequest = {
          name: tournament.name,
          description: tournament.description || undefined,
          start_date: tournament.start_date + 'T00:00:00Z',
          end_date: tournament.end_date + 'T23:59:59Z',
          group_id: tournament.group_id || undefined,
          scoring_method: tournament.scoring_method || 'gross',
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
            if (!player.id) {
              console.warn('Skipping player with no ID:', player);
              continue;
            }
            try {
              await apiClient.addTeamMember(newTeam.id, player.id);
            } catch (memberError) {
              console.error(`Failed to add player ${player.name} (${player.id}) to team:`, memberError);
            }
          }
        }

        // Step 3: Create rounds and pairings
        for (const round of rounds) {
          const newRound = await apiClient.createRound(newTournament.id, {
            name: round.name,
            round_number: round.round_number,
            round_date: round.date,
            golf_course_id: round.golf_course_id,
          });

          // Create pairings for this round
          for (const pairing of round.pairings || []) {
            const pairingPlayers: PairingPlayerRequest[] = (pairing.players || [])
              .filter(p => p.user_id && p.team_id) // Filter out invalid players
              .map(p => {
                // Map temp team IDs to actual created team IDs
                let actualTeamId = p.team_id;
                if (p.team_id.startsWith('team-')) {
                  const teamIdx = parseInt(p.team_id.split('-')[1]);
                  actualTeamId = createdTeams[teamIdx].id;
                }
                return {
                  user_id: p.user_id,
                  team_id: actualTeamId,
                  player_order: p.player_order
                };
              });

            const pairingMatches: PairingMatchRequest[] = (pairing.matches || []).map(match => {
              // Collect user IDs for this match from team1_players and team2_players indices
              // Note: team1_players/team2_players contain indices into teams[].players, not pairing.players
              const playerUserIds: string[] = [];
              if (match.team1_players && Array.isArray(match.team1_players)) {
                match.team1_players.forEach(teamPlayerIdx => {
                  // teamPlayerIdx is an index into teams[0].players
                  if (teams[0] && teams[0].players[teamPlayerIdx]) {
                    playerUserIds.push(teams[0].players[teamPlayerIdx].id);
                  }
                });
              }
              if (match.team2_players && Array.isArray(match.team2_players)) {
                match.team2_players.forEach(teamPlayerIdx => {
                  // teamPlayerIdx is an index into teams[1].players
                  if (teams[1] && teams[1].players[teamPlayerIdx]) {
                    playerUserIds.push(teams[1].players[teamPlayerIdx].id);
                  }
                });
              }

              return {
                team1_id: createdTeams[0].id,
                team2_id: createdTeams[1].id,
                match_format_id: match.format_id,
                holes: match.holes,
                start_hole: match.start_hole,
                end_hole: match.end_hole,
                points_available: match.points_available,
                player_user_ids: playerUserIds.length > 0 ? playerUserIds : undefined
              };
            });

            // Convert tee_time (HH:MM) to full RFC3339 timestamp in UTC
            let fullTeeTime: string | undefined;
            if (pairing.tee_time) {
              // Create date in the tournament's timezone, then convert to UTC
              const localDateTime = new Date(`${round.date}T${pairing.tee_time}:00`);
              fullTeeTime = localDateTime.toISOString();
            }

            await apiClient.createPairing(newRound.id, {
              pairing_number: pairing.pairing_number,
              tee_time: fullTeeTime,
              golf_course_tee_id: pairing.golf_course_tee_id || undefined, // Convert empty string to undefined
              players: pairingPlayers,
              matches: pairingMatches
            });
          }
        }

        alert('Tournament created successfully!');
        localStorage.removeItem('tournament_draft');
      }
      
      // Reset form
      setStep(1);
      setTournament({ 
        name: '', 
        description: '', 
        start_date: '', 
        end_date: '', 
        group_id: '',
        scoring_method: 'gross',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
      });
      setTeams([
        { name: 'Team USA', color: '#DC2626', players: [] },
        { name: 'Team Europe', color: '#2563EB', players: [] }
      ]);
      setRounds([]);
      setEditMode(false);
      setSelectedTournamentId('');
      // Reload the tournaments list
      loadInitialData();
      
    } catch (err) {
      console.error('Error saving tournament:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to save tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Draft Data Dialog */}
      {showDraftDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">Resume Tournament Creation?</h3>
            <p className="text-gray-600 mb-6">
              We found saved tournament data from a previous session. Would you like to continue where you left off?
            </p>
            <div className="flex gap-3">
              <button
                onClick={loadDraft}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Continue Draft
              </button>
              <button
                onClick={clearDraft}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-800 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Tournament Setup</h1>
            <p className="text-green-100 mt-2">Create and configure your Ryder Cup style tournament</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveDraft}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 text-sm"
              title="Save current progress"
            >
              💾 Save Progress
            </button>
            {lastSaved && (
              <span className="text-green-100 text-xs">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all data and start over?')) {
                  clearDraft();
                  setTournament({ name: '', description: '', start_date: '', end_date: '', group_id: '', scoring_method: 'gross', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                  setTeams([
                    { name: 'Team USA', color: '#DC2626', players: [] },
                    { name: 'Team Europe', color: '#2563EB', players: [] }
                  ]);
                  setRounds([]);
                  setStep(1);
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              title="Clear all data and start over"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tournament Selector - Edit or Create New */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={createNewTournament}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    !editMode 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Create New Tournament
                </button>
                <button
                  onClick={() => {
                    if (!editMode) {
                      setEditMode(true);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    editMode 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Edit Existing Tournament
                </button>
              </div>
            </div>
            
            {editMode && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tournament to Edit
                </label>
                <select
                  value={selectedTournamentId}
                  onChange={(e) => {
                    const tournamentId = e.target.value;
                    setSelectedTournamentId(tournamentId);
                    if (tournamentId) {
                      loadExistingTournament(tournamentId);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                >
                  <option value="">-- Select a tournament --</option>
                  {existingTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
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
            <div className="flex items-center flex-1">
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
            {lastSaved && (
              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                ✓ Auto-saved {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <TournamentInfoStep 
            tournament={tournament} 
            setTournament={setTournament}
            userGroups={userGroups}
            onGroupSelect={loadGroupUsers}
          />
        )}
        {step === 2 && (
          <TeamsStep 
            teams={teams} 
            setTeams={setTeams} 
            availableUsers={tournament.group_id ? selectedGroupUsers : availableUsers} 
          />
        )}
        {step === 3 && (
          <RoundsStep 
            rounds={rounds} 
            setRounds={setRounds} 
            teams={teams}
            matchFormats={matchFormats}
            golfCourses={golfCourses}
            availableTees={availableTees}
            setAvailableTees={setAvailableTees}
            loading={loading}
            tournamentStartDate={tournament.start_date}
            tournamentEndDate={tournament.end_date}
          />
        )}
        {step === 4 && (
          <ReviewStep 
            tournament={tournament} 
            teams={teams} 
            rounds={rounds}
            golfCourses={golfCourses}
          />
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
              {editMode ? 'Update Tournament' : 'Create Tournament'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 1: Tournament Info
const TournamentInfoStep = ({ tournament, setTournament, userGroups, onGroupSelect }) => {
  const handleGroupChange = (groupId: string) => {
    setTournament({ ...tournament, group_id: groupId });
    onGroupSelect(groupId);
  };

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

        <div>
          <label className="block text-sm font-medium mb-2">
            Group (optional)
            <span className="text-xs text-gray-500 ml-2">Select a group to limit team member selection</span>
          </label>
          <select
            value={tournament.group_id}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="w-full p-3 border rounded-lg"
          >
            <option value="">No group - use all users</option>
            {userGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
                {group.description && ` - ${group.description}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Scoring Method *
            <span className="text-xs text-gray-500 ml-2">How scores will be calculated</span>
          </label>
          <select
            value={tournament.scoring_method}
            onChange={(e) => setTournament({ ...tournament, scoring_method: e.target.value })}
            className="w-full p-3 border rounded-lg"
          >
            <option value="gross">Gross (Stroke Play)</option>
            <option value="stableford">Stableford (Points-Based)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {tournament.scoring_method === 'gross' 
              ? 'Lower score wins. Scores are compared as-is.'
              : 'Points awarded based on score vs par. Higher points win.'}
          </p>
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
              min={tournament.start_date || undefined}
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
const RoundsStep = ({ rounds, setRounds, teams, matchFormats, golfCourses, availableTees, setAvailableTees, loading, tournamentStartDate, tournamentEndDate }) => {
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
    // Try to use the last entered date, or default to empty string
    const lastDate = rounds.length > 0 ? rounds[rounds.length - 1].date : '';
    setRounds([
      ...rounds,
      {
        name: `Round ${rounds.length + 1}`,
        round_number: rounds.length + 1,
        date: lastDate,
        pairings: []
      }
    ]);
  };

  const updateRound = async (idx, field, value) => {
    const newRounds = [...rounds];
    newRounds[idx][field] = value;
    
    // If golf course changed, load tees for that course
    if (field === 'golf_course_id' && value) {
      try {
        const tees = await apiClient.getGolfCourseTees(value);
        setAvailableTees(prev => ({ ...prev, [value]: tees }));
      } catch (err) {
        console.error('Failed to load tees:', err);
      }
    }
    
    setRounds(newRounds);
  };

  const deleteRound = (idx) => {
    setRounds(rounds.filter((_, i) => i !== idx));
  };

  const addPairing = (roundIdx) => {
    const newRounds = [...rounds];
    const round = newRounds[roundIdx];
    
    // Get default tee from previous pairing in this round
    const previousPairing = round.pairings.length > 0 ? round.pairings[round.pairings.length - 1] : null;
    const defaultTeeId = previousPairing?.golf_course_tee_id;
    
    round.pairings.push({
      pairing_number: round.pairings.length + 1,
      golf_course_tee_id: defaultTeeId,
      players: [],
      matches: []
    });
    setRounds(newRounds);
  };

  const updatePairing = (roundIdx, pairingIdx, field, value) => {
    const newRounds = [...rounds];
    const newPairings = [...newRounds[roundIdx].pairings];
    newPairings[pairingIdx] = { ...newPairings[pairingIdx], [field]: value };
    newRounds[roundIdx] = { ...newRounds[roundIdx], pairings: newPairings };
    setRounds(newRounds);
  };

  const deletePairing = (roundIdx, pairingIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].pairings = newRounds[roundIdx].pairings.filter((_, i) => i !== pairingIdx);
    setRounds(newRounds);
  };

  const addMatch = (roundIdx, pairingIdx) => {
    const newRounds = [...rounds];
    const safeMatchFormats = Array.isArray(matchFormats) ? matchFormats : [];
    const pairing = newRounds[roundIdx].pairings[pairingIdx];
    
    // Get the last match in this pairing to copy format and holes from
    const lastMatch = pairing.matches.length > 0 ? pairing.matches[pairing.matches.length - 1] : null;
    
    pairing.matches.push({
      match_number: pairing.matches.length + 1,
      format_id: lastMatch ? lastMatch.format_id : (safeMatchFormats.length > 0 ? safeMatchFormats[0].id : ''),
      holes: lastMatch ? lastMatch.holes : 6,
      team1_players: [],
      team2_players: []
    });
    setRounds(newRounds);
  };

  const updateMatch = (roundIdx, pairingIdx, matchIdx, fieldOrFields, value?) => {
    const newRounds = [...rounds];
    const newPairings = [...newRounds[roundIdx].pairings];
    const newMatches = [...newPairings[pairingIdx].matches];
    
    // Support both single field update and multiple fields update
    if (typeof fieldOrFields === 'string') {
      // Single field update: updateMatch(roundIdx, pairingIdx, matchIdx, 'field', value)
      newMatches[matchIdx] = { ...newMatches[matchIdx], [fieldOrFields]: value };
    } else {
      // Multiple fields update: updateMatch(roundIdx, pairingIdx, matchIdx, { field1: value1, field2: value2 })
      newMatches[matchIdx] = { ...newMatches[matchIdx], ...fieldOrFields };
    }
    
    newPairings[pairingIdx] = { ...newPairings[pairingIdx], matches: newMatches };
    newRounds[roundIdx] = { ...newRounds[roundIdx], pairings: newPairings };
    setRounds(newRounds);
  };

  const deleteMatch = (roundIdx, pairingIdx, matchIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].pairings[pairingIdx].matches = newRounds[roundIdx].pairings[pairingIdx].matches.filter((_, i) => i !== matchIdx);
    setRounds(newRounds);
  };

  const toggleRoundCollapse = (roundIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].collapsed = !newRounds[roundIdx].collapsed;
    setRounds(newRounds);
  };

  const togglePairingCollapse = (roundIdx, pairingIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].pairings[pairingIdx].collapsed = !newRounds[roundIdx].pairings[pairingIdx].collapsed;
    setRounds(newRounds);
  };

  const toggleMatchCollapse = (roundIdx, pairingIdx, matchIdx) => {
    const newRounds = [...rounds];
    newRounds[roundIdx].pairings[pairingIdx].matches[matchIdx].collapsed = !newRounds[roundIdx].pairings[pairingIdx].matches[matchIdx].collapsed;
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
              golfCourses={golfCourses}
              availableTees={availableTees}
              tournamentStartDate={tournamentStartDate}
              tournamentEndDate={tournamentEndDate}
              updateRound={updateRound}
              deleteRound={deleteRound}
              addPairing={addPairing}
              updatePairing={updatePairing}
              deletePairing={deletePairing}
              addMatch={addMatch}
              updateMatch={updateMatch}
              deleteMatch={deleteMatch}
              toggleRoundCollapse={toggleRoundCollapse}
              togglePairingCollapse={togglePairingCollapse}
              toggleMatchCollapse={toggleMatchCollapse}
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
  golfCourses,
  availableTees,
  tournamentStartDate,
  tournamentEndDate,
  updateRound,
  deleteRound,
  addPairing,
  updatePairing,
  deletePairing,
  addMatch,
  updateMatch,
  deleteMatch,
  toggleRoundCollapse,
  togglePairingCollapse,
  toggleMatchCollapse
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Generate date options between tournament start and end dates
  const getDateOptions = () => {
    if (!tournamentStartDate || !tournamentEndDate) return [];
    
    const dates = [];
    const start = new Date(tournamentStartDate);
    const end = new Date(tournamentEndDate);
    
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };
  
  const dateOptions = getDateOptions();
  
  // Filter golf courses based on search term
  const filteredCourses = (golfCourses || []).filter(course => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      course.club_name.toLowerCase().includes(search) ||
      course.course_name.toLowerCase().includes(search) ||
      (course.city && course.city.toLowerCase().includes(search)) ||
      (course.state && course.state.toLowerCase().includes(search))
    );
  });

  const selectedCourse = golfCourses?.find(c => c.id === round.golf_course_id);
  
  const formatCourseName = (course: GolfCourse) => {
    const parts = [course.club_name];
    if (course.course_name && course.course_name !== course.club_name) {
      parts.push(`- ${course.course_name}`);
    }
    if (course.city || course.state) {
      const location = [course.city, course.state].filter(Boolean).join(', ');
      parts.push(`(${location})`);
    }
    return parts.join(' ');
  };

  // Collapsed view
  if (round.collapsed) {
    const selectedCourse = golfCourses?.find(c => c.id === round.golf_course_id);
    const courseName = selectedCourse ? formatCourseName(selectedCourse) : 'No course selected';
    return (
      <div className="border-2 rounded-lg p-3 bg-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <span className="font-bold text-lg">{round.name}</span>
            <span className="text-sm text-gray-600">{round.date ? new Date(round.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}</span>
            <span className="text-xs text-gray-500">{courseName}</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{round.pairings?.length || 0} pairing{(round.pairings?.length || 0) !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleRoundCollapse(roundIdx)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => deleteRound(roundIdx)}
              className="p-2 text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {dateOptions.length > 0 ? (
            <select
              value={round.date}
              onChange={(e) => updateRound(roundIdx, 'date', e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Select date...</option>
              {dateOptions.map(date => (
                <option key={date} value={date}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              value={round.date}
              onChange={(e) => updateRound(roundIdx, 'date', e.target.value)}
              className="border rounded px-3 py-1"
              placeholder="Set tournament dates first"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addPairing(roundIdx)}
            className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={16} className="mr-1" />
            Add Pairing
          </button>
          <button
            onClick={() => toggleRoundCollapse(roundIdx)}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            ✓ Done
          </button>
          <button
            onClick={() => deleteRound(roundIdx)}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Golf Course Selector */}
      <div className="mb-4 ml-4 relative">
        <label className="block text-sm font-medium mb-1">Golf Course (optional)</label>
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={selectedCourse ? formatCourseName(selectedCourse) : "Search for a golf course..."}
              className="w-full p-2 pr-8 border rounded"
            />
            <Search className="absolute right-2 top-2.5 text-gray-400" size={18} />
          </div>
          
          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div
                  onClick={() => {
                    updateRound(roundIdx, 'golf_course_id', undefined);
                    setSearchTerm('');
                    setShowDropdown(false);
                  }}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500 italic"
                >
                  No golf course
                </div>
                {filteredCourses.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No courses found. {searchTerm && "Try a different search term."}
                  </div>
                ) : (
                  filteredCourses.map(course => (
                    <div
                      key={course.id}
                      onClick={() => {
                        updateRound(roundIdx, 'golf_course_id', course.id);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                        course.id === round.golf_course_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium">{course.club_name}</div>
                      {course.course_name && course.course_name !== course.club_name && (
                        <div className="text-sm text-gray-600">{course.course_name}</div>
                      )}
                      {(course.city || course.state) && (
                        <div className="text-xs text-gray-500">
                          {[course.city, course.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        {selectedCourse && !showDropdown && (
          <div className="mt-1 text-sm text-gray-600">
            Selected: {formatCourseName(selectedCourse)}
          </div>
        )}
      </div>

      <div className="space-y-3 ml-4">
        {(round.pairings || []).length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No pairings yet. Click "Add Pairing" to create a group of players.
          </div>
        ) : (
          (round.pairings || []).map((pairing, pairingIdx) => (
            <PairingConfig
              key={pairingIdx}
              pairing={pairing}
              pairingIdx={pairingIdx}
              roundIdx={roundIdx}
              round={round}
              teams={teams}
              matchFormats={matchFormats}
              availableTees={round.golf_course_id ? (availableTees[round.golf_course_id] || []) : []}
              updatePairing={updatePairing}
              deletePairing={deletePairing}
              addMatch={addMatch}
              updateMatch={updateMatch}
              deleteMatch={deleteMatch}
              togglePairingCollapse={togglePairingCollapse}
              toggleMatchCollapse={toggleMatchCollapse}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PairingConfig = ({
  pairing,
  pairingIdx,
  roundIdx,
  round,
  teams,
  matchFormats,
  availableTees,
  updatePairing,
  deletePairing,
  addMatch,
  updateMatch,
  deleteMatch,
  togglePairingCollapse,
  toggleMatchCollapse
}) => {
  const addPlayerToPairing = (userId, teamId) => {
    const newPlayers = [...(pairing.players || [])];
    if (newPlayers.length >= 4) {
      alert('Maximum 4 players per pairing');
      return;
    }
    if (!newPlayers.find(p => p.user_id === userId)) {
      newPlayers.push({
        user_id: userId,
        team_id: teamId,
        player_order: newPlayers.length + 1
      });
      updatePairing(roundIdx, pairingIdx, 'players', newPlayers);
    }
  };

  const removePlayerFromPairing = (userId) => {
    const newPlayers = (pairing.players || []).filter(p => p.user_id !== userId);
    // Reorder remaining players
    newPlayers.forEach((p, idx) => p.player_order = idx + 1);
    updatePairing(roundIdx, pairingIdx, 'players', newPlayers);
  };

  const allTeamPlayers = teams.flatMap((team, teamIdx) => 
    team.players.map(player => ({ 
      ...player, 
      team_id: team.id || `team-${teamIdx}`, // Use temp ID for new teams
      team_name: team.name, 
      team_color: team.color 
    }))
  );

  // Get all player IDs from ALL pairings in this round (not just current pairing)
  const allRoundPairingPlayerIds = (round.pairings || []).flatMap(p => 
    (p.players || []).map(player => player.user_id)
  );
  const availablePlayers = allTeamPlayers.filter(p => !allRoundPairingPlayerIds.includes(p.id));

  // Collapsed view
  if (pairing.collapsed) {
    const playerNames = (pairing.players || [])
      .map(p => {
        const user = allTeamPlayers.find(u => u.id === p.user_id);
        return user ? user.name : 'Unknown';
      })
      .join(', ');
    return (
      <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-bold text-blue-700">Pairing {pairing.pairing_number}</span>
            {pairing.tee_time && <span className="text-sm text-gray-600">⏰ {pairing.tee_time.includes('T') ? new Date(pairing.tee_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : pairing.tee_time}</span>}
            <span className="text-xs text-gray-500">{playerNames || 'No players'}</span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{pairing.matches?.length || 0} match{(pairing.matches?.length || 0) !== 1 ? 'es' : ''}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => togglePairingCollapse(roundIdx, pairingIdx)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => deletePairing(roundIdx, pairingIdx)}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-2 border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-bold text-blue-700">Pairing {pairing.pairing_number}</span>
          <input
            type="time"
            value={pairing.tee_time || ''}
            onChange={(e) => updatePairing(roundIdx, pairingIdx, 'tee_time', e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            placeholder="Tee time"
          />
          {availableTees.length > 0 && (
            <select
              value={pairing.golf_course_tee_id || ''}
              onChange={(e) => updatePairing(roundIdx, pairingIdx, 'golf_course_tee_id', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">Select Tee...</option>
              {availableTees.map(tee => (
                <option key={tee.id} value={tee.id}>
                  {tee.tee_name} {tee.total_yards ? `(${tee.total_yards} yds)` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => togglePairingCollapse(roundIdx, pairingIdx)}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            ✓ Done
          </button>
          <button
            onClick={() => deletePairing(roundIdx, pairingIdx)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Players in Pairing */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-2">Players ({(pairing.players || []).length}/4)</label>
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team, teamIdx) => {
            const teamPlayers = (pairing.players || [])
              .map(p => {
                const user = allTeamPlayers.find(u => u.id === p.user_id);
                return user && user.team_id === (team.id || `team-${teamIdx}`) ? { ...p, user } : null;
              })
              .filter(p => p !== null);
            
            // Get available players for this specific team
            const availableTeamPlayers = availablePlayers.filter(p => p.team_id === (team.id || `team-${teamIdx}`));
            
            return (
              <div key={teamIdx}>
                <div className="text-xs font-medium mb-1" style={{ color: team.color }}>
                  {team.name}
                </div>
                <div className="space-y-1 mb-2">
                  {teamPlayers.map((player) => (
                    <div key={player.user_id} className="flex items-center justify-between bg-white rounded p-2 border">
                      <span className="font-medium text-sm">{player.user.name}</span>
                      <button
                        onClick={() => removePlayerFromPairing(player.user_id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Add player dropdown for this team */}
                {availableTeamPlayers.length > 0 && (pairing.players || []).length < 4 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addPlayerToPairing(e.target.value, team.id || `team-${teamIdx}`);
                      }
                    }}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="">+ Add player...</option>
                    {availableTeamPlayers.map(player => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Matches within Pairing */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Matches in this Pairing</label>
          <button
            onClick={() => addMatch(roundIdx, pairingIdx)}
            className="flex items-center px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
          >
            <Plus size={14} className="mr-1" />
            Add Match
          </button>
        </div>
        
        <div className="space-y-2">
          {(pairing.matches || []).length === 0 ? (
            <div className="text-center py-3 text-gray-500 text-xs">
              No matches configured. Add a match format for this pairing.
            </div>
          ) : (
            (pairing.matches || []).map((match, matchIdx) => (
              <MatchConfig
                key={matchIdx}
                match={match}
                matchIdx={matchIdx}
                pairingIdx={pairingIdx}
                roundIdx={roundIdx}
                teams={teams}
                pairing={pairing}
                allTeamPlayers={allTeamPlayers}
                matchFormats={matchFormats}
                updateMatch={updateMatch}
                deleteMatch={deleteMatch}
                toggleMatchCollapse={toggleMatchCollapse}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const MatchConfig = ({
  match,
  matchIdx,
  pairingIdx,
  roundIdx,
  teams,
  pairing,
  allTeamPlayers,
  matchFormats,
  updateMatch,
  deleteMatch,
  toggleMatchCollapse
}) => {
  // Ensure matchFormats is always an array
  const safeMatchFormats = Array.isArray(matchFormats) ? matchFormats : [];
  const selectedFormat = safeMatchFormats.find(f => f.id === match.format_id);
  const playersNeeded = selectedFormat?.players_per_side || 1;
  
  // Get the player IDs that are in this pairing
  const pairingPlayerIds = (pairing.players || []).map(p => p.user_id);

  // Collapsed view
  if (match.collapsed) {
    const formatName = selectedFormat?.name || 'No format';
    const holeRangeText = match.start_hole && match.end_hole 
      ? `holes ${match.start_hole}-${match.end_hole}`
      : `${match.holes} holes`;
    return (
      <div className="bg-gray-100 rounded p-2 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-medium text-sm">Match {matchIdx + 1}</span>
            <span className="text-xs text-gray-600">{formatName}</span>
            <span className="text-xs text-gray-600">{holeRangeText}</span>
            <span className="text-xs text-gray-600">{match.points_available || 1} pt{(match.points_available || 1) !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleMatchCollapse(roundIdx, pairingIdx, matchIdx)}
              className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => deleteMatch(roundIdx, pairingIdx, matchIdx)}
              className="text-red-600 hover:text-red-800"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded p-3 border">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">Match {matchIdx + 1}</span>
        <div className="flex gap-2">
          <button
            onClick={() => toggleMatchCollapse(roundIdx, pairingIdx, matchIdx)}
            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
          >
            ✓ Done
          </button>
          <button
            onClick={() => deleteMatch(roundIdx, pairingIdx, matchIdx)}
            className="text-red-600 hover:text-red-800"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Format</label>
          <select
            value={match.format_id}
            onChange={(e) => updateMatch(roundIdx, pairingIdx, matchIdx, 'format_id', e.target.value)}
            className="w-full p-2 border rounded text-sm"
            disabled={safeMatchFormats.length === 0}
          >
            <option value="">
              {safeMatchFormats.length === 0 ? 'No formats available' : 'Select format...'}
            </option>
            {safeMatchFormats.map(format => (
              <option key={format.id} value={format.id}>
                {format.name}
                {format.score_input_type && ` (${format.score_input_type === 'team' ? 'Team Score' : 'Individual Scores'})`}
              </option>
            ))}
          </select>
          {selectedFormat && (
            <div className="mt-2 text-xs text-gray-500">
              <p>
                {selectedFormat.score_input_type === 'team'
                  ? '📝 Team submits one combined score per hole'
                  : '📝 Each player submits their own score'}
              </p>
              {/* Show format description if present, with a short fallback for the new combined format */}
              <p className="mt-1 text-xs text-gray-600">
                {selectedFormat.description
                  ? selectedFormat.description
                  : (selectedFormat.scoring_type === 'combined_scores'
                      ? 'Two-person teams: sum player scores per hole; for Stableford tournaments sum Stableford points (higher wins), otherwise sum strokes (lower wins). Ties split the hole.'
                      : '')}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Holes</label>
          <select
            value={match.holes}
            onChange={(e) => updateMatch(roundIdx, pairingIdx, matchIdx, 'holes', parseInt(e.target.value))}
            className="w-full p-2 border rounded text-sm"
          >
            <option value={6}>6 holes</option>
            <option value={9}>9 holes</option>
            <option value={18}>18 holes</option>
          </select>
        </div>

        {match.holes !== 18 && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Hole Range *
              <span className="text-xs text-gray-400 ml-1">Which holes to play</span>
            </label>
            <select
              value={match.start_hole && match.end_hole ? `${match.start_hole}-${match.end_hole}` : ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  // Clear both start and end holes using multi-field update
                  updateMatch(roundIdx, pairingIdx, matchIdx, { start_hole: undefined, end_hole: undefined });
                } else {
                  // Set both start and end holes together using multi-field update
                  const [start, end] = e.target.value.split('-').map(Number);
                  updateMatch(roundIdx, pairingIdx, matchIdx, { start_hole: start, end_hole: end });
                }
              }}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="">Select hole range...</option>
              {match.holes === 6 && (
                <>
                  <option value="1-6">Holes 1-6</option>
                  <option value="7-12">Holes 7-12</option>
                  <option value="13-18">Holes 13-18</option>
                </>
              )}
              {match.holes === 9 && (
                <>
                  <option value="1-9">Holes 1-9 (Front 9)</option>
                  <option value="10-18">Holes 10-18 (Back 9)</option>
                </>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1">Points</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={match.points_available || 1}
            onChange={(e) => updateMatch(roundIdx, pairingIdx, matchIdx, 'points_available', parseFloat(e.target.value) || 1)}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        {teams.map((team, teamIdx) => {
          // Filter team players to only those in this pairing
          const teamPlayersInPairing = team.players.filter(player => 
            pairingPlayerIds.includes(player.id)
          );
          
          // Check if we should auto-assign players (2v2 format with exactly 2 players per team)
          const shouldAutoAssign = playersNeeded === 2 && teamPlayersInPairing.length === 2;
          
          return (
            <div key={teamIdx}>
              <label className="block text-xs font-medium mb-1" style={{ color: team.color }}>
                {team.name} Players
              </label>
              <div className="space-y-1">
                {shouldAutoAssign ? (
                  // Auto-assigned view - just show the players
                  teamPlayersInPairing.map((player) => (
                    <div key={player.id} className="p-1 bg-gray-100 rounded text-xs border">
                      {player.name}
                    </div>
                  ))
                ) : (
                  // Manual selection view - show dropdowns
                  Array.from({ length: playersNeeded }).map((_, playerSlot) => (
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
                        updateMatch(roundIdx, pairingIdx, matchIdx, teamIdx === 0 ? 'team1_players' : 'team2_players', newPlayers);
                      }}
                      className="w-full p-1 border rounded text-xs"
                    >
                      <option value="">Select...</option>
                      {teamPlayersInPairing.map((player, pIdx) => {
                        // Find the original index of this player in team.players
                        const originalIdx = team.players.findIndex(p => p.id === player.id);
                        return (
                          <option key={player.id} value={originalIdx.toString()}>
                            {player.name}
                          </option>
                        );
                      })}
                    </select>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Step 4: Review
const ReviewStep = ({ tournament, teams, rounds, golfCourses }) => {
  const getCourseName = (courseId: string) => {
    const course = golfCourses?.find(c => c.id === courseId);
    if (!course) return 'Not specified';
    const parts = [course.club_name];
    if (course.course_name && course.course_name !== course.club_name) {
      parts.push(`- ${course.course_name}`);
    }
    if (course.city || course.state) {
      const location = [course.city, course.state].filter(Boolean).join(', ');
      parts.push(`(${location})`);
    }
    return parts.join(' ');
  };

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
          <h3 className="text-lg font-bold mb-3">Rounds & Pairings</h3>
          <div className="space-y-3">
            {rounds.map((round, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold">{round.name}</h4>
                  <span className="text-sm text-gray-600">{round.date}</span>
                </div>
                {round.golf_course_id && (
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Course:</span> {getCourseName(round.golf_course_id)}
                  </div>
                )}
                <div className="text-sm text-gray-700">
                  {round.pairings?.length || 0} pairing{(round.pairings?.length || 0) !== 1 ? 's' : ''} configured
                </div>
                {round.pairings && round.pairings.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {round.pairings.map(pairing => (
                      <div key={pairing.pairing_number} className="bg-gray-50 rounded p-2 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">Pairing {pairing.pairing_number}</span>
                          {pairing.tee_time && <span className="text-gray-600">Tee Time: {pairing.tee_time}</span>}
                        </div>
                        <div className="text-gray-600">
                          {pairing.players?.length || 0} player{(pairing.players?.length || 0) !== 1 ? 's' : ''}, {pairing.matches?.length || 0} match{(pairing.matches?.length || 0) !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentSetup;

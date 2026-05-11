import { MatchPlayer } from '../services/api';

export interface SimpleTeam {
  id?: string;
  players: { id: string; name?: string }[];
}

export interface SlotIssue {
  matchId?: string;
  matchNumber?: number;
  side: 'team1' | 'team2';
  slot: number;
  message: string;
}

export interface MappingResult {
  team1_players: (string | undefined)[];
  team2_players: (string | undefined)[];
  warnings: string[];
  slotIssues: SlotIssue[];
}

/**
 * Map persisted MatchPlayer entries into per-side slot arrays of user IDs
 * (string user_id) for the UI. Returns arrays sized to playersNeeded and any
 * warnings or slot-specific issues encountered.
 */
export function mapMatchPlayersToSlots(
  loadedTeams: SimpleTeam[],
  matchPlayers: MatchPlayer[],
  playersNeeded: number,
  opts?: { matchId?: string; matchNumber?: number; matchTeam1Id?: string; matchTeam2Id?: string }
): MappingResult {
  const team1_players: (string | undefined)[] = Array(playersNeeded).fill(undefined);
  const team2_players: (string | undefined)[] = Array(playersNeeded).fill(undefined);
  const warnings: string[] = [];
  const slotIssues: SlotIssue[] = [];

  const { matchId, matchNumber, matchTeam1Id, matchTeam2Id } = opts || {};

  // Build quick lookup by team id
  const teamIdToIdx: { [id: string]: number } = {};
  loadedTeams.forEach((t, idx) => { if (t.id) teamIdToIdx[t.id] = idx; });

  // If explicit team IDs were not provided, and we have at least two teams,
  // fall back to order-based mapping but warn that we're guessing.
  if ((matchTeam1Id === undefined || matchTeam2Id === undefined) && loadedTeams.length >= 2) {
    const t0 = loadedTeams[0].id;
    const t1 = loadedTeams[1].id;
    if (t0) teamIdToIdx[t0] = 0;
    if (t1) teamIdToIdx[t1] = 1;
    warnings.push(`Match ${matchNumber ?? matchId ?? ''}: team side mapping not provided by API; falling back to loaded team order.`);
  }

  // Process each persisted match player
  (matchPlayers || []).forEach(mp => {
    const slot = (mp.player_order || 1) - 1;
    if (slot < 0 || slot >= playersNeeded) {
      warnings.push(`Match ${matchNumber ?? matchId ?? ''}: player ${mp.user_id} has invalid player_order ${mp.player_order}`);
      return;
    }

    const teamIdx = mp.team_id ? (teamIdToIdx[mp.team_id] ?? loadedTeams.findIndex(t => t.id === mp.team_id)) : -1;
    if (teamIdx === -1) {
      warnings.push(`Match ${matchNumber ?? matchId ?? ''}: player ${mp.user_id} references unknown team ${mp.team_id}`);
      // We cannot place this player without a team; skip
      slotIssues.push({ matchId, matchNumber, side: 'team1', slot, message: `Unknown team ${mp.team_id} for player ${mp.user_id}` });
      return;
    }

    // Check if user exists on the team
    const userOnTeam = (loadedTeams[teamIdx].players || []).find(p => p.id === mp.user_id);
    if (!userOnTeam) {
      warnings.push(`Match ${matchNumber ?? matchId ?? ''}: player ${mp.user_id} not found on team ${mp.team_id}`);
      slotIssues.push({ matchId, matchNumber, side: teamIdx === 0 ? 'team1' : 'team2', slot, message: `Player ${mp.user_id} not found on team ${mp.team_id}` });
      // Still place the user_id so the UI can show the preserved value
    }

    // Decide whether this belongs to team1 or team2
    let side: 'team1' | 'team2' | undefined;
    if (matchTeam1Id && mp.team_id === matchTeam1Id) side = 'team1';
    else if (matchTeam2Id && mp.team_id === matchTeam2Id) side = 'team2';
    else {
      // Use teamIdx to decide
      if (teamIdx === 0) side = 'team1';
      else if (teamIdx === 1) side = 'team2';
      else {
        // If more than 2 teams, decide based on whether teamIdx is 0/1
        side = teamIdx === 0 ? 'team1' : 'team2';
      }
    }

    if (side === 'team1') team1_players[slot] = mp.user_id;
    else if (side === 'team2') team2_players[slot] = mp.user_id;
    else warnings.push(`Match ${matchNumber ?? matchId ?? ''}: could not determine side for player ${mp.user_id}`);
  });

  return { team1_players, team2_players, warnings, slotIssues };
}

export default mapMatchPlayersToSlots;

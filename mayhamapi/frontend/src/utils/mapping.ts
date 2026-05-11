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
    // Support both 1-based and legacy 0-based player_order values.
    // Treat undefined as 1 (first slot). If player_order === 0, treat as slot 0.
    let slot = (mp.player_order === undefined ? 1 : mp.player_order) - 1;

    // If slot is out-of-range, we'll attempt tolerant placement below instead
    const slotOutOfRange = slot < 0 || slot >= playersNeeded;

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

    // If the originally computed slot is out-of-range or already taken, attempt
    // to place the player into the first available slot for that side.
    const placeInFirstAvailable = () => {
      const arr = side === 'team1' ? team1_players : team2_players;
      const freeIdx = arr.findIndex(v => v === undefined);
      if (freeIdx !== -1) {
        arr[freeIdx] = mp.user_id;
        warnings.push(`Match ${matchNumber ?? matchId ?? ''}: placed player ${mp.user_id} into slot ${freeIdx + 1} due to unexpected player_order ${mp.player_order}`);
      } else {
        warnings.push(`Match ${matchNumber ?? matchId ?? ''}: no available slots to place player ${mp.user_id} (player_order ${mp.player_order})`);
        slotIssues.push({ matchId, matchNumber, side: side || 'team1', slot: Math.max(0, Math.min(playersNeeded - 1, slot)), message: `Could not place player ${mp.user_id} into any slot` });
      }
    };

    if (slotOutOfRange) {
      // Special-case common off-by-one: if player_order === 0, we already adjusted,
      // otherwise try tolerant fallback
      if (mp.player_order === 0) {
        // slot already computed as 0, fall through to place there
      } else {
        // Attempt to place in first available slot instead of skipping silently.
        if (side === 'team1' || side === 'team2') {
          placeInFirstAvailable();
          return;
        }
      }
    }

    if (slot < 0 || slot >= playersNeeded) {
      warnings.push(`Match ${matchNumber ?? matchId ?? ''}: player ${mp.user_id} has invalid player_order ${mp.player_order}`);
      return;
    }

    if (side === 'team1') {
      if (team1_players[slot] !== undefined) {
        // slot already occupied — try to place in first available slot
        placeInFirstAvailable();
      } else team1_players[slot] = mp.user_id;
    } else if (side === 'team2') {
      if (team2_players[slot] !== undefined) {
        placeInFirstAvailable();
      } else team2_players[slot] = mp.user_id;
    } else warnings.push(`Match ${matchNumber ?? matchId ?? ''}: could not determine side for player ${mp.user_id}`);
  });

  return { team1_players, team2_players, warnings, slotIssues };
}

export default mapMatchPlayersToSlots;

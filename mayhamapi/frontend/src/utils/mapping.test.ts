import { describe, it, expect } from 'vitest';
import mapMatchPlayersToSlots from './mapping';

describe('mapMatchPlayersToSlots', () => {
  it('maps simple 1v1 correctly', () => {
    const teams = [
      { id: 't1', players: [{ id: 'u1' }] },
      { id: 't2', players: [{ id: 'u2' }] }
    ];

    const matchPlayers: any[] = [
      { user_id: 'u1', team_id: 't1', player_order: 1 },
      { user_id: 'u2', team_id: 't2', player_order: 1 }
    ];

    const res = mapMatchPlayersToSlots(teams as any, matchPlayers, 1, { matchId: 'm1', matchNumber: 1, matchTeam1Id: 't1', matchTeam2Id: 't2' });
    expect(res.team1_players[0]).toBe('u1');
    expect(res.team2_players[0]).toBe('u2');
    expect(res.warnings.length).toBe(0);
    expect(res.slotIssues.length).toBe(0);
  });

  it('maps 2v2 players to correct slots', () => {
    const teams = [
      { id: 't1', players: [{ id: 'a' }, { id: 'b' }] },
      { id: 't2', players: [{ id: 'c' }, { id: 'd' }] }
    ];

    const matchPlayers: any[] = [
      { user_id: 'a', team_id: 't1', player_order: 1 },
      { user_id: 'b', team_id: 't1', player_order: 2 },
      { user_id: 'c', team_id: 't2', player_order: 1 },
      { user_id: 'd', team_id: 't2', player_order: 2 }
    ];

    const res = mapMatchPlayersToSlots(teams as any, matchPlayers, 2, { matchId: 'm2', matchNumber: 2, matchTeam1Id: 't1', matchTeam2Id: 't2' });
    expect(res.team1_players[0]).toBe('a');
    expect(res.team1_players[1]).toBe('b');
    expect(res.team2_players[0]).toBe('c');
    expect(res.team2_players[1]).toBe('d');
    expect(res.warnings.length).toBe(0);
  });

  it('warns when team is unknown', () => {
    const teams = [
      { id: 't1', players: [{ id: 'u1' }] },
      { id: 't2', players: [{ id: 'u2' }] }
    ];

    const matchPlayers: any[] = [
      { user_id: 'uX', team_id: 'tX', player_order: 1 }
    ];

    const res = mapMatchPlayersToSlots(teams as any, matchPlayers, 1, { matchId: 'm3', matchNumber: 3 });
    expect(res.team1_players[0]).toBeUndefined();
    expect(res.team2_players[0]).toBeUndefined();
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.slotIssues.length).toBeGreaterThan(0);
  });

  it('falls back to team order when explicit side ids are missing and warns', () => {
    const teams = [
      { id: 'tA', players: [{ id: 'p1' }] },
      { id: 'tB', players: [{ id: 'p2' }] }
    ];
    const matchPlayers: any[] = [
      { user_id: 'p1', team_id: 'tA', player_order: 1 },
      { user_id: 'p2', team_id: 'tB', player_order: 1 }
    ];

    const res = mapMatchPlayersToSlots(teams as any, matchPlayers, 1, { matchId: 'm4', matchNumber: 4 });
    expect(res.warnings.some(w => w.includes('falling back'))).toBe(true);
    expect(res.team1_players[0]).toBe('p1');
    expect(res.team2_players[0]).toBe('p2');
  });
});

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Leaderboard from '../Leaderboard';
import { apiClient } from '../../services/api';
import * as TournamentContext from '../TournamentContext';

jest.mock('../../services/api');

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe('Live Matches loading', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders live matches from leaderboard.live_matches', async () => {
    const tournamentId = 'tourn-live-1';

    // Mock tournament leaderboard to include a live match
    mockedApi.getTournamentLeaderboard.mockResolvedValue({
      tournament: { id: tournamentId, name: 'Live Tourney', start_date: '2026-01-01', end_date: '2026-01-02', created_by: '', status: 'active', scoring_method: 'gross', created_at: '', updated_at: '' },
      team_standings: [],
      live_matches: [
        {
          id: 'lm1',
          pairing_id: 'p-live-1',
          round_id: 'r-live-1',
          match_format_id: 'mf',
          match_number: 1,
          holes: 18,
          status: 'in_progress',
          team1_id: 't1',
          team2_id: 't2',
          points_available: 1.0,
          team1_points: 0.0,
          team2_points: 0.0,
          players: [
            { id: 'pp1', pairing_id: 'p-live-1', user_id: 'u1', team_id: 't1', player_order: 1, user: { id: 'u1', name: 'Alice', email: '' } },
            { id: 'pp2', pairing_id: 'p-live-1', user_id: 'u2', team_id: 't2', player_order: 1, user: { id: 'u2', name: 'Bob', email: '' } }
          ]
        }
      ],
      total_available_points: 0
    } as any);

    // Mock pairing fetch used by the transform logic
    mockedApi.getPairing.mockResolvedValue({ id: 'p-live-1', pairing_number: 2, round_id: 'r-live-1', status: 'in_progress', players: [], created_at: '', updated_at: '' } as any);

    // Mock rounds used to attach round metadata
    mockedApi.getTournamentRounds.mockResolvedValue([
      { id: 'r-live-1', round_number: 1, name: 'Round Live', tournament_id: tournamentId, round_date: '2026-01-01', status: 'active', created_at: '', updated_at: '' } as any
    ]);

    // Mock match scores/hole_results for the live match
    mockedApi.getMatchScores.mockResolvedValue({ scores: [], match_status: {}, hole_results: [ { id: 'hr1', match_id: 'lm1', hole_number: 1, team1_points: 0, team2_points: 1, created_at: '', updated_at: '' } ] } as any);

    // Mock useTournament to return our tournament id
    jest.spyOn(TournamentContext, 'useTournament').mockReturnValue({ selectedTournamentId: tournamentId, loading: false, error: null } as any);

    render(<Leaderboard />);

    // Click the Live Matches view button
    const liveBtn = await screen.findByRole('button', { name: /Live Matches/i });
    fireEvent.click(liveBtn);

    // Wait for processing and ensure the pairing header is shown
    await waitFor(() => expect(mockedApi.getTournamentLeaderboard).toHaveBeenCalled());

    expect(await screen.findByText(/Live Matches/i)).toBeTruthy();

    // The pairing header should include pairing number 2 (from mocked pairing)
    expect(await screen.findByText(/Pairing 2/)).toBeTruthy();
  });
});

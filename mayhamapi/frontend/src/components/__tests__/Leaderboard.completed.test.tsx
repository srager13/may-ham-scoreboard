import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Leaderboard from '../Leaderboard';
import { apiClient } from '../../services/api';
import * as TournamentContext from '../TournamentContext';

jest.mock('../../services/api');

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe('Completed Matches loading', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('shows pairings that contain completed matches even when pairing.status is not completed', async () => {
    const tournamentId = 'tourn-1';

    // Mock rounds
    mockedApi.getTournamentRounds.mockResolvedValue([{ id: 'r1', round_number: 1, name: 'R1', tournament_id: tournamentId, round_date: '2026-01-01', status: 'active', created_at: '', updated_at: '' } as any]);

    // Mock pairings for round
    mockedApi.getRoundPairings.mockResolvedValue([
      { id: 'p1', pairing_number: 1, round_id: 'r1', status: 'not_started', created_at: '', updated_at: '' },
    ] as any);

    // Mock pairing matches: match is completed even though pairing.status is not
    mockedApi.getPairingMatches.mockResolvedValue([
      { id: 'm1', status: 'completed', round_id: 'r1', match_format_id: 'mf', match_number: 1, holes: 18, team1_id: 't1', team2_id: 't2', points_available: 1.0, team1_points: 1.0, team2_points: 0.0, created_at: '' } as any,
    ]);

    // Mock match scores/hole_results
    mockedApi.getMatchScores.mockResolvedValue({ scores: [], match_status: {}, hole_results: [ { id: 'hr1', match_id: 'm1', hole_number: 1, team1_points: 1, team2_points: 0, created_at: '', updated_at: '' } ] } as any);

    // Mock leaderboard summary used by TournamentLeaderboard initial load
    mockedApi.getTournamentLeaderboard.mockResolvedValue({ tournament: { id: tournamentId, name: 'Tourney', start_date: '2026-01-01', end_date: '2026-01-02', created_by: '', status: 'active', scoring_method: 'gross', created_at: '', updated_at: '' }, team_standings: [], live_matches: [], total_available_points: 0 } as any);

    // Mock useTournament to return our tournament id
    jest.spyOn(TournamentContext, 'useTournament').mockReturnValue({ selectedTournamentId: tournamentId, loading: false, error: null } as any);

    render(<Leaderboard />);

    // Click the Completed Matches view button
    const completedBtn = await screen.findByRole('button', { name: /Completed Matches/i });
    fireEvent.click(completedBtn);

    // Wait for the completed pairings to load and display the pairing header 'Pairing 1'
    await waitFor(() => expect(mockedApi.getTournamentRounds).toHaveBeenCalled());
    expect(await screen.findByText(/Pairing 1/)).toBeTruthy();
  });
});

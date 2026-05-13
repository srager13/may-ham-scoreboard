import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiClient, Round, Pairing, PairingPlayer, Score, Match, Team } from '../services/api';
import { useTournament } from './TournamentContext';
import { PairingHeaderDetails } from './PairingHeaderDetails';

type EnrichedPairing = Pairing & {
  players?: PairingPlayer[];
  scoresMap?: Record<number, Record<string, number>>; // hole -> { userId: strokes }
  matchResults?: Match[];
  round?: Round;
};

const formatDate = (d?: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

const Scorecards: React.FC = () => {
  const { selectedTournamentId, selectedTournament } = useTournament();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pairingsByRound, setPairingsByRound] = useState<Record<string, EnrichedPairing[]>>({});
  const [loadingPairings, setLoadingPairings] = useState<Record<string, boolean>>({});
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({});

  const calculateOverallTeamPoints = (pairing?: EnrichedPairing) => {
    const teamPoints: Record<string, number> = {};
    if (!pairing || !pairing.matchResults) return teamPoints;
    pairing.matchResults.forEach((match) => {
      if (match.team1_id) {
        teamPoints[match.team1_id] = (teamPoints[match.team1_id] || 0) + (match.team1_points || 0);
      }
      if (match.team2_id) {
        teamPoints[match.team2_id] = (teamPoints[match.team2_id] || 0) + (match.team2_points || 0);
      }
    });
    return teamPoints;
  };

  useEffect(() => {
    if (selectedTournamentId) loadRounds();
    else {
      setRounds([]);
      setPairingsByRound({});
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    // Load tournament teams once so we can attach team objects to players/matches
    const loadTeams = async () => {
      if (!selectedTournamentId) return;
      try {
        const teams = await apiClient.getTournamentTeams(selectedTournamentId);
        const map: Record<string, Team> = {};
        teams.forEach((t) => (map[t.id] = t));
        setTeamMap(map);
      } catch (err) {
        console.warn('Failed to load tournament teams', err);
        setTeamMap({});
      }
    };
    loadTeams();
  }, [selectedTournamentId]);

  const loadRounds = async () => {
    if (!selectedTournamentId) return;
    setLoadingRounds(true);
    setError(null);
    try {
      const r = await apiClient.getTournamentRounds(selectedTournamentId);
      r.sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
      setRounds(r);
      setPairingsByRound({});
    } catch (err) {
      console.error('Failed to load rounds', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setRounds([]);
    } finally {
      setLoadingRounds(false);
    }
  };

  const toggleRound = (roundId: string) => {
    const currently = !!expandedRounds[roundId];
    setExpandedRounds((p) => ({ ...p, [roundId]: !currently }));
    if (!currently && !pairingsByRound[roundId]) {
      const round = rounds.find((r) => r.id === roundId);
      if (round) loadPairingsForRound(round);
    }
  };

  const loadPairingsForRound = async (round: Round) => {
    if (!round) return;
    setLoadingPairings((p) => ({ ...p, [round.id]: true }));
    try {
      const pairings = await apiClient.getRoundPairings(round.id);

      // Ensure we have a teamMap before enriching pairings so PairingHeaderDetails
      // can display team names/colors and calculate team points reliably.
      if (!teamMap || Object.keys(teamMap).length === 0) {
        try {
          const teams = await apiClient.getTournamentTeams(selectedTournamentId!);
          const map: Record<string, Team> = {};
          teams.forEach((t) => (map[t.id] = t));
          setTeamMap(map);
        } catch (err) {
          // If teams fail to load, continue — enrichment will attempt to use any
          // team objects already present on players/matches.
          console.warn('Failed to load tournament teams during pairing enrichment', err);
        }
      }

      const enriched: EnrichedPairing[] = await Promise.all(
        pairings.map(async (pairing) => {
          try {
            const [playersRespRaw, matchesRespRaw, scoresResp] = await Promise.all([
              apiClient.getPairingPlayers(pairing.id),
              apiClient.getPairingMatches(pairing.id).catch(() => [] as Match[]),
              apiClient.getPairingScores(pairing.id).catch(() => ({ scores: [] } as { scores: Score[] })),
            ]);

            // Attach team objects to players when available
            const playersResp = (playersRespRaw || []).map((p) => ({
              ...p,
              team: p.team || (p.team_id ? teamMap[p.team_id] : undefined),
            } as PairingPlayer));
            const matchesResp = (matchesRespRaw || []).map((m) => ({
              ...m,
              team1: (m as any).team1 || (m.team1_id ? teamMap[m.team1_id] : undefined),
              team2: (m as any).team2 || (m.team2_id ? teamMap[m.team2_id] : undefined),
            } as Match));

            const scores = (scoresResp && scoresResp.scores) || [];
            const scoresMap: Record<number, Record<string, number>> = {};
            scores.forEach((s) => {
              if (!scoresMap[s.hole_number]) scoresMap[s.hole_number] = {};
              scoresMap[s.hole_number][s.user_id] = s.strokes;
            });

            // Enrich matches with hole_results and compute per-match team points so
            // PairingHeaderDetails can calculate overall team points reliably.
            const enrichedMatches: Match[] = await Promise.all(
              (matchesResp || []).map(async (m) => {
                try {
                  const resp = await apiClient.getMatchScores(m.id).catch(() => ({ hole_results: [] } as any));
                  const holeResults = resp.hole_results || [];

                  // Sum team points from hole_results if present
                  let t1 = 0;
                  let t2 = 0;
                  holeResults.forEach((hr: any) => {
                    t1 += hr.team1_points || 0;
                    t2 += hr.team2_points || 0;
                  });

                  return { ...m, hole_results: holeResults, team1_points: t1, team2_points: t2 } as Match;
                } catch (err) {
                  console.warn('Failed to load match scores for', m.id, err);
                  return m;
                }
              })
            );

            return { ...pairing, players: playersResp, matchResults: enrichedMatches, scoresMap, round } as EnrichedPairing;
          } catch (err) {
            console.warn('Failed to enrich pairing', pairing.id, err);
            return { ...pairing, round } as EnrichedPairing;
          }
        })
      );

      setPairingsByRound((p) => ({ ...p, [round.id]: enriched }));
    } catch (err) {
      console.error('Failed to load pairings for round', round.id, err);
    } finally {
      setLoadingPairings((p) => ({ ...p, [round.id]: false }));
    }
  };

  if (!selectedTournamentId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Tournament Selected</h2>
          <p className="text-gray-600">Please select a tournament from the user menu to view scorecards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{selectedTournament?.name || 'Tournament'}</h1>
            <p className="text-green-100">{formatDate(selectedTournament?.start_date)} - {formatDate(selectedTournament?.end_date)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Scorecards</h2>
            <p className="text-sm text-gray-500">Scorecards for every pairing, organized by round</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadRounds}
              className="inline-flex items-center px-3 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100"
            >
              <RefreshCw className="mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {loadingRounds ? (
          <div className="p-8 text-center bg-white rounded-lg shadow">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
            <p className="text-gray-600">Loading rounds...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white rounded-lg shadow">
            <p className="text-red-600 mb-4">{error}</p>
            <button onClick={loadRounds} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Retry</button>
          </div>
        ) : rounds.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg shadow">
            <p className="text-gray-600">No rounds have been created for this tournament.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {rounds.map((round) => (
              <div key={round.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between px-6 py-4 cursor-pointer" onClick={() => toggleRound(round.id)}>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{round.name || `Round ${round.round_number}`}</div>
                    <div className="text-sm text-gray-500">{formatDate(round.round_date)} {round.start_time ? `• ${round.start_time}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-500">{(pairingsByRound[round.id] || []).length} pairings</div>
                      {loadingPairings[round.id] ? (
                        <div className="w-4 h-4 border-b-2 border-gray-300 rounded-full animate-spin" aria-hidden="true" />
                      ) : null}
                    </div>
                    <div className="text-green-600">
                      {expandedRounds[round.id] ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>
                </div>

                {expandedRounds[round.id] && (
                  <div className="px-6 pb-6">
                    {loadingPairings[round.id] ? (
                      <div className="p-6 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                        <p className="text-gray-600">Loading pairings...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {(pairingsByRound[round.id] || []).length === 0 ? (
                          <div className="p-6 text-center bg-white rounded shadow">No pairings for this round.</div>
                        ) : (
                          (pairingsByRound[round.id] || []).map((pairing) => (
                            <div key={pairing.id} className="space-y-4">
                              <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-lg shadow-lg p-6">
                                <PairingHeaderDetails pairing={pairing} overallTeamPoints={calculateOverallTeamPoints(pairing)} />
                              </div>

                              <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg p-6">
                                <h3 className="text-md font-semibold text-gray-900 mb-4">Scorecard</h3>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs table-fixed">
                                    <thead>
                                      <tr>
                                        <th className="w-40 px-2 py-1 text-left">Player</th>
                                        {Array.from({ length: 18 }, (_, i) => (
                                          <th key={i} className="px-1 py-1 text-center">{i + 1}</th>
                                        ))}
                                        <th className="px-2 py-1 text-center">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(pairing.players || []).map((player) => {
                                        const userId = player.user_id;
                                        let total = 0;
                                        const cells = Array.from({ length: 18 }, (_, i) => {
                                          const hole = i + 1;
                                          const val = pairing.scoresMap?.[hole]?.[userId];
                                          if (typeof val === 'number') total += val;
                                          return (
                                            <td key={hole} className="px-1 py-2 text-center text-gray-800">
                                              {typeof val === 'number' && val > 0 ? val : '—'}
                                            </td>
                                          );
                                        });

                                        return (
                                          <tr key={player.id} className="border-t">
                                            <td className="px-2 py-2 text-left align-top">
                                              <div className="font-medium text-gray-900">{player.user?.name || 'Player'}</div>
                                              {player.team && <div className="text-xs text-gray-600">{player.team.name}</div>}
                                            </td>
                                            {cells}
                                            <td className="px-2 py-2 text-center font-semibold">{total > 0 ? total : '—'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scorecards;

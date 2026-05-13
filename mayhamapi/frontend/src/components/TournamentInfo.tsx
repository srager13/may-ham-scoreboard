import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiClient, Round, Pairing, PairingPlayer, Match, HoleResult } from '../services/api';
import { useTournament } from './TournamentContext';
import { PairingHeaderDetails } from './PairingHeaderDetails';
import { MatchesStatusDisplay } from './MatchResultsDisplay';

type EnrichedMatch = Match & { hole_results?: HoleResult[] };

type EnrichedPairing = Pairing & {
  players?: PairingPlayer[];
  matches?: Match[];
  matchResults?: EnrichedMatch[];
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

const TournamentInfo: React.FC = () => {
  const { selectedTournamentId, selectedTournament } = useTournament();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pairingsByRound, setPairingsByRound] = useState<Record<string, EnrichedPairing[]>>({});
  const [loadingPairings, setLoadingPairings] = useState<Record<string, boolean>>({});
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  // Track mounted state to avoid setting state after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Token to identify the latest prefetch/loadRounds invocation. Incrementing
  // this will cause in-progress prefetches for previous tournaments to abort
  // (they check the token before setting state).
  const prefetchTokenRef = useRef(0);

  // Track in-flight requests per round to avoid duplicate fetches
  const inFlightRef = useRef<Record<string, Promise<void>>>({});

  // Concurrency limit for prefetching pairings
  const PREFETCH_CONCURRENCY = 3;

  useEffect(() => {
    if (selectedTournamentId) {
      loadRounds();
    }
  }, [selectedTournamentId]);

  const loadRounds = async () => {
    if (!selectedTournamentId) return;
    setLoadingRounds(true);
    setError(null);
    try {
      const r = await apiClient.getTournamentRounds(selectedTournamentId);
      // sort by round_number ascending
      r.sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
      setRounds(r);

      // Clear any previously cached pairings to ensure fresh data, but do
      // not auto-expand the rounds. We still prefetch pairings for each
      // round in the background to make expanding faster when the user
      // chooses to view a round.
      setPairingsByRound({});

      // Prefetch pairings with limited concurrency. We don't await the whole
      // operation (fire-and-forget) — UI renders immediately and each round
      // will show its own loading indicator while its pairings load.
      const token = ++prefetchTokenRef.current;

      // Helper to run async tasks in limited concurrency
      const runWithConcurrency = async <T,>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) => {
        const executing: Promise<void>[] = [];
        for (const item of items) {
          const p = worker(item).catch((err) => {
            console.warn('Prefetch worker error', err);
          });
          executing.push(p);
          if (executing.length >= concurrency) {
            try {
              await Promise.race(executing);
            } catch {
              // ignore individual errors
            }
            // Remove settled promises
            for (let i = executing.length - 1; i >= 0; i--) {
              if ((executing[i] as any).status === 'settled') {
                executing.splice(i, 1);
              }
            }
            // Fallback: filter out fulfilled/rejected by checking settled via Promise.race above
            // Since JS promises don't expose settled state, keep the array bounded to concurrency
            while (executing.length > concurrency - 1) {
              executing.shift();
            }
          }
        }
        // Wait for remaining
        await Promise.all(executing);
      };

      // Worker simply calls loadPairingsForRound with the token
      runWithConcurrency(r, (rd) => loadPairingsForRound(rd, token), PREFETCH_CONCURRENCY).catch((err) => {
        console.warn('Error prefetching pairings for rounds', err);
      });
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
      // load pairings for this round (use current prefetch token so stale
      // prefetches won't overwrite results for a new tournament)
      const round = rounds.find((r) => r.id === roundId);
      if (round) loadPairingsForRound(round, prefetchTokenRef.current);
    }
  };

  const loadPairingsForRound = async (round: Round, token?: number) => {
    // Ensure only one in-flight request per round — reuse if exists
    if (inFlightRef.current[round.id]) {
      return inFlightRef.current[round.id];
    }

    const activeToken = typeof token === 'number' ? token : prefetchTokenRef.current;

    const promise = (async () => {
      // If token doesn't match current prefetch token, abort early
      if (activeToken !== prefetchTokenRef.current) return;

      if (!isMountedRef.current) return;
      if (isMountedRef.current) setLoadingPairings((p) => ({ ...p, [round.id]: true }));

      try {
        const pairings = await apiClient.getRoundPairings(round.id);

        const enriched = await Promise.all(
          pairings.map(async (pairing) => {
            try {
              const [players, matches] = await Promise.all([
                apiClient.getPairingPlayers(pairing.id),
                apiClient.getPairingMatches(pairing.id),
              ]);

              // For each match, try to fetch hole_results (optional)
              const matchResults: EnrichedMatch[] = await Promise.all(
                (matches || []).map(async (m) => {
                  try {
                    const resp = await apiClient.getMatchScores(m.id);
                    return { ...m, hole_results: resp.hole_results || [] } as EnrichedMatch;
                  } catch (err) {
                    // If fetching match scores fails, return match without results
                    console.warn('Failed to load match scores', m.id, err);
                    return m as EnrichedMatch;
                  }
                })
              );

              return {
                ...pairing,
                players,
                matches,
                matchResults,
                round,
              } as EnrichedPairing;
            } catch (err) {
              console.warn('Failed to enrich pairing', pairing.id, err);
              return { ...pairing, round } as EnrichedPairing;
            }
          })
        );

        // Do not update state if a newer prefetch has started or component
        // has unmounted
        if (activeToken !== prefetchTokenRef.current || !isMountedRef.current) return;

        setPairingsByRound((p) => ({ ...p, [round.id]: enriched }));
      } catch (err) {
        console.error('Failed to load pairings for round', round.id, err);
      } finally {
        if (isMountedRef.current && activeToken === prefetchTokenRef.current) {
          setLoadingPairings((p) => ({ ...p, [round.id]: false }));
        }
      }
    })();

    inFlightRef.current[round.id] = promise;
    try {
      await promise;
    } finally {
      delete inFlightRef.current[round.id];
    }
  };

  if (!selectedTournamentId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Tournament Selected</h2>
          <p className="text-gray-600">Please select a tournament from the user menu to view tournament information.</p>
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
            <h2 className="text-xl font-semibold text-gray-900">Tournament Info</h2>
            <p className="text-sm text-gray-500">Rounds, pairings and matches for this tournament</p>
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
                      {/* Subtle spinner showing prefetch in progress for this round */}
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
                                <PairingHeaderDetails pairing={pairing} />
                              </div>
                              <MatchesStatusDisplay pairing={pairing} />
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

export default TournamentInfo;

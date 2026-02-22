import React from 'react';
import { CheckCircle, Trophy, TrendingUp } from 'lucide-react';
import { Match, MatchPlayer, Pairing, PairingPlayer, HoleResult } from '../services/api';

interface MatchWithResults extends Match {
  hole_results?: HoleResult[];
  match_players?: MatchPlayer[];
}

export interface PairingWithMatchResults extends Pairing {
  matchResults?: MatchWithResults[];
  matches?: Match[];
  players?: PairingPlayer[];
}

interface MatchStatusBoxProps {
  match: Match;
  matchIndex: number;
  pairing: PairingWithMatchResults;
  variant?: 'compact' | 'detailed';
}

const getMatchColorClass = (matchIndex: number): string => {
  const matchColors = ['bg-white-100', 'bg-slate-100', 'bg-blue-50', 'bg-white-100', 'bg-gray-100'];
  return matchColors[matchIndex % matchColors.length];
};

const getMatchColorHex = (matchIndex: number): string => {
  const matchColorHexes = ['#f1f5f9', '#dbeafe', '#f1f5f9', '#dbeafe', '#f3f4f6'];
  return matchColorHexes[matchIndex % matchColorHexes.length];
};

const getMatchesForPairing = (pairing: PairingWithMatchResults): Match[] => {
  if (pairing.matches && pairing.matches.length > 0) {
    return pairing.matches;
  }
  return pairing.matchResults || [];
};

const getMatchForHole = (pairing: PairingWithMatchResults, holeNumber: number): Match | undefined => {
  const matches = getMatchesForPairing(pairing);
  return matches.find((match) => {
    if (match.start_hole !== undefined && match.end_hole !== undefined) {
      return holeNumber >= match.start_hole && holeNumber <= match.end_hole;
    }
    return true;
  });
};

export const MatchStatusBox: React.FC<MatchStatusBoxProps> = ({ match, matchIndex, pairing, variant = 'detailed' }) => {
  const getMatchStatus = () => {
    const matchResult = pairing.matchResults?.find((mr) => mr.id === match.id);
    if (!matchResult?.hole_results) {
      return {
        status: 'AS',
        statusText: 'Not Started',
        statusColor: 'text-gray-500',
        team1Points: 0,
        team2Points: 0,
        holesLeft: match.holes,
        team1Winning: false
      };
    }

    const startHole = match.start_hole || 1;
    const endHole = match.end_hole || 18;
    let team1Points = 0;
    let team2Points = 0;
    let holesPlayed = 0;

    for (let h = startHole; h <= endHole; h++) {
      const holeResult = matchResult.hole_results.find((hr) => hr.hole_number === h);
      if (holeResult) {
        team1Points += holeResult.team1_points;
        team2Points += holeResult.team2_points;
        holesPlayed++;
      }
    }

    const totalHoles = endHole - startHole + 1;
    const holesLeft = totalHoles - holesPlayed;
    const difference = Math.abs(team1Points - team2Points);

    let status = 'AS';
    let statusText = 'TIED';
    let statusColor = 'text-gray-700 font-semibold';
    let leadingTeam;
    let teamColor;

    if (team1Points > team2Points) {
      status = difference === 1 ? '1UP' : `${difference}UP`;
      statusText = status;
      statusColor = 'text-red-700 font-bold';
      leadingTeam = match.team1?.name || 'Team 1';
      teamColor = match.team1?.color || '#DC2626';
    } else if (team2Points > team1Points) {
      status = difference === 1 ? '1UP' : `${difference}UP`;
      statusText = status;
      statusColor = 'text-blue-700 font-bold';
      leadingTeam = match.team2?.name || 'Team 2';
      teamColor = match.team2?.color || '#2563EB';
    } else if (team1Points > 0 || team2Points > 0) {
      statusText = 'TIED';
    } else {
      statusText = 'Not Started';
      statusColor = 'text-gray-500';
    }

    return {
      status,
      statusText,
      statusColor,
      leadingTeam,
      teamColor,
      team1Points,
      team2Points,
      holesLeft,
      team1Winning: team1Points > team2Points
    };
  };

  const matchStatus = getMatchStatus();
  const isTeamMatch = match.format?.players_per_side === 2;

  const team1Players = match.players?.filter((p) => p.team_id === match.team1_id).sort((a, b) => a.player_order - b.player_order) || [];
  const team2Players = match.players?.filter((p) => p.team_id === match.team2_id).sort((a, b) => a.player_order - b.player_order) || [];

  const team1PlayerNames = team1Players.map((p) => p.user?.name).join(' & ') || match.team1?.name || 'Team 1';
  const team2PlayerNames = team2Players.map((p) => p.user?.name).join(' & ') || match.team2?.name || 'Team 2';

  const holeRange = (match.start_hole && match.end_hole)
    ? `Holes ${match.start_hole}-${match.end_hole}`
    : `All ${match.holes} Holes`;

  if (variant === 'compact') {
    const matchColorHex = getMatchColorHex(matchIndex);

    return (
      <div
        className="bg-white border-2 border-gray-300 rounded-lg p-4"
        style={{ borderLeftWidth: '6px', borderLeftColor: matchColorHex }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-400"
              style={{ backgroundColor: matchColorHex }}
            ></div>
            <span className="font-semibold text-gray-900">Match {matchIndex + 1}</span>
            <span className="text-sm text-gray-600">({match.format?.name || 'Unknown Format'})</span>
          </div>
          <div className="text-sm text-gray-600">
            {matchStatus.holesLeft} hole{matchStatus.holesLeft !== 1 ? 's' : ''} to play
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: match.team1?.color || '#DC2626' }}></div>
            <span className="font-medium text-gray-900">
              {isTeamMatch ? team1PlayerNames : (team1Players[0]?.user?.name || match.team1?.name)}
            </span>
            {matchStatus.status !== 'AS' && matchStatus.team1Winning && (
              <span className="ml-2 text-xl font-bold" style={{ color: match.team1?.color || '#DC2626' }}>
                {matchStatus.status}
              </span>
            )}
          </div>
          <span className="mx-2 text-gray-500 text-sm">vs</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: match.team2?.color || '#2563EB' }}></div>
            <span className="font-medium text-gray-900">
              {isTeamMatch ? team2PlayerNames : (team2Players[0]?.user?.name || match.team2?.name)}
            </span>
            {matchStatus.status !== 'AS' && !matchStatus.team1Winning && (
              <span className="ml-2 text-xl font-bold" style={{ color: match.team2?.color || '#2563EB' }}>
                {matchStatus.status}
              </span>
            )}
          </div>
          {matchStatus.status === 'AS' && (
            <div className="ml-4">
              <div className="text-xl font-bold text-gray-600">
                {matchStatus.status}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const matchBgClass = getMatchColorClass(matchIndex);
  const matchColorHex = getMatchColorHex(matchIndex);

  return (
    <div
      className={`${matchBgClass} border-2 border-gray-300 rounded-lg p-4`}
      style={{ borderLeftWidth: '6px', borderLeftColor: matchColorHex }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-4 rounded border border-gray-400"
              style={{ backgroundColor: matchColorHex }}
            ></div>
            <span className="font-semibold text-gray-900">Match {matchIndex + 1}</span>
            <span className="text-sm text-gray-600">({match.format?.name})</span>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: match.team1?.color || '#DC2626' }}></div>
                <span className="font-medium text-gray-900">
                  {team1PlayerNames}
                </span>
              </div>
              <span className="mx-2 text-gray-500">vs</span>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: match.team2?.color || '#2563EB' }}></div>
                <span className="font-medium text-gray-900">
                  {team2PlayerNames}
                </span>
              </div>
            </div>
            <div className="text-gray-600">{holeRange}</div>
          </div>
        </div>
        <div className="text-right ml-4">
          {matchStatus.leadingTeam ? (
            <div>
              <div className="text-xs text-gray-600 mb-1">{matchStatus.leadingTeam}</div>
              <div
                className={`text-2xl ${matchStatus.statusColor}`}
                style={{ color: matchStatus.teamColor }}
              >
                {matchStatus.statusText}
              </div>
            </div>
          ) : (
            <div className={`text-xl ${matchStatus.statusColor}`}>
              {matchStatus.statusText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MatchesStatusDisplay: React.FC<{ pairing: PairingWithMatchResults }> = ({ pairing }) => {
  if (!pairing.matches || pairing.matches.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg mt-6">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b-2 border-gray-300">
        <h3 className="text-lg font-semibold text-gray-900">Matches</h3>
      </div>
      <div className="p-6 space-y-4">
        {pairing.matches.map((match, idx) => (
          <MatchStatusBox
            key={match.id}
            match={match}
            matchIndex={idx}
            pairing={pairing}
            variant="detailed"
          />
        ))}
      </div>
    </div>
  );
};

export const MatchResultsDisplay: React.FC<{ pairing: PairingWithMatchResults }> = ({ pairing }) => {
  if (!pairing.matchResults || pairing.matchResults.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>Match results are being calculated...</p>
      </div>
    );
  }

  const didTeamWinHole = (holeNumber: number, teamId: string): boolean => {
    const match = getMatchForHole(pairing, holeNumber);
    if (!match) return false;

    const matchResult = pairing.matchResults?.find((mr) => mr.id === match.id);
    if (!matchResult?.hole_results) return false;

    const holeResult = matchResult.hole_results.find((hr) => hr.hole_number === holeNumber);
    if (!holeResult) return false;

    return holeResult.winner_team_id === teamId && holeResult.winner_team_id !== null && holeResult.winner_team_id !== undefined;
  };

  const DiagonalPointsCell = ({
    team1Points,
    team2Points,
    team1Color,
    team2Color
  }: {
    team1Points: number;
    team2Points: number;
    team1Color?: string;
    team2Color?: string;
  }) => {
    return (
      <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 100,0 0,100" fill={team1Color || '#999'} opacity="0.3" />
          <polygon points="100,0 100,100 0,100" fill={team2Color || '#999'} opacity="0.3" />
          <line x1="0" y1="100" x2="100" y2="0" stroke="#333" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex items-center justify-between w-full h-full px-2">
          <div className="absolute top-1 left-1 text-xs font-bold text-gray-900">
            {team1Points.toFixed(1)} pts
          </div>
          <div className="absolute bottom-1 right-1 text-xs font-bold text-gray-900">
            {team2Points.toFixed(1)} pts
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center mb-6">
        <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">Match Results</h2>
      </div>

      <MatchesStatusDisplay pairing={pairing} />

      {pairing.matchResults.map((match) => {
        const team1Won = match.team1_points > match.team2_points;
        const team2Won = match.team2_points > match.team1_points;
        const tied = match.team1_points === match.team2_points;

        let team1HolesWon = 0;
        let team2HolesWon = 0;
        let holesHalved = 0;

        if (match.hole_results) {
          match.hole_results.forEach((hr) => {
            if (hr.winner_team_id === match.team1_id) {
              team1HolesWon++;
            } else if (hr.winner_team_id === match.team2_id) {
              team2HolesWon++;
            } else {
              holesHalved++;
            }
          });
        }

        return (
          <div key={match.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Match {match.match_number}: {match.format?.name || 'Unknown Format'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {match.format?.description || ''} • {match.holes} holes
                    {match.start_hole && match.end_hole && (
                      <span> (Holes {match.start_hole}-{match.end_hole})</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-600">Match Points</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {match.points_available.toFixed(1)} available
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={`text-center p-4 rounded-lg ${team1Won ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-center mb-2">
                    {team1Won && <Trophy className="h-5 w-5 text-green-600 mr-2" />}
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: match.team1?.color }}
                    ></div>
                    <div className="font-semibold text-gray-900">{match.team1?.name}</div>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {(() => {
                      if (match.format?.players_per_side === 1) {
                        if (match.match_players && match.match_players.length > 0) {
                          const team1Players = match.match_players
                            .filter((mp) => mp.team_id === match.team1_id)
                            .sort((a, b) => a.player_order - b.player_order);
                          return team1Players[0]?.user?.name || '';
                        }

                        const teamPlayers = (pairing.players || [])
                          .filter((p) => p.team_id === match.team1_id)
                          .sort((a, b) => a.player_order - b.player_order);
                        const playerIndex = (match.match_number - 1) % teamPlayers.length;
                        const player = teamPlayers[playerIndex];
                        return player?.user?.name || '';
                      }

                      if (match.match_players && match.match_players.length > 0) {
                        const team1Players = match.match_players
                          .filter((mp) => mp.team_id === match.team1_id)
                          .sort((a, b) => a.player_order - b.player_order);
                        return team1Players.map((p) => p.user?.name).join(' & ');
                      }

                      const teamPlayers = (pairing.players || [])
                        .filter((p) => p.team_id === match.team1_id)
                        .sort((a, b) => a.player_order - b.player_order);
                      return teamPlayers.map((p) => p.user?.name).join(' & ');
                    })()}
                  </div>
                  <div className="text-4xl font-bold mb-2" style={{ color: match.team1?.color }}>
                    {match.team1_points.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {team1HolesWon} holes won
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-gray-400 mb-2">VS</div>
                  {tied && (
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      Tied
                    </div>
                  )}
                  {holesHalved > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      {holesHalved} hole{holesHalved !== 1 ? 's' : ''} halved
                    </div>
                  )}
                </div>

                <div className={`text-center p-4 rounded-lg ${team2Won ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-center mb-2">
                    {team2Won && <Trophy className="h-5 w-5 text-green-600 mr-2" />}
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: match.team2?.color }}
                    ></div>
                    <div className="font-semibold text-gray-900">{match.team2?.name}</div>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {(() => {
                      if (match.format?.players_per_side === 1) {
                        if (match.match_players && match.match_players.length > 0) {
                          const team2Players = match.match_players
                            .filter((mp) => mp.team_id === match.team2_id)
                            .sort((a, b) => a.player_order - b.player_order);
                          return team2Players[0]?.user?.name || '';
                        }

                        const teamPlayers = (pairing.players || [])
                          .filter((p) => p.team_id === match.team2_id)
                          .sort((a, b) => a.player_order - b.player_order);
                        const playerIndex = (match.match_number - 1) % teamPlayers.length;
                        const player = teamPlayers[playerIndex];
                        return player?.user?.name || '';
                      }

                      if (match.match_players && match.match_players.length > 0) {
                        const team2Players = match.match_players
                          .filter((mp) => mp.team_id === match.team2_id)
                          .sort((a, b) => a.player_order - b.player_order);
                        return team2Players.map((p) => p.user?.name).join(' & ');
                      }

                      const teamPlayers = (pairing.players || [])
                        .filter((p) => p.team_id === match.team2_id)
                        .sort((a, b) => a.player_order - b.player_order);
                      return teamPlayers.map((p) => p.user?.name).join(' & ');
                    })()}
                  </div>
                  <div className="text-4xl font-bold mb-2" style={{ color: match.team2?.color }}>
                    {match.team2_points.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {team2HolesWon} holes won
                  </div>
                </div>
              </div>

              {match.hole_results && match.hole_results.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    View Hole-by-Hole Results ({match.hole_results.length} holes)
                  </summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hole</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{ color: match.team1?.color }}>
                            {match.team1?.name}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{ color: match.team2?.color }}>
                            {match.team2?.name}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Result</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {match.hole_results.map((hr) => {
                          const isHighLow = match.format?.scoring_type === 'high_low';

                          return (
                            <tr key={hr.hole_number} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                {hr.hole_number}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isHighLow ? (
                                  <span className="text-xs text-gray-500 italic">High-Low</span>
                                ) : (
                                  <span className={hr.winner_team_id === match.team1_id ? 'font-bold text-green-600' : ''}>
                                    {hr.team1_score !== undefined && hr.team1_score !== null ? hr.team1_score : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isHighLow ? (
                                  <span className="text-xs text-gray-500 italic">Format</span>
                                ) : (
                                  <span className={hr.winner_team_id === match.team2_id ? 'font-bold text-green-600' : ''}>
                                    {hr.team2_score !== undefined && hr.team2_score !== null ? hr.team2_score : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {isHighLow ? (
                                  <div className="flex items-center justify-center gap-2 text-xs">
                                    <span style={{ color: match.team1?.color }} className="font-semibold">
                                      {hr.team1_points}
                                    </span>
                                    <span className="text-gray-400">-</span>
                                    <span style={{ color: match.team2?.color }} className="font-semibold">
                                      {hr.team2_points}
                                    </span>
                                    <span className="text-gray-500 ml-1">pts</span>
                                  </div>
                                ) : (
                                  <div>
                                    {hr.winner_team_id === match.team1_id && (
                                      <CheckCircle
                                        className="h-5 w-5 mx-auto"
                                        style={{ color: match.team1?.color }}
                                      />
                                    )}
                                    {hr.winner_team_id === match.team2_id && (
                                      <CheckCircle
                                        className="h-5 w-5 mx-auto"
                                        style={{ color: match.team2?.color }}
                                      />
                                    )}
                                    {!hr.winner_team_id && (
                                      <span className="text-gray-400">Halved</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pairing Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          {(() => {
            const teamPoints = new Map<string, number>();
            pairing.matchResults?.forEach((match) => {
              const team1Id = match.team1_id;
              const team2Id = match.team2_id;
              teamPoints.set(team1Id, (teamPoints.get(team1Id) || 0) + match.team1_points);
              teamPoints.set(team2Id, (teamPoints.get(team2Id) || 0) + match.team2_points);
            });

            return Array.from(teamPoints.entries()).map(([teamId, points]) => {
              const team = pairing.matchResults?.[0]?.team1_id === teamId
                ? pairing.matchResults[0].team1
                : pairing.matchResults?.[0]?.team2;

              if (!team) return null;

              return (
                <div key={teamId} className="bg-white rounded-lg p-4 shadow">
                  <div className="flex items-center mb-2">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: team.color }}
                    ></div>
                    <div className="font-semibold text-gray-900">{team.name}</div>
                  </div>
                  <div className="text-3xl font-bold" style={{ color: team.color }}>
                    {points.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">
                    total points earned
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};

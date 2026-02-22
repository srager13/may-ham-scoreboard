import React from 'react';
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


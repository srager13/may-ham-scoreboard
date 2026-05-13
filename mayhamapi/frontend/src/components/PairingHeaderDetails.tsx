import React from 'react';
import { MapPin } from 'lucide-react';
import { Match, Pairing, PairingPlayer, Round, Team } from '../services/api';

interface MatchWithResults extends Match {
  hole_results?: Array<{
    team1_points: number;
    team2_points: number;
  }>;
}

export interface PairingHeaderData extends Pairing {
  round?: Round;
  players?: PairingPlayer[];
  matchResults?: MatchWithResults[];
}

interface PairingHeaderDetailsProps {
  pairing: PairingHeaderData;
  overallTeamPoints?: Record<string, number>;
}

const getSortedPlayers = (players: PairingPlayer[] | undefined) => {
  if (!players) return [];
  return [...players].sort((a, b) => {
    if (a.team_id !== b.team_id) {
      return a.team_id.localeCompare(b.team_id);
    }
    return (a.player_order || 0) - (b.player_order || 0);
  });
};

const getTeamsFromPairing = (pairing: PairingHeaderData) => {
  const teamMap = new Map<string, Team>();

  (pairing.players || []).forEach((player) => {
    if (player.team) {
      teamMap.set(player.team.id, player.team);
    }
  });

  (pairing.matchResults || []).forEach((match) => {
    if (match.team1) {
      teamMap.set(match.team1.id, match.team1);
    }
    if (match.team2) {
      teamMap.set(match.team2.id, match.team2);
    }
  });

  return Array.from(teamMap.values());
};

const calculateOverallTeamPoints = (pairing: PairingHeaderData) => {
  const teamPoints: Record<string, number> = {};
  (pairing.matchResults || []).forEach((match) => {
    // Prefer aggregate fields if present; fall back to summing hole_results.
    const t1 = typeof (match as any).team1_points === 'number'
      ? (match as any).team1_points
      : (match.hole_results ? match.hole_results.reduce((acc, hr) => acc + (hr.team1_points || 0), 0) : 0);

    const t2 = typeof (match as any).team2_points === 'number'
      ? (match as any).team2_points
      : (match.hole_results ? match.hole_results.reduce((acc, hr) => acc + (hr.team2_points || 0), 0) : 0);

    if (match.team1_id) {
      teamPoints[match.team1_id] = (teamPoints[match.team1_id] || 0) + (t1 || 0);
    }
    if (match.team2_id) {
      teamPoints[match.team2_id] = (teamPoints[match.team2_id] || 0) + (t2 || 0);
    }
  });
  return teamPoints;
};

export const PairingHeaderDetails: React.FC<PairingHeaderDetailsProps> = ({ pairing, overallTeamPoints }) => {
  const players = getSortedPlayers(pairing.players).map((player) => player.user?.name).filter(Boolean);
  const teamPoints = overallTeamPoints || calculateOverallTeamPoints(pairing);
  const teams = getTeamsFromPairing(pairing);

  return (
    <div>
      <p className="text-green-100 text-sm">
        {pairing.round ? `${pairing.round.name} - Pairing ${pairing.pairing_number}` : `Pairing ${pairing.pairing_number}`}
        {pairing.tee_time && (
          <span className="ml-2">
            @ {new Date(pairing.tee_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            })}
          </span>
        )}
      </p>
      {pairing.round?.golf_course && (
        <p className="text-green-100 text-sm mt-1">
          <MapPin className="inline h-3.5 w-3.5 mr-1" />
          {pairing.round.golf_course.course_name}
          {pairing.round.golf_course.city && pairing.round.golf_course.state && (
            <span className="ml-1 text-green-200">
              ({pairing.round.golf_course.city}, {pairing.round.golf_course.state})
            </span>
          )}
        </p>
      )}
      <p className="text-green-100 text-sm mt-1">
        Players: {players.length > 0 ? players.join(', ') : 'TBD'}
      </p>
      {teams.length > 0 && (
        <div className="flex items-center justify-end space-x-2 mt-3">
          {teams.map((team, idx) => {
            const points = teamPoints[team.id] || 0;
            return (
              <div
                key={team.id}
                className="flex items-center space-x-2 bg-white bg-opacity-20 px-3 py-2 rounded"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: team.color || (idx === 0 ? '#DC2626' : '#2563EB') }}
                />
                <span className="font-semibold">{team.name}</span>
                <span className="ml-2 font-bold">{points.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

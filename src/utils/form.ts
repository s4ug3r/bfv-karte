/**
 * Ergebnisse, Form ("S-S-U-N-S") und nächste Spiele einer Mannschaft aus ihrem BFV-Spielplan.
 */
import type { BfvMatch } from '../services/bfv/bfvClient';
import { parseKickoff } from './date';

export type Outcome = 'S' | 'U' | 'N';

export interface TeamGame {
  matchId: string;
  kickoff: string;
  /** Spielt die betrachtete Mannschaft zu Hause? */
  home: boolean;
  homeTeam: string;
  awayTeam: string;
  opponent: string;
  competition: string;
  /** nur bei gespielten Spielen */
  goalsFor?: number;
  goalsAgainst?: number;
  outcome?: Outcome;
}

/** "2:1", "2 : 1" → { home: 2, away: 1 }; abgesetzte/leere Ergebnisse → null. */
export function parseResult(result: string | null | undefined): { home: number; away: number } | null {
  const m = /(\d{1,2})\s*:\s*(\d{1,2})/.exec(result ?? '');
  return m ? { home: Number(m[1]), away: Number(m[2]) } : null;
}

function toGame(m: BfvMatch, teamId: string): TeamGame | null {
  if (!m.kickoffDate) return null;
  const kickoff = parseKickoff(m.kickoffDate, m.kickoffTime ?? undefined);
  if (!kickoff) return null;
  const home = m.homeTeamPermanentId === teamId;
  if (!home && m.guestTeamPermanentId !== teamId) return null;
  const game: TeamGame = {
    matchId: m.matchId,
    kickoff,
    home,
    homeTeam: m.homeTeamName,
    awayTeam: m.guestTeamName,
    opponent: home ? m.guestTeamName : m.homeTeamName,
    competition: m.competitionName,
  };
  const r = parseResult(m.result);
  if (r) {
    game.goalsFor = home ? r.home : r.away;
    game.goalsAgainst = home ? r.away : r.home;
    game.outcome = game.goalsFor > game.goalsAgainst ? 'S' : game.goalsFor < game.goalsAgainst ? 'N' : 'U';
  }
  return game;
}

/** Letzte gespielte Spiele mit Ergebnis, neueste zuerst. */
export function recentGames(matches: BfvMatch[], teamId: string, now = new Date(), limit = 5): TeamGame[] {
  return matches
    .map((m) => toGame(m, teamId))
    .filter((g): g is TeamGame => !!g?.outcome && new Date(g.kickoff) <= now)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, limit);
}

/** Nächste Spiele (noch nicht angepfiffen), früheste zuerst. */
export function upcomingGames(
  matches: BfvMatch[],
  teamId: string,
  now = new Date(),
  limit = 3,
  excludeMatchId?: string,
): TeamGame[] {
  return matches
    .map((m) => toGame(m, teamId))
    .filter((g): g is TeamGame => !!g && !g.outcome && new Date(g.kickoff) > now && g.matchId !== excludeMatchId)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, limit);
}

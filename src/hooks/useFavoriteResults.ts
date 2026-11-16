import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchTeamMatchesCached } from '../services/bfv/bfvClient';
import type { AreaIndex } from '../services/bfv/areaIndex';
import type { Match } from '../types/match';
import { clubKey } from '../utils/favorites';
import { recentGames, type TeamGame } from '../utils/form';

/** Höchstens so viele Mannschaften abfragen – die Spielpläne sind meist schon zwischengespeichert. */
const MAX_TEAMS = 16;
const RECENT_DAYS = 8;

export interface FavoriteResult extends TeamGame {
  /** Spielstand aus Sicht des Heimteams, z. B. "2:1" */
  score: string;
}

/**
 * Ergebnisse der letzten Tage für "Meine Vereine". Die Mannschaften der gemerkten Vereine
 * kommen aus dem erkundeten Verzeichnis und den geladenen Spielen (nur BFV-Daten).
 */
export function useFavoriteResults(index: AreaIndex, matches: Match[], keys: ReadonlySet<string>, now: Date) {
  const teamIds = useMemo(() => {
    if (keys.size === 0) return [];
    const ids = new Set<string>();
    for (const club of Object.values(index.clubs)) {
      for (const t of club.teams ?? []) {
        if (keys.has(clubKey(t.name || club.name))) ids.add(t.id);
      }
    }
    for (const m of matches) {
      if (!m.bfv) continue;
      if (keys.has(clubKey(m.homeTeam))) ids.add(m.bfv.homeTeamId);
      if (keys.has(clubKey(m.awayTeam))) ids.add(m.bfv.awayTeamId);
    }
    return [...ids].sort().slice(0, MAX_TEAMS);
  }, [index, matches, keys]);

  const queries = useQueries({
    queries: teamIds.map((id) => ({
      queryKey: ['teamPlan', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchTeamMatchesCached(id, signal),
      staleTime: 15 * 60 * 1000,
      gcTime: 6 * 60 * 60 * 1000,
      retry: 0,
    })),
  });

  const stamp = queries.map((q) => q.dataUpdatedAt).join(',');
  const dayKey = now.toISOString().slice(0, 13); // stündlich neu berechnen reicht

  return useMemo(() => {
    const since = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();
    const out: FavoriteResult[] = [];
    teamIds.forEach((id, i) => {
      const data = queries[i]?.data;
      if (!data) return;
      for (const g of recentGames(data.matches, id, now, 3)) {
        if (new Date(g.kickoff).getTime() < since || seen.has(g.matchId)) continue;
        seen.add(g.matchId);
        const score = g.home ? `${g.goalsFor}:${g.goalsAgainst}` : `${g.goalsAgainst}:${g.goalsFor}`;
        out.push({ ...g, score });
      }
    });
    return {
      results: out.sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 4),
      loading: queries.some((q) => q.isPending && q.fetchStatus !== 'idle'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIds, stamp, dayKey]);
}

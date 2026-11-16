/**
 * "Meine Vereine": gemerkte Vereine. Ein Verein wird über seinen normalisierten Namen erkannt,
 * abgeleitet aus dem Mannschaftsnamen ("TSV Dachau 1865 U15" → "tsv dachau 1865").
 * So gilt ein Stern für alle Mannschaften des Vereins – egal aus welcher Datenquelle.
 */
import { clubNameFromTeam } from '../services/providers/bfvWidgetProvider';
import type { Match } from '../types/match';
import { normalizeText } from './text';

export interface FavoriteClub {
  key: string;
  name: string;
}

export const clubKey = (teamName: string) => normalizeText(clubNameFromTeam(teamName));

/** Anzeigename des Vereins zu einem Mannschaftsnamen. */
export const clubName = (teamName: string) => clubNameFromTeam(teamName) || teamName;

export function involvesFavorite(m: Match, keys: ReadonlySet<string>): boolean {
  return keys.size > 0 && (keys.has(clubKey(m.homeTeam)) || keys.has(clubKey(m.awayTeam)));
}

/** Gespeicherte Liste prüfen (localStorage kann alt oder manipuliert sein). */
export function sanitizeFavorites(stored: unknown): FavoriteClub[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const out: FavoriteClub[] = [];
  for (const f of stored) {
    if (!f || typeof f !== 'object') continue;
    const { key, name } = f as Partial<FavoriteClub>;
    if (typeof key !== 'string' || typeof name !== 'string' || !key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name: name.slice(0, 120) });
  }
  return out.slice(0, 50);
}

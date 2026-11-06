import type { Match } from '../types/match';
import { normalizeText } from './text';

/**
 * Schlüssel für die Duplikaterkennung: Spielstätte + Anstoßzeit + Paarung.
 *
 * Die Paarung gehört bewusst dazu: Auf großen Anlagen laufen samstags oft mehrere
 * Jugendspiele parallel auf verschiedenen Kleinfeldern – das sind echte, verschiedene
 * Spiele. Doppelte Einträge desselben Spiels (z. B. weil eine Quelle es in zwei
 * Wettbewerben listet oder zwei Quellen zusammengeführt wurden) werden dagegen entfernt.
 */
export function dedupeKey(match: Match): string {
  const v = match.venue;
  const venuePart =
    normalizeText([v.name, v.street, v.postalCode, v.city].filter(Boolean).join(' ')) ||
    (v.location ? `${v.location.lat.toFixed(4)},${v.location.lng.toFixed(4)}` : '');
  const time = new Date(match.kickoff).getTime();
  return [venuePart, time, normalizeText(match.homeTeam), normalizeText(match.awayTeam)].join('|');
}

/**
 * Entfernt doppelte Spiele. Behält das erste Vorkommen, übernimmt aber fehlende
 * Angaben (Detail-Link, Altersklasse, Koordinaten) aus späteren Duplikaten.
 */
export function dedupeMatches<T extends Match>(matches: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const m of matches) {
    const key = dedupeKey(m);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, m);
      continue;
    }
    byKey.set(key, {
      ...existing,
      detailUrl: existing.detailUrl ?? m.detailUrl,
      ageClass: existing.ageClass ?? m.ageClass,
      category: existing.category === 'unbekannt' ? m.category : existing.category,
      venue: { ...existing.venue, location: existing.venue.location ?? m.venue.location },
    });
  }
  return [...byKey.values()];
}

/**
 * Verarbeitungs-Pipeline zwischen Data-Provider und UI:
 *   1. Spiele laden (Provider)
 *   2. fehlende Koordinaten per Geocoding ergänzen
 *   3. Entfernung berechnen, auf Radius + Zeitraum filtern, Duplikate entfernen
 *   4. Nutzerfilter (Kategorie, Altersklasse/Liga, Freitext) anwenden und sortieren
 * Schritte 1–2 laufen in React Query (gecacht), 3–4 synchron im Client.
 */
import type { CategoryFilter, Filters } from '../types/filters';
import type { LatLng, LocatedMatch, Match, MatchWithDistance } from '../types/match';
import type { MatchDataProvider, MatchQuery } from '../types/provider';
import { classifyCategory, matchesClassFilter } from '../utils/classify';
import { dedupeMatches } from '../utils/dedupe';
import { haversineKm, isValidLatLng } from '../utils/distance';
import { formatVenueAddress } from '../utils/maps';
import { matchesSearch } from '../utils/text';
import { findPlace, geocodeAddress, type FoundPlace } from './googleMaps';

export interface LoadedMatches {
  matches: LocatedMatch[];
  /** Spiele, deren Spielstätte nicht verortet werden konnte. */
  unresolvedCount: number;
}

/** Führt asynchrone Aufgaben mit begrenzter Parallelität aus (schont Geocoding-Kontingent). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Schlüssel, unter dem eine Spielstätte verortet wird: Suchbegriff oder Adresse. */
const lookupKey = (v: Match['venue']) => (v.searchQuery ? `q:${v.searchQuery}` : `a:${formatVenueAddress(v, true)}`);

/**
 * Ergänzt fehlende Koordinaten – per Adress-Geocoding oder, wenn nur ein Suchbegriff
 * bekannt ist (BFV-Schnittstelle), per Places-Textsuche nach dem Platz des Heimvereins.
 * Ohne Google-Zustimmung bleiben sie offen.
 */
export async function resolveLocations(matches: Match[], geocodingEnabled: boolean): Promise<LoadedMatches> {
  const pending = new Map<string, Match['venue']>();
  for (const m of matches) {
    if (!isValidLatLng(m.venue.location)) {
      const key = lookupKey(m.venue);
      if (key.length > 2 && !pending.has(key)) pending.set(key, m.venue);
    }
  }

  const resolved = new Map<string, FoundPlace | null>();
  if (geocodingEnabled && pending.size > 0) {
    const entries = [...pending.entries()];
    const found = await mapLimit(entries, 4, async ([, venue]) =>
      venue.searchQuery
        ? findPlace(venue.searchQuery)
        : geocodeAddress(`${formatVenueAddress(venue, true)}, Deutschland`).then((p) => (p ? { location: p } : null)),
    );
    entries.forEach(([key], i) => resolved.set(key, found[i]));
  }

  const located: LocatedMatch[] = [];
  let unresolvedCount = 0;
  for (const m of matches) {
    if (isValidLatLng(m.venue.location)) {
      located.push({ ...m, venue: { ...m.venue, location: m.venue.location } });
      continue;
    }
    const hit = resolved.get(lookupKey(m.venue));
    if (!hit) {
      unresolvedCount++;
      continue;
    }
    located.push({
      ...m,
      venue: {
        ...m.venue,
        location: hit.location,
        // Gefundenen Platznamen/Adresse übernehmen (bei Suche über den Heimverein)
        name: m.venue.searchQuery && hit.name ? hit.name : m.venue.name,
        street: m.venue.street ?? (m.venue.searchQuery ? hit.address : undefined),
      },
    });
  }
  return { matches: located, unresolvedCount };
}

/** Lädt Spiele über den Provider und ergänzt Kategorie + Koordinaten. */
export async function loadMatches(
  provider: MatchDataProvider,
  query: MatchQuery,
  geocodingEnabled: boolean,
  signal?: AbortSignal,
): Promise<LoadedMatches> {
  const raw = await provider.fetchMatches(query, signal);
  const classified = raw.map((m) =>
    m.category && m.category !== 'unbekannt'
      ? m
      : { ...m, category: classifyCategory(m.competition, m.homeTeam, m.awayTeam, m.ageClass) },
  );
  return resolveLocations(classified, geocodingEnabled);
}

/**
 * Räumliche und zeitliche Filterung: nur Spiele innerhalb des Radius und im Zeitraum,
 * ohne Duplikate, mit Entfernung. Unabhängig von den Nutzerfiltern, damit sich daraus
 * auch Zähler pro Kategorie ableiten lassen.
 */
export function filterByAreaAndTime(
  matches: LocatedMatch[],
  center: LatLng,
  radiusKm: number,
  from: Date,
  to: Date,
): MatchWithDistance[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const inArea = matches
    .map((m) => ({ ...m, distanceKm: haversineKm(center, m.venue.location) }))
    .filter((m) => {
      const t = new Date(m.kickoff).getTime();
      return m.distanceKm <= radiusKm && t >= fromMs && t <= toMs;
    });
  return dedupeMatches(inArea);
}

const categoryMatches = (m: Match, c: CategoryFilter) => c === 'alle' || m.category === c;

/** Nutzerfilter anwenden und nach Anstoß (dann Entfernung) sortieren. */
export function applyUserFilters(
  matches: MatchWithDistance[],
  filters: Pick<Filters, 'category' | 'classFilter' | 'search'>,
): MatchWithDistance[] {
  return matches
    .filter((m) => categoryMatches(m, filters.category))
    .filter((m) => matchesClassFilter(m, filters.classFilter))
    .filter((m) =>
      matchesSearch(filters.search, [
        m.homeTeam,
        m.awayTeam,
        m.competition,
        m.ageClass,
        m.venue.name,
        m.venue.city,
        m.venue.postalCode,
        m.venue.street,
      ]),
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.distanceKm - b.distanceKm);
}

/** Anzahl Spiele je Kategorie (für Zähler an den Filter-Schaltern). */
export function countByCategory(matches: Match[]): Record<CategoryFilter, number> {
  const counts = { alle: matches.length, herren: 0, jugend: 0 };
  for (const m of matches) {
    if (m.category === 'herren') counts.herren++;
    else if (m.category === 'jugend') counts.jugend++;
  }
  return counts;
}

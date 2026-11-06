/**
 * Kostenlose Ortssuche über OpenStreetMap – ohne API-Key und ohne Abrechnung.
 *
 *   1. Photon (https://photon.komoot.io) – schnell, mehrere Anfragen parallel (faire Nutzung)
 *   2. Nominatim als Reserve, falls Photon nicht erreichbar ist
 * Jeder Ort wird pro Sitzung nur einmal gesucht (viele Vereine teilen sich einen Ort).
 *
 * Nominatim-Nutzungsbedingungen (https://operations.osmfoundation.org/policies/nominatim/):
 *   - höchstens 1 Anfrage pro Sekunde  → Anfragen werden hier nacheinander mit Pause gestellt
 *   - Ergebnisse cachen                → erledigt der Cache in googleMaps.ts (30 Tage)
 *   - Quellenangabe "© OpenStreetMap-Mitwirkende" → steht in der Fußzeile
 * Für viele Nutzer gleichzeitig sollte ein eigener Geocoding-Dienst genutzt werden.
 */
import type { LatLng } from '../types/match';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
/** Bayern als Suchrechteck (links, oben, rechts, unten) */
const BAVARIA_VIEWBOX = '8.97,50.57,13.84,47.27';
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

export interface OsmPlace {
  location: LatLng;
  address?: string;
}

/** Eine Nominatim-Suche, global auf max. 1 Anfrage/Sekunde gedrosselt. */
export function nominatimSearch(query: string): Promise<OsmPlace | null> {
  const run = async (): Promise<OsmPlace | null> => {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      countrycodes: 'de',
      viewbox: BAVARIA_VIEWBOX,
      bounded: '1',
      limit: '1',
      'accept-language': 'de',
    });
    const res = await fetch(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenStreetMap-Suche: HTTP ${res.status}`);
    const results = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
    const hit = results[0];
    if (!hit) return null;
    const location = { lat: Number(hit.lat), lng: Number(hit.lon) };
    return Number.isFinite(location.lat) && Number.isFinite(location.lng)
      ? { location, address: hit.display_name }
      : null;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Vereinskürzel und Zusätze, die nicht zum Ortsnamen gehören. */
const CLUB_WORDS = new Set(
  [
    'tsv', 'sv', 'fc', 'sc', 'spvgg', 'spvg', 'asv', 'tus', 'djk', 'sg', 'fsv', 'bsc', 'esv', 'tsg', 'ssv',
    'vfb', 'vfl', 'vfr', 'tv', 'tsc', 'ft', 'fv', 'sk', 'ksv', 'psv', 'post', 'ssg', 'jfg', 'spg', 'bc', 'kv',
    'eintracht', 'germania', 'kickers', 'concordia', 'union', 'rot', 'weiss', 'weiß', 'blau', 'schwarz',
    'gruen', 'grün', 'sportfreunde', 'sportverein', 'turnverein', 'fussballclub', 'fußballclub', 'ev', 'e', 'v',
    'sportplatz', 'fussball', 'fußball', 'ii', 'iii', 'iv', 'ah',
  ].map((w) => w.toLowerCase()),
);

/**
 * Leitet aus einem Vereinsnamen den Ort ab:
 * "ASV Eggstätt" → "Eggstätt", "TSV 1865 Dachau e.V." → "Dachau",
 * "SV Rot-Weiß Unterhaching Sportplatz" → "Unterhaching", "1. FC Garmisch-Partenkirchen" → "Garmisch-Partenkirchen".
 */
export function townFromClubName(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, ' ')
    .replace(/\be\.\s?V\.?/gi, ' ')
    .split(/[\s/]+/)
    .map((w) => w.replace(/^[.,;:]+|[.,;:]+$/g, ''))
    .filter(Boolean);
  const kept = words.filter((w) => {
    const lower = w.toLowerCase();
    if (/^\d+\.?$/.test(w)) return false; // Gründungsjahr, "1."
    if (CLUB_WORDS.has(lower)) return false;
    // zusammengesetzte Vereinsfarben wie "Rot-Weiß", "Blau-Gelb"
    if (lower.split('-').every((p) => CLUB_WORDS.has(p) || /^(gelb|weiss|weiß|rot|blau|schwarz|grün|gruen)$/.test(p))) {
      return false;
    }
    return true;
  });
  return kept.join(' ').trim();
}

// ─── Photon ────────────────────────────────────────────────────────────────

const PHOTON = 'https://photon.komoot.io/api/';
/** Bayern als bbox: minLon, minLat, maxLon, maxLat */
const BAVARIA_BBOX = '8.97,47.27,13.84,50.57';
const PHOTON_PARALLEL = 6;
let photonActive = 0;
const photonWaiting: (() => void)[] = [];

async function withPhotonSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (photonActive >= PHOTON_PARALLEL) await new Promise<void>((r) => photonWaiting.push(r));
  photonActive++;
  try {
    return await fn();
  } finally {
    photonActive--;
    photonWaiting.shift()?.();
  }
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; city?: string; postcode?: string; countrycode?: string; state?: string };
}

export function photonSearch(query: string): Promise<OsmPlace | null> {
  return withPhotonSlot(async () => {
    const params = new URLSearchParams({ q: query, limit: '3', lang: 'de', bbox: BAVARIA_BBOX });
    const res = await fetch(`${PHOTON}?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Photon: HTTP ${res.status}`);
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const hit = (json.features ?? []).find((f) => !f.properties?.countrycode || f.properties.countrycode === 'DE');
    const c = hit?.geometry?.coordinates;
    if (!c) return null;
    const p = hit?.properties ?? {};
    return {
      location: { lat: c[1], lng: c[0] },
      address: [p.name, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined,
    };
  });
}

// ─── Kombiniert, mit Ortscache ─────────────────────────────────────────────

const townCache = new Map<string, Promise<OsmPlace | null>>();

/** Photon, bei Fehler Nominatim. Gleiche Suchbegriffe werden zusammengelegt. */
export function openSearch(query: string): Promise<OsmPlace | null> {
  const key = query.trim().toLowerCase();
  const hit = townCache.get(key);
  if (hit) return hit;
  const value = (async () => {
    try {
      return await photonSearch(query);
    } catch (err) {
      console.info('[OpenStreetMap] Photon nicht erreichbar, nutze Nominatim:', err);
      return nominatimSearch(query);
    }
  })();
  townCache.set(key, value);
  value.catch(() => townCache.delete(key)); // Fehler nicht merken
  return value;
}

// ─── Freie Ortssuche ohne Google (Ersatz für die Google-Vorschläge) ─────────

/** Sucht einen Ort/PLZ in Bayern über OpenStreetMap. */
export async function searchTownFree(query: string): Promise<{ location: LatLng; label: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const { placeIndexWithin, lookupPlace } = await import('./placeIndex');
  if (!/\d/.test(q)) {
    const index = await placeIndexWithin(4000);
    const hit = index ? lookupPlace(index, q) : null;
    if (hit) return { location: hit, label: q };
  }
  const found = await openSearch(q);
  return found ? { location: found.location, label: found.address ?? q } : null;
}

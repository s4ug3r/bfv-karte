/**
 * Kostenlose Ortssuche über OpenStreetMap (Nominatim) – ohne API-Key und ohne Abrechnung.
 *
 * Nutzungsbedingungen (https://operations.osmfoundation.org/policies/nominatim/):
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

/**
 * Ortsverzeichnis Bayern aus OpenStreetMap – für die Vereinssuche ohne Google.
 *
 * Statt jeden Verein einzeln bei einem Geocoder zu suchen, lädt die App EINMAL alle
 * Städte, Märkte, Dörfer und Stadtteile Bayerns (Overpass API, kompaktes CSV) und schlägt
 * danach lokal nach – in Millisekunden. Gleichnamige Orte ("Kirchdorf" gibt es dutzendfach)
 * werden über die Nähe zum Suchmittelpunkt aufgelöst.
 *
 * Daten © OpenStreetMap-Mitwirkende (ODbL). Gespeichert 30 Tage im localStorage.
 */
import type { LatLng } from '../types/match';
import { haversineKm } from '../utils/distance';
import { readJson, writeJson } from '../utils/storage';

const STORAGE_KEY = 'bfv.places.v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Alle benannten Orte in Bayern als CSV "lat|lon|name" (ohne Kopfzeile). */
const QUERY = `[out:csv(::lat,::lon,"name";false;"|")][timeout:120];
area["ISO3166-2"="DE-BY"]["admin_level"="4"]->.by;
node(area.by)["place"~"^(city|town|village|suburb|quarter)$"]["name"];
out;`;

/** Normalisierter Ortsname → Koordinaten (mehrere bei gleichnamigen Orten). */
export type PlaceIndex = Map<string, LatLng[]>;

/** Für den Abgleich: klein, Umlaute vereinheitlicht, Zusätze wie "a.d." entfernt. */
export function normPlace(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\bst\.\s?/g, 'sankt ')
    .replace(/[.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** CSV aus Overpass in ein Nachschlage-Verzeichnis umwandeln. */
export function parsePlacesCsv(csv: string): PlaceIndex {
  const index: PlaceIndex = new Map();
  for (const line of csv.split('\n')) {
    const [lat, lon, ...nameParts] = line.split('|');
    const name = nameParts.join('|').trim();
    const p = { lat: Number(lat), lng: Number(lon) };
    if (!name || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const key = normPlace(name);
    const list = index.get(key);
    if (list) list.push(p);
    else index.set(key, [p]);
  }
  return index;
}

/**
 * Sucht einen Ort aus einem Vereins-/Ortsnamen. Probiert den ganzen Namen, dann die
 * einzelnen Wörter und Bindestrich-Teile ("Dachau-Ost" → "Dachau", "München-Pasing" → "Pasing").
 * Bei mehreren Treffern gewinnt der Ort, der `near` am nächsten liegt.
 */
export function lookupPlace(index: PlaceIndex, town: string, near?: LatLng): LatLng | null {
  const full = normPlace(town);
  if (!full) return null;
  const words = full.split(' ');
  const variants = [
    full,
    ...words.flatMap((w) => [w, ...w.split('-')]).reverse(), // spätere Wörter zuerst (meist der Ort)
  ].filter((v) => v.length >= 3);

  for (const v of [...new Set(variants)]) {
    const hits = index.get(v);
    if (!hits?.length) continue;
    if (!near || hits.length === 1) return hits[0];
    return hits.reduce((best, p) => (haversineKm(near, p) < haversineKm(near, best) ? p : best));
  }
  return null;
}

// ─── Laden & Speichern ─────────────────────────────────────────────────────

let loading: Promise<PlaceIndex | null> | null = null;

interface Stored {
  t: number;
  /** kompakt: [name, lat, lng] */
  p: [string, number, number][];
}

/**
 * Lädt das Ortsverzeichnis (aus dem Speicher oder per Overpass). Gibt null zurück,
 * wenn es nicht verfügbar ist – die Suche fällt dann auf Photon/Nominatim zurück.
 */
export function loadPlaceIndex(): Promise<PlaceIndex | null> {
  if (loading) return loading;
  loading = (async () => {
    const stored = readJson<Stored | null>(STORAGE_KEY, null);
    if (stored && Date.now() - stored.t < TTL_MS && Array.isArray(stored.p) && stored.p.length > 1000) {
      const index: PlaceIndex = new Map();
      for (const [name, lat, lng] of stored.p) {
        const list = index.get(name);
        if (list) list.push({ lat, lng });
        else index.set(name, [{ lat, lng }]);
      }
      return index;
    }

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(QUERY)}`,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const index = parsePlacesCsv(await res.text());
        if (index.size < 1000) throw new Error(`nur ${index.size} Orte erhalten`);
        // kompakt speichern (Koordinaten auf ~10 m gerundet)
        const p: Stored['p'] = [];
        for (const [name, list] of index) {
          for (const c of list) p.push([name, Math.round(c.lat * 1e4) / 1e4, Math.round(c.lng * 1e4) / 1e4]);
        }
        writeJson(STORAGE_KEY, { t: Date.now(), p } satisfies Stored);
        console.info(`[Ortsverzeichnis] ${index.size} Ortsnamen aus OpenStreetMap geladen`);
        return index;
      } catch (err) {
        console.warn('[Ortsverzeichnis] Overpass nicht erreichbar:', endpoint, err);
      }
    }
    loading = null; // später erneut versuchen
    return null;
  })();
  return loading;
}

// ─── Suchmittelpunkt ───────────────────────────────────────────────────────

let bias: LatLng | undefined;
/** Mittelpunkt, um gleichnamige Orte aufzulösen (wird von der Erkundung gesetzt). */
export const setPlaceBias = (center: LatLng | undefined) => {
  bias = center;
};
export const getPlaceBias = () => bias;

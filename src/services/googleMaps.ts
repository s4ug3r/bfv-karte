/**
 * Laden der Google Maps JavaScript API und Geocoding mit lokalem Cache.
 *
 * Die API wird erst nach ausdrücklicher Zustimmung geladen (siehe ConsentCard), weil
 * dabei Daten (u. a. IP-Adresse) an Google übertragen werden.
 */
import { Loader } from '@googlemaps/js-api-loader';
import { config } from '../config';
import type { LatLng } from '../types/match';
import { readJson, writeJson } from '../utils/storage';
import { normalizeText } from '../utils/text';

let loadPromise: Promise<void> | null = null;

/** Lädt Maps, Marker, Places und Geocoding genau einmal. */
export function loadGoogleMaps(): Promise<void> {
  if (!config.googleMapsApiKey) {
    return Promise.reject(
      new Error('Es ist kein Google-Maps-API-Key konfiguriert (VITE_GOOGLE_MAPS_API_KEY).'),
    );
  }
  if (!loadPromise) {
    const loader = new Loader({
      apiKey: config.googleMapsApiKey,
      version: 'weekly',
      language: 'de',
      region: 'DE',
    });
    loadPromise = Promise.all([
      loader.importLibrary('maps'),
      loader.importLibrary('marker'),
      loader.importLibrary('places'),
      loader.importLibrary('geocoding'),
    ])
      .then(() => undefined)
      .catch((err: unknown) => {
        loadPromise = null; // erneuten Versuch erlauben
        throw err instanceof Error ? err : new Error('Google Maps konnte nicht geladen werden.');
      });
  }
  return loadPromise;
}

export const isGoogleMapsLoaded = () => typeof google !== 'undefined' && !!google.maps?.Geocoder;

// ─── Geocoding mit Cache ───────────────────────────────────────────────────

interface GeocodeCacheEntry {
  /** null = Adresse nicht auflösbar */
  p: LatLng | null;
  /** gefundene Adresse (nur bei Ortssuche) */
  a?: string;
  /** gefundener Ortsname (nur bei Ortssuche) */
  n?: string;
  /** Zeitpunkt der Speicherung (ms) */
  t: number;
}

const CACHE_KEY = `bfv.geocode.${config.cacheVersion}`;
const MAX_ENTRIES = 2000;

let cache: Record<string, GeocodeCacheEntry> | null = null;
const inflight = new Map<string, Promise<GeocodeCacheEntry>>();

function getCache(): Record<string, GeocodeCacheEntry> {
  if (!cache) {
    cache = readJson<Record<string, GeocodeCacheEntry>>(CACHE_KEY, {});
    // Abgelaufene Einträge beim Start entfernen
    const now = Date.now();
    for (const [k, e] of Object.entries(cache)) {
      const ttl = e.p ? config.cache.geocodeTtlMs : config.cache.geocodeNegativeTtlMs;
      if (now - e.t > ttl) delete cache[k];
    }
  }
  return cache;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persistCache() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const c = getCache();
    const keys = Object.keys(c);
    if (keys.length > MAX_ENTRIES) {
      // Älteste Einträge verwerfen
      keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete c[k]);
    }
    writeJson(CACHE_KEY, c);
  }, 300);
}

/** Gemeinsame Logik: Cache prüfen, gleiche Anfragen bündeln, Ergebnis speichern. */
async function cachedLookup(
  cacheKey: string,
  lookup: () => Promise<Omit<GeocodeCacheEntry, 't'> | null>,
): Promise<GeocodeCacheEntry> {
  const cached = getCache()[cacheKey];
  if (cached) return cached;
  const running = inflight.get(cacheKey);
  if (running) return running;

  const promise = (async () => {
    try {
      const found = await lookup();
      const entry: GeocodeCacheEntry = { p: null, ...found, t: Date.now() };
      // Auch "nicht gefunden" merken (kurz), damit nicht ständig neu gesucht wird
      getCache()[cacheKey] = entry;
      persistCache();
      return entry;
    } catch {
      // OVER_QUERY_LIMIT, Netzwerkfehler etc. nicht cachen – nächster Versuch später.
      return { p: null, t: Date.now() };
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, promise);
  return promise;
}

/**
 * Wandelt eine Adresse in Koordinaten um (Google Geocoding API).
 * Ergebnisse – auch negative – werden im localStorage zwischengespeichert.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = normalizeText(address);
  if (!key) return null;
  const entry = await cachedLookup(`g:${key}`, async () => {
    try {
      const { results } = await new google.maps.Geocoder().geocode({
        address,
        region: 'de',
        componentRestrictions: { country: 'DE' },
      });
      const loc = results[0]?.geometry.location;
      return { p: loc ? { lat: loc.lat(), lng: loc.lng() } : null, a: results[0]?.formatted_address };
    } catch (err) {
      if ((err as { code?: string }).code === 'ZERO_RESULTS') return { p: null };
      throw err;
    }
  });
  return entry.p;
}

/** Bayern grob als Rechteck – Suchergebnisse außerhalb werden ausgeschlossen. */
const BAVARIA_BOUNDS = { south: 47.27, west: 8.97, north: 50.57, east: 13.84 };

export interface FoundPlace {
  location: LatLng;
  address?: string;
  name?: string;
}

/**
 * Sucht einen Ort per Freitext (Places API (New), Text Search), beschränkt auf Bayern –
 * z. B. "TSV 1865 Dachau Sportplatz". Fällt auf das Geocoding zurück.
 */
export async function findPlace(query: string): Promise<FoundPlace | null> {
  const key = normalizeText(query);
  if (!key) return null;
  const entry = await cachedLookup(`p:${key}`, async () => {
    const PlaceCtor = (google.maps.places as unknown as {
      Place?: { searchByText: (req: Record<string, unknown>) => Promise<{ places: PlaceResult[] }> };
    }).Place;
    if (PlaceCtor?.searchByText) {
      try {
        const { places } = await PlaceCtor.searchByText({
          textQuery: query,
          fields: ['displayName', 'formattedAddress', 'location'],
          locationRestriction: BAVARIA_BOUNDS,
          language: 'de',
          region: 'de',
          maxResultCount: 1,
        });
        const place = places[0];
        if (place?.location) {
          return {
            p: { lat: place.location.lat(), lng: place.location.lng() },
            a: place.formattedAddress ?? undefined,
            n: place.displayName ?? undefined,
          };
        }
      } catch {
        /* Places nicht verfügbar → Geocoding versuchen */
      }
    }
    const p = await geocodeAddress(`${query}, Bayern`);
    return { p };
  });
  return entry.p ? { location: entry.p, address: entry.a, name: entry.n } : null;
}

interface PlaceResult {
  location?: google.maps.LatLng | null;
  formattedAddress?: string | null;
  displayName?: string | null;
}

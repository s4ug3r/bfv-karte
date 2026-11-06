/**
 * Zentrale Konfiguration aus Umgebungsvariablen (siehe .env.example).
 */
import type { RadiusKm, SelectedLocation } from './types/filters';

// Fallback {} erlaubt das Ausführen außerhalb von Vite (z. B. Skripte)
const env: ImportMetaEnv = import.meta.env ?? {};

export type ProviderKind = 'bfv' | 'rest' | 'static';

const baseUrl = (env.VITE_BFV_API_BASE_URL ?? '').trim();

function resolveProvider(): ProviderKind {
  const v = (env.VITE_BFV_DATA_PROVIDER ?? '').trim();
  if (v === 'bfv' || v === 'rest' || v === 'static') return v;
  // Standard: BFV-Widget-Schnittstelle über bfv-api; eigenes Backend, falls konfiguriert
  return baseUrl ? 'rest' : 'bfv';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const config = {
  googleMapsApiKey: (env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim(),
  /** Map-ID für Advanced Markers; DEMO_MAP_ID funktioniert nur für Entwicklung. */
  googleMapsMapId: (env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID',

  dataProvider: resolveProvider(),
  bfvApiBaseUrl: baseUrl,
  bfvApiAreaQuery: (env.VITE_BFV_API_AREA_QUERY ?? 'true').trim().toLowerCase() !== 'false',
  /**
   * Basis-URL der BFV-Widget-Schnittstelle. Standard ist der eigene Proxy-Pfad "/bfv-api",
   * der im Dev-Server (vite.config.ts) bzw. beim Hosting (public/_redirects, vercel.json)
   * auf https://widget-prod.bfv.de/api/service/widget/v1 weiterleitet – so gibt es keine CORS-Probleme.
   */
  bfvProxyUrl: (env.VITE_BFV_PROXY_URL ?? '').trim() || '/bfv-api',
  /**
   * Proxy-Pfad zu https://www.bfv.de – nur für die Vereinsseiten, auf denen alle Mannschaften
   * eines Vereins verlinkt sind (die Widget-Schnittstelle bietet dafür keinen Endpunkt).
   */
  bfvWebProxyUrl: (env.VITE_BFV_WEB_PROXY_URL ?? '').trim() || '/bfv-web',
  /** Optionaler Startpunkt für die erste Umgebungserkundung (bfv.de-Link oder ID). */
  bfvSeed: (env.VITE_BFV_SEED ?? '').trim(),
  /** Link zur Spieldetailseite; {matchId} wird ersetzt. Leer = kein Link. */
  bfvMatchUrlTemplate: env.VITE_BFV_MATCH_URL_TEMPLATE ?? 'https://www.bfv.de/ergebnisse/spiel/-/{matchId}',
  bfvStaticUrl: (env.VITE_BFV_STATIC_URL ?? '').trim() || '/data/matches.json',

  /** Standardzentrum: Dachau, Bayern. */
  defaultLocation: {
    lat: 48.2603,
    lng: 11.4342,
    label: 'Dachau, Bayern',
    source: 'default',
  } satisfies SelectedLocation,
  defaultRadiusKm: 20 as RadiusKm,

  cache: {
    /**
     * Spielansetzungen ändern sich (Verlegungen, Absagen, Uhrzeiten) –
     * nach 15 Minuten gelten Daten als veraltet und werden im Hintergrund aktualisiert.
     */
    matchesStaleMs: 15 * MINUTE,
    /** So lange bleiben Ergebnisse im Speicher bzw. im localStorage (Offline/Schnellstart). */
    matchesMaxAgeMs: 6 * HOUR,
    /** Spielstätten bewegen sich nicht – Geocoding-Ergebnisse lange cachen (spart API-Kosten). */
    geocodeTtlMs: 30 * DAY,
    /** Fehlgeschlagene Adressauflösungen nur kurz merken, damit Korrekturen greifen. */
    geocodeNegativeTtlMs: 1 * DAY,
    /**
     * BFV-Spiele: Für einen Umkreis werden hunderte Mannschaften abgefragt. Um den BFV-Server
     * zu schonen, gelten diese Daten 60 Minuten als aktuell.
     */
    bfvMatchesStaleMs: 60 * MINUTE,
    /** Erkundete Umgebung (Vereine, Mannschaften): nach 30 Tagen neu erkunden (Saison/IDs ändern sich). */
    areaIndexTtlMs: 30 * DAY,
  },

  /** Wird bei inkompatiblen Cache-Formaten erhöht und verwirft alte localStorage-Caches. */
  cacheVersion: 'v3',
} as const;

import type { LatLng, Match } from './match';

/** Parameter einer Spielabfrage. */
export interface MatchQuery {
  /** Mittelpunkt der Suche. */
  center: LatLng;
  /** Suchradius in km (Provider ohne Flächenabfrage dürfen ihn ignorieren). */
  radiusKm: number;
  /** Beginn des Zeitraums (inklusive). */
  from: Date;
  /** Ende des Zeitraums (inklusive). */
  to: Date;
}

/**
 * Austauschbare Datenquelle für BFV-Spiele.
 *
 * Es gibt (Stand Nov. 2026) keine offizielle, öffentlich dokumentierte BFV-API.
 * Deshalb kapselt dieses Interface die Datenbeschaffung: Eine offizielle API,
 * ein eigener Crawler/Proxy oder ein vorab exportierter Datensatz können
 * angebunden werden, ohne die UI anzufassen.
 *
 * Vertrag:
 * - liefert nur Spiele im Zeitraum [from, to] (zusätzliche Spiele werden clientseitig verworfen)
 * - `kickoff` immer als ISO-Zeitpunkt (UTC oder mit Offset)
 * - Koordinaten sind optional; fehlende werden per Geocoding ergänzt
 * - darf mehr Spiele als im Radius liefern – die App filtert immer clientseitig nach Entfernung
 */
export interface MatchDataProvider {
  /** Technischer Bezeichner (Teil des Cache-Keys). */
  readonly id: string;
  /** Anzeigename der Quelle, z. B. für die Fußzeile. */
  readonly label: string;
  /** true, wenn die Quelle nach Mittelpunkt + Radius filtern kann. */
  readonly supportsAreaQuery: boolean;
  /** true bei Demodaten – die UI zeigt dann einen deutlichen Hinweis. */
  readonly isDemo: boolean;
  /** Optional abweichende Frische-Dauer für den Cache (ms), z. B. um teure Quellen zu schonen. */
  readonly staleTimeMs?: number;
  fetchMatches(query: MatchQuery, signal?: AbortSignal): Promise<Match[]>;
}

/** Fehler einer Datenquelle mit nutzerfreundlicher Meldung. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

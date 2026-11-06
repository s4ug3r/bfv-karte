/**
 * Zentrale Domänentypen für Spiele und Spielstätten.
 * Alle Data-Provider liefern Daten in dieser normalisierten Form.
 */

/** Geografische Koordinate (WGS84). */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Kategorie eines Spiels. "unbekannt" = nicht eindeutig zuordenbar (z. B. Freundschaftsspiel, Frauen). */
export type MatchCategory = 'herren' | 'jugend' | 'unbekannt';

/** Spielstätte. Koordinaten sind optional und werden bei Bedarf per Geocoding ergänzt. */
export interface Venue {
  name: string;
  street?: string;
  postalCode?: string;
  city?: string;
  location?: LatLng;
  /**
   * Suchbegriff für die Ortsermittlung, wenn keine Adresse bekannt ist
   * (z. B. "TSV 1865 Dachau Sportplatz" bei der BFV-Widget-Schnittstelle).
   */
  searchQuery?: string;
  /** true, wenn der Spielort nur über den Heimverein ermittelt wurde (ohne Gewähr). */
  approximate?: boolean;
}

/** Ein Spiel, wie es ein Data-Provider liefert. */
export interface Match {
  /** Eindeutige ID (vom Provider, sonst aus Inhalt abgeleitet). */
  id: string;
  /** Anstoß als ISO-8601-Zeitpunkt in UTC (z. B. "2026-11-07T14:00:00.000Z"). */
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  /** Wettbewerb bzw. Liga, z. B. "Kreisliga 1" oder "U15 Kreisklasse". */
  competition: string;
  category: MatchCategory;
  /** Altersklasse, falls bekannt, z. B. "U15". */
  ageClass?: string;
  venue: Venue;
  /** Link zur BFV-Spieldetailseite, falls verfügbar. */
  detailUrl?: string;
}

/** Spiel mit garantiert vorhandenen Koordinaten der Spielstätte. */
export interface LocatedMatch extends Match {
  venue: Venue & { location: LatLng };
}

/** Spiel inklusive berechneter Entfernung zum gewählten Standort. */
export interface MatchWithDistance extends LocatedMatch {
  distanceKm: number;
}

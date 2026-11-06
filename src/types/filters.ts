import type { LatLng } from './match';

export type CategoryFilter = 'alle' | 'herren' | 'jugend';

export type TimePreset = 'heute' | 'wochenende' | '7' | '14' | '30' | 'custom';

export const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

export interface Filters {
  category: CategoryFilter;
  timePreset: TimePreset;
  /** Benutzerdefinierter Zeitraum als Kalendertag "YYYY-MM-DD" (Europe/Berlin). */
  customFrom: string;
  customTo: string;
  radiusKm: RadiusKm;
  /** Freitext für Verein, Liga oder Ort. */
  search: string;
  /** Altersklasse/Liga-Filter, z. B. "age:U15" oder "league:Kreisliga". Leer = alle. */
  classFilter: string;
}

/** Herkunft des gewählten Standorts – relevant für Datenschutzhinweise. */
export type LocationSource = 'default' | 'search' | 'geolocation';

export interface SelectedLocation extends LatLng {
  label: string;
  source: LocationSource;
}

/** Konkreter Zeitraum (Zeitpunkte) inkl. Kalendertage für Cache-Keys. */
export interface DateRange {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
}

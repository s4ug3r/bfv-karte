/**
 * Lokales Verzeichnis der erkundeten Umgebung: Vereine mit Ort und Mannschaften.
 *
 * Die BFV-Schnittstelle kennt keine Umkreissuche. Die App baut sich deshalb einmalig ein
 * Verzeichnis auf (siehe discovery.ts) und speichert es im Browser. Danach reicht
 * Standort + Radius, um alle Mannschaften – und damit alle Spiele – im Umkreis zu finden.
 */
import { config } from '../../config';
import type { LatLng } from '../../types/match';
import { haversineKm } from '../../utils/distance';
import { readJson, removeKey, writeJson } from '../../utils/storage';

export interface AreaTeam {
  id: string;
  name?: string;
  /** Mannschaftsart laut BFV, z. B. "Herren", "C-Junioren" */
  type?: string;
}

export interface AreaClub {
  id: string;
  name: string;
  /** undefined = noch nicht gesucht, null = nicht gefunden */
  location?: LatLng | null;
  address?: string;
  locatedAt?: number;
  /** Mannschaften (gefüllt, sobald der Verein "erkundet" wurde) */
  teams?: AreaTeam[];
  expandedAt?: number;
  /** IDs der Gegner-Vereine aus den Spielplänen – die Kanten des Erkundungsgraphen */
  neighbors?: string[];
  /** true, wenn der Ort nicht gefunden wurde und der gewählte Standort angenommen ist (nur Startverein) */
  locationAssumed?: boolean;
}

/** Kennzahlen der letzten Erkundung – zur Fehlersuche in der App sichtbar. */
export interface DiscoveryStats {
  at: number;
  clubsExpanded: number;
  clubsLocated: number;
  clubsNotLocated: number;
  teamsLoaded: number;
  teamErrors: number;
  matchesSeen: number;
  opponentsWithoutClubId: number;
  opponentsResolvedViaTeam: number;
  clubsInRadius: number;
}

export interface CoveredArea extends LatLng {
  radiusKm: number;
  at: number;
}

export interface AreaIndex {
  version: 1;
  clubs: Record<string, AreaClub>;
  covered: CoveredArea[];
  updatedAt: number;
  lastRun?: DiscoveryStats;
}

// v2: frühere Version konnte einen Umkreis fälschlich als erkundet markieren → neu anfangen
const STORAGE_KEY = 'bfv.area.v2';

export const emptyIndex = (): AreaIndex => ({ version: 1, clubs: {}, covered: [], updatedAt: 0 });

export function loadAreaIndex(): AreaIndex {
  const stored = readJson<AreaIndex | null>(STORAGE_KEY, null);
  if (!stored || stored.version !== 1 || typeof stored.clubs !== 'object') return emptyIndex();
  return stored;
}

export function saveAreaIndex(index: AreaIndex): void {
  writeJson(STORAGE_KEY, index);
}

export function clearAreaIndex(): void {
  removeKey(STORAGE_KEY);
}

const isFresh = (at: number | undefined, now = Date.now()) => !!at && now - at < config.cache.areaIndexTtlMs;

/** Ist der Kreis (center, radiusKm) vollständig von einer frischen Erkundung abgedeckt? */
export function isAreaCovered(index: AreaIndex, center: LatLng, radiusKm: number, now = Date.now()): boolean {
  return index.covered.some((a) => isFresh(a.at, now) && haversineKm(a, center) + radiusKm <= a.radiusKm + 0.5);
}

/** Erkundete Vereine (mit Ort und Mannschaften) im Umkreis. */
export function clubsInRadius(index: AreaIndex, center: LatLng, radiusKm: number): AreaClub[] {
  return Object.values(index.clubs).filter(
    (c) => c.location && c.teams && c.teams.length > 0 && haversineKm(center, c.location) <= radiusKm,
  );
}

export function indexStats(index: AreaIndex) {
  const clubs = Object.values(index.clubs).filter((c) => c.teams && c.teams.length > 0);
  return { clubs: clubs.length, teams: clubs.reduce((n, c) => n + (c.teams?.length ?? 0), 0) };
}

/**
 * Grobe Schätzung der Erkundungsdauer. Annahme: ~0,1 Vereine pro km² (Oberbayern, ländlich
 * bis städtisch), je Verein ~10 Anfragen bei ~6 parallelen Anfragen à ~0,4 s.
 */
export function estimateMinutes(radiusKm: number): number {
  const clubs = Math.PI * radiusKm * radiusKm * 0.1;
  return Math.max(1, Math.round((clubs * 10 * 0.4) / 6 / 60));
}

export { isFresh };

/**
 * Tolerante Abbildung fremder Datenformate (REST-Backend, JSON-Export) auf den Match-Typ.
 * Akzeptiert gängige englische und deutsche Feldnamen, damit Exporte aus Crawlern oder
 * Tabellen ohne Umbau eingelesen werden können.
 */
import type { LatLng, Match, MatchCategory, Venue } from '../../types/match';
import { classifyCategory, extractAgeClass } from '../../utils/classify';
import { parseKickoff } from '../../utils/date';
import { isValidLatLng } from '../../utils/distance';
import { safeHttpUrl } from '../../utils/maps';
import { hashString } from '../../utils/text';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Erster nicht-leerer String unter den angegebenen Schlüsseln. */
function str(obj: Raw | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    if (isObj(v) && typeof v.name === 'string') return v.name.trim();
  }
  return undefined;
}

function num(obj: Raw | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseLocation(obj: Raw | undefined): LatLng | undefined {
  if (!obj) return undefined;
  const nested = isObj(obj.location) ? obj.location : isObj(obj.coordinates) ? obj.coordinates : undefined;
  const lat = num(nested ?? obj, 'lat', 'latitude', 'breitengrad');
  const lng = num(nested ?? obj, 'lng', 'lon', 'long', 'longitude', 'laengengrad');
  const p = { lat, lng };
  return isValidLatLng(p) ? p : undefined;
}

function parseVenue(raw: Raw): Venue {
  const v = isObj(raw.venue) ? raw.venue : isObj(raw.spielstaette) ? raw.spielstaette : isObj(raw.ground) ? raw.ground : {};
  return {
    name: str(v, 'name', 'bezeichnung') ?? str(raw, 'venueName', 'spielstaetteName', 'venue') ?? 'Spielstätte unbekannt',
    street: str(v, 'street', 'strasse', 'address', 'adresse') ?? str(raw, 'venueStreet', 'strasse'),
    postalCode: str(v, 'postalCode', 'zip', 'plz') ?? str(raw, 'venuePostalCode', 'plz'),
    city: str(v, 'city', 'ort', 'town') ?? str(raw, 'venueCity', 'ort'),
    location: parseLocation(v) ?? parseLocation(raw),
  };
}

const CATEGORIES: MatchCategory[] = ['herren', 'jugend', 'unbekannt'];

function parseCategory(value: string | undefined): MatchCategory | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (CATEGORIES.includes(v as MatchCategory)) return v as MatchCategory;
  if (/herren|men|senior/.test(v)) return 'herren';
  if (/jugend|youth|junior/.test(v)) return 'jugend';
  return undefined;
}

/** Normalisiert einen einzelnen Datensatz. Gibt null zurück, wenn Pflichtfelder fehlen. */
export function normalizeMatch(input: unknown): Match | null {
  if (!isObj(input)) return null;
  const raw = input;

  const kickoffRaw = str(raw, 'kickoff', 'kickoffAt', 'anstoss', 'startDate', 'datetime');
  const kickoff = kickoffRaw
    ? parseKickoff(kickoffRaw, str(raw, 'time', 'kickoffTime', 'uhrzeit'))
    : (() => {
        const date = str(raw, 'date', 'datum');
        return date ? parseKickoff(date, str(raw, 'time', 'kickoffTime', 'uhrzeit')) : null;
      })();

  const homeTeam = str(raw, 'homeTeam', 'homeTeamName', 'home', 'heim', 'heimmannschaft');
  const awayTeam = str(raw, 'awayTeam', 'guestTeam', 'awayTeamName', 'away', 'gast', 'gastmannschaft');
  if (!kickoff || !homeTeam || !awayTeam) return null;

  const competition = str(raw, 'competition', 'competitionName', 'league', 'liga', 'wettbewerb') ?? '';
  const ageClass = str(raw, 'ageClass', 'altersklasse') ?? extractAgeClass(competition, homeTeam, awayTeam);
  const category =
    parseCategory(str(raw, 'category', 'kategorie')) ?? classifyCategory(competition, homeTeam, awayTeam, ageClass);
  const venue = parseVenue(raw);

  const id = str(raw, 'id', 'matchId', 'spielId', 'spielkennung') ?? hashString(`${kickoff}|${homeTeam}|${awayTeam}|${venue.name}`);

  return {
    id,
    kickoff,
    homeTeam,
    awayTeam,
    competition,
    category,
    ageClass,
    venue,
    detailUrl: safeHttpUrl(raw.detailUrl ?? raw.url ?? raw.matchUrl ?? raw.link),
  };
}

/** Normalisiert eine Antwort, die entweder ein Array oder { matches: [...] } / { data: [...] } ist. */
export function normalizeMatchList(payload: unknown): Match[] {
  const list = Array.isArray(payload)
    ? payload
    : isObj(payload) && Array.isArray(payload.matches)
      ? payload.matches
      : isObj(payload) && Array.isArray(payload.data)
        ? payload.data
        : [];
  return list.map(normalizeMatch).filter((m): m is Match => m !== null);
}

/**
 * Erzeugt realistisch wirkende, aber FIKTIVE Demo-Spiele rund um Dachau / Oberbayern.
 * Dient zur Entwicklung und als Vorführung, solange keine echte Datenquelle angebunden ist.
 * Die Ansetzungen sind frei erfunden – die UI weist deutlich darauf hin.
 *
 * Die Daten sind deterministisch (fester Seed je Tag + Spielstätte), sodass Neuladen
 * dieselben Spiele liefert.
 */
import type { Match, Venue } from '../../types/match';
import { classifyCategory, extractAgeClass } from '../../utils/classify';
import { addDaysToKey, berlinLocalToUtc, parseDateKey, weekdayOfKey } from '../../utils/date';
import { haversineKm } from '../../utils/distance';
import { hashString } from '../../utils/text';

interface DemoClub {
  club: string;
  venue: Venue;
}

/** [Ort, PLZ, lat, lng] – Koordinaten ungefähr Ortsmitte; zwei Orte bewusst ohne Koordinaten (Geocoding-Test). */
const TOWNS: [string, string, number | null, number | null][] = [
  ['Dachau', '85221', 48.2603, 11.4342],
  ['Karlsfeld', '85757', 48.227, 11.4747],
  ['Bergkirchen', '85232', 48.2567, 11.36],
  ['Markt Indersdorf', '85229', 48.3612, 11.3782],
  ['Odelzhausen', '85235', 48.3086, 11.199],
  ['Röhrmoos', '85244', 48.329, 11.448],
  ['Hebertshausen', '85241', 48.29, 11.46],
  ['Vierkirchen', '85256', 48.3667, 11.45],
  ['Haimhausen', '85778', 48.317, 11.556],
  ['Petershausen', '85238', 48.41, 11.47],
  ['Schwabhausen', '85247', null, null],
  ['Altomünster', '85250', null, null],
  ['Fürstenfeldbruck', '82256', 48.1786, 11.2552],
  ['Olching', '82140', 48.2008, 11.3305],
  ['Germering', '82110', 48.1333, 11.3667],
  ['Puchheim', '82178', 48.15, 11.35],
  ['Unterschleißheim', '85716', 48.2806, 11.5764],
  ['Oberschleißheim', '85764', 48.25, 11.5667],
  ['Garching', '85748', 48.2492, 11.6511],
  ['Ismaning', '85737', 48.2264, 11.6725],
  ['München-Moosach', '80992', 48.18, 11.51],
  ['München-Pasing', '81241', 48.15, 11.46],
  ['Freising', '85354', 48.4028, 11.7489],
  ['Erding', '85435', 48.3064, 11.9078],
  ['Moosburg', '85368', 48.47, 11.937],
  ['Pfaffenhofen', '85276', 48.53, 11.505],
  ['Starnberg', '82319', 47.999, 11.34],
  ['Landsberg', '86899', 48.048, 10.873],
  ['Augsburg', '86150', 48.3705, 10.8978],
  ['Ingolstadt', '85049', 48.7665, 11.4258],
  ['Landshut', '84028', 48.537, 12.152],
  ['Rosenheim', '83022', 47.8561, 12.1289],
];

const PREFIXES = ['TSV', 'SV', 'FC', 'SC', 'SpVgg', 'ASV', 'TuS', 'DJK'];
const VENUE_NAMES = ['Sportanlage', 'Sportpark', 'Sportzentrum', 'Sportgelände'];
const STREETS = ['Sportplatzstraße 1', 'Am Sportpark 3', 'Jahnstraße 12', 'Stadionweg 5', 'Badstraße 20'];

const CLUBS: DemoClub[] = TOWNS.map(([town, plz, lat, lng], i) => ({
  club: `${PREFIXES[i % PREFIXES.length]} ${town}`,
  venue: {
    name: `${VENUE_NAMES[i % VENUE_NAMES.length]} ${town}`,
    street: STREETS[i % STREETS.length],
    postalCode: plz,
    city: town.replace(/^München-.*/, 'München'),
    location: lat !== null && lng !== null ? { lat, lng } : undefined,
  },
}));

/** Ungefähre Position für die Gegnerwahl, auch wenn die Spielstätte (noch) keine Koordinaten hat. */
const APPROX_POS = TOWNS.map(([, , lat, lng]) => ({ lat: lat ?? 48.33, lng: lng ?? 11.3 }));

const HERREN_LEAGUES = ['Bayernliga Süd', 'Landesliga Südost', 'Bezirksliga Nord', 'Kreisliga 1', 'Kreisklasse 2', 'A-Klasse 4'];
interface YouthDef {
  age: string;
  comps: string[];
  times: [number, number][];
}

const YOUTH: YouthDef[] = [
  { age: 'U19', comps: ['U19 Bezirksoberliga', 'U19 Kreisliga 1'], times: [[11, 0], [13, 0]] },
  { age: 'U17', comps: ['U17 Kreisliga 2', 'U17 Bezirksoberliga'], times: [[11, 0], [13, 0]] },
  { age: 'U15', comps: ['U15 Kreisliga 1', 'U15 Kreisklasse 3'], times: [[10, 30], [12, 30]] },
  { age: 'U13', comps: ['U13 Kreisklasse 2', 'U13 Kreisgruppe Dachau'], times: [[10, 0], [11, 30]] },
  { age: 'U11', comps: ['U11 Kreisgruppe Dachau', 'E-Junioren Kleinfeld'], times: [[10, 0], [11, 0]] },
  { age: 'U9', comps: ['U9 Fair-Play-Liga'], times: [[10, 0]] },
  { age: 'U7', comps: ['G-Junioren Spielfest'], times: [[10, 0]] },
];

/** Kleiner deterministischer Zufallsgenerator (mulberry32). */
function rng(seed: string) {
  let a = parseInt(hashString(seed), 36) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/** Wählt einen Gegner aus der Region (bevorzugt < 35 km entfernt). */
function pickOpponent(r: () => number, homeIndex: number): string {
  const home = APPROX_POS[homeIndex];
  const near = CLUBS.filter((_, i) => i !== homeIndex && haversineKm(home, APPROX_POS[i]) < 35);
  const pool = near.length > 2 ? near : CLUBS.filter((_, i) => i !== homeIndex);
  return pick(r, pool).club;
}

function makeMatch(
  dayKey: string,
  homeIndex: number,
  hour: number,
  minute: number,
  homeTeam: string,
  awayTeam: string,
  competition: string,
): Match {
  const p = parseDateKey(dayKey)!;
  const kickoff = berlinLocalToUtc(p.year, p.month, p.day, hour, minute).toISOString();
  const ageClass = extractAgeClass(competition, homeTeam);
  return {
    id: `demo-${hashString(`${dayKey}|${homeIndex}|${hour}:${minute}|${competition}|${homeTeam}`)}`,
    kickoff,
    homeTeam,
    awayTeam,
    competition,
    ageClass,
    category: classifyCategory(competition, homeTeam, awayTeam, ageClass),
    venue: CLUBS[homeIndex].venue,
  };
}

/** Alle Demo-Spiele eines Kalendertags. */
function matchesForDay(dayKey: string): Match[] {
  const wd = weekdayOfKey(dayKey);
  const out: Match[] = [];

  CLUBS.forEach((c, i) => {
    const r = rng(`${dayKey}|${i}`);
    const league = HERREN_LEAGUES[i % HERREN_LEAGUES.length];
    const youthCount = wd === 6 ? Math.floor(r() * 4) : wd === 3 || wd === 5 ? (r() < 0.15 ? 1 : 0) : 0;

    // Jugendspiele (Samstagvormittag, unter der Woche abends)
    const usedAges = new Set<string>();
    for (let k = 0; k < youthCount; k++) {
      const y = pick(r, YOUTH);
      if (usedAges.has(y.age)) continue;
      usedAges.add(y.age);
      const [h, m] = wd === 6 ? pick(r, y.times) : [18, 0];
      out.push(makeMatch(dayKey, i, h, m, `${c.club} ${y.age}`, `${pickOpponent(r, i)} ${y.age}`, pick(r, y.comps)));
    }

    // Herrenspiele (Fr-Abend, Sa-Nachmittag, So: Reserve + 1. Mannschaft)
    if (wd === 5 && r() < 0.12) {
      out.push(makeMatch(dayKey, i, 19, 30, c.club, pickOpponent(r, i), league));
    }
    if (wd === 6 && r() < 0.3) {
      out.push(makeMatch(dayKey, i, 15, 0, c.club, pickOpponent(r, i), league));
    }
    if (wd === 7 && r() < 0.5) {
      const opp = pickOpponent(r, i);
      out.push(makeMatch(dayKey, i, 15, 0, c.club, opp, league));
      if (r() < 0.6) out.push(makeMatch(dayKey, i, 13, 0, `${c.club} II`, `${opp} II`, 'A-Klasse 4 (Reserve)'));
    }

    // Unklare Kategorie (grau): Frauen- und Freundschaftsspiele
    if (wd === 7 && r() < 0.08) {
      out.push(makeMatch(dayKey, i, 11, 0, `${c.club} Frauen`, `${pickOpponent(r, i)} Frauen`, 'Frauen Bezirksoberliga'));
    }
    if ((wd === 2 || wd === 4) && r() < 0.06) {
      out.push(makeMatch(dayKey, i, 19, 0, c.club, pickOpponent(r, i), 'Freundschaftsspiel'));
    }
  });

  // Simuliert doppelte Einträge aus der Quelle – die App muss sie zusammenführen.
  const r = rng(`dup|${dayKey}`);
  for (const m of [...out]) {
    if (r() < 0.04) out.push({ ...m, id: `${m.id}-dup`, competition: m.competition });
  }
  return out;
}

/** Demo-Spiele für den Zeitraum zwischen zwei Kalendertagen (inklusive). */
export function generateDemoMatches(fromKey: string, toKey: string): Match[] {
  const out: Match[] = [];
  for (let key = fromKey, guard = 0; key <= toKey && guard < 120; key = addDaysToKey(key, 1), guard++) {
    out.push(...matchesForDay(key));
  }
  return out;
}

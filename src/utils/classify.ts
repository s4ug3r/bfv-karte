/**
 * Heuristische Einordnung von Spielen in Herren / Jugend sowie Altersklasse und Ligastufe.
 * Wird genutzt, wenn eine Datenquelle die Kategorie nicht explizit mitliefert.
 */
import type { Match, MatchCategory } from '../types/match';

/** Buchstaben-Junioren des DFB → Altersklasse. */
const JUNIOR_LETTER_TO_AGE: Record<string, string> = {
  A: 'U19',
  B: 'U17',
  C: 'U15',
  D: 'U13',
  E: 'U11',
  F: 'U9',
  G: 'U7',
};

const YOUTH_RE = /\bU\s?-?\s?(?:[7-9]|1\d)\b|junior|jugend|bambini|kinder|nachwuchs|\bjgd\b/i;
const WOMEN_RE = /frauen|damen|mädchen|maedchen/i;
const MEN_RE =
  /herren|männer|maenner|senioren|\bü\s?\d{2}\b|\bah\b|bayernliga|landesliga|bezirksliga|kreisliga|kreisklasse|\b[a-c]-klasse\b|regionalliga|reserve/i;

/** Ermittelt die Altersklasse (U7–U19) aus Wettbewerb oder Teamnamen. */
export function extractAgeClass(...texts: (string | undefined)[]): string | undefined {
  const text = texts.filter(Boolean).join(' ');
  const u = /\bU\s?-?\s?(\d{1,2})\b/i.exec(text);
  if (u) {
    const n = Number(u[1]);
    if (n >= 6 && n <= 21) return `U${n}`;
  }
  const letter = /\b([A-G])[- ]?(?:junior|jun\.|jgd)/i.exec(text);
  if (letter) return JUNIOR_LETTER_TO_AGE[letter[1].toUpperCase()];
  return undefined;
}

/**
 * Ordnet ein Spiel einer Kategorie zu.
 * Reihenfolge: Jugend-Merkmale zuerst (auch "U17 Kreisliga" ist Jugend), dann Frauen
 * (→ "unbekannt", da die App nur Herren/Jugend unterscheidet), dann Herren-Ligen.
 */
export function classifyCategory(
  competition: string,
  homeTeam = '',
  awayTeam = '',
  ageClass?: string,
): MatchCategory {
  const text = [competition, homeTeam, awayTeam, ageClass].filter(Boolean).join(' ');
  if (ageClass || YOUTH_RE.test(text)) return 'jugend';
  if (WOMEN_RE.test(text)) return 'unbekannt';
  if (MEN_RE.test(text)) return 'herren';
  return 'unbekannt';
}

/** Ligastufen für den optionalen Filter (von oben nach unten). */
export const LEAGUE_LEVELS = [
  'Bayernliga',
  'Landesliga',
  'Bezirksliga',
  'Kreisliga',
  'Kreisklasse',
  'A-Klasse',
  'B-Klasse',
] as const;

/** Standard-Altersklassen für den Filter. */
export const AGE_CLASSES = ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U19'] as const;

/** Prüft einen Altersklasse/Liga-Filterwert ("age:U15", "league:Kreisliga") gegen ein Spiel. */
export function matchesClassFilter(match: Match, filter: string): boolean {
  if (!filter) return true;
  const [kind, value] = filter.split(':');
  if (kind === 'age') return match.ageClass === value;
  if (kind === 'league') {
    const escaped = value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    return new RegExp(`(^|[^a-zäöüß])${escaped}($|[^a-zäöüß])`, 'i').test(match.competition);
  }
  return true;
}

export const CATEGORY_LABEL: Record<MatchCategory, string> = {
  herren: 'Herren',
  jugend: 'Jugend',
  unbekannt: 'Sonstige',
};

/** Markerfarben laut Vorgabe: Blau = Herren, Grün = Jugend, Grau = unklar. */
export const CATEGORY_COLOR: Record<MatchCategory, string> = {
  herren: '#2563eb',
  jugend: '#16a34a',
  unbekannt: '#6b7280',
};

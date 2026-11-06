import { describe, expect, it } from 'vitest';
import type { Match } from '../types/match';
import { classifyCategory, extractAgeClass, matchesClassFilter } from './classify';

describe('classifyCategory', () => {
  it.each([
    ['Kreisliga 1', 'TSV Dachau', 'SC Karlsfeld', 'herren'],
    ['A-Klasse 4 (Reserve)', 'TSV Dachau II', 'SV X II', 'herren'],
    ['U17 Kreisliga 2', 'TSV Dachau U17', 'SV X U17', 'jugend'],
    ['C-Junioren Kreisklasse', 'TSV Dachau', 'SV X', 'jugend'],
    ['Frauen Bezirksoberliga', 'TSV Dachau', 'SV X', 'unbekannt'],
    ['Freundschaftsspiel', 'TSV Dachau', 'SV X', 'unbekannt'],
  ])('%s → %s', (competition, home, away, expected) => {
    expect(classifyCategory(competition, home, away)).toBe(expected);
  });
});

describe('extractAgeClass', () => {
  it('liest U-Klassen und Buchstaben-Junioren', () => {
    expect(extractAgeClass('U15 Kreisliga')).toBe('U15');
    expect(extractAgeClass('B-Junioren Bezirksoberliga')).toBe('U17');
    expect(extractAgeClass('Kreisliga 1')).toBeUndefined();
  });
});

describe('matchesClassFilter', () => {
  const m = { competition: 'U15 Kreisliga 1', ageClass: 'U15' } as Match;
  it('filtert nach Altersklasse und Liga', () => {
    expect(matchesClassFilter(m, 'age:U15')).toBe(true);
    expect(matchesClassFilter(m, 'age:U17')).toBe(false);
    expect(matchesClassFilter(m, 'league:Kreisliga')).toBe(true);
    expect(matchesClassFilter(m, 'league:Kreisklasse')).toBe(false);
    expect(matchesClassFilter(m, '')).toBe(true);
  });
});

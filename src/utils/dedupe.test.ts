import { describe, expect, it } from 'vitest';
import type { Match } from '../types/match';
import { dedupeMatches } from './dedupe';
import { normalizeMatchList } from '../services/providers/normalize';

const base: Match = {
  id: '1',
  kickoff: '2026-11-07T14:00:00.000Z',
  homeTeam: 'TSV Dachau',
  awayTeam: 'SC Karlsfeld',
  competition: 'Kreisliga 1',
  category: 'herren',
  venue: { name: 'Sportanlage Dachau', street: 'Sportplatzstraße 1', postalCode: '85221', city: 'Dachau' },
};

describe('dedupeMatches', () => {
  it('entfernt dasselbe Spiel an derselben Spielstätte zur selben Zeit', () => {
    const dup = { ...base, id: '2', homeTeam: 'TSV  Dachau', detailUrl: 'https://www.bfv.de/spiele/x' };
    const result = dedupeMatches([base, dup]);
    expect(result).toHaveLength(1);
    // fehlender Detail-Link wird aus dem Duplikat übernommen
    expect(result[0].detailUrl).toBe('https://www.bfv.de/spiele/x');
  });

  it('behält parallele, verschiedene Spiele auf derselben Anlage', () => {
    const other = { ...base, id: '3', homeTeam: 'TSV Dachau U11', awayTeam: 'SV Röhrmoos U11' };
    expect(dedupeMatches([base, other])).toHaveLength(2);
  });
});

describe('normalizeMatchList', () => {
  it('liest deutsche Feldnamen und klassifiziert automatisch', () => {
    const [m] = normalizeMatchList({
      matches: [
        {
          datum: '07.11.2026',
          uhrzeit: '10:30',
          heim: 'TSV Dachau U15',
          gast: 'SV Röhrmoos U15',
          liga: 'U15 Kreisliga 1',
          spielstaette: { name: 'Sportanlage Dachau', plz: '85221', ort: 'Dachau', lat: '48.26', lng: '11.43' },
          url: 'javascript:alert(1)',
        },
      ],
    });
    expect(m.kickoff).toBe('2026-11-07T09:30:00.000Z');
    expect(m.category).toBe('jugend');
    expect(m.ageClass).toBe('U15');
    expect(m.venue.location).toEqual({ lat: 48.26, lng: 11.43 });
    expect(m.detailUrl).toBeUndefined(); // unsichere URL verworfen
  });

  it('überspringt Datensätze ohne Pflichtfelder', () => {
    expect(normalizeMatchList([{ homeTeam: 'A' }])).toHaveLength(0);
  });
});

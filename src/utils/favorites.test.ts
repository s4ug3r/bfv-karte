import { describe, expect, it } from 'vitest';
import type { Match } from '../types/match';
import { formatRelativeKickoff } from './date';
import { clubKey, involvesFavorite, sanitizeFavorites } from './favorites';

describe('clubKey', () => {
  it('fasst alle Mannschaften eines Vereins zusammen', () => {
    const k = clubKey('TSV Dachau 1865');
    expect(clubKey('TSV Dachau 1865 U15')).toBe(k);
    expect(clubKey('TSV Dachau 1865 II')).toBe(k);
    expect(clubKey('TSV Dachau 1865 Frauen')).toBe(k);
    expect(clubKey('SV Röhrmoos')).not.toBe(k);
  });
});

describe('involvesFavorite', () => {
  const m = { homeTeam: 'FC Bergkirchen U15', awayTeam: 'SpVgg Röhrmoos U15' } as Match;
  it('erkennt Heim- und Gastverein', () => {
    expect(involvesFavorite(m, new Set([clubKey('SpVgg Röhrmoos')]))).toBe(true);
    expect(involvesFavorite(m, new Set([clubKey('FC Bergkirchen')]))).toBe(true);
    expect(involvesFavorite(m, new Set([clubKey('TSV Dachau')]))).toBe(false);
    expect(involvesFavorite(m, new Set())).toBe(false);
  });
});

describe('sanitizeFavorites', () => {
  it('verwirft Unsinn und Duplikate', () => {
    expect(sanitizeFavorites('x')).toEqual([]);
    expect(sanitizeFavorites([{ key: 'a', name: 'A' }, { key: 'a', name: 'A2' }, { key: 1 }, null])).toEqual([
      { key: 'a', name: 'A' },
    ]);
  });
});

describe('formatRelativeKickoff', () => {
  const now = new Date('2026-11-21T12:00:00Z'); // Sa. 13:00 in Berlin
  it('zeigt laufende und baldige Spiele relativ', () => {
    expect(formatRelativeKickoff('2026-11-21T11:30:00Z', now)).toBe('läuft');
    expect(formatRelativeKickoff('2026-11-21T12:25:00Z', now)).toBe('in 25 Min.');
  });
  it('zeigt heute, morgen und Wochentag', () => {
    expect(formatRelativeKickoff('2026-11-21T14:00:00Z', now)).toBe('heute 15:00');
    expect(formatRelativeKickoff('2026-11-22T10:00:00Z', now)).toBe('morgen 11:00');
    expect(formatRelativeKickoff('2026-11-24T18:30:00Z', now)).toMatch(/^Di\.? 19:30$/);
  });
});

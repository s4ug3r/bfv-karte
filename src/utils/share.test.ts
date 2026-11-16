import { describe, expect, it } from 'vitest';
import type { Match } from '../types/match';
import { buildIcs, shareText } from './share';

const match: Match = {
  id: 'abc123',
  kickoff: '2026-11-21T13:00:00.000Z',
  homeTeam: 'TSV Dachau 1865',
  awayTeam: 'SC Fürstenfeldbruck',
  competition: 'Kreisliga 1',
  category: 'herren',
  venue: { name: 'Sportpark Ost', street: 'Sportplatzstraße 1', postalCode: '85221', city: 'Dachau' },
  detailUrl: 'https://www.bfv.de/ergebnisse/spiel/-/abc123',
};

describe('buildIcs', () => {
  const ics = buildIcs(match, new Date('2026-11-16T10:00:00Z'));

  it('enthält Anstoß und zwei Stunden Dauer in UTC', () => {
    expect(ics).toContain('DTSTART:20261121T130000Z');
    expect(ics).toContain('DTEND:20261121T150000Z');
  });

  it('maskiert Kommas im Ort und nutzt CRLF', () => {
    expect(ics).toContain('LOCATION:Sportpark Ost\\, Sportplatzstraße 1\\, 85221 Dachau');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('bricht keine Zeile über 75 Zeichen', () => {
    const long = buildIcs({ ...match, competition: 'X'.repeat(200) });
    expect(long.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
});

describe('shareText', () => {
  it('nennt Paarung, Anstoß und Spielort', () => {
    const text = shareText(match);
    expect(text).toContain('TSV Dachau 1865 – SC Fürstenfeldbruck');
    expect(text).toContain('Kreisliga 1');
    expect(text).toContain('Sportpark Ost');
  });
});

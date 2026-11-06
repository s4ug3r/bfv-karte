import { describe, expect, it } from 'vitest';
import { berlinLocalToUtc, getDateRange, parseKickoff, toBerlinDateKey, formatTime } from './date';

describe('Zeitzone Europe/Berlin', () => {
  it('rechnet Winterzeit (UTC+1) korrekt um', () => {
    expect(berlinLocalToUtc(2026, 11, 7, 15, 0).toISOString()).toBe('2026-11-07T14:00:00.000Z');
  });

  it('rechnet Sommerzeit (UTC+2) korrekt um', () => {
    expect(berlinLocalToUtc(2026, 7, 4, 15, 0).toISOString()).toBe('2026-07-04T13:00:00.000Z');
  });

  it('ermittelt den Berliner Kalendertag auch kurz nach Mitternacht', () => {
    // 23:30 UTC am 6.11. ist bereits 00:30 am 7.11. in Berlin
    expect(toBerlinDateKey(new Date('2026-11-06T23:30:00Z'))).toBe('2026-11-07');
  });

  it('formatiert Anstoßzeiten in Berliner Zeit', () => {
    expect(formatTime('2026-11-07T14:00:00.000Z')).toBe('15:00');
  });
});

describe('parseKickoff', () => {
  it('versteht ISO mit Offset, ISO ohne Offset und deutsches Datum', () => {
    expect(parseKickoff('2026-11-07T15:00:00+01:00')).toBe('2026-11-07T14:00:00.000Z');
    expect(parseKickoff('2026-11-07T15:00')).toBe('2026-11-07T14:00:00.000Z');
    expect(parseKickoff('07.11.2026', '15:00 Uhr')).toBe('2026-11-07T14:00:00.000Z');
    expect(parseKickoff('2026-11-07', '10:30')).toBe('2026-11-07T09:30:00.000Z');
  });

  it('lehnt Unsinn ab', () => {
    expect(parseKickoff('morgen')).toBeNull();
    expect(parseKickoff('2026-13-01', '10:00')).toBeNull();
  });
});

describe('getDateRange', () => {
  // Freitag, 06.11.2026, 10:00 Berliner Zeit
  const now = new Date('2026-11-06T09:00:00Z');

  it('"Heute" reicht von jetzt bis Tagesende', () => {
    const r = getDateRange('heute', now);
    expect(r.from).toEqual(now);
    expect(r.to.toISOString()).toBe('2026-11-06T22:59:59.999Z');
  });

  it('"Dieses Wochenende" an einem Freitag = Samstag + Sonntag', () => {
    const r = getDateRange('wochenende', now);
    expect(r.fromKey).toBe('2026-11-07');
    expect(r.toKey).toBe('2026-11-08');
    expect(r.from.toISOString()).toBe('2026-11-06T23:00:00.000Z');
  });

  it('"Dieses Wochenende" am Sonntag = nur noch heute', () => {
    const sunday = new Date('2026-11-08T12:00:00Z');
    const r = getDateRange('wochenende', sunday);
    expect(r.fromKey).toBe('2026-11-08');
    expect(r.toKey).toBe('2026-11-08');
  });

  it('"Nächste 7 Tage"', () => {
    const r = getDateRange('7', now);
    expect(r.toKey).toBe('2026-11-13');
  });

  it('benutzerdefinierter Zeitraum tauscht vertauschte Daten und kappt die Vergangenheit', () => {
    const r = getDateRange('custom', now, '2026-11-20', '2026-11-01');
    expect(r.fromKey).toBe('2026-11-06');
    expect(r.toKey).toBe('2026-11-20');
  });

  it('Zeitraum in der Vergangenheit ergibt leeren Bereich', () => {
    const r = getDateRange('custom', now, '2026-10-01', '2026-10-05');
    expect(r.from.getTime()).toBeGreaterThan(r.to.getTime());
  });
});

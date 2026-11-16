import { describe, expect, it } from 'vitest';
import { describeWeather, weatherAt, weatherCell } from './weather';

describe('weather', () => {
  it('fasst nahe Orte zu einer Zelle zusammen', () => {
    expect(weatherCell({ lat: 48.2603, lng: 11.4342 })).toBe('48.3,11.4');
    expect(weatherCell({ lat: 48.2701, lng: 11.4012 })).toBe('48.3,11.4');
  });

  it('nimmt die Stunde des Anpfiffs (gerundet)', () => {
    const f = { '2026-11-21T13': [12, 0, 5], '2026-11-21T14': [11, 61, 80] } as Record<string, [number, number, number]>;
    expect(weatherAt(f, '2026-11-21T13:00:00.000Z')).toMatchObject({ temp: 12, emoji: '☀️' });
    expect(weatherAt(f, '2026-11-21T13:30:00.000Z')).toMatchObject({ temp: 11, emoji: '🌧️', rain: 80 });
    expect(weatherAt(f, '2026-11-25T13:00:00.000Z')).toBeNull();
    expect(weatherAt(undefined, '2026-11-21T13:00:00.000Z')).toBeNull();
  });

  it('übersetzt Wettercodes', () => {
    expect(describeWeather(3).label).toBe('bewölkt');
    expect(describeWeather(95).emoji).toBe('⛈️');
  });
});

import { describe, expect, it } from 'vitest';
import { formatDistance, haversineKm, isValidLatLng } from './distance';

describe('haversineKm', () => {
  it('liefert 0 für identische Punkte', () => {
    expect(haversineKm({ lat: 48.26, lng: 11.43 }, { lat: 48.26, lng: 11.43 })).toBe(0);
  });

  it('berechnet Dachau → München Marienplatz (~16 km)', () => {
    const d = haversineKm({ lat: 48.2603, lng: 11.4342 }, { lat: 48.1374, lng: 11.5755 });
    expect(d).toBeGreaterThan(16);
    expect(d).toBeLessThan(18);
  });

  it('berechnet München → Nürnberg (~150 km)', () => {
    const d = haversineKm({ lat: 48.1374, lng: 11.5755 }, { lat: 49.4521, lng: 11.0767 });
    expect(d).toBeGreaterThan(145);
    expect(d).toBeLessThan(155);
  });
});

describe('formatDistance', () => {
  it('formatiert deutsch', () => {
    expect(formatDistance(0.84)).toBe('840 m');
    expect(formatDistance(4.25)).toBe('4,3 km');
    expect(formatDistance(37.4)).toBe('37 km');
  });
});

describe('isValidLatLng', () => {
  it('erkennt ungültige Koordinaten', () => {
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 11 })).toBe(false);
    expect(isValidLatLng(undefined)).toBe(false);
    expect(isValidLatLng({ lat: 48.2, lng: 11.4 })).toBe(true);
  });
});

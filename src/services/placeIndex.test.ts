import { describe, expect, it } from 'vitest';
import { lookupPlace, parsePlacesCsv } from './placeIndex';

const CSV = [
  '48.2603|11.4342|Dachau',
  '48.1500|11.4600|Pasing',
  '48.3612|11.3782|Markt Indersdorf',
  '47.9000|12.4000|Eggstätt',
  // zwei gleichnamige Orte: einer nahe Dachau, einer weit weg
  '48.3000|11.4000|Kirchdorf',
  '49.9000|10.0000|Kirchdorf',
  'kaputt',
].join('\n');

describe('Ortsverzeichnis', () => {
  const index = parsePlacesCsv(CSV);

  it('liest das CSV und ignoriert kaputte Zeilen', () => {
    expect(index.size).toBe(5);
  });

  it('findet Orte auch mit Umlauten und Zusätzen', () => {
    expect(lookupPlace(index, 'Eggstätt')).toEqual({ lat: 47.9, lng: 12.4 });
    expect(lookupPlace(index, 'Markt Indersdorf')).toEqual({ lat: 48.3612, lng: 11.3782 });
    expect(lookupPlace(index, 'Dachau-Ost')).toEqual({ lat: 48.2603, lng: 11.4342 });
    expect(lookupPlace(index, 'München-Pasing')).toEqual({ lat: 48.15, lng: 11.46 });
  });

  it('nimmt bei gleichnamigen Orten den nächstgelegenen', () => {
    expect(lookupPlace(index, 'Kirchdorf', { lat: 48.26, lng: 11.43 })).toEqual({ lat: 48.3, lng: 11.4 });
    expect(lookupPlace(index, 'Kirchdorf', { lat: 49.8, lng: 10.1 })).toEqual({ lat: 49.9, lng: 10 });
  });

  it('liefert null für Unbekanntes', () => {
    expect(lookupPlace(index, 'Atlantis')).toBeNull();
  });
});

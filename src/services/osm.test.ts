import { describe, expect, it } from 'vitest';
import { townFromClubName } from './osm';

describe('townFromClubName', () => {
  it.each([
    ['ASV Eggstätt Sportplatz', 'Eggstätt'],
    ['TSV 1865 Dachau e.V.', 'Dachau'],
    ['SV Rot-Weiß Unterhaching', 'Unterhaching'],
    ['1. FC Garmisch-Partenkirchen', 'Garmisch-Partenkirchen'],
    ['SpVgg Markt Indersdorf', 'Markt Indersdorf'],
    ['DJK Eintracht Landshut', 'Landshut'],
  ])('%s → %s', (club, town) => {
    expect(townFromClubName(club)).toBe(town);
  });
});

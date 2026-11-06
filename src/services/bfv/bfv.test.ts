import { describe, expect, it } from 'vitest';
import { clubNameFromTeam, mapBfvMatch } from '../providers/bfvWidgetProvider';
import type { BfvMatch } from './bfvClient';
import { parseSourceInput } from './sources';

const ID = '016PD5QT70000000VV0AG811VTE5EA5R';

describe('parseSourceInput', () => {
  it('erkennt Mannschafts-Links von bfv.de', () => {
    expect(parseSourceInput(`https://www.bfv.de/mannschaften/tsv-musterstadt/${ID}`)).toEqual({ id: ID, kind: 'team' });
  });
  it('erkennt Liga-Links', () => {
    expect(parseSourceInput(`www.bfv.de/wettbewerbe/meisterschaft/kreisliga-1/${ID}`)).toEqual({ id: ID, kind: 'competition' });
  });
  it('akzeptiert reine IDs ohne Typ', () => {
    expect(parseSourceInput(`  ${ID} `)).toEqual({ id: ID });
  });
  it('erkennt Vereins-Links', () => {
    expect(parseSourceInput(`https://www.bfv.de/vereine/tsv-musterstadt/${ID}`)).toEqual({ id: ID, kind: 'club' });
  });
  it('lehnt Text ohne ID ab', () => {
    expect(parseSourceInput('https://www.bfv.de/')).toBeNull();
  });
});

describe('clubNameFromTeam', () => {
  it.each([
    ['TSV 1865 Dachau II', 'TSV 1865 Dachau'],
    ['SV Röhrmoos U15', 'SV Röhrmoos'],
    ['(SG) FC Alpha/SV Beta', 'FC Alpha'],
    ['ASV Dachau e.V.', 'ASV Dachau'],
    ['FC Bergkirchen 2', 'FC Bergkirchen'],
  ])('%s → %s', (team, club) => {
    expect(clubNameFromTeam(team)).toBe(club);
  });
});

describe('mapBfvMatch', () => {
  const base: BfvMatch = {
    matchId: 'M1',
    compoundId: 'C1',
    competitionName: 'Kreisliga 1',
    competitionType: 'Meisterschaft',
    teamType: 'Herren',
    kickoffDate: '08.11.2026',
    kickoffTime: '14:30',
    homeTeamName: 'TSV Musterstadt II',
    homeTeamPermanentId: 'H1',
    homeClubId: null,
    guestTeamName: 'SV Beispiel',
    guestTeamPermanentId: 'G1',
    guestClubId: null,
    result: '',
    prePublished: false,
  };

  it('wandelt in das App-Format, Spielort über den Heimverein', () => {
    const m = mapBfvMatch(base, new Map([['H1', 'TSV Musterstadt 1920']]))!;
    expect(m.kickoff).toBe('2026-11-08T13:30:00.000Z');
    expect(m.category).toBe('herren');
    expect(m.venue.searchQuery).toBe('TSV Musterstadt 1920 Sportplatz');
    expect(m.venue.approximate).toBe(true);
    expect(m.id).toBe('bfv-M1');
  });

  it('erkennt Jugendspiele über den Mannschaftstyp', () => {
    const m = mapBfvMatch({ ...base, teamType: 'C-Junioren', competitionName: 'Kreisklasse 3' }, new Map())!;
    expect(m.category).toBe('jugend');
    expect(m.ageClass).toBe('U15');
  });

  it('überspringt Spiele ohne Termin', () => {
    expect(mapBfvMatch({ ...base, kickoffDate: null }, new Map())).toBeNull();
  });
});

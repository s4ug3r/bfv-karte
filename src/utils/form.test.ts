import { describe, expect, it } from 'vitest';
import type { BfvMatch } from '../services/bfv/bfvClient';
import { parseResult, recentGames, upcomingGames } from './form';

const m = (id: string, date: string, home: string, guest: string, result = ''): BfvMatch => ({
  matchId: id,
  compoundId: 'L',
  competitionName: 'Kreisliga 1',
  competitionType: 'Meisterschaft',
  teamType: 'Herren',
  kickoffDate: date,
  kickoffTime: '15:00',
  homeTeamName: home === 'T' ? 'TSV Test' : `Gegner ${home}`,
  homeTeamPermanentId: home,
  homeClubId: null,
  guestTeamName: guest === 'T' ? 'TSV Test' : `Gegner ${guest}`,
  guestTeamPermanentId: guest,
  guestClubId: null,
  result,
  prePublished: false,
});

const plan = [
  m('1', '18.10.2026', 'T', 'A', '3:1'),
  m('2', '25.10.2026', 'B', 'T', '2:2'),
  m('3', '01.11.2026', 'T', 'C', '0 : 1'),
  m('4', '08.11.2026', 'D', 'T', '0:4'),
  m('5', '15.11.2026', 'T', 'E', 'abgesetzt'),
  m('6', '22.11.2026', 'T', 'F'),
  m('7', '29.11.2026', 'G', 'T'),
];
const now = new Date('2026-11-16T12:00:00Z');

describe('parseResult', () => {
  it('liest Ergebnisse und ignoriert Texte', () => {
    expect(parseResult('2:1')).toEqual({ home: 2, away: 1 });
    expect(parseResult(' 0 : 4 ')).toEqual({ home: 0, away: 4 });
    expect(parseResult('abgesetzt')).toBeNull();
    expect(parseResult('')).toBeNull();
  });
});

describe('recentGames', () => {
  it('liefert S/U/N aus Sicht der Mannschaft, neueste zuerst', () => {
    const games = recentGames(plan, 'T', now);
    expect(games.map((g) => g.outcome)).toEqual(['S', 'N', 'U', 'S']);
    expect(games[0]).toMatchObject({ opponent: 'Gegner D', home: false, goalsFor: 4, goalsAgainst: 0 });
  });
});

describe('upcomingGames', () => {
  it('liefert die nächsten Spiele ohne das aktuelle', () => {
    expect(upcomingGames(plan, 'T', now).map((g) => g.matchId)).toEqual(['6', '7']);
    expect(upcomingGames(plan, 'T', now, 3, '6').map((g) => g.matchId)).toEqual(['7']);
  });
});

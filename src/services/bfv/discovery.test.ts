import { describe, expect, it } from 'vitest';
import type { LatLng } from '../../types/match';
import { clubsInRadius, emptyIndex, isAreaCovered } from './areaIndex';
import type { BfvMatch } from './bfvClient';
import { discoverArea, type DiscoveryDeps } from './discovery';

/**
 * Kleine Fantasie-Region: Vereine A–D liegen nahe Dachau, E weit weg (Nürnberg).
 * Verbindungen (wer spielt gegen wen): A–B, B–C, C–D, D–E.
 * Erwartung bei 20 km: A, B, C, D werden erkundet; E nur verortet, nicht erkundet.
 */
const CLUBS: Record<string, { name: string; pos: LatLng; teams: string[] }> = {
  A: { name: 'Verein A', pos: { lat: 48.26, lng: 11.43 }, teams: ['A1', 'A2'] },
  B: { name: 'Verein B', pos: { lat: 48.3, lng: 11.4 }, teams: ['B1'] },
  C: { name: 'Verein C', pos: { lat: 48.22, lng: 11.5 }, teams: ['C1'] },
  D: { name: 'Verein D', pos: { lat: 48.33, lng: 11.55 }, teams: ['D1'] },
  E: { name: 'Verein E', pos: { lat: 49.45, lng: 11.08 }, teams: ['E1'] },
};
const EDGES: [string, string][] = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']];
const clubOfTeam = (t: string) => t[0];

const match = (home: string, guest: string): BfvMatch => ({
  matchId: `${home}-${guest}`,
  compoundId: 'L',
  competitionName: 'Kreisliga',
  competitionType: 'Meisterschaft',
  teamType: 'Herren',
  kickoffDate: '08.11.2026',
  kickoffTime: '15:00',
  homeTeamName: `${CLUBS[clubOfTeam(home)].name}`,
  homeTeamPermanentId: home,
  homeClubId: clubOfTeam(home),
  guestTeamName: `${CLUBS[clubOfTeam(guest)].name}`,
  guestTeamPermanentId: guest,
  guestClubId: clubOfTeam(guest),
  result: '',
  prePublished: false,
});

const calls: string[] = [];
const deps: DiscoveryDeps = {
  fetchClubName: async (id) => CLUBS[id]?.name ?? null,
  fetchClubTeamIds: async (id) => {
    calls.push(`club:${id}`);
    return CLUBS[id]?.teams ?? [];
  },
  fetchCompetitionTeams: async () => ({ competitionName: 'L', teams: [{ permanentId: 'A1', name: 'A' }] }),
  fetchTeamMatches: async (teamId) => {
    const club = clubOfTeam(teamId);
    const matches = EDGES.filter(([x, y]) => x === club || y === club).map(([x, y]) =>
      match(CLUBS[x].teams[0], CLUBS[y].teams[0]),
    );
    return {
      team: { permanentId: teamId, name: teamId, typeName: 'Herren', clubId: club, clubName: CLUBS[club].name, compoundId: 'L', competitionName: 'L' },
      matches,
    };
  },
  fetchClubForTeam: async (teamId) => ({ id: clubOfTeam(teamId), name: CLUBS[clubOfTeam(teamId)].name }),
  locate: async (q) => {
    const c = Object.values(CLUBS).find((x) => q.startsWith(x.name));
    return c ? { location: c.pos } : null;
  },
};

describe('discoverArea', () => {
  const center = { lat: 48.26, lng: 11.43 };

  it('findet alle Vereine im Umkreis über den Spielgraphen, aber nicht darüber hinaus', async () => {
    calls.length = 0;
    const index = await discoverArea({
      index: emptyIndex(),
      center,
      radiusKm: 20,
      seed: { id: 'A', kind: 'club' },
      signal: new AbortController().signal,
      onProgress: () => {},
      deps,
    });

    const explored = Object.values(index.clubs).filter((c) => c.teams?.length).map((c) => c.id).sort();
    expect(explored).toEqual(['A', 'B', 'C', 'D']);
    expect(calls.includes('club:E')).toBe(false); // weit entfernt: nur verortet
    expect(index.clubs.E.location).toEqual(CLUBS.E.pos);
    expect(index.clubs.A.teams?.map((t) => t.id).sort()).toEqual(['A1', 'A2']);

    expect(isAreaCovered(index, center, 20)).toBe(true);
    expect(isAreaCovered(index, center, 30)).toBe(false);
    expect(clubsInRadius(index, center, 20).length).toBe(4);
  });

  it('kann ohne Startpunkt auf einem vorhandenen Verzeichnis aufbauen', async () => {
    const first = await discoverArea({
      index: emptyIndex(), center, radiusKm: 5, seed: { id: 'A', kind: 'club' },
      signal: new AbortController().signal, onProgress: () => {}, deps,
    });
    const second = await discoverArea({
      index: first, center, radiusKm: 20, signal: new AbortController().signal, onProgress: () => {}, deps,
    });
    expect(clubsInRadius(second, center, 20).length).toBe(4);
  });

  it('findet Gegner auch, wenn Spielpläne keine Vereins-IDs enthalten', async () => {
    const noIds: DiscoveryDeps = {
      ...deps,
      fetchTeamMatches: async (teamId) => {
        const r = await deps.fetchTeamMatches(teamId);
        return { ...r, matches: r.matches.map((m) => ({ ...m, homeClubId: null, guestClubId: null })) };
      },
    };
    const index = await discoverArea({
      index: emptyIndex(), center, radiusKm: 20, seed: { id: 'A', kind: 'club' },
      signal: new AbortController().signal, onProgress: () => {}, deps: noIds,
    });
    expect(clubsInRadius(index, center, 20).length).toBe(4);
    expect(index.lastRun!.opponentsResolvedViaTeam > 0).toBe(true);
  });

  it('nimmt den Standort an, wenn Google den Startverein nicht findet', async () => {
    const index = await discoverArea({
      index: emptyIndex(), center, radiusKm: 20, seed: { id: 'A', kind: 'club' },
      signal: new AbortController().signal, onProgress: () => {},
      deps: { ...deps, locate: async (q) => (q.startsWith('Verein A') ? null : deps.locate(q)) },
    });
    expect(index.clubs.A.locationAssumed).toBe(true);
    expect(clubsInRadius(index, center, 20).length).toBe(4);
  });

  it('meldet einen verständlichen Fehler, wenn nichts bekannt und kein Startpunkt da ist', async () => {
    let message = '';
    try {
      await discoverArea({ index: emptyIndex(), center, radiusKm: 20, signal: new AbortController().signal, onProgress: () => {}, deps });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message.includes('Startpunkt')).toBe(true);
  });
});

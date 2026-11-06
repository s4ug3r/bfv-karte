/**
 * Automatische Umgebungserkundung.
 *
 * Idee: Vereine bilden einen Graphen – zwei Vereine sind verbunden, wenn ihre Mannschaften
 * gegeneinander spielen. Ausgehend von einem Startpunkt (ein Verein, eine Mannschaft oder
 * eine Liga aus der Nähe) läuft die Erkundung wie eine Breitensuche:
 *
 *   Verein → alle Mannschaften (bfv.de-Vereinsseite) → deren Spielpläne (bfv-api)
 *          → Gegner-Vereine → verorten (Google Places) → liegt der Verein im Umkreis?
 *               ja  → ebenfalls erkunden
 *               nein → merken, aber nicht weiter verfolgen
 *
 * Da Ligen regional organisiert sind, erreicht man so praktisch alle Vereine im Umkreis.
 * Das Ergebnis landet im AreaIndex (localStorage) und wird 30 Tage wiederverwendet.
 */
import type { LatLng } from '../../types/match';
import { haversineKm } from '../../utils/distance';
import { clearLastGoogleError, findPlace, getLastGoogleError, isUsingOsmFallback } from '../googleMaps';
import { loadPlaceIndex, setPlaceBias } from '../placeIndex';
import { clubNameFromTeam } from '../providers/bfvWidgetProvider';
import type { AreaClub, AreaIndex, DiscoveryStats } from './areaIndex';
import { clubsInRadius, isFresh } from './areaIndex';
import {
  fetchClubForTeam,
  fetchClubName,
  fetchClubTeamIds,
  fetchCompetitionTeams,
  fetchTeamMatchesCached,
  type BfvMatch,
} from './bfvClient';
import type { ParsedSourceInput } from './sources';

/** Vereine knapp außerhalb des Radius werden mit erkundet, damit keine Lücken am Rand entstehen. */
const EDGE_MARGIN_KM = 3;
/** Sicherheitsgrenze gegen ausufernde Erkundungen. */
const MAX_CLUBS = 800;
/** Parallel erkundete Vereine (je Verein zusätzlich 2 parallele Spielplan-Abfragen) – schont den BFV. */
const CONCURRENCY = 5;

export interface DiscoveryProgress {
  /** erkundete Vereine */
  done: number;
  /** noch zu erkundende Vereine im Umkreis */
  queued: number;
  /** gefundene Mannschaften */
  teams: number;
  /** aktueller Schritt, für die Anzeige */
  step: string;
}

export interface DiscoveryOptions {
  index: AreaIndex;
  center: LatLng;
  radiusKm: number;
  /** Startpunkt; optional, wenn das Verzeichnis schon Vereine in der Nähe kennt. */
  seed?: ParsedSourceInput & { kind?: 'team' | 'competition' | 'club' };
  signal: AbortSignal;
  onProgress: (p: DiscoveryProgress) => void;
  /** Zwischenstände speichern (z. B. alle 10 Vereine), damit ein Abbruch nichts verliert */
  onCheckpoint?: (index: AreaIndex) => void;
  deps?: Partial<DiscoveryDeps>;
}

export class DiscoveryError extends Error {}

/** Externe Abhängigkeiten – austauschbar für Tests. */
export interface DiscoveryDeps {
  fetchClubName: typeof fetchClubName;
  fetchClubTeamIds: typeof fetchClubTeamIds;
  fetchCompetitionTeams: typeof fetchCompetitionTeams;
  fetchTeamMatches: typeof fetchTeamMatchesCached;
  fetchClubForTeam: typeof fetchClubForTeam;
  /** Ort eines Vereins suchen (Google Places), z. B. "TSV 1865 Dachau Sportplatz" */
  locate: (query: string) => Promise<{ location: LatLng; address?: string } | null>;
}

const defaultDeps: DiscoveryDeps = {
  fetchClubName,
  fetchClubTeamIds,
  fetchCompetitionTeams,
  fetchTeamMatches: fetchTeamMatchesCached,
  fetchClubForTeam,
  locate: findPlace,
};

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Erkundung abgebrochen', 'AbortError');
}

export async function discoverArea(opts: DiscoveryOptions): Promise<AreaIndex> {
  const { center, radiusKm, signal } = opts;
  const deps = { ...defaultDeps, ...opts.deps };
  if (!opts.deps?.locate) {
    clearLastGoogleError();
    // Gleichnamige Orte zugunsten der Nähe auflösen; Ortsverzeichnis schon im Hintergrund laden
    setPlaceBias(center);
    void loadPlaceIndex();
  }
  // Arbeitskopie – das gespeicherte Verzeichnis wird erst über Checkpoints/Ergebnis ersetzt
  const index: AreaIndex = structuredClone(opts.index);
  const now = Date.now();
  const startedAt = now;
  const limitKm = radiusKm + EDGE_MARGIN_KM;

  const queue: string[] = [];
  const queued = new Set<string>();
  /** Vereine, die unabhängig von ihrer Lage erkundet werden (Startpunkt) */
  const forced = new Set<string>();
  /** In Spielplänen gesehene Mannschaften je Verein (Ersatz, falls die Vereinsseite nicht lesbar ist) */
  const seenTeams = new Map<string, Map<string, string>>();
  let done = 0;
  let step = 'Starte…';
  const stats: DiscoveryStats = {
    at: 0,
    clubsExpanded: 0,
    clubsLocated: 0,
    clubsNotLocated: 0,
    teamsLoaded: 0,
    teamErrors: 0,
    matchesSeen: 0,
    opponentsWithoutClubId: 0,
    opponentsResolvedViaTeam: 0,
    clubsInRadius: 0,
  };
  /** Gegner-Mannschaften ohne Vereins-ID im Spielplan → Verein später über die Mannschaft ermitteln */
  const teamsWithoutClub = new Map<string, string>();

  const report = () =>
    opts.onProgress({
      done,
      queued: queue.length,
      teams: Object.values(index.clubs).reduce((n, c) => n + (c.teams?.length ?? 0), 0),
      step,
    });

  const club = (id: string, nameGuess = ''): AreaClub =>
    (index.clubs[id] ??= { id, name: nameGuess || id });

  const inRange = (c: AreaClub) => !!c.location && haversineKm(center, c.location) <= limitKm;

  const enqueue = (c: AreaClub, force = false) => {
    if (queued.has(c.id) || queued.size >= MAX_CLUBS) return;
    if (!force && !inRange(c)) return;
    if (force) forced.add(c.id);
    queued.add(c.id);
    queue.push(c.id);
  };

  /** Ist der Name nur eine ID oder leer? */
  const hasRealName = (c: AreaClub) => !!c.name && c.name !== c.id;

  /** In diesem Durchlauf schon gesucht – nie zweimal suchen, auch wenn nicht gefunden */
  const attempted = new Set<string>();

  /** Verein verorten (einmal pro 30 Tage) und ggf. zur Erkundung vormerken. */
  const consider = async (id: string, nameGuess: string, force = false) => {
    const c = club(id, nameGuess);
    const needsLocation = c.location === undefined || c.location === null || !isFresh(c.locatedAt, now);
    if (needsLocation && !attempted.has(id)) {
      attempted.add(id);
      throwIfAborted(signal);
      // Name aus dem Spielplan genügt für die Ortssuche; offizieller Name nur, wenn keiner bekannt ist
      if (nameGuess && !hasRealName(c)) c.name = nameGuess;
      if (!hasRealName(c)) {
        const officialName = await timed('bfv', () => deps.fetchClubName(id, signal));
        if (officialName) c.name = officialName;
      }
      const place = hasRealName(c) ? await timed('locate', () => locateClub(c.name)) : null;
      c.location = place?.location ?? null;
      c.address = place?.address;
      c.locatedAt = Date.now();
      if (c.location) stats.clubsLocated++;
      else stats.clubsNotLocated++;
    }
    enqueue(c, force);
  };

  // ─── Zeitmessung (für "Details zur letzten Erkundung") ───────────────────
  const timing = { bfv: { n: 0, ms: 0 }, locate: { n: 0, ms: 0 } };
  async function timed<T>(kind: 'bfv' | 'locate', fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      timing[kind].n++;
      timing[kind].ms += performance.now() - t0;
    }
  }

  /** Mehrere Suchvarianten, bis Google einen Ort findet. */
  // Eine Suche genügt: findPlace probiert selbst Google (Sportplatz) und OpenStreetMap (Ort) durch
  const locateClub = (name: string) => deps.locate(`${name} Sportplatz`);

  /** Mannschaften eines Vereins laden und Nachbarn einsammeln. */
  const expand = async (id: string) => {
    const c = club(id);
    step = `Erkunde ${c.name}`;
    report();

    if (!isFresh(c.expandedAt, now) || !c.teams?.length) {
      const fromPage = await timed('bfv', () => deps.fetchClubTeamIds(id, signal));
      const known = new Map<string, string>(c.teams?.map((t) => [t.id, t.name ?? ''] as [string, string]) ?? []);
      for (const [tid, tname] of seenTeams.get(id) ?? []) if (!known.has(tid)) known.set(tid, tname);
      for (const tid of fromPage) if (!known.has(tid)) known.set(tid, '');

      const teams: AreaClub['teams'] = [];
      const neighbors = new Map<string, string>();

      const onPage = new Set(fromPage);
      await pool([...known.keys()], 3, async (tid) => {
        throwIfAborted(signal);
        try {
          const { team, matches } = await timed('bfv', () => deps.fetchTeamMatches(tid, signal));
          stats.teamsLoaded++;
          stats.matchesSeen += matches.length;
          // Mannschaften, die nur aus fremden Spielplänen bekannt sind, müssen zum Verein gehören.
          // Mannschaften von der Vereinsseite (auch Spielgemeinschaften) werden immer übernommen.
          if (!onPage.has(tid) && team?.clubId && team.clubId !== id) return;
          if (team?.clubId === id && team.clubName && !hasRealName(c)) c.name = team.clubName;
          teams.push({ id: tid, name: team?.name || known.get(tid) || undefined, type: team?.typeName });
          collectNeighbors(matches, id, tid, neighbors, seenTeams, teamsWithoutClub, stats);
        } catch (err) {
          if ((err as Error).name === 'AbortError' || signal.aborted) throw err;
          stats.teamErrors++; // einzelne fehlerhafte Mannschaft überspringen (z. B. veraltete ID)
        }
      });

      // Gegner ohne Vereins-ID: Verein über die Mannschaft nachschlagen
      const pending = [...teamsWithoutClub];
      teamsWithoutClub.clear();
      await pool(pending, 3, async ([teamId, teamName]) => {
        const found = await timed('bfv', () => deps.fetchClubForTeam(teamId, signal));
        if (!found || found.id === id) return;
        stats.opponentsResolvedViaTeam++;
        if (!neighbors.has(found.id)) neighbors.set(found.id, found.name || clubNameFromTeam(teamName));
        let m = seenTeams.get(found.id);
        if (!m) seenTeams.set(found.id, (m = new Map()));
        m.set(teamId, teamName);
      });

      c.teams = teams;
      c.neighbors = [...neighbors.keys()];
      c.expandedAt = Date.now();
      // Namensvorschläge der Nachbarn für das Verorten merken
      for (const [nid, nname] of neighbors) club(nid, nname);
    }

    // Nachbarn verorten und vormerken
    await pool(c.neighbors ?? [], CONCURRENCY, async (nid) => {
      const n = club(nid);
      await consider(nid, n.name === nid ? '' : n.name);
    });

    done++;
    stats.clubsExpanded++;
    report();
    if (done % 5 === 0) opts.onCheckpoint?.(index); // Zwischenstand → Spiele erscheinen schon währenddessen
  };

  /**
   * Startverein nicht gefunden (Google kennt den Namen nicht)? Der Nutzer hat ihn als
   * "aus der Nähe" angegeben – dann den gewählten Standort annehmen, statt die Erkundung
   * scheitern zu lassen.
   */
  const assumeSeedLocation = (id: string) => {
    const c = index.clubs[id];
    if (c && !c.location) {
      c.location = { lat: center.lat, lng: center.lng };
      c.locationAssumed = true;
    }
  };

  // ─── Startpunkte ─────────────────────────────────────────────────────────
  step = 'Suche Startpunkt und lade Ortsverzeichnis…';
  report();

  // Bereits bekannte Vereine im Umkreis
  for (const c of Object.values(index.clubs)) if (c.teams?.length) enqueue(c);

  if (opts.seed) {
    const { id, kind } = opts.seed;
    if (kind === 'club') {
      await consider(id, '', true);
      assumeSeedLocation(id);
    } else {
      // Mannschaft oder Liga: über einen Spielplan den Verein bestimmen
      let teamId = id;
      if (kind === 'competition') {
        const { teams } = await deps.fetchCompetitionTeams(id, signal);
        if (!teams.length) throw new DiscoveryError('Diese Liga hat keine Mannschaften.');
        teamId = teams[0].permanentId;
      }
      let res: Awaited<ReturnType<typeof fetchTeamMatchesCached>>;
      try {
        res = await deps.fetchTeamMatches(teamId, signal);
      } catch (err) {
        // ID ohne Typangabe: vielleicht doch eine Liga
        if (kind) throw err;
        const { teams } = await deps.fetchCompetitionTeams(id, signal);
        if (!teams.length) throw err;
        res = await deps.fetchTeamMatches(teams[0].permanentId, signal);
      }
      const seedClub = res.team?.clubId;
      if (seedClub) {
        await consider(seedClub, res.team?.clubName ?? '', true);
        assumeSeedLocation(seedClub);
      }
      // Gegner des Startteams ebenfalls berücksichtigen
      const neighbors = new Map<string, string>();
      collectNeighbors(res.matches, seedClub ?? '', teamId, neighbors, seenTeams, teamsWithoutClub, stats);
      await pool([...neighbors], CONCURRENCY, ([nid, nname]) => consider(nid, nname));
    }
  }

  if (queue.length === 0) {
    throw new DiscoveryError(
      opts.seed
        ? 'Der Startpunkt liegt nicht im gewählten Umkreis oder konnte nicht verortet werden. Wähle einen Verein aus deiner Nähe.'
        : 'Für diese Gegend kennt die App noch keinen Verein. Gib einen Startpunkt an (bfv.de-Link eines Vereins oder einer Mannschaft aus der Nähe).',
    );
  }

  // ─── Breitensuche ────────────────────────────────────────────────────────
  // Durchgehende Arbeiter statt Gruppen: Jeder nimmt sich den nächsten Verein, sobald er frei ist.
  let active = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        throwIfAborted(signal);
        const id = queue.shift();
        if (id === undefined) {
          if (active === 0) return; // nichts mehr zu tun und niemand findet noch Nachbarn
          await new Promise((r) => setTimeout(r, 40));
          continue;
        }
        active++;
        try {
          await expand(id);
        } finally {
          active--;
        }
      }
    }),
  );

  stats.clubsInRadius = clubsInRadius(index, center, radiusKm).length;
  stats.at = Date.now();
  stats.durationSec = Math.round((Date.now() - startedAt) / 1000);
  stats.bfvAvgMs = timing.bfv.n ? Math.round(timing.bfv.ms / timing.bfv.n) : 0;
  stats.bfvRequests = timing.bfv.n;
  stats.locateAvgMs = timing.locate.n ? Math.round(timing.locate.ms / timing.locate.n) : 0;
  stats.locateRequests = timing.locate.n;
  // Fehler nur melden, wenn die Verortung wirklich gescheitert ist (nicht, wenn OSM eingesprungen ist)
  stats.googleError = opts.deps?.locate || stats.clubsLocated > 0 ? null : getLastGoogleError();
  stats.locator = opts.deps?.locate ? undefined : isUsingOsmFallback() ? 'OpenStreetMap' : 'Google';
  index.lastRun = stats;
  console.info('[Erkundung] Ergebnis', stats);

  // Abgedeckten Kreis nur eintragen, wenn Vereine im Umkreis gefunden wurden und die
  // Erkundung nicht an der Sicherheitsgrenze endete
  if (stats.clubsInRadius > 1 && queued.size < MAX_CLUBS) {
    index.covered = [
      ...index.covered.filter((a) => isFresh(a.at)),
      { lat: center.lat, lng: center.lng, radiusKm, at: Date.now() },
    ];
  }
  index.updatedAt = Date.now();
  step = 'Fertig';
  report();
  return index;
}

/** Gegner-Vereine (und deren Mannschaften) aus einem Spielplan einsammeln. */
function collectNeighbors(
  matches: BfvMatch[],
  ownClubId: string,
  ownTeamId: string,
  neighbors: Map<string, string>,
  seenTeams: Map<string, Map<string, string>>,
  teamsWithoutClub: Map<string, string>,
  stats: DiscoveryStats,
) {
  const remember = (clubId: string | null | undefined, teamId: string, teamName: string) => {
    if (!teamId || teamId === ownTeamId) return;
    if (!clubId) {
      // Vereins-ID fehlt im Spielplan → später über die Mannschaft nachschlagen
      if (!teamsWithoutClub.has(teamId)) {
        teamsWithoutClub.set(teamId, teamName);
        stats.opponentsWithoutClubId++;
      }
      return;
    }
    let m = seenTeams.get(clubId);
    if (!m) seenTeams.set(clubId, (m = new Map()));
    m.set(teamId, teamName);
    if (clubId !== ownClubId && !neighbors.has(clubId)) neighbors.set(clubId, clubNameFromTeam(teamName));
  };
  for (const m of matches) {
    remember(m.homeClubId, m.homeTeamPermanentId, m.homeTeamName);
    remember(m.guestClubId, m.guestTeamPermanentId, m.guestTeamName);
  }
}

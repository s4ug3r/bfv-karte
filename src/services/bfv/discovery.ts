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
import { findPlace } from '../googleMaps';
import { clubNameFromTeam } from '../providers/bfvWidgetProvider';
import type { AreaClub, AreaIndex } from './areaIndex';
import { isFresh } from './areaIndex';
import {
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
const CONCURRENCY = 3;

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
  /** Ort eines Vereins suchen (Google Places), z. B. "TSV 1865 Dachau Sportplatz" */
  locate: (query: string) => Promise<{ location: LatLng; address?: string } | null>;
}

const defaultDeps: DiscoveryDeps = {
  fetchClubName,
  fetchClubTeamIds,
  fetchCompetitionTeams,
  fetchTeamMatches: fetchTeamMatchesCached,
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
  // Arbeitskopie – das gespeicherte Verzeichnis wird erst über Checkpoints/Ergebnis ersetzt
  const index: AreaIndex = structuredClone(opts.index);
  const now = Date.now();
  const limitKm = radiusKm + EDGE_MARGIN_KM;

  const queue: string[] = [];
  const queued = new Set<string>();
  /** Vereine, die unabhängig von ihrer Lage erkundet werden (Startpunkt) */
  const forced = new Set<string>();
  /** In Spielplänen gesehene Mannschaften je Verein (Ersatz, falls die Vereinsseite nicht lesbar ist) */
  const seenTeams = new Map<string, Map<string, string>>();
  let done = 0;
  let step = 'Starte…';

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

  /** Verein verorten (einmal pro 30 Tage) und ggf. zur Erkundung vormerken. */
  const consider = async (id: string, nameGuess: string, force = false) => {
    const c = club(id, nameGuess);
    if (c.location === undefined || !isFresh(c.locatedAt, now)) {
      throwIfAborted(signal);
      const officialName = await deps.fetchClubName(id, signal);
      if (officialName) c.name = officialName;
      else if (nameGuess && c.name === id) c.name = nameGuess;
      const place = await deps.locate(`${c.name} Sportplatz`);
      c.location = place?.location ?? null;
      c.address = place?.address;
      c.locatedAt = Date.now();
    }
    enqueue(c, force);
  };

  /** Mannschaften eines Vereins laden und Nachbarn einsammeln. */
  const expand = async (id: string) => {
    const c = club(id);
    step = `Erkunde ${c.name}`;
    report();

    if (!isFresh(c.expandedAt, now) || !c.teams?.length) {
      const fromPage = await deps.fetchClubTeamIds(id, signal);
      const known = new Map<string, string>(c.teams?.map((t) => [t.id, t.name ?? ''] as [string, string]) ?? []);
      for (const [tid, tname] of seenTeams.get(id) ?? []) if (!known.has(tid)) known.set(tid, tname);
      for (const tid of fromPage) if (!known.has(tid)) known.set(tid, '');

      const teams: AreaClub['teams'] = [];
      const neighbors = new Map<string, string>();

      await pool([...known.keys()], 2, async (tid) => {
        throwIfAborted(signal);
        try {
          const { team, matches } = await deps.fetchTeamMatches(tid, signal);
          // Mannschaften anderer Vereine (z. B. aus Spielgemeinschaften) nicht übernehmen
          if (team?.clubId && team.clubId !== id) return;
          teams.push({ id: tid, name: team?.name || known.get(tid) || undefined, type: team?.typeName });
          collectNeighbors(matches, id, neighbors, seenTeams);
        } catch (err) {
          if ((err as Error).name === 'AbortError' || signal.aborted) throw err;
          // einzelne fehlerhafte Mannschaft überspringen (z. B. veraltete ID)
        }
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
    report();
    if (done % 10 === 0) opts.onCheckpoint?.(index);
  };

  // ─── Startpunkte ─────────────────────────────────────────────────────────
  step = 'Suche Startpunkt…';
  report();

  // Bereits bekannte Vereine im Umkreis
  for (const c of Object.values(index.clubs)) if (c.teams?.length) enqueue(c);

  if (opts.seed) {
    const { id, kind } = opts.seed;
    if (kind === 'club') {
      await consider(id, '', true);
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
      }
      // Gegner des Startteams ebenfalls berücksichtigen
      const neighbors = new Map<string, string>();
      collectNeighbors(res.matches, seedClub ?? '', neighbors, seenTeams);
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
  while (queue.length > 0) {
    throwIfAborted(signal);
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(expand));
  }

  // Abgedeckten Kreis nur eintragen, wenn die Erkundung nicht an der Sicherheitsgrenze endete
  if (queued.size < MAX_CLUBS) {
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
  neighbors: Map<string, string>,
  seenTeams: Map<string, Map<string, string>>,
) {
  const remember = (clubId: string | null, teamId: string, teamName: string) => {
    if (!clubId) return;
    let m = seenTeams.get(clubId);
    if (!m) seenTeams.set(clubId, (m = new Map()));
    if (teamId) m.set(teamId, teamName);
    if (clubId !== ownClubId && !neighbors.has(clubId)) neighbors.set(clubId, clubNameFromTeam(teamName));
  };
  for (const m of matches) {
    remember(m.homeClubId, m.homeTeamPermanentId, m.homeTeamName);
    remember(m.guestClubId, m.guestTeamPermanentId, m.guestTeamName);
  }
}

/**
 * Data-Provider für echte BFV-Spiele über die Bibliothek "bfv-api" – mit Umkreissuche.
 *
 * Die BFV-Schnittstelle selbst kennt keine Umkreissuche. Der Provider nutzt deshalb das
 * Verzeichnis der erkundeten Umgebung (AreaIndex, siehe services/bfv/discovery.ts):
 *   1. alle erkundeten Vereine im Radius bestimmen (ihr Ort ist bekannt)
 *   2. Spielpläne aller ihrer Mannschaften laden (begrenzt parallel, 60 min Cache)
 *   3. doppelte Spiele über die matchId zusammenführen (jedes Spiel kommt bei beiden Teams vor)
 *   4. Spielort = Platz des Heimvereins (die Schnittstelle liefert keine Spielstätten)
 */
import { config } from '../../config';
import type { Match, Venue } from '../../types/match';
import type { MatchDataProvider, MatchQuery } from '../../types/provider';
import { classifyCategory, extractAgeClass } from '../../utils/classify';
import { parseKickoff } from '../../utils/date';
import { safeHttpUrl } from '../../utils/maps';
import { clubsInRadius, type AreaIndex } from '../bfv/areaIndex';
import { fetchTeamMatchesCached, loadProgressStore, type BfvMatch } from '../bfv/bfvClient';

/** Parallele Anfragen an den BFV – bewusst niedrig. */
const CONCURRENCY = 3;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

/**
 * Leitet aus einem Mannschaftsnamen den Vereinsnamen ab:
 * "TSV 1865 Dachau II" → "TSV 1865 Dachau", "SV Röhrmoos U15" → "SV Röhrmoos",
 * "(SG) FC A/SV B" → "FC A".
 */
export function clubNameFromTeam(teamName: string): string {
  return teamName
    .replace(/\(sg\)\s*/i, '')
    .replace(/^sg\s+/i, '')
    .split('/')[0]
    .replace(/\b(U\s?\d{1,2}|[A-G]-?Junior(?:en|innen)|Junior(?:en|innen)|Frauen|Damen|Mädchen|Herren|AH|Ü\s?\d{2}|Reserve)\b/gi, '')
    .replace(/\s+(I{1,4}|[2-9])\s*$/i, '')
    .replace(/\s+e\.\s?V\.?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function matchUrl(matchId: string): string | undefined {
  const tpl = config.bfvMatchUrlTemplate.trim();
  return tpl ? safeHttpUrl(tpl.replace('{matchId}', encodeURIComponent(matchId))) : undefined;
}

/**
 * Wandelt ein BFV-Spiel in das App-Format. `knownVenue` liefert – falls bekannt – den
 * verorteten Platz des Heimvereins; sonst wird er später per Places-Suche ermittelt.
 */
export function mapBfvMatch(
  m: BfvMatch,
  clubNames: Map<string, string>,
  knownVenue?: (m: BfvMatch) => Venue | undefined,
): Match | null {
  if (!m.kickoffDate || !m.homeTeamName || !m.guestTeamName) return null; // noch nicht terminiert
  const kickoff = parseKickoff(m.kickoffDate, m.kickoffTime ?? undefined);
  if (!kickoff) return null;

  const competition = m.competitionName || m.competitionType || '';
  const ageClass = extractAgeClass(m.teamType, competition, m.homeTeamName);
  const club = clubNames.get(m.homeTeamPermanentId) ?? clubNameFromTeam(m.homeTeamName);

  return {
    id: `bfv-${m.matchId}`,
    kickoff,
    homeTeam: m.homeTeamName,
    awayTeam: m.guestTeamName,
    competition,
    ageClass,
    category: classifyCategory(`${competition} ${m.teamType ?? ''}`, m.homeTeamName, m.guestTeamName, ageClass),
    venue: knownVenue?.(m) ?? {
      name: `Platz ${club}`,
      searchQuery: `${club} Sportplatz`,
      approximate: true,
    },
    detailUrl: matchUrl(m.matchId),
  };
}

export class BfvAreaMatchProvider implements MatchDataProvider {
  readonly id: string;
  readonly label = 'BFV (über bfv-api, inoffiziell)';
  readonly supportsAreaQuery = true;
  readonly isDemo = false;
  readonly staleTimeMs = config.cache.bfvMatchesStaleMs;

  constructor(private readonly index: AreaIndex) {
    // Neues Verzeichnis → neuer Cache-Key
    this.id = `bfv-area:${index.updatedAt}`;
  }

  async fetchMatches(query: MatchQuery, signal?: AbortSignal): Promise<Match[]> {
    const clubs = clubsInRadius(this.index, query.center, query.radiusKm);
    const teamIds = [...new Set(clubs.flatMap((c) => c.teams?.map((t) => t.id) ?? []))];
    if (teamIds.length === 0) return [];

    // Spielpläne laden; einzelne Fehler überspringen, solange etwas ankommt
    let done = 0;
    let firstError: unknown = null;
    loadProgressStore.set({ done, total: teamIds.length });
    try {
      const results = await mapLimit(teamIds, CONCURRENCY, async (id) => {
        try {
          return await fetchTeamMatchesCached(id, signal);
        } catch (err) {
          if (signal?.aborted) throw err;
          firstError ??= err;
          return { team: null, matches: [] as BfvMatch[] };
        } finally {
          loadProgressStore.set({ done: ++done, total: teamIds.length });
        }
      });
      if (firstError && results.every((r) => r.matches.length === 0)) throw firstError;

      const clubNames = new Map<string, string>();
      for (const r of results) if (r.team?.permanentId && r.team.clubName) clubNames.set(r.team.permanentId, r.team.clubName);

      // Platz des Heimvereins aus dem Verzeichnis
      const venueFor = (m: BfvMatch): Venue | undefined => {
        const c = m.homeClubId ? this.index.clubs[m.homeClubId] : undefined;
        if (!c?.location) return undefined;
        return { name: `Platz ${c.name}`, street: c.address, location: c.location, approximate: true };
      };

      const byId = new Map<string, BfvMatch>();
      for (const r of results) for (const m of r.matches) if (m.matchId && !byId.has(m.matchId)) byId.set(m.matchId, m);

      const from = query.from.getTime();
      const to = query.to.getTime();
      const out: Match[] = [];
      for (const m of byId.values()) {
        const mapped = mapBfvMatch(m, clubNames, venueFor);
        if (!mapped) continue;
        const t = new Date(mapped.kickoff).getTime();
        if (t >= from && t <= to) out.push(mapped);
      }
      return out;
    } finally {
      loadProgressStore.set(null);
    }
  }
}

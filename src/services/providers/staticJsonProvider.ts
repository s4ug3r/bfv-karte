/**
 * Provider für einen vorab exportierten Datensatz (z. B. nächtlich per Crawler oder
 * Skript erzeugte JSON-Datei, die neben der App statisch ausgeliefert wird).
 * Keine Flächenabfrage: Die Datei wird geladen und clientseitig gefiltert.
 */
import type { Match } from '../../types/match';
import { ProviderError, type MatchDataProvider, type MatchQuery } from '../../types/provider';
import { normalizeMatchList } from './normalize';

export class StaticJsonMatchProvider implements MatchDataProvider {
  readonly id = 'static';
  readonly label = 'Exportierter BFV-Datensatz';
  readonly supportsAreaQuery = false;
  readonly isDemo = false;

  constructor(private readonly url: string) {}

  async fetchMatches(query: MatchQuery, signal?: AbortSignal): Promise<Match[]> {
    let res: Response;
    try {
      res = await fetch(this.url, { headers: { Accept: 'application/json' }, signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      throw new ProviderError('Der Spieldatensatz konnte nicht geladen werden.');
    }
    if (!res.ok) throw new ProviderError(`Der Spieldatensatz wurde nicht gefunden (HTTP ${res.status}).`, res.status);

    const all = normalizeMatchList(await res.json());
    const from = query.from.getTime();
    const to = query.to.getTime();
    return all.filter((m) => {
      const t = new Date(m.kickoff).getTime();
      return t >= from && t <= to;
    });
  }
}

/**
 * Provider für ein eigenes Backend (offizielle API-Anbindung, Proxy oder Crawler),
 * das den in der README beschriebenen Endpunkt bereitstellt:
 *
 *   GET {VITE_BFV_API_BASE_URL}/matches?lat=48.26&lng=11.43&radiusKm=20&from=ISO&to=ISO
 *   → [ { id, kickoff, homeTeam, awayTeam, competition, category?, ageClass?, venue: {...}, detailUrl? } ]
 *
 * Hinweis: API-Schlüssel für die BFV-Daten gehören ins Backend, nie ins Frontend –
 * alles mit VITE_-Präfix landet im ausgelieferten JavaScript.
 */
import type { Match } from '../../types/match';
import { ProviderError, type MatchDataProvider, type MatchQuery } from '../../types/provider';
import { normalizeMatchList } from './normalize';

export class RestApiMatchProvider implements MatchDataProvider {
  readonly id = 'rest';
  readonly label: string;

  constructor(
    private readonly baseUrl: string,
    readonly supportsAreaQuery: boolean,
  ) {
    this.label = `BFV-Datenquelle (${new URL(baseUrl, window.location.origin).host})`;
  }

  async fetchMatches(query: MatchQuery, signal?: AbortSignal): Promise<Match[]> {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL('matches', new URL(base, window.location.origin));
    url.searchParams.set('from', query.from.toISOString());
    url.searchParams.set('to', query.to.toISOString());
    if (this.supportsAreaQuery) {
      url.searchParams.set('lat', query.center.lat.toFixed(5));
      url.searchParams.set('lng', query.center.lng.toFixed(5));
      url.searchParams.set('radiusKm', String(Math.ceil(query.radiusKm)));
    }

    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      throw new ProviderError('Die BFV-Datenquelle ist nicht erreichbar. Bitte prüfe deine Internetverbindung.');
    }
    if (!res.ok) {
      throw new ProviderError(
        res.status >= 500
          ? 'Die BFV-Datenquelle hat gerade ein Problem. Bitte versuche es später erneut.'
          : `Die BFV-Datenquelle hat die Anfrage abgelehnt (HTTP ${res.status}).`,
        res.status,
      );
    }
    try {
      return normalizeMatchList(await res.json());
    } catch {
      throw new ProviderError('Die Antwort der BFV-Datenquelle konnte nicht gelesen werden.');
    }
  }
}

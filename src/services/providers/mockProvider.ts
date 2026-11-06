import type { Match } from '../../types/match';
import type { MatchDataProvider, MatchQuery } from '../../types/provider';
import { toBerlinDateKey } from '../../utils/date';
import { generateDemoMatches } from './mockData';

/**
 * Demo-Provider mit fiktiven Spielen. Simuliert eine Quelle OHNE Flächenabfrage
 * (liefert alle Spiele im Zeitraum) sowie Netzwerklatenz.
 */
export class MockMatchProvider implements MatchDataProvider {
  readonly id = 'mock';
  readonly label = 'Demodaten (fiktive Ansetzungen)';
  readonly supportsAreaQuery = false;
  readonly isDemo = true;

  async fetchMatches(query: MatchQuery, signal?: AbortSignal): Promise<Match[]> {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 350);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Abgebrochen', 'AbortError'));
      });
    });
    const from = query.from.getTime();
    const to = query.to.getTime();
    return generateDemoMatches(toBerlinDateKey(query.from), toBerlinDateKey(query.to)).filter((m) => {
      const t = new Date(m.kickoff).getTime();
      return t >= from && t <= to;
    });
  }
}

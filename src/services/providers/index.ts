/**
 * Auswahl des Data-Providers anhand der Konfiguration.
 * Neue Quellen (z. B. eine offizielle BFV-API) implementieren MatchDataProvider
 * und werden hier ergänzt – sonst ist keine Änderung an der App nötig.
 */
import { config } from '../../config';
import type { MatchDataProvider } from '../../types/provider';
import type { AreaIndex } from '../bfv/areaIndex';
import { BfvAreaMatchProvider } from './bfvWidgetProvider';
import { MockMatchProvider } from './mockProvider';
import { RestApiMatchProvider } from './restApiProvider';
import { StaticJsonMatchProvider } from './staticJsonProvider';

/** true beim BFV-Provider (Umgebungserkundung in der App). */
export const usesBfvSources = config.dataProvider === 'bfv';

function createStaticProvider(): MatchDataProvider {
  switch (config.dataProvider) {
    case 'rest':
      if (!config.bfvApiBaseUrl) {
        console.warn('[BFV] VITE_BFV_DATA_PROVIDER=rest, aber VITE_BFV_API_BASE_URL fehlt – nutze Demodaten.');
        return new MockMatchProvider();
      }
      return new RestApiMatchProvider(config.bfvApiBaseUrl, config.bfvApiAreaQuery);
    case 'static':
      return new StaticJsonMatchProvider(config.bfvStaticUrl);
    default:
      return new MockMatchProvider();
  }
}

const staticProvider = usesBfvSources ? null : createStaticProvider();
const demoProvider = new MockMatchProvider();
let cached: { key: number; provider: MatchDataProvider } | null = null;

/**
 * Liefert den aktiven Provider. Beim BFV-Provider hängt er vom Verzeichnis der erkundeten
 * Umgebung ab; `useDemo` schaltet auf Demodaten um (zum Ausprobieren).
 */
export function getMatchProvider(index: AreaIndex, useDemo = false): MatchDataProvider {
  if (staticProvider) return staticProvider;
  if (useDemo) return demoProvider;
  if (cached?.key !== index.updatedAt) cached = { key: index.updatedAt, provider: new BfvAreaMatchProvider(index) };
  return cached.provider;
}

/**
 * Auswahl des Data-Providers anhand der Konfiguration.
 * Neue Quellen (z. B. eine offizielle BFV-API) implementieren MatchDataProvider
 * und werden hier ergänzt – sonst ist keine Änderung an der App nötig.
 */
import { config } from '../../config';
import type { MatchDataProvider } from '../../types/provider';
import type { AreaIndex } from '../bfv/areaIndex';
import { BfvAreaMatchProvider } from './bfvWidgetProvider';
import { RestApiMatchProvider } from './restApiProvider';
import { StaticJsonMatchProvider } from './staticJsonProvider';

/** true beim BFV-Provider (Umgebungserkundung in der App). */
export const usesBfvSources = createStaticProvider() === null;

/** Eigenes Backend oder exportierter Datensatz statt der BFV-Erkundung (siehe README). */
function createStaticProvider(): MatchDataProvider | null {
  if (config.dataProvider === 'rest' && config.bfvApiBaseUrl) {
    return new RestApiMatchProvider(config.bfvApiBaseUrl, config.bfvApiAreaQuery);
  }
  if (config.dataProvider === 'static') return new StaticJsonMatchProvider(config.bfvStaticUrl);
  return null;
}

const staticProvider = createStaticProvider();
let cached: { key: number; provider: MatchDataProvider } | null = null;

/**
 * Liefert den aktiven Provider. Beim BFV-Provider hängt er vom Verzeichnis der erkundeten
 * Umgebung ab.
 */
export function getMatchProvider(index: AreaIndex): MatchDataProvider {
  if (staticProvider) return staticProvider;
  if (cached?.key !== index.updatedAt) cached = { key: index.updatedAt, provider: new BfvAreaMatchProvider(index) };
  return cached.provider;
}

/**
 * Zugriff auf die BFV-Widget-Schnittstelle über die Bibliothek "bfv-api" (v1.4.0,
 * https://github.com/SebastianSiedler/bfv-api-js – inoffiziell, nicht vom BFV).
 *
 * Die Bibliothek spricht https://widget-prod.bfv.de/api/service/widget/v1 an. Im Browser
 * gehen die Anfragen über unseren Proxy-Pfad (config.bfvProxyUrl, Standard "/bfv-api"),
 * damit keine CORS-Sperre greift.
 *
 * Wichtig: Die Schnittstelle arbeitet pro Mannschaft bzw. Liga – es gibt keine Umkreissuche
 * und keine Spielstätten-Adressen. Beides ergänzt die App (Provider + Places-Suche).
 */
import { createBfvApiClient } from 'bfv-api';
import { config } from '../../config';
import { ProviderError } from '../../types/provider';

/** Spiel, wie es /team/{id}/matches liefert (Feldnamen laut bfv-api-Schema). */
export interface BfvMatch {
  matchId: string;
  compoundId: string;
  competitionName: string;
  competitionType: string;
  teamType: string;
  kickoffDate: string | null;
  kickoffTime: string | null;
  homeTeamName: string;
  homeTeamPermanentId: string;
  homeClubId: string | null;
  guestTeamName: string;
  guestTeamPermanentId: string;
  guestClubId: string | null;
  result: string;
  prePublished: boolean;
}

export interface BfvTeam {
  permanentId: string;
  name: string;
  typeName: string;
  clubId: string;
  clubName: string;
  compoundId: string;
  competitionName: string;
}

export interface BfvTableEntry {
  team?: { permanentId?: string; name?: string };
}

// Antwortvalidierung aus: Kleine Schemaänderungen beim BFV sollen die App nicht lahmlegen –
// unsere eigene Normalisierung prüft die benötigten Felder ohnehin.
const client = createBfvApiClient(config.bfvProxyUrl, { validate: 'request' });

/** Übersetzt Netzwerk-/HTTP-Fehler in verständliche Meldungen. */
function toProviderError(err: unknown, what: string): Error {
  const e = err as { name?: string; code?: string; response?: { status?: number } };
  if (e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
    return err as Error;
  }
  const status = e?.response?.status;
  if (status === 404) return new ProviderError(`${what} wurde beim BFV nicht gefunden (ID prüfen).`, 404);
  if (status) return new ProviderError(`Der BFV hat die Anfrage für ${what} abgelehnt (HTTP ${status}).`, status);
  return new ProviderError(
    'Die BFV-Schnittstelle ist nicht erreichbar. Läuft die App über den Dev-Server bzw. ist der Proxy beim Hosting eingerichtet (siehe README)?',
  );
}

/** Alle Spiele einer Mannschaft (Saison) plus Mannschaftsdaten. */
export async function fetchTeamMatches(
  teamPermanentId: string,
  signal?: AbortSignal,
): Promise<{ team: BfvTeam | null; matches: BfvMatch[] }> {
  try {
    const res = (await client.listMatches({ params: { teamPermanentId }, signal })) as unknown as {
      data?: { team?: BfvTeam; matches?: BfvMatch[] };
    };
    return { team: res.data?.team ?? null, matches: res.data?.matches ?? [] };
  } catch (err) {
    throw toProviderError(err, 'Die Mannschaft');
  }
}

/** Mannschaften einer Liga über die Tabelle. */
export async function fetchCompetitionTeams(
  compoundId: string,
  signal?: AbortSignal,
): Promise<{ competitionName: string; teams: { permanentId: string; name: string }[] }> {
  try {
    const res = (await client.getCompetitionTable({ params: { compoundId }, signal })) as unknown as {
      data?: { competitionName?: string; table?: BfvTableEntry[] };
    };
    const teams = (res.data?.table ?? [])
      .map((e) => e.team)
      .filter((t): t is { permanentId: string; name: string } => !!t?.permanentId)
      .map((t) => ({ permanentId: t.permanentId, name: t.name ?? '' }));
    return { competitionName: res.data?.competitionName ?? '', teams };
  } catch (err) {
    throw toProviderError(err, 'Die Liga');
  }
}

/** Name einer Liga (für die Quellenverwaltung). */
export async function fetchCompetitionName(compoundId: string): Promise<string> {
  try {
    const res = (await client.getCompetitionInformation({ params: { compoundId } })) as unknown as {
      data?: { competitionName?: string; competitionBreadcrumb?: string };
    };
    return res.data?.competitionName || compoundId;
  } catch (err) {
    throw toProviderError(err, 'Die Liga');
  }
}

/** Name einer Mannschaft inkl. Verein (für die Quellenverwaltung). */
export async function fetchTeamName(teamPermanentId: string): Promise<string> {
  try {
    const res = (await client.getTeamInformation({ params: { teamPermanentId } })) as unknown as {
      data?: { team?: { name?: string; typeName?: string }; name?: string; typeName?: string };
    };
    const t = res.data?.team ?? res.data;
    return [t?.name, t?.typeName].filter(Boolean).join(' · ') || teamPermanentId;
  } catch (err) {
    throw toProviderError(err, 'Die Mannschaft');
  }
}

/** Offizieller Name eines Vereins (getClubInformationById). */
export async function fetchClubName(clubId: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = (await client.getClubInformationById({ params: { clubId }, signal })) as unknown as {
      data?: { club?: { name?: string } };
    };
    return res.data?.club?.name?.trim() || null;
  } catch (err) {
    const e = toProviderError(err, 'Der Verein');
    if (e.name === 'CanceledError' || e.name === 'AbortError') throw e;
    return null;
  }
}

/**
 * Alle Mannschaften eines Vereins von seiner bfv.de-Vereinsseite
 * (https://www.bfv.de/vereine/verein/{clubId}). Die Widget-Schnittstelle bietet dafür keinen
 * Endpunkt; die Vereinsseite verlinkt jede Mannschaft als /mannschaften/<name>/<ID>.
 * Gibt [] zurück, wenn die Seite nicht lesbar ist – die Erkundung nutzt dann die
 * Mannschaften, die ihr in Spielplänen begegnet sind.
 */
export async function fetchClubTeamIds(clubId: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(`${config.bfvWebProxyUrl}/vereine/verein/${encodeURIComponent(clubId)}`, {
      signal,
      headers: { Accept: 'text/html' },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const ids = new Set<string>();
    for (const m of html.matchAll(/\/mannschaften\/[a-z0-9-]+\/([0-9A-Z]{32})/g)) ids.add(m[1]);
    return [...ids];
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return [];
  }
}

// ─── Zwischenspeicher für Spielpläne ───────────────────────────────────────
// Erkundung und Spielliste fragen dieselben Mannschaften ab – so wird jede nur einmal geladen.

type TeamMatches = Awaited<ReturnType<typeof fetchTeamMatches>>;
const teamCache = new Map<string, { at: number; value: Promise<TeamMatches> }>();

export function fetchTeamMatchesCached(teamPermanentId: string, signal?: AbortSignal): Promise<TeamMatches> {
  const hit = teamCache.get(teamPermanentId);
  if (hit && Date.now() - hit.at < config.cache.bfvMatchesStaleMs) return hit.value;
  const value = fetchTeamMatches(teamPermanentId, signal);
  teamCache.set(teamPermanentId, { at: Date.now(), value });
  value.catch(() => teamCache.delete(teamPermanentId)); // Fehler nicht cachen
  return value;
}

// ─── Ladefortschritt (für die Anzeige "120 / 640 Mannschaften") ────────────

export interface LoadProgress {
  done: number;
  total: number;
}
let progress: LoadProgress | null = null;
const listeners = new Set<() => void>();

export const loadProgressStore = {
  get: () => progress,
  set: (p: LoadProgress | null) => {
    progress = p;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

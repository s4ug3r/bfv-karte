/**
 * Startpunkte für die Umgebungserkundung: Verein, Mannschaft oder Liga – als bfv.de-Link oder ID.
 */
export type BfvSourceKind = 'competition' | 'team' | 'club';

/** BFV-IDs sind lange Großbuchstaben-/Ziffernfolgen, z. B. "016PD5QT70000000VV0AG811VTE5EA5R". */
const ID_RE = /^[0-9A-Z]{16,40}$/;

export interface ParsedSourceInput {
  id: string;
  /** Aus dem Link erkannter Typ; undefined, wenn nur eine ID eingegeben wurde. */
  kind?: BfvSourceKind;
}

/**
 * Liest eine BFV-ID aus einem bfv.de-Link oder einer reinen ID.
 *   https://www.bfv.de/vereine/<name>/<clubId>                 → Verein
 *   https://www.bfv.de/mannschaften/<name>/<teamPermanentId>   → Mannschaft
 *   https://www.bfv.de/wettbewerbe/.../<compoundId>            → Liga
 */
export function parseSourceInput(input: string): ParsedSourceInput | null {
  const text = input.trim();
  if (!text) return null;
  if (ID_RE.test(text)) return { id: text };

  let path = text;
  try {
    path = new URL(text.startsWith('http') ? text : `https://${text}`).pathname;
  } catch {
    /* kein Link – als Pfad weiterverarbeiten */
  }
  const segments = path.split('/').filter(Boolean);
  const id = [...segments].reverse().find((s) => ID_RE.test(s));
  if (!id) return null;

  const lower = path.toLowerCase();
  const kind: BfvSourceKind | undefined = lower.includes('/verein')
    ? 'club'
    : lower.includes('/mannschaft')
    ? 'team'
    : /\/(wettbewerb|liga|ligen|tabelle|spielplan)/.test(lower)
      ? 'competition'
      : undefined;
  return { id, kind };
}

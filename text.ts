/**
 * Normalisiert Text für Vergleiche und Suche:
 * Kleinschreibung, Umlaute/ß vereinheitlicht, Satzzeichen entfernt, Leerraum zusammengefasst.
 * "TSV 1865 Dachau e.V." → "tsv 1865 dachau ev"
 */
export function normalizeText(input: string | undefined | null): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prüft, ob alle Suchbegriffe in einem der Felder vorkommen (UND-Verknüpfung über Wörter). */
export function matchesSearch(query: string, fields: (string | undefined)[]): boolean {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(fields.filter(Boolean).join(' '));
  return terms.every((t) => haystack.includes(t));
}

/** Einfacher, stabiler String-Hash (FNV-1a) für abgeleitete IDs. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Robuster Zugriff auf localStorage. Im privaten Modus, bei deaktivierten Cookies oder
 * vollem Speicher kann der Zugriff werfen – die App funktioniert dann ohne Persistenz weiter.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher nicht verfügbar – ignorieren */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignorieren */
  }
}

/** Liefert localStorage, falls nutzbar – sonst undefined (z. B. für den Query-Persister). */
export function getSafeStorage(): Storage | undefined {
  try {
    const probe = '__bfv_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

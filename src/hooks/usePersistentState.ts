import { useEffect, useState } from 'react';
import { readJson, writeJson } from '../utils/storage';

/**
 * useState mit Speicherung in localStorage. `sanitize` prüft geladene Werte,
 * damit veraltete oder manipulierte Einträge die App nicht stören.
 */
export function usePersistentState<T>(key: string, initial: T, sanitize?: (stored: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readJson<unknown>(key, undefined);
    if (stored === undefined) return initial;
    return sanitize ? sanitize(stored) : (stored as T);
  });

  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

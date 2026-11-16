import { useCallback, useMemo } from 'react';
import { clubKey, clubName, sanitizeFavorites, type FavoriteClub } from '../utils/favorites';
import { usePersistentState } from './usePersistentState';

/** Gemerkte Vereine – nur in diesem Browser gespeichert. */
export function useFavorites() {
  const [list, setList] = usePersistentState<FavoriteClub[]>('bfv.favorites.v1', [], sanitizeFavorites);
  const keys = useMemo(() => new Set(list.map((f) => f.key)), [list]);

  const isFavorite = useCallback((teamName: string) => keys.has(clubKey(teamName)), [keys]);

  const toggle = useCallback(
    (teamName: string) => {
      const key = clubKey(teamName);
      if (!key) return;
      setList((l) =>
        l.some((f) => f.key === key)
          ? l.filter((f) => f.key !== key)
          : [...l, { key, name: clubName(teamName) }].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      );
    },
    [setList],
  );

  const remove = useCallback((key: string) => setList((l) => l.filter((f) => f.key !== key)), [setList]);

  return { list, keys, isFavorite, toggle, remove };
}

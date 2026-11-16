import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { fetchForecast, WEATHER_DAYS, weatherAt, weatherCell, type WeatherAt } from '../services/weather';
import type { Match } from '../types/match';

const HOUR = 60 * 60 * 1000;

/**
 * Wetter für die angezeigten Spiele: eine Abfrage je ~10-km-Zelle, eine Stunde zwischengespeichert.
 * Liefert eine Funktion Spiel → Wetter (oder null, solange nichts da ist).
 */
export function useWeather(matches: Match[], enabled: boolean) {
  const cells = useMemo(() => {
    const until = Date.now() + (WEATHER_DAYS - 1) * 24 * HOUR;
    const set = new Set<string>();
    for (const m of matches) {
      if (m.venue.location && new Date(m.kickoff).getTime() < until) set.add(weatherCell(m.venue.location));
    }
    return [...set].sort().slice(0, 30); // Obergrenze schont den Dienst bei 100 km Umkreis
  }, [matches]);

  const queries = useQueries({
    queries: cells.map((cell) => ({
      queryKey: ['weather', cell],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchForecast(cell, signal),
      enabled,
      staleTime: HOUR,
      gcTime: 12 * HOUR,
      retry: 0,
    })),
  });

  // Nur neu aufbauen, wenn neue Vorhersagen eingetroffen sind
  const stamp = queries.map((q) => q.dataUpdatedAt).join(',');
  const byCell = useMemo(() => {
    const map = new Map<string, (typeof queries)[number]['data']>();
    cells.forEach((c, i) => map.set(c, queries[i]?.data));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, stamp]);

  return useCallback(
    (m: Match): WeatherAt | null =>
      m.venue.location ? weatherAt(byCell.get(weatherCell(m.venue.location)), m.kickoff) : null,
    [byCell],
  );
}

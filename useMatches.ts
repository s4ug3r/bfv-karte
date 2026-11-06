import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { config } from '../config';
import { loadMatches, applyUserFilters, countByCategory, filterByAreaAndTime } from '../services/matchService';
import type { Filters, SelectedLocation } from '../types/filters';
import type { MatchDataProvider } from '../types/provider';
import { getDateRange, startOfBerlinDay, toBerlinDateKey } from '../utils/date';

/** Puffer, damit gerundete Mittelpunkte bei Flächenabfragen keine Randspiele verlieren. */
const AREA_BUFFER_KM = 2;

/**
 * Lädt und filtert Spiele für Standort + Filter.
 *
 * Cache-Strategie (React Query, persistiert in localStorage):
 * - Query-Key enthält Quelle, Zeitraum (Kalendertage) und – nur bei Quellen mit Flächenabfrage –
 *   den auf ~1 km gerundeten Mittelpunkt + Radius. Quellen ohne Flächenabfrage laden
 *   unabhängig vom Standort, d. h. Standort-/Radiuswechsel kosten keinen neuen Abruf.
 * - Nach 15 min gelten Daten als veraltet und werden im Hintergrund aktualisiert,
 *   nach 6 h verworfen (Ansetzungen ändern sich).
 * - Kategorie, Freitext und Altersklasse filtern nur lokal – sofortige Reaktion.
 */
export function useMatches(
  matchProvider: MatchDataProvider,
  location: SelectedLocation,
  filters: Filters,
  geocodingEnabled: boolean,
) {
  const todayKey = toBerlinDateKey(new Date());
  const range = useMemo(
    () => getDateRange(filters.timePreset, new Date(), filters.customFrom, filters.customTo),
    // todayKey als Abhängigkeit: Der Zeitraum verschiebt sich nach Mitternacht.
    [filters.timePreset, filters.customFrom, filters.customTo, todayKey],
  );
  const emptyRange = range.from.getTime() > range.to.getTime();

  const area = matchProvider.supportsAreaQuery
    ? {
        lat: Number(location.lat.toFixed(2)),
        lng: Number(location.lng.toFixed(2)),
        radiusKm: filters.radiusKm,
      }
    : null;

  const query = useQuery({
    queryKey: ['matches', matchProvider.id, range.fromKey, range.toKey, area, geocodingEnabled],
    queryFn: ({ signal }) =>
      loadMatches(
        matchProvider,
        {
          center: area ? { lat: area.lat, lng: area.lng } : { lat: location.lat, lng: location.lng },
          radiusKm: filters.radiusKm + AREA_BUFFER_KM,
          // ganze Kalendertage laden – die exakte Grenze (z. B. "ab jetzt") filtert der Client
          from: startOfBerlinDay(range.fromKey),
          to: range.to,
        },
        geocodingEnabled,
        signal,
      ),
    enabled: !emptyRange,
    staleTime: matchProvider.staleTimeMs ?? config.cache.matchesStaleMs,
    gcTime: config.cache.matchesMaxAgeMs,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const loaded = query.data;

  const inArea = useMemo(
    () =>
      loaded
        ? filterByAreaAndTime(
            loaded.matches,
            location,
            filters.radiusKm,
            // vergangene Spiele ausblenden
            new Date(Math.max(range.from.getTime(), Date.now())),
            range.to,
          )
        : [],
    [loaded, location, filters.radiusKm, range],
  );

  const matches = useMemo(
    () => applyUserFilters(inArea, filters),
    [inArea, filters],
  );

  const counts = useMemo(() => countByCategory(applyUserFilters(inArea, { ...filters, category: 'alle' })), [inArea, filters]);

  return {
    matches,
    /** Alle Spiele im Umkreis/Zeitraum vor Nutzerfiltern (z. B. für Filteroptionen). */
    inArea,
    counts,
    range,
    emptyRange,
    unresolvedCount: loaded?.unresolvedCount ?? 0,
    isLoading: query.isPending && !emptyRange,
    isFetching: query.isFetching,
    /** true, solange nach Filterwechsel noch die alten Daten angezeigt werden */
    isPlaceholder: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
    provider: matchProvider,
  };
}

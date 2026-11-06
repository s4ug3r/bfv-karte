import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  clearAreaIndex,
  emptyIndex,
  loadAreaIndex,
  saveAreaIndex,
  type AreaIndex,
} from '../services/bfv/areaIndex';
import { loadProgressStore } from '../services/bfv/bfvClient';
import { discoverArea, type DiscoveryProgress } from '../services/bfv/discovery';
import type { ParsedSourceInput } from '../services/bfv/sources';
import type { LatLng } from '../types/match';

/**
 * Zustand der Umgebungserkundung: Verzeichnis (persistiert), laufende Erkundung,
 * Fortschritt, Fehler, Starten/Abbrechen/Zurücksetzen.
 */
export function useAreaDiscovery() {
  const [index, setIndex] = useState<AreaIndex>(loadAreaIndex);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Laufende Erkundung beim Verlassen der Seite abbrechen
  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(
    async (center: LatLng, radiusKm: number, seed?: ParsedSourceInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setError(null);
      setProgress({ done: 0, queued: 0, teams: 0, step: 'Starte…' });
      try {
        const result = await discoverArea({
          index,
          center,
          radiusKm,
          seed,
          signal: controller.signal,
          onProgress: setProgress,
          // Zwischenstand sichern und gleich anzeigen – Spiele erscheinen schon während der Erkundung
          onCheckpoint: (partial) => {
            saveAreaIndex(partial);
            setIndex({ ...structuredClone(partial), updatedAt: Date.now() });
          },
        });
        saveAreaIndex(result);
        setIndex(result);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // Zwischenstand übernehmen, damit bereits Erkundetes nutzbar ist
          const partial = loadAreaIndex();
          setIndex({ ...partial, updatedAt: Date.now() });
        } else {
          setError(err instanceof Error ? err.message : 'Die Erkundung ist fehlgeschlagen.');
          const partial = loadAreaIndex();
          if (partial.updatedAt !== index.updatedAt) setIndex(partial);
        }
      } finally {
        setRunning(false);
        setProgress(null);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [index],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearAreaIndex();
    setIndex(emptyIndex());
    setError(null);
  }, []);

  return { index, running, progress, error, start, cancel, reset, clearError: () => setError(null) };
}

/** Fortschritt beim Laden der Spielpläne ("120 / 640 Mannschaften"). */
export function useLoadProgress() {
  return useSyncExternalStore(loadProgressStore.subscribe, loadProgressStore.get, () => null);
}

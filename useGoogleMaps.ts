import { useEffect, useState } from 'react';
import { isGoogleMapsLoaded, loadGoogleMaps } from '../services/googleMaps';

export type GoogleMapsStatus = 'disabled' | 'loading' | 'ready' | 'error';

/**
 * Lädt die Google Maps API, sobald `enabled` (= Nutzerzustimmung) true ist.
 */
export function useGoogleMaps(enabled: boolean) {
  const [status, setStatus] = useState<GoogleMapsStatus>(() =>
    !enabled ? 'disabled' : isGoogleMapsLoaded() ? 'ready' : 'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return;
    }
    let cancelled = false;
    setStatus(isGoogleMapsLoaded() ? 'ready' : 'loading');
    setError(null);
    loadGoogleMaps()
      .then(() => !cancelled && setStatus('ready'))
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || 'Google Maps konnte nicht geladen werden.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  return { status, error, retry: () => setAttempt((a) => a + 1) };
}

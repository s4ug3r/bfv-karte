import { useCallback, useState } from 'react';
import type { LatLng } from '../types/match';

const ERROR_MESSAGES: Record<number, string> = {
  1: 'Du hast den Zugriff auf deinen Standort nicht erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben oder einen Ort eingeben.',
  2: 'Dein Standort konnte nicht ermittelt werden. Bitte gib einen Ort ein.',
  3: 'Die Standortermittlung hat zu lange gedauert. Bitte versuche es erneut oder gib einen Ort ein.',
};

/**
 * Kapselt die Browser-Geolocation-API. Wird erst nach ausdrücklicher Zustimmung im
 * Dialog aufgerufen; der Standort wird nicht gespeichert und nur im Browser verwendet.
 */
export function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback((): Promise<LatLng | null> => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Dein Browser unterstützt keine Standortermittlung.');
      return Promise.resolve(null);
    }
    if (!window.isSecureContext) {
      setError('Die Standortermittlung funktioniert nur über eine sichere Verbindung (HTTPS).');
      return Promise.resolve(null);
    }
    setLocating(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setLocating(false);
          setError(ERROR_MESSAGES[err.code] ?? 'Dein Standort konnte nicht ermittelt werden.');
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
      );
    });
  }, []);

  return { locate, locating, error, clearError: () => setError(null) };
}

import { useCallback, useState } from 'react';
import type { LatLng } from '../types/match';

const ERROR_MESSAGES: Record<number, string> = {
  1: 'Du hast den Zugriff auf deinen Standort nicht erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben oder einen Ort eingeben.',
  2: 'Dein Standort konnte nicht ermittelt werden (am PC oft: Windows-Standortdienst aus). Bitte gib einen Ort oben ins Suchfeld ein.',
  3: 'Die Standortermittlung hat zu lange gedauert. Am PC muss dafür der Windows-Standortdienst eingeschaltet sein (Einstellungen → Datenschutz → Standort). Einfacher: Ort oben ins Suchfeld eingeben.',
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
        // Desktop-PCs ohne GPS brauchen über WLAN-Ortung manchmal länger
        { enableHighAccuracy: false, timeout: 25_000, maximumAge: 10 * 60_000 },
      );
    });
  }, []);

  return { locate, locating, error, clearError: () => setError(null) };
}

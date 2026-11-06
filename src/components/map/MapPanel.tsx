import { forwardRef } from 'react';
import type { GoogleMapsStatus } from '../../hooks/useGoogleMaps';
import type { SelectedLocation } from '../../types/filters';
import type { MatchWithDistance } from '../../types/match';
import { IconAlert, IconMap, Spinner, buttonPrimary, buttonSecondary } from '../ui';
import { MapView, type MapViewHandle } from './MapView';

interface Props {
  status: GoogleMapsStatus;
  error: string | null;
  location: SelectedLocation;
  radiusKm: number;
  matches: MatchWithDistance[];
  onConsent: () => void;
  onRetry: () => void;
}

/**
 * Kartenbereich mit Zwei-Klick-Lösung: Google Maps wird erst nach Zustimmung geladen.
 * Vorher (oder bei Fehlern) zeigt der Bereich einen erklärenden Platzhalter.
 */
export const MapPanel = forwardRef<MapViewHandle, Props>(function MapPanel(props, ref) {
  const { status } = props;

  if (status === 'ready') {
    return <MapView ref={ref} location={props.location} radiusKm={props.radiusKm} matches={props.matches} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bfv-50 p-6">
      <div className="max-w-sm rounded-2xl bg-white/95 p-6 text-center shadow-lg ring-1 ring-slate-200">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Spinner className="h-6 w-6 text-bfv-700" />
            <p className="text-sm">Karte wird geladen…</p>
          </div>
        )}

        {status === 'disabled' && (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bfv-50 text-bfv-700">
              <IconMap width={22} height={22} />
            </div>
            <h2 className="font-bold text-slate-900">Karte & Ortssuche aktivieren</h2>
            <p className="mt-2 text-sm text-slate-600">
              Für Karte, Ortssuche und Adressauflösung nutzen wir Google Maps. Beim Laden werden Daten
              wie deine IP-Adresse an Google übertragen. Die Liste funktioniert auch ohne.
            </p>
            <button type="button" className={`${buttonPrimary} mt-4 w-full`} onClick={props.onConsent}>
              Google Maps laden
            </button>
            <p className="mt-2 text-xs text-slate-500">Deine Wahl wird in diesem Browser gespeichert und kann unten widerrufen werden.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <IconAlert width={22} height={22} />
            </div>
            <h2 className="font-bold text-slate-900">Karte nicht verfügbar</h2>
            <p className="mt-2 text-sm text-slate-600">{props.error}</p>
            <button type="button" className={`${buttonSecondary} mt-4`} onClick={props.onRetry}>
              Erneut versuchen
            </button>
          </>
        )}
      </div>
    </div>
  );
});

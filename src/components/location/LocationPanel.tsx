import type { SelectedLocation } from '../../types/filters';
import { IconLocate, IconPin, IconX, Spinner, buttonSecondary } from '../ui';
import { PlaceSearch } from './PlaceSearch';

interface Props {
  location: SelectedLocation;
  googleReady: boolean;
  locating: boolean;
  geoError: string | null;
  onSelect: (l: SelectedLocation) => void;
  onUseMyLocation: () => void;
  onResetLocation: () => void;
  onDismissGeoError: () => void;
}

/** Standortauswahl: Google-Ortssuche, "Meinen Standort verwenden" und aktueller Standort. */
export function LocationPanel(props: Props) {
  const { location, googleReady, locating, geoError } = props;
  return (
    <section aria-labelledby="loc-heading">
      {/* Kein <label for>: Das Google-Suchfeld steckt in einem Web-Component, auf dessen
          inneres Eingabefeld ein Label nicht zeigen kann. Beschriftung erfolgt per aria-label. */}
      <h2 id="loc-heading" className="mb-1.5 text-sm font-semibold text-slate-700">
        Standort
      </h2>

      {googleReady ? (
        <PlaceSearch onSelect={props.onSelect} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Die Ortssuche nutzt Google. Aktiviere Google Maps, um nach Orten zu suchen.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={buttonSecondary} onClick={props.onUseMyLocation} disabled={locating}>
          {locating ? <Spinner /> : <IconLocate />}
          {locating ? 'Standort wird ermittelt…' : 'Meinen Standort verwenden'}
        </button>
      </div>

      <div className="mt-2 flex items-start gap-2 rounded-xl bg-bfv-50 px-3 py-2 text-sm text-bfv-900">
        <IconPin className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="sr-only">Aktueller Standort: </span>
          <span className="font-medium break-words">{location.label}</span>
          {location.source === 'geolocation' && <span className="text-bfv-700"> · per GPS, nicht gespeichert</span>}
        </span>
        {location.source !== 'default' && (
          <button
            type="button"
            onClick={props.onResetLocation}
            className="shrink-0 rounded-md p-0.5 text-bfv-700 hover:bg-bfv-100"
            aria-label="Standort zurücksetzen auf Dachau"
            title="Zurück zu Dachau"
          >
            <IconX width={16} height={16} />
          </button>
        )}
      </div>

      {geoError && (
        <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">{geoError}</span>
          <button type="button" onClick={props.onDismissGeoError} aria-label="Hinweis schließen" className="shrink-0">
            <IconX width={16} height={16} />
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Standortsuche mit Google Places Autocomplete (PlaceAutocompleteElement, "Places API (New)").
 * Das ältere google.maps.places.Autocomplete ist für neue Google-Cloud-Projekte nicht mehr
 * verfügbar, daher wird das Web-Component-basierte Element verwendet.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchTownFree } from '../../services/osm';
import { IconSearch, Spinner, inputClass } from '../ui';
import { config } from '../../config';
import type { SelectedLocation } from '../../types/filters';

interface Props {
  onSelect: (location: SelectedLocation) => void;
}

/** Minimale Typen, da @types/google.maps das neue Element je nach Version unvollständig beschreibt. */
interface PlaceLike {
  fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
  location?: google.maps.LatLng | null;
  formattedAddress?: string | null;
  displayName?: string | null;
}

export function PlaceSearch({ onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [error, setError] = useState<string | null>(null);
  /** true, wenn die Google-Vorschläge nicht funktionieren → einfaches Suchfeld über OpenStreetMap */
  const [fallback, setFallback] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (fallback) return;
    const host = hostRef.current;
    const places = google.maps.places as unknown as {
      PlaceAutocompleteElement?: new (opts: Record<string, unknown>) => HTMLElement;
    };
    if (!host || !places.PlaceAutocompleteElement) {
      setFallback(true);
      return;
    }

    // Google prüft Koordinaten streng: nur { lat, lng } übergeben, keine weiteren Felder
    // (config.defaultLocation enthält zusätzlich label/source → "unknown property"-Fehler).
    const { lat, lng } = config.defaultLocation;
    let element: HTMLElement;
    try {
      element = new places.PlaceAutocompleteElement({
        includedRegionCodes: ['de'],
        // Ergebnisse rund um Bayern bevorzugen
        locationBias: { center: { lat, lng }, radius: 50_000 },
      });
    } catch (err) {
      console.warn('[Ortssuche] Mit Ortsbezug fehlgeschlagen, versuche ohne:', err);
      try {
        element = new places.PlaceAutocompleteElement({ includedRegionCodes: ['de'] });
      } catch (err2) {
        console.error('[Ortssuche] PlaceAutocompleteElement konnte nicht erstellt werden:', err2);
        setFallback(true);
        return;
      }
    }
    element.setAttribute('placeholder', 'Ort, Adresse oder PLZ suchen');
    element.setAttribute('aria-label', 'Standort suchen');
    element.id = 'place-search';

    const handlePlace = async (place: PlaceLike) => {
      try {
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
        if (!place.location) {
          setError('Für diesen Ort sind keine Koordinaten verfügbar. Bitte wähle einen anderen.');
          return;
        }
        setError(null);
        onSelectRef.current({
          lat: place.location.lat(),
          lng: place.location.lng(),
          label: place.formattedAddress || place.displayName || 'Ausgewählter Ort',
          source: 'search',
        });
      } catch (err) {
        console.error('[Ortssuche] Ort konnte nicht geladen werden:', err);
        setError('Der Ort konnte nicht geladen werden. Bitte versuche es erneut.');
      }
    };

    // Aktuelles Ereignis ("gmp-select") und älteres Beta-Ereignis ("gmp-placeselect") unterstützen
    const onSelectEvent = (e: Event) => {
      const prediction = (e as Event & { placePrediction?: { toPlace: () => PlaceLike } }).placePrediction;
      if (prediction) void handlePlace(prediction.toPlace());
    };
    const onLegacyEvent = (e: Event) => {
      const place = (e as Event & { place?: PlaceLike }).place;
      if (place) void handlePlace(place);
    };
    // Google-Vorschläge nicht verfügbar (z. B. Kontingent aufgebraucht) → eigenes Suchfeld
    const onError = (e: Event) => {
      console.warn('[Ortssuche] Google-Vorschläge nicht verfügbar, nutze OpenStreetMap:', e);
      setFallback(true);
    };

    element.addEventListener('gmp-select', onSelectEvent);
    element.addEventListener('gmp-placeselect', onLegacyEvent);
    element.addEventListener('gmp-error', onError);
    host.replaceChildren(element);

    return () => {
      element.removeEventListener('gmp-select', onSelectEvent);
      element.removeEventListener('gmp-placeselect', onLegacyEvent);
      element.removeEventListener('gmp-error', onError);
      element.remove();
    };
  }, [fallback]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearching(true);
    try {
      const hit = await searchTownFree(query);
      if (!hit) {
        setError('Ort nicht gefunden. Versuch es mit dem Ortsnamen oder einer bayerischen Postleitzahl.');
        return;
      }
      onSelectRef.current({ lat: hit.location.lat, lng: hit.location.lng, label: hit.label, source: 'search' });
    } catch {
      setError('Die Ortssuche ist gerade nicht erreichbar. Bitte später erneut versuchen.');
    } finally {
      setSearching(false);
    }
  };

  if (fallback) {
    return (
      <form onSubmit={submit}>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="place-search"
            className={`${inputClass} pl-9 pr-9`}
            placeholder="Ort oder PLZ eingeben und Enter drücken"
            aria-label="Standort suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
          {searching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-bfv-700" />}
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div>
      <div ref={hostRef} className="min-h-11" />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

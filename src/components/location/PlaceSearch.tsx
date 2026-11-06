/**
 * Standortsuche mit Google Places Autocomplete (PlaceAutocompleteElement, "Places API (New)").
 * Das ältere google.maps.places.Autocomplete ist für neue Google-Cloud-Projekte nicht mehr
 * verfügbar, daher wird das Web-Component-basierte Element verwendet.
 */
import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    const host = hostRef.current;
    const places = google.maps.places as unknown as {
      PlaceAutocompleteElement?: new (opts: Record<string, unknown>) => HTMLElement;
    };
    if (!host || !places.PlaceAutocompleteElement) {
      setError('Die Ortssuche ist in dieser Google-Maps-Version nicht verfügbar.');
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
        setError('Die Ortssuche konnte nicht geladen werden. Ist die „Places API (New)“ im Google-Projekt aktiviert?');
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
    const onError = (e: Event) => {
      console.error('[Ortssuche] gmp-error:', e);
      setError('Die Ortssuche ist gerade nicht verfügbar. Prüfe, ob die „Places API (New)“ aktiviert ist und dein API-Key diese Website erlaubt.');
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
  }, []);

  return (
    <div>
      <div ref={hostRef} className="min-h-11" />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

import type { LatLng, Venue } from '../types/match';

/**
 * URL, die Google Maps mit Navigation zur Spielstätte öffnet
 * (Maps URLs API – funktioniert in App und Browser, ohne API-Key).
 */
export function buildRouteUrl(destination: LatLng, origin?: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Adresse einer Spielstätte als einzeilige Zeichenkette (für Anzeige und Geocoding). */
export function formatVenueAddress(venue: Venue, includeName = false): string {
  const cityLine = [venue.postalCode, venue.city].filter(Boolean).join(' ');
  return [includeName ? venue.name : undefined, venue.street, cityLine].filter(Boolean).join(', ');
}

/**
 * Verteilt Marker mit identischen Koordinaten minimal (spiralförmig, ~15–40 m),
 * damit mehrere Spiele auf derselben Anlage einzeln anklickbar bleiben.
 */
export function spreadOverlapping<T extends { id: string; position: LatLng }>(items: T[]): Map<string, LatLng> {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = `${it.position.lat.toFixed(5)},${it.position.lng.toFixed(5)}`;
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const result = new Map<string, LatLng>();
  for (const group of groups.values()) {
    group.forEach((it, i) => {
      if (i === 0) {
        result.set(it.id, it.position);
        return;
      }
      const angle = i * 2.399963; // goldener Winkel
      const meters = 14 * Math.sqrt(i);
      const dLat = (meters * Math.cos(angle)) / 111_320;
      const dLng = (meters * Math.sin(angle)) / (111_320 * Math.cos((it.position.lat * Math.PI) / 180));
      result.set(it.id, { lat: it.position.lat + dLat, lng: it.position.lng + dLng });
    });
  }
  return result;
}

/** Nur http(s)-Links zulassen (Schutz vor javascript:-URLs aus Fremddaten). */
export function safeHttpUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

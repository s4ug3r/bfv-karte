import type { LatLng } from '../types/match';

/** Mittlerer Erdradius in Kilometern (IUGG). */
const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Großkreisentfernung zweier Punkte nach der Haversine-Formel.
 * Genauigkeit ~0,5 % – für Umkreissuchen mehr als ausreichend.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formatiert eine Entfernung deutsch, z. B. "850 m", "4,2 km", "37 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  if (km < 10) return `${km.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
  return `${Math.round(km)} km`;
}

/** Prüft, ob eine Koordinate plausibel ist (kein 0/0, im gültigen Wertebereich). */
export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  );
}

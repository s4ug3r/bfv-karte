/**
 * Wetter zum Anpfiff über Open-Meteo (kostenlos, ohne Anmeldung, https://open-meteo.com).
 * Gesendet werden nur die Koordinaten der Spielorte (auf ~10 km gerundet), nie der eigene Standort.
 * Vorhersage reicht 16 Tage in die Zukunft.
 */
import type { LatLng } from '../types/match';

export const WEATHER_DAYS = 16;

/** Stunde (UTC, "2026-11-21T13") → [Temperatur °C, Wettercode, Regenwahrscheinlichkeit %] */
export type Forecast = Record<string, [number, number, number]>;

export interface WeatherAt {
  temp: number;
  code: number;
  rain: number;
  emoji: string;
  label: string;
}

/** Spielorte auf ~10 km zusammenfassen – eine Abfrage je Zelle statt je Spiel. */
export function weatherCell(p: LatLng): string {
  return `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
}

export async function fetchForecast(cell: string, signal?: AbortSignal): Promise<Forecast> {
  const [lat, lng] = cell.split(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability&timezone=GMT&forecast_days=${WEATHER_DAYS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wetter: HTTP ${res.status}`);
  const data = (await res.json()) as {
    hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[]; precipitation_probability?: (number | null)[] };
  };
  const h = data.hourly ?? {};
  const out: Forecast = {};
  (h.time ?? []).forEach((t, i) => {
    const temp = h.temperature_2m?.[i];
    const code = h.weather_code?.[i];
    if (typeof temp === 'number' && typeof code === 'number') {
      out[t.slice(0, 13)] = [Math.round(temp), code, h.precipitation_probability?.[i] ?? 0];
    }
  });
  return out;
}

/** Wetter zur Anstoßstunde (auf die volle Stunde gerundet). */
export function weatherAt(forecast: Forecast | undefined, kickoffIso: string): WeatherAt | null {
  if (!forecast) return null;
  const d = new Date(kickoffIso);
  d.setUTCMinutes(d.getUTCMinutes() + 30, 0, 0);
  const hit = forecast[d.toISOString().slice(0, 13)];
  if (!hit) return null;
  const [temp, code, rain] = hit;
  const { emoji, label } = describeWeather(code);
  return { temp, code, rain, emoji, label };
}

/** WMO-Wettercodes → Symbol und Text. */
export function describeWeather(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'sonnig' };
  if (code <= 2) return { emoji: '🌤️', label: 'leicht bewölkt' };
  if (code === 3) return { emoji: '☁️', label: 'bewölkt' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Nebel' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Niesel' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: '🌧️', label: 'Regen' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { emoji: '🌨️', label: 'Schnee' };
  if (code >= 95) return { emoji: '⛈️', label: 'Gewitter' };
  return { emoji: '🌡️', label: '' };
}

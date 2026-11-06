#!/usr/bin/env node
/**
 * Minimales Beispiel-Backend für VITE_BFV_DATA_PROVIDER=rest – ohne Abhängigkeiten.
 *
 * Liest einen JSON-Export (Format wie public/data/matches.example.json) und stellt
 *   GET /matches?lat=..&lng=..&radiusKm=..&from=ISO&to=ISO
 * mit Flächen- und Zeitraumfilter bereit. Hier ist der richtige Ort, um später
 * eine offizielle BFV-Schnittstelle oder einen Crawler anzubinden (inkl. API-Keys,
 * serverseitigem Caching und CORS) – nicht im Frontend.
 *
 * Start:  node server/example-backend.mjs ./pfad/zu/matches.json
 * Frontend: VITE_BFV_API_BASE_URL=http://localhost:8787
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_FILE = process.argv[2] ?? new URL('../public/data/matches.example.json', import.meta.url);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

/** Haversine in km (identisch zur App). */
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const venueOf = (m) => m.venue ?? m.spielstaette ?? {};
const locOf = (m) => {
  const v = venueOf(m);
  const lat = Number(v.lat ?? v.latitude);
  const lng = Number(v.lng ?? v.lon ?? v.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

async function loadMatches() {
  const json = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  return Array.isArray(json) ? json : json.matches ?? [];
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (req.method !== 'GET' || url.pathname.replace(/\/$/, '') !== '/matches') {
    return res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not found"}');
  }

  try {
    const from = Date.parse(url.searchParams.get('from') ?? '') || Date.now();
    const to = Date.parse(url.searchParams.get('to') ?? '') || from + 30 * 864e5;
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const radiusKm = Number(url.searchParams.get('radiusKm'));
    const area = Number.isFinite(lat) && Number.isFinite(lng) && radiusKm > 0 ? { lat, lng, radiusKm } : null;

    const result = (await loadMatches()).filter((m) => {
      const t = Date.parse(m.kickoff ?? '');
      // Datensätze im Format datum/uhrzeit lässt das Beispiel durch – die App filtert sie selbst.
      if (Number.isFinite(t) && (t < from || t > to)) return false;
      const loc = locOf(m);
      // Ohne Koordinaten durchlassen: Die App ergänzt sie per Geocoding und filtert selbst.
      return !area || !loc || haversineKm(area, loc) <= area.radiusKm;
    });

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      // kurzer HTTP-Cache – Ansetzungen können sich ändern
      'Cache-Control': 'public, max-age=300',
    });
    res.end(JSON.stringify({ matches: result }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"internal"}');
  }
}).listen(PORT, () => console.log(`BFV-Beispiel-Backend auf http://localhost:${PORT}/matches (Daten: ${DATA_FILE})`));

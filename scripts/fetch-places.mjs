#!/usr/bin/env node
/**
 * Lädt alle Städte, Märkte, Dörfer und Stadtteile Bayerns aus OpenStreetMap (Overpass API)
 * und speichert sie als public/data/orte-bayern.csv ("lat|lon|name").
 *
 * Läuft automatisch vor jedem Build (npm run build). Schlägt der Download fehl, bleibt
 * eine vorhandene Datei erhalten und der Build läuft trotzdem weiter.
 * Daten © OpenStreetMap-Mitwirkende, ODbL.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/data/orte-bayern.csv', import.meta.url);
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // höchstens einmal pro Woche neu laden
const QUERY = `[out:csv(::lat,::lon,"name";false;"|")][timeout:180];
area["ISO3166-2"="DE-BY"]["admin_level"="4"]->.by;
node(area.by)["place"~"^(city|town|village|suburb|quarter)$"]["name"];
out;`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

if (existsSync(OUT) && Date.now() - statSync(OUT).mtimeMs < MAX_AGE_MS && !process.argv.includes('--force')) {
  console.log('[Orte] Ortsverzeichnis ist aktuell – überspringe Download.');
  process.exit(0);
}

for (const endpoint of ENDPOINTS) {
  try {
    console.log(`[Orte] Lade Ortsverzeichnis Bayern von ${endpoint} …`);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'bfv-spiele-in-der-naehe' },
      body: `data=${encodeURIComponent(QUERY)}`,
      signal: AbortSignal.timeout(200_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = (await res.text()).trim();
    const lines = csv.split('\n').filter((l) => l.split('|').length >= 3);
    if (lines.length < 1000) throw new Error(`nur ${lines.length} Orte erhalten`);
    mkdirSync(new URL('.', OUT), { recursive: true });
    writeFileSync(OUT, lines.join('\n') + '\n');
    console.log(`[Orte] ${lines.length} Orte gespeichert.`);
    process.exit(0);
  } catch (err) {
    console.warn(`[Orte] Fehlgeschlagen (${endpoint}):`, err.message);
  }
}
console.warn('[Orte] Kein Ortsverzeichnis geladen – die App sucht Orte dann einzeln (langsamer).');
process.exit(0); // Build nie deswegen abbrechen

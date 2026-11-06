# BFV Spiele in der Nähe

Responsive Web-App, die Fußballspiele des Bayerischen Fußball-Verbands (BFV) auf einer interaktiven Google-Maps-Karte und in einer Liste anzeigt – gefiltert nach Umkreis, Zeitraum, Herren/Jugend, Altersklasse/Liga und Freitext.

**Stack:** React 18 · TypeScript · Tailwind CSS 4 · Vite · TanStack React Query · Google Maps JavaScript API (Advanced Markers, Places, Geocoding) · MarkerClusterer

> **Datenquelle:** Echte Spiele kommen über die Bibliothek [`bfv-api`](https://github.com/SebastianSiedler/bfv-api-js) (v1.4.0) von der BFV-Widget-Schnittstelle. Sie ist **inoffiziell** und kennt keine Umkreissuche – deshalb **erkundet die App die Umgebung einmalig selbst** (Vereine finden, verorten, Mannschaften sammeln). Danach genügen Standort und Radius, um alle Spiele in der Nähe zu sehen. Details unter [BFV-Datenquelle](#bfv-datenquelle).

---

## Schnellstart

```bash
npm install
cp .env.example .env        # API-Key eintragen (siehe unten)
npm run dev                 # http://localhost:5173
```

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm run build` | Produktions-Build nach `dist/` (ohne Typprüfung, damit Deployments robust sind) |
| `npm run check` | Typprüfung + Unit-Tests |
| `npm run preview` | Produktions-Build lokal ansehen |
| `npm test` | Unit-Tests (Entfernung, Zeitzonen, Klassifizierung, Duplikate, Normalisierung, BFV-Links/-Spiele, Umgebungserkundung) |
| `npm run typecheck` | Nur TypeScript prüfen |

Beim ersten Start: Google Maps aktivieren, Radius wählen und unter **„Spiele in der Umgebung“** einmalig den bfv.de-Link eines Vereins aus der Nähe einfügen (z. B. `https://www.bfv.de/vereine/<name>/<ID>`) → **„Umgebung erkunden“**. Danach zeigt die App alle Spiele im Umkreis.

---

## Online stellen (Web-App für alle)

Die App ist eine reine Web-Anwendung: `npm run build` erzeugt den Ordner `dist/` mit HTML, JS und CSS. Wichtig: Der BFV erlaubt keine direkten Browser-Aufrufe von fremden Domains (CORS). Deshalb leitet die App alle BFV-Anfragen über die Pfade **`/bfv-api`** (Widget-Schnittstelle) und **`/bfv-web`** (Vereinsseiten auf bfv.de) der eigenen Domain – der Hoster muss diese Pfade weiterleiten. Für Netlify und Vercel ist das schon eingerichtet:

**Netlify (am einfachsten, ohne Git):**
1. Lokal `npm install` und `npm run build` ausführen.
2. Auf [app.netlify.com/drop](https://app.netlify.com/drop) den Ordner `dist/` ins Browserfenster ziehen.
3. Fertig – die Datei `dist/_redirects` (aus `public/_redirects`) richtet den Proxy automatisch ein.
4. Die neue Adresse (z. B. `https://bfv-spiele.netlify.app/*`) beim Google-API-Key als erlaubten Referrer eintragen.

Hinweis: Umgebungsvariablen (`.env`) werden beim Build eingebacken – also vor `npm run build` den Google-Key in `.env` eintragen.

**Netlify mit Git** (automatisches Deployment): Repository verbinden; `netlify.toml` ist vorhanden. Den API-Key unter *Site settings → Environment variables* als `VITE_GOOGLE_MAPS_API_KEY` hinterlegen.

**Vercel:** Repository importieren, Framework „Vite“; `vercel.json` enthält Proxy und SPA-Weiterleitung. API-Key als Environment Variable setzen.

**Andere Hoster** (Apache, nginx, GitHub Pages …): `/bfv-api/*` muss auf `https://widget-prod.bfv.de/api/service/widget/v1/*` und `/bfv-web/*` auf `https://www.bfv.de/*` weitergeleitet werden. GitHub Pages kann das nicht – dort bräuchtest du einen kleinen externen Proxy und setzt `VITE_BFV_PROXY_URL` auf dessen Adresse.

---

## Google-Maps-API-Key einrichten

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen und ein **Rechnungskonto** verknüpfen (Google verlangt das auch für das Gratiskontingent).
2. Unter *APIs & Dienste → Bibliothek* aktivieren:
   - **Maps JavaScript API**
   - **Places API (New)** – für die Ortssuche (`PlaceAutocompleteElement`; das alte `places.Autocomplete` steht neuen Projekten nicht mehr zur Verfügung)
   - **Geocoding API** – für Spielstätten ohne Koordinaten (Places API (New) wird zusätzlich für die Suche nach dem Platz des Heimvereins genutzt)
3. Unter *APIs & Dienste → Anmeldedaten* einen API-Key erstellen und **einschränken**:
   - *Anwendungseinschränkung:* HTTP-Referrer, z. B. `http://localhost:5173/*` und `https://deine-domain.de/*`
   - *API-Einschränkung:* nur die drei APIs oben
4. **Map-ID** für Advanced Markers anlegen: *Google Maps Platform → Kartenverwaltung → Map-ID erstellen* (Typ JavaScript, Vektor). Ohne eigene ID nutzt die App `DEMO_MAP_ID`, die nur für Entwicklung gedacht ist.
5. In `.env` eintragen:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_GOOGLE_MAPS_MAP_ID=abc123def456
```

> Der Key ist im ausgelieferten JavaScript sichtbar – das ist bei der Maps-JS-API normal. Schutz erfolgt über die Referrer- und API-Einschränkung sowie Budget-Warnungen in der Cloud Console.

---

## Konfiguration (`.env`)

| Variable | Bedeutung | Standard |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Google-API-Key | – |
| `VITE_GOOGLE_MAPS_MAP_ID` | Map-ID für Advanced Markers | `DEMO_MAP_ID` |
| `VITE_BFV_DATA_PROVIDER` | `bfv` \| `rest` \| `static` | `rest`, falls Base-URL gesetzt, sonst `bfv` |
| `VITE_BFV_PROXY_URL` | Pfad/URL des Proxys zur BFV-Widget-Schnittstelle | `/bfv-api` |
| `VITE_BFV_WEB_PROXY_URL` | Pfad/URL des Proxys zu www.bfv.de (Vereinsseiten) | `/bfv-web` |
| `VITE_BFV_SEED` | vorausgefüllter Startpunkt für die erste Erkundung | – |
| `VITE_BFV_MATCH_URL_TEMPLATE` | Link zur Spieldetailseite, `{matchId}` wird ersetzt | `https://www.bfv.de/ergebnisse/spiel/-/{matchId}` |
| `VITE_BFV_API_BASE_URL` | Basis-URL deines Backends (`/matches`-Endpunkt) | – |
| `VITE_BFV_API_AREA_QUERY` | `true`, wenn das Backend nach `lat/lng/radiusKm` filtert | `true` |
| `VITE_BFV_STATIC_URL` | URL eines JSON-Exports (Provider `static`) | `/data/matches.json` |

---

## Funktionen

- **Standort:** Google-Ortssuche (auf Deutschland beschränkt, Bayern bevorzugt), „Meinen Standort verwenden“ (Browser-Geolocation nach Einwilligungsdialog), Standard **Dachau**.
- **Umkreis:** 5 / 10 / 20 / 30 / 50 / 100 km – als Kreis auf der Karte dargestellt.
- **Filter:** Alle / Herren / Jugend (mit Trefferzählern), Zeitraum (Heute, Dieses Wochenende, 7/14/30 Tage, eigener Zeitraum), Altersklasse U7–U19 bzw. Ligastufe (Bayernliga … B-Klasse), Freitext für Verein, Liga oder Ort.
- **Karte:** Marker in **Blau (Herren, „H“)**, **Grün (Jugend, „J“)**, **Grau (unklar, „?“)**, Marker-Clustering, InfoWindow mit Datum/Uhrzeit, Paarung, Liga, Spielstätte, Entfernung, „Route öffnen“ und BFV-Link. Mehrere Spiele auf derselben Anlage werden minimal versetzt, damit jedes anklickbar bleibt.
- **Liste:** nach Spieltag gruppiert, sortiert nach Anstoß (dann Entfernung), mit „Auf Karte zeigen“ (zentriert + öffnet InfoWindow) und „Route öffnen“.
- **Ansichten:** Beides / Karte / Liste – mobil untereinander, ab 1024 px nebeneinander.
- **Zustände:** Skeleton beim Laden, Fehler mit „Erneut versuchen“, leere Ergebnisse mit Ein-Klick-Vorschlägen (Umkreis erweitern, 30 Tage, Filter zurücksetzen), Hinweis bei nicht verortbaren Spielen, Weiterverwendung des Caches bei Netzwerkfehlern.

### Wichtige Regeln

- Es werden **nur Spiele innerhalb des Radius** angezeigt – die Entfernung wird immer clientseitig per **Haversine** geprüft, auch wenn das Backend schon filtert.
- **Duplikate** (gleiche Spielstätte + gleiche Anstoßzeit + gleiche Paarung) werden zusammengeführt; fehlende Angaben wie der BFV-Link werden aus dem Duplikat übernommen. Die Paarung gehört bewusst zum Schlüssel: Auf großen Anlagen laufen samstags oft mehrere *verschiedene* Jugendspiele parallel – die sollen sichtbar bleiben.
- Nur **zukünftige** Spiele werden angezeigt.
- **Zeitzone:** Alle Berechnungen (Tagesgrenzen, Wochenende, Anzeige) erfolgen in `Europe/Berlin` inkl. Sommer-/Winterzeit – unabhängig von der Zeitzone des Geräts (getestet).

---

## Caching

| Was | Wo | Dauer | Begründung |
|---|---|---|---|
| Spiele | React Query, persistiert in `localStorage` | frisch 15 min, verworfen nach 6 h | Ansetzungen ändern sich (Verlegungen, Absagen) – im Hintergrund wird nach 15 min aktualisiert, alte Daten bleiben bis dahin sofort sichtbar |
| Geocoding-Treffer | `localStorage` | 30 Tage | Spielstätten ziehen nicht um; spart API-Kosten |
| Fehlgeschlagenes Geocoding | `localStorage` | 1 Tag | Korrigierte Adressen greifen schnell |
| Filter (ohne Freitext) | `localStorage` | dauerhaft | Komfort |
| Standort | **nicht gespeichert** | – | Datenschutz |

Bei Quellen **ohne Flächenabfrage** (`static`) hängt der Cache-Key nicht vom Standort ab – Standort- oder Radiuswechsel lösen keinen neuen Abruf aus. Bei Quellen **mit Flächenabfrage** wird der Mittelpunkt auf ~1 km gerundet und der Radius um 2 km gepuffert, damit kleine Verschiebungen den Cache treffen. Kategorie-, Freitext- und Altersklassenfilter wirken nur lokal und sind sofort da.

Ein Formatwechsel des Caches wird über `cacheVersion` in `src/config.ts` erzwungen.

---

## Datenschutz

- **Google Maps wird erst nach Klick auf „Google Maps laden“ eingebunden** (Zwei-Klick-Lösung), da dabei u. a. die IP-Adresse an Google übertragen wird. Die Einwilligung wird lokal gespeichert und kann in der Fußzeile widerrufen werden. Ohne Einwilligung funktioniert die Liste weiterhin.
- **Standort** wird nur nach ausdrücklicher Zustimmung im eigenen Dialog und anschließend über die Browserabfrage ermittelt, nur im Browser verarbeitet und nicht gespeichert. Bei Quellen mit Flächenabfrage wird der auf ~1 km gerundete Mittelpunkt an das eigene Backend gesendet.
- Für den Produktivbetrieb gehören die Google-Dienste in die Datenschutzerklärung; prüfe die Anforderungen (DSGVO/TTDSG) mit deinem Datenschutzbeauftragten.

---

## BFV-Datenquelle

### Ausgangslage

Der BFV bietet keine offizielle, öffentlich dokumentierte API. Die App nutzt deshalb die Community-Bibliothek **[`bfv-api`](https://github.com/SebastianSiedler/bfv-api-js) v1.4.0** (MIT, nicht vom BFV). Sie spricht die Widget-Schnittstelle `https://widget-prod.bfv.de/api/service/widget/v1` an, die der BFV für Vereins-Widgets betreibt. Diese Schnittstelle ist undokumentiert und kann sich jederzeit ändern – für einen dauerhaften, öffentlichen Betrieb solltest du beim BFV nachfragen und schonend mit Anfragen umgehen (die App lädt max. 3 Anfragen parallel und cacht 15 Minuten).

### Provider `bfv` (Standard): Umkreissuche durch Umgebungserkundung

Die Widget-Schnittstelle beantwortet nur „Welche Spiele hat Mannschaft X?“ – nicht „Was spielt in der Nähe?“. Die App baut sich deshalb ein **eigenes Verzeichnis der Umgebung** auf:

```
Startpunkt (ein Verein/eine Mannschaft/eine Liga aus der Nähe)
  → Verein: alle Mannschaften (bfv.de-Vereinsseite /vereine/verein/{clubId})
  → jede Mannschaft: Spielplan (bfv-api listMatches)
  → Gegner-Vereine → offizieller Name (getClubInformationById) → verorten (Google Places)
       liegt im Umkreis (+3 km Rand)? → ebenfalls erkunden
       liegt außerhalb?               → merken, nicht weiter verfolgen
```

Weil Ligen regional organisiert sind, erreicht diese Breitensuche praktisch alle Vereine im Umkreis – inklusive aller Jugendteams (über die Vereinsseite). Nur ganz isolierte Vereine ohne Spiele gegen Nachbarn würden fehlen.

- **Einmalig nötig:** ein Startpunkt (bfv.de-Link eines Vereins, einer Mannschaft oder Liga in der Nähe). Spätere Erkundungen – anderer Ort, größerer Radius – starten von bereits bekannten Vereinen, solange es Überschneidungen gibt.
- **Dauer:** abhängig vom Radius, grob 1 Min. bei 10–20 km, mehrere Minuten bei 50 km (Fortschrittsanzeige, abbrechbar; Zwischenstände werden gespeichert). Sicherheitsgrenze: 800 Vereine.
- **Gespeichert** im Browser (`localStorage`, Schlüssel `bfv.area.v1`) für **30 Tage**; danach wird neu erkundet, weil sich Mannschafts-IDs zur Saison ändern können.
- **Danach:** Bei jeder Suche lädt die App die Spielpläne aller Mannschaften der Vereine im gewählten Radius (max. 3 parallel, 60 Minuten Cache – der BFV-Server soll nicht unnötig belastet werden). Ein kleinerer Radius bedeutet weniger Anfragen.
- **Spielort:** Die Schnittstelle liefert keine Spielstätten. Spielort = verorteter Platz des Heimvereins, markiert als „über den Heimverein ermittelt – ohne Gewähr“ (Ausweichplätze oder Spielgemeinschaften können abweichen).
- **Google-Kosten:** Die Erkundung sucht jeden Verein einmal per Places-Textsuche (gecacht 30 Tage). Bei 20 km sind das grob 150–300 Suchen. Behalte das Kontingent in der Google Cloud Console im Blick.

Genutzte Endpunkte:

| Quelle | Endpunkt | Wofür |
|---|---|---|
| bfv-api `listMatches` | `/team/{teamPermanentId}/matches` | Spielplan je Mannschaft (Datum, Uhrzeit, Teams, Vereine, Liga, Mannschaftstyp) |
| bfv-api `getClubInformationById` | `/club/{clubId}/info` | offizieller Vereinsname (für die Ortssuche) |
| bfv-api `getCompetitionTable` | `/competition/{compoundId}/table` | Startpunkt per Liga-Link |
| bfv.de Vereinsseite | `/vereine/verein/{clubId}` | alle Mannschaften eines Vereins (Links `/mannschaften/<name>/<ID>`) – dasselbe Vorgehen nutzt das Projekt `Paul1404/bfv-api` |

**Weitere Hinweise:**
- Das Format von `kickoffDate`/`kickoffTime` ist in `bfv-api` nicht dokumentiert. Der Parser versteht `07.11.2026`, `Sa, 07.11.26`, `2026-11-07` und ISO-Zeitpunkte. Spiele ohne Termin werden ausgelassen.
- Der Link zur Spieldetailseite folgt dem Muster der bfv.de-Seiten (`/ergebnisse/spiel/-/{matchId}`); anpassbar über `VITE_BFV_MATCH_URL_TEMPLATE`.
- Der Proxy `/bfv-web` leitet nur an www.bfv.de weiter. Wer die App öffentlich betreibt, sollte das Aufkommen im Blick behalten und beim BFV nachfragen.

### Architektur: austauschbarer Data-Provider

Die gesamte Datenbeschaffung steckt hinter einem Interface (`src/types/provider.ts`):

```ts
interface MatchDataProvider {
  readonly id: string;
  readonly label: string;
  readonly supportsAreaQuery: boolean; // kann die Quelle nach lat/lng/radius filtern?
  fetchMatches(query: { center; radiusKm; from: Date; to: Date }, signal?): Promise<Match[]>;
}
```

Mitgeliefert:

| Provider | Datei | Einsatz |
|---|---|---|
| `bfv` | `services/providers/bfvWidgetProvider.ts` | **Standard:** echte Spiele über `bfv-api` mit Umkreissuche (über die erkundete Umgebung) |
| `rest` | `services/providers/restApiProvider.ts` | Eigenes Backend / Proxy / offizielle API-Anbindung |
| `static` | `services/providers/staticJsonProvider.ts` | Vorab exportierter Datensatz als JSON-Datei |

Eine neue Quelle (z. B. eine künftige offizielle BFV-API) implementiert das Interface und wird in `services/providers/index.ts` registriert – sonst ändert sich nichts. Kann die Quelle nicht nach Fläche filtern, setzt sie `supportsAreaQuery = false`; die App lädt dann alle Spiele im Zeitraum und filtert clientseitig nach Entfernung.

### REST-Schnittstelle (Vertrag für `rest`)

```
GET {VITE_BFV_API_BASE_URL}/matches?from=2026-11-06T23:00:00.000Z&to=2026-11-13T22:59:59.999Z&lat=48.26&lng=11.43&radiusKm=22
```

`lat`, `lng`, `radiusKm` werden nur gesendet, wenn `VITE_BFV_API_AREA_QUERY=true`. Antwort: Array oder `{ "matches": [...] }`:

```json
{
  "matches": [
    {
      "id": "02IS7R9AJG000000VS5489B4VSBVSTLT",
      "kickoff": "2026-11-08T14:00:00+01:00",
      "homeTeam": "Heimverein",
      "awayTeam": "Gastverein",
      "competition": "Kreisliga 1",
      "category": "herren",
      "ageClass": null,
      "venue": {
        "name": "Sportanlage Musterstadt",
        "street": "Sportplatzstraße 1",
        "postalCode": "85221",
        "city": "Dachau",
        "lat": 48.2603,
        "lng": 11.4342
      },
      "detailUrl": "https://www.bfv.de/spiele/..."
    }
  ]
}
```

Der Normalisierer (`services/providers/normalize.ts`) ist tolerant:

- **Pflicht:** Anstoß, Heimteam, Gastteam. Datensätze ohne diese werden übersprungen.
- **Anstoß:** ISO mit Offset, ISO ohne Offset (= Berliner Zeit) oder `datum` + `uhrzeit` (`07.11.2026` + `15:00 Uhr`).
- **Deutsche Feldnamen** werden verstanden: `heim`, `gast`, `liga`, `spielstaette`, `strasse`, `plz`, `ort`, …
- **Kategorie/Altersklasse** fehlen? → heuristische Einordnung aus Liga/Teamnamen (`U15`, `C-Junioren`, `Kreisliga`, `Reserve`, …). Frauen- und Freundschaftsspiele landen als „unklar“ (grau).
- **Koordinaten** fehlen? → Google Geocoding (gecacht, max. 4 parallele Anfragen).
- **Links** werden nur als `http(s)` übernommen.

### Beispiel-Backend

`server/example-backend.mjs` ist ein abhängigkeitsfreies Node-Backend, das einen JSON-Export mit Zeitraum- und Umkreisfilter über `/matches` bereitstellt (inkl. CORS). Es ist die Stelle, an der du später eine offizielle Schnittstelle oder einen genehmigten Crawler anbindest – API-Schlüssel gehören dorthin, **nie** in `VITE_`-Variablen.

```bash
node server/example-backend.mjs ./daten/matches.json   # http://localhost:8787/matches
# .env der App:
VITE_BFV_API_BASE_URL=http://localhost:8787
```

### Vorab exportierter Datensatz (`static`)

Eine JSON-Datei im Format von `public/data/matches.example.json` nach `public/data/matches.json` legen (z. B. nächtlich per Skript erzeugt) und `VITE_BFV_DATA_PROVIDER=static` setzen. Am besten liefert der Export Koordinaten gleich mit – bei einem bayernweiten Datensatz ohne Koordinaten würde sonst jede Spielstätte einmal geocodiert (danach 30 Tage gecacht).

---

## Projektstruktur

```
src/
├── App.tsx                     Layout, Zustand, Zusammenspiel der Bereiche
├── main.tsx                    React Query + localStorage-Persistenz
├── config.ts                   Umgebungsvariablen, Standardwerte, Cache-Zeiten
├── components/
│   ├── filters/FilterPanel     Umkreis, Kategorie, Zeitraum, Altersklasse/Liga, Suche
│   ├── layout/                 Header, Footer (Quelle, Datenschutz, Widerruf)
│   ├── location/               Ortssuche (PlaceAutocompleteElement), Geolocation-Dialog
│   ├── map/                    MapPanel (Einwilligung), MapView (Marker, Cluster, Kreis), InfoWindow-Inhalt
│   ├── results/                Liste, Karte je Spiel, Trefferzeile, Lade-/Fehler-/Leerzustände
│   ├── area/AreaPanel          Umgebungserkundung: Startpunkt, Fortschritt, Status
│   └── ui.tsx                  Icons, Segmented Control, Button-Stile
├── hooks/                      useMatches, useAreaDiscovery, useGoogleMaps, useGeolocation, usePersistentState
├── services/
│   ├── bfv/                    bfv-api-Client (über Proxy), Umgebungserkundung (discovery), Verzeichnis (areaIndex)
│   ├── googleMaps.ts           API-Loader, Geocoding + Places-Textsuche mit Cache
│   ├── matchService.ts         Pipeline: Laden → Geocoding → Radius/Zeit → Duplikate → Filter
│   └── providers/              Data-Provider (bfv, rest, static) + Normalisierung
├── types/                      Match, Filter, Provider-Interface
└── utils/                      Haversine, Zeitzonen/Datum, Klassifizierung, Duplikate, Text
server/example-backend.mjs      Beispiel-Backend für den REST-Provider
public/_redirects, vercel.json  Proxys /bfv-api → widget-prod.bfv.de und /bfv-web → www.bfv.de beim Hosting
```

---

## Bekannte Grenzen & Ideen

- Die BFV-Widget-Schnittstelle ist **inoffiziell**; Änderungen beim BFV können den Abruf brechen. Dann `bfv-api` aktualisieren (`npm update bfv-api`).
- Spielorte sind über den Heimverein **geschätzt** (siehe oben).
- Entfernungen sind **Luftlinie**; die tatsächliche Fahrstrecke zeigt „Route öffnen“ in Google Maps.
- Die Herren/Jugend-Heuristik deckt die üblichen BFV-Bezeichnungen ab; liefert die Quelle `category`, wird diese verwendet.
- Mögliche Erweiterungen: Frauen als eigene Kategorie, Favoriten-Vereine, Kalender-Export (ICS), PWA/Offline-Modus, Fahrzeit statt Luftlinie (Distance Matrix / Routes API).

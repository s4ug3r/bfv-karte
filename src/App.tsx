import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FilterPanel, TIME_PRESETS } from './components/filters/FilterPanel';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { GeolocationDialog } from './components/location/GeolocationDialog';
import { LocationPanel } from './components/location/LocationPanel';
import { MapPanel } from './components/map/MapPanel';
import type { MapViewHandle } from './components/map/MapView';
import { MatchList } from './components/results/MatchList';
import { ResultBar, type ViewMode } from './components/results/ResultBar';
import { EmptyState, ErrorState, LoadingList, type Suggestion } from './components/results/StatusViews';
import { AreaPanel } from './components/area/AreaPanel';
import { IconFilter } from './components/ui';
import { config } from './config';
import { useGeolocation } from './hooks/useGeolocation';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { useMatches } from './hooks/useMatches';
import { usePersistentState } from './hooks/usePersistentState';
import { useAreaDiscovery, useLoadProgress } from './hooks/useAreaDiscovery';
import { clubsInRadius, isAreaCovered } from './services/bfv/areaIndex';
import { getMatchProvider, usesBfvSources } from './services/providers';
import { RADIUS_OPTIONS, type Filters, type SelectedLocation } from './types/filters';
import { formatDateKey } from './utils/date';

const DEFAULT_FILTERS: Filters = {
  category: 'alle',
  timePreset: '7',
  customFrom: '',
  customTo: '',
  radiusKm: config.defaultRadiusKm,
  search: '',
  classFilter: '',
};

/** Gespeicherte Filter prüfen; Freitextsuche wird bewusst nicht gespeichert. */
function sanitizeFilters(stored: unknown): Filters {
  const s = (stored ?? {}) as Partial<Filters>;
  return {
    ...DEFAULT_FILTERS,
    category: s.category === 'herren' || s.category === 'jugend' ? s.category : 'alle',
    timePreset: TIME_PRESETS.some((p) => p.value === s.timePreset) ? s.timePreset! : DEFAULT_FILTERS.timePreset,
    customFrom: typeof s.customFrom === 'string' ? s.customFrom : '',
    customTo: typeof s.customTo === 'string' ? s.customTo : '',
    radiusKm: RADIUS_OPTIONS.includes(s.radiusKm as never) ? s.radiusKm! : DEFAULT_FILTERS.radiusKm,
    classFilter: typeof s.classFilter === 'string' ? s.classFilter : '',
  };
}

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

export default function App() {
  // ─── Zustand ─────────────────────────────────────────────────────────────
  const [storedFilters, setStoredFilters] = usePersistentState<Filters>('bfv.filters.v1', DEFAULT_FILTERS, sanitizeFilters);
  const filters = storedFilters;
  // Standort wird aus Datenschutzgründen nicht gespeichert.
  const [location, setLocation] = useState<SelectedLocation>(config.defaultLocation);
  const [googleConsent, setGoogleConsent] = usePersistentState<boolean>('bfv.consent.googleMaps', false, (v) => v === true);
  const [view, setView] = useState<ViewMode>('beides');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Erkundete Umgebung (Vereine/Mannschaften) – nur beim BFV-Provider relevant
  const area = useAreaDiscovery();
  const loadProgress = useLoadProgress();

  const mapRef = useRef<MapViewHandle>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  const maps = useGoogleMaps(googleConsent);
  const googleReady = maps.status === 'ready';
  const geo = useGeolocation();
  const provider = getMatchProvider(area.index);
  const result = useMatches(provider, location, filters, googleReady);
  const areaCovered = isAreaCovered(area.index, location, filters.radiusKm);
  const clubsNearby = useMemo(
    () => clubsInRadius(area.index, location, filters.radiusKm).length,
    [area.index, location, filters.radiusKm],
  );
  // Noch nichts erkundet in diesem Umkreis → Hinweis statt leerer Liste
  const needsDiscovery = usesBfvSources && clubsNearby === 0;

  const updateFilters = useCallback(
    (patch: Partial<Filters>) => setStoredFilters((f) => ({ ...f, ...patch })),
    [setStoredFilters],
  );

  // ─── Aktionen ────────────────────────────────────────────────────────────
  const handleGeoConfirm = async () => {
    setGeoDialogOpen(false);
    const pos = await geo.locate();
    if (pos) setLocation({ ...pos, label: 'Mein Standort', source: 'geolocation' });
  };

  const showOnMap = useCallback(
    (id: string) => {
      setActiveId(id);
      const wasHidden = view === 'liste';
      if (wasHidden) setView('beides');
      // Kurz warten, bis die (evtl. eben eingeblendete) Karte ihr Layout hat
      window.setTimeout(
        () => {
          if (!isDesktop()) mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          mapRef.current?.focusMatch(id);
        },
        wasHidden ? 150 : 0,
      );
    },
    [view],
  );

  const extraAgeClasses = useMemo(
    () => [...new Set(result.inArea.map((m) => m.ageClass).filter((a): a is string => !!a))],
    [result.inArea],
  );

  const userFilterCount =
    (filters.category !== 'alle' ? 1 : 0) + (filters.classFilter ? 1 : 0) + (filters.search.trim() ? 1 : 0);

  // ─── Vorschläge bei leeren Ergebnissen ──────────────────────────────────
  const suggestions: Suggestion[] = [];
  const nextRadius = RADIUS_OPTIONS.find((r) => r > filters.radiusKm);
  if (nextRadius) suggestions.push({ label: `Umkreis auf ${nextRadius} km erweitern`, onClick: () => updateFilters({ radiusKm: nextRadius }) });
  if (filters.timePreset !== '30') suggestions.push({ label: 'Nächste 30 Tage anzeigen', onClick: () => updateFilters({ timePreset: '30' }) });
  if (userFilterCount > 0)
    suggestions.push({ label: 'Filter zurücksetzen', onClick: () => updateFilters({ category: 'alle', classFilter: '', search: '' }) });

  // ─── Ergebnisbereich ─────────────────────────────────────────────────────
  let results: ReactNode;
  if (needsDiscovery) {
    results = area.running ? (
      <LoadingList />
    ) : (
      <EmptyState
        title="Umgebung noch nicht erkundet"
        text="Starte oben unter „Spiele in der Umgebung“ die Erkundung. Die App findet dann selbst alle Vereine im Umkreis und zeigt ihre Spiele – das ist nur einmal nötig."
        suggestions={[]}
      />
    );
  } else if (result.emptyRange) {
    results = (
      <EmptyState
        title="Zeitraum liegt in der Vergangenheit"
        text={`Bis ${formatDateKey(filters.customTo)} finden keine Spiele mehr statt. Wähle einen Zeitraum ab heute.`}
        suggestions={[{ label: 'Nächste 7 Tage anzeigen', onClick: () => updateFilters({ timePreset: '7' }) }]}
      />
    );
  } else if (result.isLoading) {
    results = (
      <>
        {loadProgress && (
          <p className="mb-3 text-xs text-slate-500" aria-live="polite">
            Lade Spielpläne: {loadProgress.done} / {loadProgress.total} Mannschaften…
          </p>
        )}
        <LoadingList />
      </>
    );
  } else if (result.error && !result.matches.length) {
    results = (
      <ErrorState
        message={result.error instanceof Error ? result.error.message : 'Unbekannter Fehler.'}
        onRetry={() => void result.refetch()}
      />
    );
  } else if (result.matches.length === 0 && result.unresolvedCount > 0 && !googleReady) {
    results = (
      <EmptyState
        title="Spielorte brauchen Google Maps"
        text={`${result.unresolvedCount} Spiele wurden geladen. Der BFV liefert aber keine Spielstätten – die App sucht den Platz des Heimvereins über Google. Aktiviere dafür Google Maps.`}
        suggestions={googleConsent ? [] : [{ label: 'Google Maps laden', onClick: () => setGoogleConsent(true) }]}
      />
    );
  } else if (result.matches.length === 0) {
    results = (
      <EmptyState
        title="Keine Spiele gefunden"
        text={
          userFilterCount > 0
            ? 'Mit den aktuellen Filtern gibt es hier keine Spiele. Erweitere den Umkreis oder Zeitraum oder setze die Filter zurück.'
            : `Im Umkreis von ${filters.radiusKm} km um ${location.label} ist im gewählten Zeitraum nichts angesetzt. Versuch es mit einem größeren Radius oder Zeitraum.`
        }
        suggestions={suggestions}
      />
    );
  } else {
    results = (
      <MatchList
        matches={result.matches}
        origin={location}
        mapAvailable={googleReady}
        activeId={activeId}
        onShowOnMap={showOnMap}
      />
    );
  }

  const listHidden = view === 'karte';
  const mapHidden = view === 'liste';

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <Header />

      <main
        className={`flex flex-1 flex-col lg:grid lg:min-h-0 ${
          mapHidden ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(380px,460px)_1fr]'
        }`}
      >
        {/* Mobil: "contents" lässt Steuerung, Karte und Liste per order sortieren; Desktop: scrollbare Seitenleiste */}
        <aside className="contents lg:block lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-slate-200">
          <div className={`order-1 space-y-4 p-4 sm:p-5 ${mapHidden ? 'lg:mx-auto lg:max-w-3xl' : ''}`}>

            <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <LocationPanel
                location={location}
                googleReady={googleReady}
                locating={geo.locating}
                geoError={geo.error}
                onSelect={setLocation}
                onUseMyLocation={() => setGeoDialogOpen(true)}
                onResetLocation={() => setLocation(config.defaultLocation)}
                onDismissGeoError={geo.clearError}
              />

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 lg:hidden"
                aria-expanded={filtersOpen}
                aria-controls="filter-panel"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                <span className="flex items-center gap-2">
                  <IconFilter /> Filter: {filters.radiusKm} km, {TIME_PRESETS.find((p) => p.value === filters.timePreset)?.label}
                  {userFilterCount > 0 && (
                    <span className="rounded-full bg-bfv-700 px-1.5 text-[11px] text-white">{userFilterCount}</span>
                  )}
                </span>
                <span aria-hidden className={`transition ${filtersOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              <div id="filter-panel" className={`${filtersOpen ? 'block' : 'hidden'} lg:block`}>
                <FilterPanel
                  filters={filters}
                  counts={result.counts}
                  extraAgeClasses={extraAgeClasses}
                  onChange={updateFilters}
                />
              </div>
            </div>

            {usesBfvSources && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <AreaPanel
                  index={area.index}
                  radiusKm={filters.radiusKm}
                  covered={areaCovered}
                  hasClubsNearby={clubsNearby > 0}
                  googleReady={googleReady}
                  running={area.running}
                  progress={area.progress}
                  error={area.error}
                  onStart={(seed) => void area.start(location, filters.radiusKm, seed)}
                  onCancel={area.cancel}
                  onReset={area.reset}
                  onEnableGoogle={() => setGoogleConsent(true)}
                />
              </div>
            )}

            <ResultBar
              count={result.matches.length}
              radiusKm={filters.radiusKm}
              loading={result.isLoading}
              refreshing={result.isFetching && !result.isLoading}
              view={view}
              onViewChange={setView}
            />

            {result.unresolvedCount > 0 && !result.isLoading && (
              <p className="rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
                {result.unresolvedCount} {result.unresolvedCount === 1 ? 'Spiel konnte' : 'Spiele konnten'} nicht verortet
                werden{googleReady ? '' : ' – aktiviere Google Maps, damit Adressen in Koordinaten umgewandelt werden'}.
              </p>
            )}
            {result.error && result.matches.length > 0 && (
              <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Aktualisierung fehlgeschlagen – es werden zwischengespeicherte Spiele angezeigt.
              </p>
            )}
          </div>

          <div
            className={`order-3 px-4 pb-6 sm:px-5 ${listHidden ? 'hidden' : ''} ${mapHidden ? 'lg:mx-auto lg:max-w-3xl' : ''} ${
              result.isPlaceholder ? 'opacity-60 transition-opacity' : ''
            }`}
          >
            {results}
            <Footer
              sourceLabel={result.provider.label}
              googleConsent={googleConsent}
              onRevokeGoogle={() => {
                setGoogleConsent(false);
                window.location.reload(); // entlädt die Google-Skripte vollständig
              }}
            />
          </div>
        </aside>

        <section
          ref={mapSectionRef}
          aria-label="Karte"
          className={`order-2 scroll-mt-2 px-4 sm:px-5 lg:p-0 ${mapHidden ? 'hidden' : ''}`}
        >
          <div
            className={`overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200 lg:h-full lg:rounded-none lg:shadow-none lg:ring-0 ${
              listHidden ? 'h-[72vh]' : 'h-[55vh] min-h-[320px]'
            } mb-4 lg:mb-0`}
          >
            <MapPanel
              ref={mapRef}
              status={maps.status}
              error={maps.error}
              location={location}
              radiusKm={filters.radiusKm}
              matches={result.matches}
              onConsent={() => setGoogleConsent(true)}
              onRetry={maps.retry}
            />
          </div>
        </section>
      </main>

      <GeolocationDialog
        open={geoDialogOpen}
        googleActive={googleReady}
        onConfirm={() => void handleGeoConfirm()}
        onCancel={() => setGeoDialogOpen(false)}
      />
    </div>
  );
}

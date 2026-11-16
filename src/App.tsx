import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FilterPanel, TIME_PRESETS } from './components/filters/FilterPanel';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { MobileNav, type MobileTab } from './components/layout/MobileNav';
import { GeolocationDialog } from './components/location/GeolocationDialog';
import { LocationPanel } from './components/location/LocationPanel';
import { MapPanel } from './components/map/MapPanel';
import type { MapViewHandle } from './components/map/MapView';
import { MatchList } from './components/results/MatchList';
import { ResultBar, type ViewMode } from './components/results/ResultBar';
import { EmptyState, ErrorState, LoadingList, type Suggestion } from './components/results/StatusViews';
import { AreaPanel } from './components/area/AreaPanel';
import { FavoritesCard, UpcomingCard } from './components/results/Highlights';
import { useFavorites } from './hooks/useFavorites';
import { useNow } from './hooks/useNow';
import { useOnline } from './hooks/useOnline';
import { involvesFavorite } from './utils/favorites';
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
import { MATCH_RUNNING_MS, formatDateKey } from './utils/date';

const DEFAULT_FILTERS: Filters = {
  category: 'alle',
  timePreset: '7',
  customFrom: '',
  customTo: '',
  radiusKm: config.defaultRadiusKm,
  search: '',
  classFilter: '',
  favoritesOnly: false,
};

/** Gespeicherte Filter prüfen; Freitextsuche wird bewusst nicht gespeichert. */
function sanitizeFilters(stored: unknown): Filters {
  const s = (stored ?? {}) as Partial<Filters>;
  return {
    ...DEFAULT_FILTERS,
    category: s.category === 'herren' || s.category === 'frauen' || s.category === 'jugend' ? s.category : 'alle',
    timePreset: TIME_PRESETS.some((p) => p.value === s.timePreset) ? s.timePreset! : DEFAULT_FILTERS.timePreset,
    customFrom: typeof s.customFrom === 'string' ? s.customFrom : '',
    customTo: typeof s.customTo === 'string' ? s.customTo : '',
    radiusKm: RADIUS_OPTIONS.includes(s.radiusKm as never) ? s.radiusKm! : DEFAULT_FILTERS.radiusKm,
    classFilter: typeof s.classFilter === 'string' ? s.classFilter : '',
    favoritesOnly: s.favoritesOnly === true,
  };
}

/** Gespeicherten Standort prüfen; bei Unsinn zurück auf Dachau. */
function sanitizeLocation(stored: unknown): SelectedLocation {
  const s = (stored ?? {}) as Partial<SelectedLocation>;
  const valid =
    typeof s.lat === 'number' &&
    typeof s.lng === 'number' &&
    Math.abs(s.lat) <= 90 &&
    Math.abs(s.lng) <= 180 &&
    typeof s.label === 'string';
  if (!valid) return config.defaultLocation;
  const source = s.source === 'search' || s.source === 'geolocation' ? s.source : 'default';
  return { lat: s.lat!, lng: s.lng!, label: s.label!, source };
}

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

export default function App() {
  // ─── Zustand ─────────────────────────────────────────────────────────────
  const [storedFilters, setStoredFilters] = usePersistentState<Filters>('bfv.filters.v1', DEFAULT_FILTERS, sanitizeFilters);
  const filters = storedFilters;
  // Zuletzt gewählter Standort – nur in diesem Browser gespeichert, damit er beim nächsten Besuch da ist.
  const [location, setLocation] = usePersistentState<SelectedLocation>(
    'bfv.location.v1',
    config.defaultLocation,
    sanitizeLocation,
  );
  const [googleConsent, setGoogleConsent] = usePersistentState<boolean>('bfv.consent.googleMaps', false, (v) => v === true);
  const [view, setView] = useState<ViewMode>('beides');
  // Handy: Liste oder Vollbild-Karte (untere Leiste); Desktop nutzt `view`.
  const [tab, setTab] = useState<MobileTab>('liste');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Erkundete Umgebung (Vereine/Mannschaften) – nur beim BFV-Provider relevant
  const area = useAreaDiscovery();
  const loadProgress = useLoadProgress();

  const mapRef = useRef<MapViewHandle>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  const maps = useGoogleMaps(googleConsent);
  const googleReady = maps.status === 'ready';
  const geo = useGeolocation();
  const provider = getMatchProvider(area.index);
  const result = useMatches(provider, location, filters, googleReady);
  const favorites = useFavorites();
  const online = useOnline();
  const now = useNow();
  // "Nur meine Vereine" wirkt auf Liste, Karte und Zähler
  const shown = useMemo(
    () => (filters.favoritesOnly ? result.matches.filter((m) => involvesFavorite(m, favorites.keys)) : result.matches),
    [filters.favoritesOnly, result.matches, favorites.keys],
  );
  const notOver = (m: { kickoff: string }) => new Date(m.kickoff).getTime() > now.getTime() - MATCH_RUNNING_MS;
  // Bei "Nur meine Vereine" zeigt der Vereine-Kasten schon die nächsten Spiele
  const upcoming = shown.length > 3 && !filters.favoritesOnly ? shown.filter(notOver).slice(0, 3) : [];
  const favoriteMatches = result.inArea.filter((m) => notOver(m) && involvesFavorite(m, favorites.keys)).slice(0, 3);
  const areaCovered = isAreaCovered(area.index, location, filters.radiusKm);
  const clubsNearby = useMemo(
    () => clubsInRadius(area.index, location, filters.radiusKm).length,
    [area.index, location, filters.radiusKm],
  );
  // Noch nichts erkundet in diesem Umkreis → Hinweis statt leerer Liste
  const needsDiscovery = usesBfvSources && clubsNearby === 0;

  // Neue Gegend ohne bekannte Vereine → Erkundung automatisch starten (einmal je Ort und Umkreis),
  // damit niemand einen Vereins-Link heraussuchen muss
  const autoStarted = useRef(new Set<string>());
  useEffect(() => {
    if (!needsDiscovery || !googleReady || !online || area.running || area.error) return;
    const key = `${location.lat.toFixed(3)},${location.lng.toFixed(3)},${filters.radiusKm}`;
    if (autoStarted.current.has(key)) return;
    autoStarted.current.add(key);
    void area.start(location, filters.radiusKm);
  }, [needsDiscovery, googleReady, online, area, location, filters.radiusKm]);

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
      const desktop = isDesktop();
      const wasHidden = desktop ? view === 'liste' : tab !== 'karte';
      if (desktop && wasHidden) setView('beides');
      if (!desktop) setTab('karte');
      // Kurz warten, bis die (evtl. eben eingeblendete) Karte ihr Layout hat
      window.setTimeout(() => mapRef.current?.focusMatch(id), wasHidden ? 150 : 0);
    },
    [view, tab],
  );

  const changeTab = (t: MobileTab) => {
    if (t === tab && t === 'liste' && !filtersOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTab(t);
    setFiltersOpen(false);
    if (t === 'liste') window.scrollTo({ top: 0 });
  };

  const openFilters = () => {
    if (tab === 'liste' && filtersOpen) {
      setFiltersOpen(false);
      return;
    }
    setTab('liste');
    setFiltersOpen(true);
    window.setTimeout(() => filterToggleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const extraAgeClasses = useMemo(
    () => [...new Set(result.inArea.map((m) => m.ageClass).filter((a): a is string => !!a))],
    [result.inArea],
  );

  const userFilterCount =
    (filters.category !== 'alle' ? 1 : 0) +
    (filters.classFilter ? 1 : 0) +
    (filters.search.trim() ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0);

  /** Spiel aus "Als Nächstes"/"Meine Vereine" in der Liste anspringen (Desktop: auch auf der Karte). */
  const selectMatch = (id: string) => {
    setActiveId(id);
    document.getElementById(`match-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (isDesktop() && view !== 'liste') mapRef.current?.focusMatch(id);
  };

  const highlights = (
    <div className="mb-4 space-y-3">
      <UpcomingCard matches={upcoming} now={now} onSelect={selectMatch} />
      <FavoritesCard
        favorites={favorites.list}
        matches={favoriteMatches}
        onlyFavorites={filters.favoritesOnly}
        now={now}
        onToggleOnly={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
        onRemove={favorites.remove}
        onSelect={selectMatch}
      />
    </div>
  );

  // ─── Vorschläge bei leeren Ergebnissen ──────────────────────────────────
  const suggestions: Suggestion[] = [];
  const nextRadius = RADIUS_OPTIONS.find((r) => r > filters.radiusKm);
  if (nextRadius) suggestions.push({ label: `Umkreis auf ${nextRadius} km erweitern`, onClick: () => updateFilters({ radiusKm: nextRadius }) });
  if (filters.timePreset !== '30') suggestions.push({ label: 'Nächste 30 Tage anzeigen', onClick: () => updateFilters({ timePreset: '30' }) });
  if (userFilterCount > 0)
    suggestions.push({
      label: 'Filter zurücksetzen',
      onClick: () => updateFilters({ category: 'alle', classFilter: '', search: '', favoritesOnly: false }),
    });

  // ─── Ergebnisbereich ─────────────────────────────────────────────────────
  let results: ReactNode;
  if (needsDiscovery) {
    results = area.running ? (
      <LoadingList />
    ) : (
      <EmptyState
        title="Umgebung noch nicht erkundet"
        text={
          googleReady
            ? 'Tippe oben auf „Umgebung erkunden“. Die App findet dann selbst alle Vereine im Umkreis und zeigt ihre Spiele – ganz ohne Eingabe, und nur einmal nötig.'
            : 'Aktiviere Google Maps. Danach findet die App selbst alle Vereine im Umkreis und zeigt ihre Spiele – ganz ohne Eingabe.'
        }
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
  } else if (result.isLoading && !online) {
    results = (
      <EmptyState
        title="Keine gespeicherten Spiele"
        text="Du bist offline, und für diese Auswahl sind noch keine Spiele gespeichert. Sobald du wieder Netz hast, werden sie geladen."
        suggestions={[]}
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
  } else if (filters.favoritesOnly && shown.length === 0 && result.matches.length > 0) {
    results = (
      <>
        {highlights}
        <EmptyState
          title="Keine Spiele deiner Vereine"
          text={
            favorites.list.length === 0
              ? 'Du hast noch keinen Verein gemerkt. Tippe bei einem Spiel auf den Stern neben dem Verein.'
              : `Deine Vereine spielen im Umkreis von ${filters.radiusKm} km im gewählten Zeitraum nicht.`
          }
          suggestions={[{ label: 'Alle Vereine zeigen', onClick: () => updateFilters({ favoritesOnly: false }) }]}
        />
      </>
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
      <>
        {highlights}
        <MatchList
          matches={shown}
          origin={location}
          mapAvailable={googleReady}
          activeId={activeId}
          favoriteKeys={favorites.keys}
          onToggleFavorite={favorites.toggle}
          onShowOnMap={showOnMap}
        />
      </>
    );
  }

  const listHidden = view === 'karte';
  const mapHidden = view === 'liste';
  const onMapTab = tab === 'karte';

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <Header />
      {!online && (
        <div
          role="status"
          className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 sm:top-[calc(4rem+env(safe-area-inset-top))] lg:static"
        >
          Offline – du siehst die zuletzt geladenen Spiele. Karte und Suche brauchen Netz.
        </div>
      )}

      <main
        className={`flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:grid lg:pb-0 lg:min-h-0 ${
          mapHidden ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(380px,460px)_1fr]'
        }`}
      >
        {/* Mobil: "contents" lässt Steuerung, Karte und Liste per order sortieren; Desktop: scrollbare Seitenleiste */}
        <aside className="contents lg:block lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-slate-200">
          <div
            className={`order-1 space-y-4 p-4 sm:p-5 ${onMapTab ? 'hidden lg:block' : ''} ${
              mapHidden ? 'lg:mx-auto lg:max-w-3xl' : ''
            }`}
          >

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
                ref={filterToggleRef}
                type="button"
                className={`${filtersOpen ? '' : 'mb-0'} flex min-h-11 w-full scroll-mt-20 items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 lg:hidden`}
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
              count={shown.length}
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
            {result.error && result.matches.length > 0 && online && (
              <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Aktualisierung fehlgeschlagen – es werden zwischengespeicherte Spiele angezeigt.
              </p>
            )}
          </div>

          <div
            className={`order-3 px-4 pb-6 sm:px-5 ${onMapTab ? 'hidden' : 'block'} ${listHidden ? 'lg:hidden' : 'lg:block'} ${mapHidden ? 'lg:mx-auto lg:max-w-3xl' : ''} ${
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
          className={`order-2 ${onMapTab ? 'block' : 'hidden'} ${mapHidden ? 'lg:hidden' : 'lg:block'}
            fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20
            lg:static lg:inset-auto lg:z-auto lg:min-h-0`}
        >
          <div className="relative h-full overflow-hidden">
            <MapPanel
              ref={mapRef}
              status={maps.status}
              error={maps.error}
              location={location}
              radiusKm={filters.radiusKm}
              matches={shown}
              onConsent={() => setGoogleConsent(true)}
              onRetry={maps.retry}
            />
            {/* Handy: kurze Zusammenfassung über der Karte */}
            {googleReady && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14 lg:hidden">
                <p className="max-w-full truncate rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
                  {result.isLoading ? (
                    'Spiele werden gesucht…'
                  ) : (
                    <>
                      <span className="text-bfv-700">
                        {shown.length} {shown.length === 1 ? 'Spiel' : 'Spiele'}
                      </span>{' '}
                      · {filters.radiusKm} km um {location.label}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <MobileNav
        tab={tab}
        count={shown.length}
        loading={result.isLoading}
        filterCount={userFilterCount}
        filtersOpen={filtersOpen}
        onTabChange={changeTab}
        onFilters={openFilters}
      />

      <GeolocationDialog
        open={geoDialogOpen}
        googleActive={googleReady}
        onConfirm={() => void handleGeoConfirm()}
        onCancel={() => setGeoDialogOpen(false)}
      />
    </div>
  );
}

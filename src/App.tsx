import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FilterPanel, TIME_PRESETS } from './components/filters/FilterPanel';
import { QuickBar } from './components/filters/QuickBar';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { MobileNav, type MobileTab } from './components/layout/MobileNav';
import { Sheet } from './components/layout/Sheet';
import { GeolocationDialog } from './components/location/GeolocationDialog';
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
import { clubKey, involvesFavorite } from './utils/favorites';
import { Spinner, buttonPrimary, buttonSecondary } from './components/ui';
import { useFavoriteResults } from './hooks/useFavoriteResults';
import { useWeather } from './hooks/useWeather';
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

// Spieldetails (Tabelle, Form …) erst beim ersten Öffnen laden – hält den Start klein
const MatchDetails = lazy(() => import('./components/details/MatchDetails').then((m) => ({ default: m.MatchDetails })));

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
  const [filters, setStoredFilters] = usePersistentState<Filters>('bfv.filters.v1', DEFAULT_FILTERS, sanitizeFilters);
  // Zuletzt gewählter Standort – nur in diesem Browser gespeichert, damit er beim nächsten Besuch da ist.
  const [location, setLocation] = usePersistentState<SelectedLocation>(
    'bfv.location.v1',
    config.defaultLocation,
    sanitizeLocation,
  );
  const [googleConsent, setGoogleConsent] = usePersistentState<boolean>('bfv.consent.googleMaps', false, (v) => v === true);
  const [favTipDismissed, setFavTipDismissed] = usePersistentState<boolean>('bfv.favTip.dismissed', false, (v) => v === true);
  const [view, setView] = useState<ViewMode>('beides');
  // Handy: Liste oder Vollbild-Karte (untere Leiste); Desktop nutzt `view`.
  const [tab, setTab] = useState<MobileTab>('liste');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Erkundete Umgebung (Vereine/Mannschaften) – nur beim BFV-Provider relevant
  const area = useAreaDiscovery();
  const loadProgress = useLoadProgress();

  const mapRef = useRef<MapViewHandle>(null);

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
  const favoriteResults = useFavoriteResults(area.index, result.inArea, favorites.keys, now);
  const weatherFor = useWeather(shown, online && config.weatherEnabled);
  const detailMatch = useMemo(
    () => (detailId ? result.inArea.find((m) => m.id === detailId) ?? null : null),
    [detailId, result.inArea],
  );

  const areaCovered = isAreaCovered(area.index, location, filters.radiusKm);
  const clubsNearby = useMemo(
    () => clubsInRadius(area.index, location, filters.radiusKm).length,
    [area.index, location, filters.radiusKm],
  );
  // Noch nichts erkundet in diesem Umkreis → Hinweis statt leerer Liste
  const needsDiscovery = usesBfvSources && clubsNearby === 0;
  // Erkundungs-Kasten nur zeigen, wenn etwas zu tun ist – sonst steckt er in den Filtern
  const areaNeedsAttention = usesBfvSources && (!areaCovered || area.running || !!area.error);

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
      setDetailId(null);
      setActiveId(id);
      const desktop = isDesktop();
      const wasHidden = desktop ? view === 'liste' : tab !== 'karte';
      if (desktop && wasHidden) setView('beides');
      if (!desktop) setTab('karte');
      // Kurz warten, bis die (evtl. eben eingeblendete) Karte ihr Layout hat
      window.setTimeout(() => mapRef.current?.focusMatch(id), wasHidden ? 200 : 50);
    },
    [view, tab],
  );

  const openDetails = useCallback((id: string) => {
    setActiveId(id);
    setDetailId(id);
  }, []);

  const changeTab = (t: MobileTab) => {
    if (t === tab && t === 'liste') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTab(t);
    if (t === 'liste') window.scrollTo({ top: 0 });
  };

  const extraAgeClasses = useMemo(
    () => [...new Set(result.inArea.map((m) => m.ageClass).filter((a): a is string => !!a))],
    [result.inArea],
  );

  /** Filter außer der Kategorie (die steht als Chips sichtbar über der Liste) */
  const extraFilterCount = (filters.classFilter ? 1 : 0) + (filters.search.trim() ? 1 : 0) + (filters.favoritesOnly ? 1 : 0);
  const userFilterCount = extraFilterCount + (filters.category !== 'alle' ? 1 : 0);
  const timeLabel = TIME_PRESETS.find((p) => p.value === filters.timePreset)?.label.replace('…', '') ?? '';

  const resetFilters = () => updateFilters({ category: 'alle', classFilter: '', search: '', favoritesOnly: false });

  const highlights = (
    <div className={`mb-5 grid grid-cols-1 items-start gap-3 ${view === 'liste' ? 'lg:grid-cols-2' : ''}`}>
      <UpcomingCard matches={upcoming} now={now} onSelect={openDetails} />
      <FavoritesCard
        favorites={favorites.list}
        matches={favoriteMatches}
        results={favoriteResults.results}
        onlyFavorites={filters.favoritesOnly}
        now={now}
        tipDismissed={favTipDismissed}
        onDismissTip={() => setFavTipDismissed(true)}
        onToggleOnly={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
        onRemove={favorites.remove}
        onSelect={openDetails}
      />
    </div>
  );

  // ─── Vorschläge bei leeren Ergebnissen ──────────────────────────────────
  const suggestions: Suggestion[] = [];
  const nextRadius = RADIUS_OPTIONS.find((r) => r > filters.radiusKm);
  if (nextRadius) suggestions.push({ label: `Umkreis auf ${nextRadius} km erweitern`, onClick: () => updateFilters({ radiusKm: nextRadius }) });
  if (filters.timePreset !== '30') suggestions.push({ label: 'Nächste 30 Tage anzeigen', onClick: () => updateFilters({ timePreset: '30' }) });
  if (userFilterCount > 0) suggestions.push({ label: 'Filter zurücksetzen', onClick: resetFilters });

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
        suggestions={googleReady || googleConsent ? [] : [{ label: 'Google Maps laden', onClick: () => setGoogleConsent(true) }]}
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
          activeId={activeId}
          favoriteKeys={favorites.keys}
          weatherFor={weatherFor}
          onToggleFavorite={favorites.toggle}
          onOpen={openDetails}
          wide={view === 'liste'}
        />
      </>
    );
  }

  const mapHidden = view === 'liste';
  const listHidden = view === 'karte';
  const onMapTab = tab === 'karte';

  const areaPanel = (
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
  );

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
        className={`flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:grid lg:min-h-0 lg:pb-0 ${
          mapHidden ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(400px,480px)_1fr]'
        }`}
      >
        {/* Seitenleiste (Desktop) bzw. Listen-Tab (Handy) */}
        <aside
          className={`${onMapTab ? 'hidden' : 'block'} ${listHidden ? 'lg:hidden' : 'lg:block'} lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-slate-200`}
        >
          <div className={`px-4 pb-6 pt-4 sm:px-5 ${mapHidden ? 'lg:mx-auto lg:max-w-5xl lg:px-8' : ''}`}>
            <QuickBar
              location={location}
              radiusKm={filters.radiusKm}
              timeLabel={timeLabel}
              category={filters.category}
              counts={result.counts}
              extraFilterCount={extraFilterCount}
              googleReady={googleReady}
              locating={geo.locating}
              geoError={geo.error}
              onCategory={(category) => updateFilters({ category })}
              onOpenFilters={() => setFiltersOpen(true)}
              onSelectPlace={setLocation}
              onUseMyLocation={() => setGeoDialogOpen(true)}
              onResetLocation={() => setLocation(config.defaultLocation)}
              onDismissGeoError={geo.clearError}
            />

            {areaNeedsAttention && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">{areaPanel}</div>
            )}

            <div className="mb-3 mt-5">
              <ResultBar
                count={shown.length}
                timeLabel={timeLabel}
                loading={result.isLoading}
                refreshing={result.isFetching && !result.isLoading}
                view={view}
                onViewChange={setView}
              />
            </div>

            {result.unresolvedCount > 0 && !result.isLoading && (
              <p className="mb-3 rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
                {result.unresolvedCount} {result.unresolvedCount === 1 ? 'Spiel konnte' : 'Spiele konnten'} nicht verortet
                werden{googleReady ? '' : ' – aktiviere Google Maps, damit Adressen in Koordinaten umgewandelt werden'}.
              </p>
            )}
            {result.error && result.matches.length > 0 && online && (
              <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Aktualisierung fehlgeschlagen – es werden zwischengespeicherte Spiele angezeigt.
              </p>
            )}

            <div className={result.isPlaceholder ? 'opacity-60 transition-opacity' : ''}>{results}</div>

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
          aria-label="Karte"
          className={`${onMapTab ? 'block' : 'hidden'} ${mapHidden ? 'lg:hidden' : 'lg:block'}
            fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-[calc(3.5rem+env(safe-area-inset-top))] z-20 sm:top-[calc(4rem+env(safe-area-inset-top))]
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
              onOpenDetails={openDetails}
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
        onFilters={() => setFiltersOpen(true)}
      />

      {/* Filter: am Handy von unten, am Desktop rechts */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter"
        footer={
          <div className="flex gap-2">
            <button type="button" className={`${buttonSecondary} min-h-12 flex-1`} onClick={resetFilters} disabled={userFilterCount === 0}>
              Zurücksetzen
            </button>
            <button type="button" className={`${buttonPrimary} min-h-12 flex-[2]`} onClick={() => setFiltersOpen(false)}>
              {result.isLoading ? 'Fertig' : `${shown.length} ${shown.length === 1 ? 'Spiel' : 'Spiele'} anzeigen`}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <FilterPanel
              filters={filters}
              counts={result.counts}
              extraAgeClasses={extraAgeClasses}
              onChange={updateFilters}
              hideCategory
            />
          </div>
          {favorites.list.length > 0 && (
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white px-4 ring-1 ring-slate-200">
              <span className="text-sm font-semibold text-slate-700">Nur meine Vereine</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-bfv-700"
                checked={filters.favoritesOnly}
                onChange={(e) => updateFilters({ favoritesOnly: e.target.checked })}
              />
            </label>
          )}
          {usesBfvSources && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">{areaPanel}</div>}
        </div>
      </Sheet>

      {/* Spiel-Details */}
      <Sheet
        open={!!detailMatch}
        onClose={() => setDetailId(null)}
        title="Spieldetails"
        ariaLabel={detailMatch ? `Details: ${detailMatch.homeTeam} gegen ${detailMatch.awayTeam}` : undefined}
      >
        {detailMatch && (
          <Suspense
            fallback={
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Spinner className="text-bfv-700" /> Wird geladen…
              </p>
            }
          >
          <MatchDetails
            match={detailMatch}
            origin={location}
            now={now}
            weather={weatherFor(detailMatch)}
            mapAvailable={googleReady}
            favHome={favorites.keys.has(clubKey(detailMatch.homeTeam))}
            favAway={favorites.keys.has(clubKey(detailMatch.awayTeam))}
            onToggleFavorite={favorites.toggle}
            onShowOnMap={showOnMap}
          />
          </Suspense>
        )}
      </Sheet>

      <GeolocationDialog
        open={geoDialogOpen}
        googleActive={googleReady}
        onConfirm={() => void handleGeoConfirm()}
        onCancel={() => setGeoDialogOpen(false)}
      />
    </div>
  );
}

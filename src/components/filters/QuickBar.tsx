import { useState } from 'react';
import type { CategoryFilter, SelectedLocation } from '../../types/filters';
import { CATEGORY_COLOR } from '../../utils/classify';
import { PlaceSearch } from '../location/PlaceSearch';
import { IconLocate, IconPin, IconSliders, IconX, Spinner } from '../ui';

interface Props {
  location: SelectedLocation;
  radiusKm: number;
  timeLabel: string;
  category: CategoryFilter;
  counts: Record<CategoryFilter, number>;
  /** Zahl aktiver Zusatzfilter (Liga, Suche, Meine Vereine) für das Abzeichen */
  extraFilterCount: number;
  googleReady: boolean;
  locating: boolean;
  geoError: string | null;
  onCategory: (c: CategoryFilter) => void;
  onOpenFilters: () => void;
  onSelectPlace: (l: SelectedLocation) => void;
  onUseMyLocation: () => void;
  onResetLocation: () => void;
  onDismissGeoError: () => void;
}

const CATEGORIES: { value: CategoryFilter; label: string; color?: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'herren', label: 'Herren', color: CATEGORY_COLOR.herren },
  { value: 'frauen', label: 'Frauen', color: CATEGORY_COLOR.frauen },
  { value: 'jugend', label: 'Jugend', color: CATEGORY_COLOR.jugend },
];

/**
 * Kompakte Steuerung oben: wo (Standort + Umkreis), was (Kategorie-Chips) und ein Knopf
 * für alle weiteren Filter. Die Ortssuche klappt erst beim Antippen des Standorts auf.
 */
export function QuickBar(p: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen((o) => !o)}
          aria-expanded={searchOpen}
          aria-controls="place-search"
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bfv-50 text-bfv-700">
            <IconPin width={18} height={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="sr-only">Standort ändern. Aktuell: </span>
            <span className="block truncate font-semibold text-slate-900">{p.location.label}</span>
            <span className="block truncate text-xs text-slate-500">
              {p.radiusKm} km Umkreis · {p.timeLabel}
            </span>
          </span>
          <span className={`shrink-0 text-slate-400 transition ${searchOpen ? 'rotate-180' : ''}`} aria-hidden>
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={p.onUseMyLocation}
          disabled={p.locating}
          aria-label={p.locating ? 'Standort wird ermittelt' : 'Meinen Standort verwenden'}
          title="Meinen Standort verwenden"
          className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-bfv-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300 disabled:opacity-60"
        >
          {p.locating ? <Spinner className="text-bfv-700" /> : <IconLocate width={22} height={22} />}
        </button>
      </div>

      {searchOpen && (
        <div id="place-search" className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          {p.googleReady ? (
            <PlaceSearch
              onSelect={(l) => {
                p.onSelectPlace(l);
                setSearchOpen(false);
              }}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
              Die Ortssuche nutzt Google. Aktiviere Google Maps (z. B. auf der Karte), um nach Orten zu suchen.
            </p>
          )}
          {p.location.source !== 'default' && (
            <button
              type="button"
              onClick={() => {
                p.onResetLocation();
                setSearchOpen(false);
              }}
              className="text-xs font-semibold text-bfv-700 underline hover:text-bfv-900"
            >
              Zurück zu Dachau
            </button>
          )}
        </div>
      )}

      {p.geoError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">{p.geoError}</span>
          <button type="button" onClick={p.onDismissGeoError} aria-label="Hinweis schließen" className="shrink-0">
            <IconX width={16} height={16} />
          </button>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {/* Handy: 4 gleich breite Felder (Name oben, Anzahl unten) – passt immer in eine Zeile */}
        <div role="radiogroup" aria-label="Mannschaften" className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 sm:gap-2">
          {CATEGORIES.map((c) => {
            const active = p.category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => p.onCategory(c.value)}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl px-1 transition sm:min-h-10 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 ${
                  active ? 'bg-bfv-700 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold sm:text-sm">
                  {c.color && (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${active ? 'ring-2 ring-white/70' : ''}`}
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                  )}
                  {c.label}
                </span>
                <span className={`text-xs tabular-nums font-medium sm:text-sm ${active ? 'text-white/75' : 'text-slate-400'}`}>
                  {p.counts[c.value]}
                </span>
              </button>
            );
          })}
        </div>
        {/* Am Handy sitzt "Filter" in der unteren Leiste */}
        <button
          type="button"
          onClick={p.onOpenFilters}
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:ring-slate-300 lg:flex"
        >
          <IconSliders width={16} height={16} /> Filter
          {p.extraFilterCount > 0 && (
            <span className="rounded-full bg-bfv-700 px-1.5 text-[11px] leading-5 text-white">{p.extraFilterCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

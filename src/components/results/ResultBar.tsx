import { IconList, IconMap, IconSplit, Spinner } from '../ui';

export type ViewMode = 'beides' | 'karte' | 'liste';

interface Props {
  count: number;
  /** z. B. "Nächste 7 Tage" */
  timeLabel: string;
  loading: boolean;
  refreshing: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

const VIEWS: { value: ViewMode; label: string; Icon: typeof IconMap }[] = [
  { value: 'beides', label: 'Liste und Karte', Icon: IconSplit },
  { value: 'liste', label: 'Nur Liste', Icon: IconList },
  { value: 'karte', label: 'Nur Karte', Icon: IconMap },
];

/** Trefferzahl und (Desktop) Umschalter Liste/Karte. */
export function ResultBar({ count, timeLabel, loading, refreshing, view, onViewChange }: Props) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 py-1.5 text-sm font-medium text-slate-600">
            <Spinner className="text-bfv-700" /> Spiele werden gesucht…
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-display text-[28px] font-bold leading-none text-bfv-800">
              {count} {count === 1 ? 'Spiel' : 'Spiele'}
              {refreshing && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{timeLabel}</p>
          </>
        )}
      </div>

      <div role="radiogroup" aria-label="Ansicht" className="hidden shrink-0 gap-0.5 rounded-xl bg-slate-100 p-1 lg:flex">
        {VIEWS.map(({ value, label, Icon }) => {
          const active = view === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => onViewChange(value)}
              className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${
                active ? 'bg-white text-bfv-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <Icon width={16} height={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { IconList, IconMap, IconSplit, Segmented, Spinner } from '../ui';

export type ViewMode = 'beides' | 'karte' | 'liste';

interface Props {
  count: number;
  radiusKm: number;
  loading: boolean;
  refreshing: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

/** Trefferzahl ("23 Spiele im Umkreis von 20 km gefunden") und Umschalter Karte/Liste. */
export function ResultBar({ count, radiusKm, loading, refreshing, view, onViewChange }: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-slate-600" aria-live="polite">
        {loading ? (
          <>
            <Spinner className="text-bfv-700" /> Spiele werden gesucht…
          </>
        ) : (
          <>
            <span className="font-display text-3xl font-bold leading-none text-bfv-700">
              {count} {count === 1 ? 'Spiel' : 'Spiele'}
            </span>
            <span>im Umkreis von {radiusKm} km gefunden</span>
            {refreshing && <Spinner className="h-3 w-3 text-slate-400" />}
          </>
        )}
      </p>
      <div className="w-full">
        <Segmented<ViewMode>
          label="Ansicht"
          size="sm"
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'beides', label: <><IconSplit width={14} height={14} />Beides</> },
            { value: 'karte', label: <><IconMap width={14} height={14} />Karte</> },
            { value: 'liste', label: <><IconList width={14} height={14} />Liste</> },
          ]}
        />
      </div>
    </div>
  );
}

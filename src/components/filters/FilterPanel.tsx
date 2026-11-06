import { useId } from 'react';
import { RADIUS_OPTIONS, type CategoryFilter, type Filters, type RadiusKm, type TimePreset } from '../../types/filters';
import { AGE_CLASSES, LEAGUE_LEVELS } from '../../utils/classify';
import { addDaysToKey, toBerlinDateKey } from '../../utils/date';
import { FieldLabel, IconSearch, IconX, Segmented, inputClass } from '../ui';

interface Props {
  filters: Filters;
  counts: Record<CategoryFilter, number>;
  /** Zusätzliche Altersklassen aus den geladenen Daten (z. B. U10). */
  extraAgeClasses: string[];
  onChange: (patch: Partial<Filters>) => void;
}

export const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: 'heute', label: 'Heute' },
  { value: 'wochenende', label: 'Dieses Wochenende' },
  { value: '7', label: 'Nächste 7 Tage' },
  { value: '14', label: 'Nächste 14 Tage' },
  { value: '30', label: 'Nächste 30 Tage' },
  { value: 'custom', label: 'Eigener Zeitraum…' },
];

/** Alle Filter: Umkreis, Kategorie, Zeitraum, Altersklasse/Liga und Freitext. */
export function FilterPanel({ filters, counts, extraAgeClasses, onChange }: Props) {
  const id = useId();
  const today = toBerlinDateKey(new Date());
  const ageClasses = [...new Set([...AGE_CLASSES, ...extraAgeClasses])].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Umkreis</FieldLabel>
        <Segmented<RadiusKm>
          label="Umkreis in Kilometern"
          size="sm"
          value={filters.radiusKm}
          onChange={(radiusKm) => onChange({ radiusKm })}
          options={RADIUS_OPTIONS.map((r) => ({ value: r, label: `${r} km` }))}
        />
      </div>

      <div>
        <FieldLabel>Mannschaften</FieldLabel>
        <Segmented<CategoryFilter>
          label="Kategorie"
          value={filters.category}
          onChange={(category) => onChange({ category })}
          options={[
            { value: 'alle', label: <>Alle <Count n={counts.alle} /></> },
            {
              value: 'herren',
              label: <><Dot color="bg-blue-600" />Herren <Count n={counts.herren} /></>,
            },
            {
              value: 'jugend',
              label: <><Dot color="bg-green-600" />Jugend <Count n={counts.jugend} /></>,
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-time`}>Zeitraum</FieldLabel>
          <select
            id={`${id}-time`}
            className={inputClass}
            value={filters.timePreset}
            onChange={(e) => {
              const timePreset = e.target.value as TimePreset;
              onChange(
                timePreset === 'custom' && !filters.customFrom
                  ? { timePreset, customFrom: today, customTo: addDaysToKey(today, 7) }
                  : { timePreset },
              );
            }}
          >
            {TIME_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-class`}>Altersklasse / Liga</FieldLabel>
          <select
            id={`${id}-class`}
            className={inputClass}
            value={filters.classFilter}
            onChange={(e) => onChange({ classFilter: e.target.value })}
          >
            <option value="">Alle</option>
            <optgroup label="Jugend">
              {ageClasses.map((a) => (
                <option key={a} value={`age:${a}`}>
                  {a}
                </option>
              ))}
            </optgroup>
            <optgroup label="Ligen">
              {LEAGUE_LEVELS.map((l) => (
                <option key={l} value={`league:${l}`}>
                  {l}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {filters.timePreset === 'custom' && (
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Eigener Zeitraum</legend>
          <div>
            <FieldLabel htmlFor={`${id}-from`}>Von</FieldLabel>
            <input
              id={`${id}-from`}
              type="date"
              className={inputClass}
              min={today}
              value={filters.customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-to`}>Bis</FieldLabel>
            <input
              id={`${id}-to`}
              type="date"
              className={inputClass}
              min={filters.customFrom || today}
              value={filters.customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
            />
          </div>
        </fieldset>
      )}

      <div>
        <FieldLabel htmlFor={`${id}-q`}>Suche</FieldLabel>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id={`${id}-q`}
            type="search"
            className={`${inputClass} pl-9 pr-9`}
            placeholder="Verein, Liga oder Ort"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            autoComplete="off"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
              aria-label="Suche leeren"
            >
              <IconX width={16} height={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const Dot = ({ color }: { color: string }) => <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />;
const Count = ({ n }: { n: number }) => <span className="tabular-nums text-slate-400 font-normal">{n}</span>;

import { useMemo } from 'react';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { formatDayHeading, toBerlinDateKey } from '../../utils/date';
import { MatchCard } from './MatchCard';

interface Props {
  matches: MatchWithDistance[];
  origin: LatLng;
  mapAvailable: boolean;
  activeId: string | null;
  onShowOnMap: (id: string) => void;
}

/** Ergebnisliste, nach Spieltag gruppiert (Sortierung: Anstoß, dann Entfernung). */
export function MatchList({ matches, origin, mapAvailable, activeId, onShowOnMap }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, MatchWithDistance[]>();
    for (const m of matches) {
      const key = toBerlinDateKey(new Date(m.kickoff));
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    return [...map.entries()];
  }, [matches]);

  return (
    <div className="space-y-5">
      {groups.map(([day, items]) => (
        <section key={day} aria-labelledby={`day-${day}`}>
          <h2
            id={`day-${day}`}
            className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline justify-between border-b-2 border-bfv-950 bg-kreide/95 px-1 pb-1 pt-2 backdrop-blur"
          >
            <span className="font-display text-xl font-semibold text-bfv-950">{formatDayHeading(day)}</span>
            <span className="text-xs font-medium text-slate-500">
              {items.length} {items.length === 1 ? 'Spiel' : 'Spiele'}
            </span>
          </h2>
          <ul className="space-y-2.5">
            {items.map((m) => (
              <li key={m.id}>
                <MatchCard
                  match={m}
                  origin={origin}
                  mapAvailable={mapAvailable}
                  active={m.id === activeId}
                  onShowOnMap={onShowOnMap}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

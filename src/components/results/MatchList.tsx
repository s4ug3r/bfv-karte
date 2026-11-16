import { useMemo } from 'react';
import type { WeatherAt } from '../../services/weather';
import type { Match, MatchWithDistance } from '../../types/match';
import { formatDayHeading, toBerlinDateKey } from '../../utils/date';
import { clubKey } from '../../utils/favorites';
import { MatchCard } from './MatchCard';

interface Props {
  matches: MatchWithDistance[];
  activeId: string | null;
  favoriteKeys: ReadonlySet<string>;
  weatherFor: (m: Match) => WeatherAt | null;
  onToggleFavorite: (teamName: string) => void;
  onOpen: (id: string) => void;
}

/** Ergebnisliste, nach Spieltag gruppiert (Sortierung: Anstoß, dann Entfernung). */
export function MatchList({ matches, activeId, favoriteKeys, weatherFor, onToggleFavorite, onOpen }: Props) {
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
            className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 mb-2 flex items-baseline justify-between bg-kreide/95 px-4 pb-1.5 sm:-mx-5 sm:px-5 pt-2 backdrop-blur sm:top-[calc(4rem+env(safe-area-inset-top))] lg:top-0"
          >
            <span className="font-display text-lg font-semibold text-bfv-800">{formatDayHeading(day)}</span>
            <span className="text-xs font-medium text-slate-500">
              {items.length} {items.length === 1 ? 'Spiel' : 'Spiele'}
            </span>
          </h2>
          <ul className="space-y-2">
            {items.map((m) => (
              <li key={m.id}>
                <MatchCard
                  match={m}
                  active={m.id === activeId}
                  favHome={favoriteKeys.has(clubKey(m.homeTeam))}
                  favAway={favoriteKeys.has(clubKey(m.awayTeam))}
                  weather={weatherFor(m)}
                  onToggleFavorite={onToggleFavorite}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

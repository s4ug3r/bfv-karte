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
  /** Breite Ansicht (Desktop, nur Liste): Karten in zwei Spalten */
  wide?: boolean;
}

/** Ergebnisliste, nach Spieltag gruppiert (Sortierung: Anstoß, dann Entfernung). */
export function MatchList({ matches, activeId, favoriteKeys, weatherFor, onToggleFavorite, onOpen, wide = false }: Props) {
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
          <ul className={`grid grid-cols-1 gap-2 ${wide ? 'lg:grid-cols-2 lg:gap-3' : ''}`}>
            {items.map((m) => (
              // content-visibility: Karten außerhalb des Bildschirms werden nicht gezeichnet –
              // lange Listen (100 km, 30 Tage) scrollen so auch auf älteren Handys flüssig
              <li key={m.id} className="[contain-intrinsic-size:auto_104px] [content-visibility:auto]">
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

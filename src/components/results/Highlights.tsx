import type { MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR } from '../../utils/classify';
import { formatRelativeKickoff } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import type { FavoriteClub } from '../../utils/favorites';
import { IconStar, IconX } from '../ui';

interface UpcomingProps {
  matches: MatchWithDistance[];
  now: Date;
  onSelect: (id: string) => void;
}

/** "Als Nächstes": die drei Spiele, die als Nächstes anfangen (oder gerade laufen). */
export function UpcomingCard({ matches, now, onSelect }: UpcomingProps) {
  if (matches.length === 0) return null;
  return (
    <section aria-labelledby="next-h" className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <h2 id="next-h" className="mb-1 flex items-center gap-2 px-1 font-display text-lg font-semibold text-bfv-800">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        Als Nächstes
      </h2>
      <MatchRows matches={matches} now={now} onSelect={onSelect} />
    </section>
  );
}

interface FavoritesProps {
  favorites: FavoriteClub[];
  /** Nächste Spiele der gemerkten Vereine (im Umkreis und Zeitraum, unabhängig von anderen Filtern) */
  matches: MatchWithDistance[];
  onlyFavorites: boolean;
  now: Date;
  onToggleOnly: () => void;
  onRemove: (key: string) => void;
  onSelect: (id: string) => void;
}

/** "Meine Vereine": gemerkte Vereine, deren nächste Spiele und der Schalter "Nur meine Vereine". */
export function FavoritesCard(p: FavoritesProps) {
  if (p.favorites.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200">
        <IconStar width={16} height={16} className="shrink-0 text-amber-500" />
        <span>
          <strong className="font-semibold text-slate-800">Tipp:</strong> Tippe bei einem Spiel auf den Stern neben
          dem Verein – dann findest du ihn hier unter „Meine Vereine“.
        </span>
      </p>
    );
  }

  return (
    <section aria-labelledby="fav-h" className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 id="fav-h" className="flex items-center gap-1.5 font-display text-lg font-semibold text-bfv-800">
          <IconStar filled width={17} height={17} className="text-amber-500" />
          Meine Vereine
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={p.onlyFavorites}
          onClick={p.onToggleOnly}
          className="flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-600"
        >
          Nur diese zeigen
          <span
            className={`relative h-5 w-9 rounded-full transition ${p.onlyFavorites ? 'bg-bfv-700' : 'bg-slate-300'}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                p.onlyFavorites ? 'left-[1.125rem]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      <ul className="mb-1 flex flex-wrap gap-1.5 px-1" aria-label="Gemerkte Vereine">
        {p.favorites.map((f) => (
          <li
            key={f.key}
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 py-0.5 pl-2.5 pr-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200"
          >
            {f.name}
            <button
              type="button"
              onClick={() => p.onRemove(f.key)}
              aria-label={`${f.name} entfernen`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100"
            >
              <IconX width={12} height={12} />
            </button>
          </li>
        ))}
      </ul>

      {p.matches.length > 0 ? (
        <MatchRows matches={p.matches} now={p.now} onSelect={p.onSelect} />
      ) : (
        <p className="px-1 pt-1 text-xs text-slate-500">Keine Spiele deiner Vereine im gewählten Umkreis und Zeitraum.</p>
      )}
    </section>
  );
}

function MatchRows({ matches, now, onSelect }: { matches: MatchWithDistance[]; now: Date; onSelect: (id: string) => void }) {
  return (
    <ul className="divide-y divide-slate-100">
      {matches.map((m) => {
        const when = formatRelativeKickoff(m.kickoff, now);
        const running = when === 'läuft';
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-50"
            >
              <span
                className={`w-[4.75rem] shrink-0 rounded-lg px-1 py-1.5 text-center text-xs font-bold tabular-nums ${
                  running ? 'bg-green-500 text-white' : 'bg-bfv-50 text-bfv-800'
                }`}
              >
                {when}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {m.homeTeam} <span className="font-normal text-slate-400">–</span> {m.awayTeam}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[m.category] }} aria-hidden />
                  <span className="min-w-0 truncate">{m.competition}</span>
                  <span className="ml-auto shrink-0 tabular-nums">{formatDistance(m.distanceKm)}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

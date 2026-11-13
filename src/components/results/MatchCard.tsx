import { memo } from 'react';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../utils/classify';
import { formatDayMonth, formatTime, formatWeekdayShort } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { buildRouteUrl, formatVenueAddress } from '../../utils/maps';
import { IconExternal, IconMap, IconRoute } from '../ui';

interface Props {
  match: MatchWithDistance;
  origin: LatLng;
  mapAvailable: boolean;
  active: boolean;
  onShowOnMap: (id: string) => void;
}

/**
 * Ein Spiel in der Liste – links die Anstoßzeit wie auf einer Anzeigetafel,
 * rechts die Paarung untereinander (Heim oben, Gast unten).
 */
export const MatchCard = memo(function MatchCard({ match, origin, mapAvailable, active, onShowOnMap }: Props) {
  const address = formatVenueAddress(match.venue);
  const color = CATEGORY_COLOR[match.category];
  const actionClass =
    'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-bfv-600';
  return (
    <article
      className={`flex overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(8_33_74/0.06)] ring-1 transition
        ${active ? 'ring-2 ring-raute shadow-md' : 'ring-bfv-950/8 hover:shadow-md hover:ring-bfv-950/15'}`}
      aria-label={`${match.homeTeam} gegen ${match.awayTeam}`}
    >
      {/* Anzeigetafel; der farbige Rand zeigt die Kategorie */}
      <div
        className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 border-l-4 bg-gradient-to-b from-bfv-700 to-bfv-800 px-1 py-3 text-center text-white sm:w-[4.75rem]"
        style={{ borderLeftColor: color }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-bfv-100/85">
          {formatWeekdayShort(match.kickoff)} {formatDayMonth(match.kickoff)}
        </span>
        <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-white">
          {formatTime(match.kickoff)}
        </span>
      </div>

      <div className="min-w-0 flex-1 px-3 py-3 sm:px-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold" style={{ color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {CATEGORY_LABEL[match.category]}
            {match.ageClass ? ` ${match.ageClass}` : ''}
          </span>
          {match.competition && <span className="min-w-0 truncate">{match.competition}</span>}
          <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold tabular-nums text-slate-700">
            {formatDistance(match.distanceKm)}
          </span>
        </div>

        <h3 className="mt-1.5 font-display text-[19px] font-semibold leading-tight text-slate-900">
          <span className="block truncate" title={match.homeTeam}>{match.homeTeam}</span>
          <span className="block truncate text-slate-500" title={match.awayTeam}>
            <span className="sr-only">gegen </span>
            {match.awayTeam}
          </span>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-500">
          {match.venue.name}
          {address && `, ${address}`}
          {match.venue.approximate && <span className="text-slate-400"> (Platz des Heimvereins, ohne Gewähr)</span>}
        </p>

        <div className="-ml-2.5 mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <a
            href={buildRouteUrl(match.venue.location, origin)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionClass} text-bfv-700 hover:bg-bfv-50 hover:text-bfv-900 active:bg-bfv-100`}
          >
            <IconRoute width={15} height={15} /> Route
          </a>
          {mapAvailable && (
            <button
              type="button"
              onClick={() => onShowOnMap(match.id)}
              className={`${actionClass} text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200`}
            >
              <IconMap width={15} height={15} /> Auf Karte
            </button>
          )}
          {match.detailUrl && (
            <a
              href={match.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionClass} text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200`}
            >
              <IconExternal width={14} height={14} /> bfv.de
            </a>
          )}
        </div>
      </div>
    </article>
  );
});

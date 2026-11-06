import { memo } from 'react';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_LABEL } from '../../utils/classify';
import { formatTime, formatWeekdayShort, formatDayMonth } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { buildRouteUrl, formatVenueAddress } from '../../utils/maps';
import { IconExternal, IconMap, IconRoute } from '../ui';

const CATEGORY_STYLE = {
  herren: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  jugend: 'bg-green-50 text-green-700 ring-green-600/20',
  unbekannt: 'bg-slate-100 text-slate-600 ring-slate-500/20',
} as const;

const ACCENT = {
  herren: 'bg-blue-600',
  jugend: 'bg-green-600',
  unbekannt: 'bg-slate-400',
} as const;

interface Props {
  match: MatchWithDistance;
  origin: LatLng;
  mapAvailable: boolean;
  active: boolean;
  onShowOnMap: (id: string) => void;
}

/** Ein Spiel in der Liste. */
export const MatchCard = memo(function MatchCard({ match, origin, mapAvailable, active, onShowOnMap }: Props) {
  const address = formatVenueAddress(match.venue);
  return (
    <article
      className={`relative flex gap-3 overflow-hidden rounded-2xl bg-white p-3 pl-4 shadow-sm ring-1 transition
        ${active ? 'ring-2 ring-bfv-600' : 'ring-slate-200 hover:ring-slate-300'}`}
      aria-label={`${match.homeTeam} gegen ${match.awayTeam}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${ACCENT[match.category]}`} aria-hidden />

      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 py-2 text-center">
        <span className="text-[11px] font-semibold uppercase text-slate-500">{formatWeekdayShort(match.kickoff)}</span>
        <span className="text-xs text-slate-500">{formatDayMonth(match.kickoff)}</span>
        <span className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatTime(match.kickoff)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CATEGORY_STYLE[match.category]}`}>
            {CATEGORY_LABEL[match.category]}
          </span>
          {match.ageClass && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {match.ageClass}
            </span>
          )}
          <span className="ml-auto text-xs font-semibold tabular-nums text-slate-600">{formatDistance(match.distanceKm)}</span>
        </div>

        <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-slate-900">
          {match.homeTeam} <span className="font-normal text-slate-400">vs.</span> {match.awayTeam}
        </h3>
        {match.competition && <p className="mt-0.5 truncate text-sm text-slate-600">{match.competition}</p>}
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{match.venue.name}</span>
          {address && <> · {address}</>}
        </p>
        {match.venue.approximate && (
          <p className="mt-0.5 text-[11px] text-amber-700">Spielort über den Heimverein ermittelt – ohne Gewähr</p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onShowOnMap(match.id)}
            disabled={!mapAvailable}
            title={mapAvailable ? undefined : 'Aktiviere Google Maps, um die Karte zu nutzen'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-bfv-50 px-2.5 py-1.5 text-xs font-semibold text-bfv-800 transition hover:bg-bfv-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconMap width={14} height={14} /> Auf Karte zeigen
          </button>
          <a
            href={buildRouteUrl(match.venue.location, origin)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-bfv-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-bfv-800"
          >
            <IconRoute width={14} height={14} /> Route öffnen
          </a>
          {match.detailUrl && (
            <a
              href={match.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconExternal width={14} height={14} /> BFV.de
            </a>
          )}
        </div>
      </div>
    </article>
  );
});

import { memo, useState } from 'react';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../utils/classify';
import { formatDayMonth, formatTime, formatWeekdayShort } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { buildRouteUrl, formatVenueAddress } from '../../utils/maps';
import { downloadIcs, shareMatch } from '../../utils/share';
import { IconCalendar, IconCheck, IconExternal, IconMap, IconRoute, IconShare } from '../ui';

interface Props {
  match: MatchWithDistance;
  origin: LatLng;
  mapAvailable: boolean;
  active: boolean;
  onShowOnMap: (id: string) => void;
}

const action = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 transition';
const iconAction =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900';

/**
 * Ein Spiel in der Liste – links die Anstoßzeit wie auf einer Anzeigetafel,
 * rechts die Paarung untereinander (Heim oben, Gast unten).
 */
export const MatchCard = memo(function MatchCard({ match, origin, mapAvailable, active, onShowOnMap }: Props) {
  const address = formatVenueAddress(match.venue);
  const color = CATEGORY_COLOR[match.category];
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const share = async () => {
    if ((await shareMatch(match)) === 'copied') {
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    }
  };
  return (
    <article
      className={`flex scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-sm shadow-bfv-950/5 ring-1 transition-shadow
        ${active ? 'ring-2 ring-raute' : 'ring-bfv-950/8 hover:ring-bfv-950/20'}`}
      aria-label={`${match.homeTeam} gegen ${match.awayTeam}`}
    >
      {/* Anzeigetafel */}
      <div className="flex w-[4.25rem] shrink-0 flex-col items-center justify-center bg-gradient-to-b from-bfv-700 to-bfv-800 px-1 py-3 text-center text-white sm:w-[4.75rem]">
        <span className="text-[11px] font-medium text-bfv-100/80">
          {formatWeekdayShort(match.kickoff)} {formatDayMonth(match.kickoff)}
        </span>
        <span className="mt-0.5 font-display text-[24px] font-semibold sm:text-[26px] leading-none tabular-nums text-white">
          {formatTime(match.kickoff)}
        </span>
      </div>

      <div className="min-w-0 flex-1 px-3 py-3 sm:px-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {CATEGORY_LABEL[match.category]}
            {match.ageClass ? ` ${match.ageClass}` : ''}
          </span>
          {match.competition && <span className="min-w-0 truncate">{match.competition}</span>}
          <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-800">
            {formatDistance(match.distanceKm)}
          </span>
        </div>

        <h3 className="mt-1.5 font-display text-[18px] sm:text-[19px] font-semibold leading-tight text-slate-900">
          <span className="block truncate">{match.homeTeam}</span>
          <span className="block truncate text-slate-500">
            <span className="sr-only">gegen </span>
            {match.awayTeam}
          </span>
        </h3>

        <p className="mt-1.5 text-xs leading-snug text-slate-500">
          {match.venue.name}
          {address && `, ${address}`}
          {match.venue.approximate && <span className="text-slate-400"> (Platz des Heimvereins, ohne Gewähr)</span>}
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold">
          <a
            href={buildRouteUrl(match.venue.location, origin)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Route öffnen"
            className={`${action} flex-1 bg-bfv-700 text-white hover:bg-bfv-800 sm:flex-none`}
          >
            <IconRoute width={15} height={15} /> Route
          </a>
          <button
            type="button"
            onClick={() => onShowOnMap(match.id)}
            aria-label="Auf Karte zeigen"
            disabled={!mapAvailable}
            title={mapAvailable ? undefined : 'Aktiviere Google Maps, um die Karte zu nutzen'}
            className={`${action} flex-1 bg-bfv-50 text-bfv-800 ring-1 ring-bfv-100 hover:bg-bfv-100 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none`}
          >
            <IconMap width={15} height={15} /> Karte
          </button>
          <span className="ml-auto flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => downloadIcs(match)}
              aria-label="In den Kalender eintragen"
              title="In den Kalender eintragen"
              className={iconAction}
            >
              <IconCalendar width={17} height={17} />
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label={shareState === 'copied' ? 'Kopiert' : 'Spiel teilen'}
              title={shareState === 'copied' ? 'In die Zwischenablage kopiert' : 'Spiel teilen'}
              className={`${iconAction} ${shareState === 'copied' ? 'text-green-700 ring-green-300' : ''}`}
            >
              {shareState === 'copied' ? <IconCheck width={17} height={17} /> : <IconShare width={17} height={17} />}
            </button>
            {match.detailUrl && (
              <a
                href={match.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Spiel auf bfv.de"
                title="Spiel auf bfv.de"
                className={iconAction}
              >
                <IconExternal width={16} height={16} />
              </a>
            )}
          </span>
        </div>
      </div>
    </article>
  );
});

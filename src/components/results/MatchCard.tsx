import { memo } from 'react';
import type { WeatherAt } from '../../services/weather';
import type { MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../utils/classify';
import { formatTime } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { clubName } from '../../utils/favorites';
import { IconStar } from '../ui';

interface Props {
  match: MatchWithDistance;
  active: boolean;
  /** Heim- bzw. Gastverein ist unter "Meine Vereine" gemerkt */
  favHome: boolean;
  favAway: boolean;
  weather: WeatherAt | null;
  onToggleFavorite: (teamName: string) => void;
  onOpen: (id: string) => void;
}

/**
 * Ein Spiel in der Liste: links die Anstoßzeit, rechts die Paarung. Die ganze Karte öffnet
 * die Detailansicht (Route, Karte, Tabelle, Form …); nur die Sterne sind eigene Knöpfe.
 */
export const MatchCard = memo(function MatchCard({
  match,
  active,
  favHome,
  favAway,
  weather,
  onToggleFavorite,
  onOpen,
}: Props) {
  const color = CATEGORY_COLOR[match.category];
  const running = new Date(match.kickoff).getTime() <= Date.now();
  return (
    <article
      id={`match-${match.id}`}
      className={`relative flex scroll-mt-28 overflow-hidden rounded-2xl bg-white shadow-sm shadow-bfv-950/5 ring-1 transition
        hover:shadow-md active:scale-[0.99] ${active ? 'ring-2 ring-raute' : 'ring-slate-200'}`}
    >
      {/* Kategorie-Farbstreifen + Anstoß */}
      <div className="flex w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-slate-100 py-3 sm:w-[4.75rem]">
        <span className="font-display text-[22px] font-semibold leading-none tabular-nums text-bfv-900">
          {formatTime(match.kickoff)}
        </span>
        {running ? (
          <span className="rounded-full bg-green-500 px-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            läuft
          </span>
        ) : weather ? (
          <span className="text-[11px] font-medium text-slate-500" title={`${weather.label} zum Anpfiff`}>
            <span aria-hidden>{weather.emoji}</span> {weather.temp}°
          </span>
        ) : null}
      </div>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden />

      <div className="min-w-0 flex-1 py-2.5 pl-3 pr-2">
        <div className="flex items-center gap-2 pr-1 text-[11px] text-slate-500">
          <span className="shrink-0 font-semibold" style={{ color }}>
            {CATEGORY_LABEL[match.category]}
            {match.ageClass ? ` ${match.ageClass}` : ''}
          </span>
          {match.competition && <span className="min-w-0 truncate">{match.competition}</span>}
          <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-700">{formatDistance(match.distanceKm)}</span>
        </div>

        <h3 className="mt-1 font-display text-[17px] font-semibold leading-snug text-slate-900 sm:text-[18px]">
          <TeamLine name={match.homeTeam} fav={favHome} onToggle={onToggleFavorite} />
          <TeamLine name={match.awayTeam} fav={favAway} onToggle={onToggleFavorite} muted />
        </h3>

        <p className="mt-0.5 truncate pr-1 text-xs text-slate-500">{match.venue.name}</p>
      </div>

      {/* Ganze Karte antippbar – liegt unter den Sternen */}
      <button
        type="button"
        onClick={() => onOpen(match.id)}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bfv-600"
        aria-label={`Details: ${match.homeTeam} gegen ${match.awayTeam}, ${formatTime(match.kickoff)} Uhr`}
      />
      <span className="pointer-events-none flex items-center pr-2 text-slate-300" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </article>
  );
});

/** Mannschaftsname mit Stern zum Merken des Vereins. */
function TeamLine({
  name,
  fav,
  muted = false,
  onToggle,
}: {
  name: string;
  fav: boolean;
  muted?: boolean;
  onToggle: (teamName: string) => void;
}) {
  const club = clubName(name);
  return (
    <span className="flex items-center gap-0.5">
      {muted && <span className="sr-only">gegen </span>}
      <span className={`min-w-0 truncate ${muted ? 'text-slate-500' : ''}`}>{name}</span>
      <button
        type="button"
        onClick={() => onToggle(name)}
        aria-pressed={fav}
        aria-label={fav ? `${club} aus „Meine Vereine“ entfernen` : `${club} zu „Meine Vereine“ hinzufügen`}
        title={fav ? 'Aus „Meine Vereine“ entfernen' : 'Verein merken'}
        className={`relative z-10 -my-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          fav ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-500'
        }`}
      >
        <IconStar filled={fav} width={16} height={16} />
      </button>
    </span>
  );
}

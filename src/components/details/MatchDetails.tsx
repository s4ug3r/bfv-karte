/**
 * Detailansicht eines Spiels: Eckdaten, Aktionen, Form beider Teams, Tabelle und nächste Spiele.
 */
import { useState, type ReactNode } from 'react';
import { useTable, useTeamPlan } from '../../hooks/useMatchDetails';
import type { WeatherAt } from '../../services/weather';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../utils/classify';
import {
  formatDayHeading,
  formatDayMonth,
  formatRelativeKickoff,
  formatTime,
  formatWeekdayShort,
  toBerlinDateKey,
} from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { clubName } from '../../utils/favorites';
import { recentGames, upcomingGames, type TeamGame } from '../../utils/form';
import { buildRouteUrl, formatVenueAddress } from '../../utils/maps';
import { downloadIcs, shareMatch } from '../../utils/share';
import { normalizeText } from '../../utils/text';
import {
  IconCalendar,
  IconCheck,
  IconExternal,
  IconMap,
  IconPin,
  IconRoute,
  IconShare,
  IconStar,
  Segmented,
  Spinner,
} from '../ui';

interface Props {
  match: MatchWithDistance;
  origin: LatLng;
  now: Date;
  weather: WeatherAt | null;
  mapAvailable: boolean;
  favHome: boolean;
  favAway: boolean;
  onToggleFavorite: (teamName: string) => void;
  onShowOnMap: (id: string) => void;
}

export function MatchDetails(p: Props) {
  const { match: m } = p;
  const color = CATEGORY_COLOR[m.category];
  const address = formatVenueAddress(m.venue);
  const relative = formatRelativeKickoff(m.kickoff, p.now);
  const running = relative === 'läuft';

  return (
    <div className="space-y-4">
      {/* Eckdaten */}
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-bfv-800 to-bfv-700 px-4 py-3 text-white">
          <div>
            <p className="text-xs font-medium text-bfv-100/90">{formatDayHeading(toBerlinDateKey(new Date(m.kickoff)), p.now)}</p>
            <p className="font-display text-3xl font-semibold leading-none tabular-nums">{formatTime(m.kickoff)} Uhr</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${running ? 'bg-green-500 text-white' : 'bg-white/15 text-white'}`}
          >
            {relative}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ backgroundColor: color }}>
              {CATEGORY_LABEL[m.category]}
              {m.ageClass ? ` ${m.ageClass}` : ''}
            </span>
            {m.competition && <span className="font-medium text-slate-600">{m.competition}</span>}
          </div>

          <div className="font-display text-[22px] font-semibold leading-tight text-slate-900">
            <TeamRow name={m.homeTeam} fav={p.favHome} onToggle={p.onToggleFavorite} />
            <p className="my-0.5 text-xs font-sans font-medium uppercase tracking-wider text-slate-400">gegen</p>
            <TeamRow name={m.awayTeam} fav={p.favAway} onToggle={p.onToggleFavorite} />
          </div>

          <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <IconPin className="mt-0.5 shrink-0 text-bfv-700" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{m.venue.name}</p>
              {address && <p>{address}</p>}
              <p className="text-xs text-slate-500">{formatDistance(m.distanceKm)} Luftlinie</p>
              {m.venue.approximate && (
                <p className="mt-1 text-xs text-amber-700">Platz des Heimvereins – ohne Gewähr</p>
              )}
            </div>
          </div>

          {p.weather && (
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-xl leading-none" aria-hidden>
                {p.weather.emoji}
              </span>
              <span>
                <strong className="font-semibold">{p.weather.temp}°C</strong> {p.weather.label} zum Anpfiff
                {p.weather.rain >= 20 && <span className="text-slate-500"> · Regenrisiko {p.weather.rain} %</span>}
              </span>
            </p>
          )}
        </div>
      </section>

      <Actions {...p} />

      {m.bfv ? (
        <BfvSections match={m} now={p.now} />
      ) : (
        <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500 ring-1 ring-slate-200">
          Tabelle, Form und Spielplan gibt es nur mit den Daten der BFV-Schnittstelle.
        </p>
      )}
    </div>
  );
}

function TeamRow({ name, fav, onToggle }: { name: string; fav: boolean; onToggle: (n: string) => void }) {
  const club = clubName(name);
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1">{name}</span>
      <button
        type="button"
        onClick={() => onToggle(name)}
        aria-pressed={fav}
        aria-label={fav ? `${club} aus „Meine Vereine“ entfernen` : `${club} zu „Meine Vereine“ hinzufügen`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          fav ? 'bg-amber-50 text-amber-500' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500'
        }`}
      >
        <IconStar filled={fav} width={20} height={20} />
      </button>
    </div>
  );
}

function Actions(p: Props) {
  const m = p.match;
  const [copied, setCopied] = useState(false);
  const tile =
    'flex flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 py-2.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40';
  return (
    <div className="space-y-2">
      <a
        href={buildRouteUrl(m.venue.location, p.origin)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-bfv-700 px-4 font-display text-lg font-semibold tracking-wide text-white shadow-sm hover:bg-bfv-800"
      >
        <IconRoute width={18} height={18} /> Route zum Platz
      </a>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={tile} disabled={!p.mapAvailable} onClick={() => p.onShowOnMap(m.id)}>
          <IconMap width={20} height={20} className="text-bfv-700" /> Karte
        </button>
        <button type="button" className={tile} onClick={() => downloadIcs(m)}>
          <IconCalendar width={20} height={20} className="text-bfv-700" /> Kalender
        </button>
        <button
          type="button"
          className={tile}
          onClick={async () => {
            if ((await shareMatch(m)) === 'copied') {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? (
            <IconCheck width={20} height={20} className="text-green-600" />
          ) : (
            <IconShare width={20} height={20} className="text-bfv-700" />
          )}
          {copied ? 'Kopiert' : 'Teilen'}
        </button>
        {m.detailUrl ? (
          <a href={m.detailUrl} target="_blank" rel="noopener noreferrer" className={tile}>
            <IconExternal width={20} height={20} className="text-bfv-700" /> bfv.de
          </a>
        ) : (
          <span className={`${tile} opacity-40`} aria-hidden>
            <IconExternal width={20} height={20} /> bfv.de
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-bfv-800">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Loading = () => (
  <p className="flex items-center gap-2 text-sm text-slate-500">
    <Spinner className="text-bfv-700" /> Wird geladen…
  </p>
);
const Failed = ({ what }: { what: string }) => <p className="text-sm text-slate-500">{what} konnte nicht geladen werden.</p>;

function BfvSections({ match: m, now }: { match: MatchWithDistance; now: Date }) {
  const refs = m.bfv!;
  const home = useTeamPlan(refs.homeTeamId);
  const away = useTeamPlan(refs.awayTeamId);
  const table = useTable(refs.compoundId);
  const [planTeam, setPlanTeam] = useState<'home' | 'away'>('home');

  const homeName = m.homeTeam;
  const awayName = m.awayTeam;
  const plan = planTeam === 'home' ? home : away;
  const planTeamId = planTeam === 'home' ? refs.homeTeamId : refs.awayTeamId;

  const isOurs = (teamId: string, teamName: string) =>
    teamId
      ? teamId === refs.homeTeamId || teamId === refs.awayTeamId
      : [m.homeTeam, m.awayTeam].some((n) => normalizeText(n) === normalizeText(teamName));

  return (
    <>
      <Section title="Form" aside={<span className="text-xs text-slate-500">letzte 5 Spiele</span>}>
        <div className="space-y-3">
          {[
            { q: home, id: refs.homeTeamId, name: m.homeTeam },
            { q: away, id: refs.awayTeamId, name: m.awayTeam },
          ].map(({ q, id, name }) => (
            <div key={id}>
              <p className="mb-1.5 truncate text-sm font-semibold text-slate-800">{name}</p>
              {q.isPending ? (
                <Loading />
              ) : q.isError ? (
                <Failed what="Die Form" />
              ) : (
                <FormBadges games={recentGames(q.data.matches, id, now)} />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tabelle" aside={table.data?.competitionName && <span className="truncate text-xs text-slate-500">{table.data.competitionName}</span>}>
        {table.isPending ? (
          <Loading />
        ) : table.isError ? (
          <Failed what="Die Tabelle" />
        ) : table.data.rows.length === 0 ? (
          <p className="text-sm text-slate-500">Für diesen Wettbewerb gibt es keine Tabelle (z. B. Freundschaftsspiel oder Pokal).</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-7 pb-1.5 font-semibold">Pl.</th>
                <th className="pb-1.5 font-semibold">Mannschaft</th>
                <th className="w-8 pb-1.5 text-right font-semibold">Sp.</th>
                <th className="w-10 pb-1.5 text-right font-semibold">Diff</th>
                <th className="w-9 pb-1.5 text-right font-semibold">Pkt</th>
              </tr>
            </thead>
            <tbody>
              {table.data.rows.map((r) => {
                const ours = isOurs(r.teamId, r.teamName);
                return (
                  <tr key={`${r.position}-${r.teamName}`} className={ours ? 'bg-amber-50 font-semibold text-slate-900' : 'text-slate-700'}>
                    <td className={`py-1.5 pl-1 ${ours ? 'rounded-l-lg' : ''}`}>{r.position}.</td>
                    <td className="max-w-0 truncate py-1.5 pr-2">{r.teamName}</td>
                    <td className="py-1.5 text-right">{r.matches}</td>
                    <td className="py-1.5 text-right">{r.goalsDiff > 0 ? `+${r.goalsDiff}` : r.goalsDiff}</td>
                    <td className={`py-1.5 pr-1 text-right font-bold ${ours ? 'rounded-r-lg' : ''}`}>{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Nächste Spiele">
        <div className="mb-3">
          <Segmented<'home' | 'away'>
            label="Mannschaft"
            size="sm"
            value={planTeam}
            onChange={setPlanTeam}
            options={[
              { value: 'home', label: <span className="truncate">{clubName(homeName)}</span> },
              { value: 'away', label: <span className="truncate">{clubName(awayName)}</span> },
            ]}
          />
        </div>
        {plan.isPending ? (
          <Loading />
        ) : plan.isError ? (
          <Failed what="Der Spielplan" />
        ) : (
          <GameList games={upcomingGames(plan.data.matches, planTeamId, now, 4, refs.matchId)} empty="Keine weiteren Spiele angesetzt." />
        )}
      </Section>
    </>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  S: 'bg-green-600',
  U: 'bg-slate-400',
  N: 'bg-red-500',
};
const OUTCOME_LABEL: Record<string, string> = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

function FormBadges({ games }: { games: TeamGame[] }) {
  if (games.length === 0) return <p className="text-sm text-slate-500">Noch keine Ergebnisse in dieser Saison.</p>;
  // älteste links, neueste rechts
  const ordered = [...games].reverse();
  return (
    <ol className="flex gap-1.5" aria-label="Letzte Ergebnisse, neuestes zuletzt">
      {ordered.map((g) => (
        <li
          key={g.matchId}
          title={`${g.goalsFor}:${g.goalsAgainst} ${g.home ? 'gegen' : 'bei'} ${g.opponent}`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${OUTCOME_STYLE[g.outcome!]}`}
        >
          <span aria-hidden>{g.outcome}</span>
          <span className="sr-only">
            {OUTCOME_LABEL[g.outcome!]} {g.goalsFor}:{g.goalsAgainst} {g.home ? 'gegen' : 'bei'} {g.opponent}
          </span>
        </li>
      ))}
    </ol>
  );
}

function GameList({ games, empty }: { games: TeamGame[]; empty: string }) {
  if (games.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {games.map((g) => (
        <li key={g.matchId} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-[5.5rem] shrink-0 text-xs font-semibold tabular-nums text-slate-600">
            {formatWeekdayShort(g.kickoff)} {formatDayMonth(g.kickoff)} {formatTime(g.kickoff)}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${g.home ? 'bg-bfv-100 text-bfv-800' : 'bg-slate-100 text-slate-600'}`}
            title={g.home ? 'Heimspiel' : 'Auswärtsspiel'}
          >
            {g.home ? 'H' : 'A'}
          </span>
          <span className="min-w-0 flex-1 truncate text-slate-800">
            {g.home ? 'gegen' : 'bei'} {g.opponent}
          </span>
          {g.outcome && (
            <span className="shrink-0 font-bold tabular-nums">
              {g.goalsFor}:{g.goalsAgainst}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export { GameList, FormBadges };

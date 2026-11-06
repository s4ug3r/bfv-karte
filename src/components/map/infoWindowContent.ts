/**
 * Baut den Inhalt des InfoWindows als DOM-Element. Bewusst ohne innerHTML,
 * damit Texte aus Fremddaten (Teamnamen, Spielstätten) nie als HTML interpretiert werden.
 */
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../utils/classify';
import { formatKickoff } from '../../utils/date';
import { formatDistance } from '../../utils/distance';
import { buildRouteUrl, formatVenueAddress } from '../../utils/maps';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function createInfoWindowContent(match: MatchWithDistance, origin: LatLng): HTMLElement {
  const root = el('div', 'w-[min(78vw,300px)] p-4 font-sans text-slate-900');

  const top = el('div', 'mb-2 flex items-center gap-2 pr-6');
  const badge = el('span', 'rounded-full px-2 py-0.5 text-[11px] font-semibold text-white', CATEGORY_LABEL[match.category]);
  badge.style.backgroundColor = CATEGORY_COLOR[match.category];
  top.append(badge);
  if (match.ageClass) top.append(el('span', 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700', match.ageClass));
  top.append(el('span', 'ml-auto text-xs font-medium text-slate-500', formatDistance(match.distanceKm)));
  root.append(top);

  root.append(el('div', 'text-sm font-semibold text-bfv-800', formatKickoff(match.kickoff)));

  const teams = el('div', 'mt-1.5 text-base font-bold leading-snug');
  teams.append(document.createTextNode(match.homeTeam));
  teams.append(el('span', 'mx-1 font-normal text-slate-400', 'vs.'));
  teams.append(document.createTextNode(match.awayTeam));
  root.append(teams);

  if (match.competition) root.append(el('div', 'mt-1 text-sm text-slate-600', match.competition));

  const venue = el('div', 'mt-3 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700');
  venue.append(el('div', 'font-semibold text-slate-900', match.venue.name));
  const address = formatVenueAddress(match.venue);
  if (address) venue.append(el('div', '', address));
  venue.append(el('div', 'text-slate-500', `${formatDistance(match.distanceKm)} Luftlinie vom gewählten Standort`));
  if (match.venue.approximate) {
    venue.append(el('div', 'mt-1 text-amber-700', 'Spielort über den Heimverein ermittelt – ohne Gewähr'));
  }
  root.append(venue);

  const actions = el('div', 'mt-3 flex flex-wrap gap-2');
  actions.append(
    el('a', 'inline-flex items-center gap-1.5 rounded-lg bg-bfv-700 px-3 py-2 text-xs font-semibold text-white no-underline hover:bg-bfv-800', 'Route öffnen', {
      href: buildRouteUrl(match.venue.location, origin),
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  );
  if (match.detailUrl) {
    actions.append(
      el('a', 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 no-underline hover:bg-slate-50', 'Spiel bei BFV.de', {
        href: match.detailUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    );
  }
  root.append(actions);
  return root;
}

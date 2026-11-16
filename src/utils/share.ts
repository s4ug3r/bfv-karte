/**
 * Ein Spiel in den Kalender übernehmen (.ics) oder teilen (Web Share API, sonst Zwischenablage).
 */
import type { Match } from '../types/match';
import { formatKickoff } from './date';
import { formatVenueAddress } from './maps';

/** Übliche Dauer inkl. Pause – Jugendspiele sind kürzer, 2 Stunden passt für alle als Kalenderblock. */
const EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

/** UTC-Zeitstempel im iCalendar-Format, z. B. 20261121T130000Z */
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Sonderzeichen nach RFC 5545 maskieren. */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Zeilen über 75 Zeichen umbrechen (RFC 5545, Folgezeilen beginnen mit Leerzeichen). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function matchTitle(m: Match): string {
  return `${m.homeTeam} – ${m.awayTeam}`;
}

export function buildIcs(m: Match, now: Date = new Date()): string {
  const start = new Date(m.kickoff);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const location = [m.venue.name, formatVenueAddress(m.venue)].filter(Boolean).join(', ');
  const description = [m.competition, m.detailUrl].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BFV Spiele in der Naehe//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(m.id)}@bfv-spiele-in-der-naehe`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`⚽ ${matchTitle(m)}`)}`,
    location && `LOCATION:${icsText(location)}`,
    description && `DESCRIPTION:${icsText(description)}`,
    m.detailUrl && `URL:${m.detailUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Lädt die .ics-Datei herunter – Handys bieten dann "Zum Kalender hinzufügen" an. */
export function downloadIcs(m: Match): void {
  const blob = new Blob([buildIcs(m)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${matchTitle(m).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'spiel'}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function shareText(m: Match): string {
  const address = formatVenueAddress(m.venue);
  return [
    `⚽ ${matchTitle(m)}`,
    `${formatKickoff(m.kickoff)}${m.competition ? ` · ${m.competition}` : ''}`,
    `📍 ${m.venue.name}${address ? `, ${address}` : ''}`,
  ].join('\n');
}

/**
 * Teilt ein Spiel über das Teilen-Menü des Handys (WhatsApp, Signal, …).
 * Ohne Web Share API wird der Text in die Zwischenablage kopiert.
 * Ergebnis: 'shared' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareMatch(m: Match): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = shareText(m);
  const url = m.detailUrl ?? window.location.origin;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: matchTitle(m), text, url });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // sonst auf Zwischenablage ausweichen
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

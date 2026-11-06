/**
 * Datums- und Zeitzonen-Hilfen.
 *
 * Alle Spiele finden in Deutschland statt; maßgeblich ist daher immer die Zeitzone
 * Europe/Berlin – unabhängig davon, in welcher Zeitzone das Gerät des Nutzers läuft.
 * Intern arbeiten wir mit UTC-Zeitpunkten (Date / ISO-Strings) und rechnen nur für
 * Anzeige und Kalendertage nach Europe/Berlin um. Sommer-/Winterzeit wird über
 * Intl.DateTimeFormat korrekt berücksichtigt – ohne zusätzliche Bibliothek.
 */
import type { DateRange, TimePreset } from '../types/filters';

export const TIME_ZONE = 'Europe/Berlin';

export interface BerlinParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

/** Zerlegt einen Zeitpunkt in die Wandzeit-Bestandteile in Europe/Berlin. */
export function getBerlinParts(date: Date): BerlinParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS[map.weekday] ?? 1,
  };
}

/** Offset von Europe/Berlin zu UTC in Millisekunden für den gegebenen Zeitpunkt (+1 h oder +2 h). */
export function berlinOffsetMs(date: Date): number {
  const p = getBerlinParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/**
 * Wandelt eine Berliner Wandzeit in einen UTC-Zeitpunkt um.
 * Berücksichtigt Sommer-/Winterzeit; bei der Zeitumstellung wird sinnvoll aufgelöst.
 */
export function berlinLocalToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = berlinOffsetMs(new Date(guess));
  let ts = guess - offset1;
  const offset2 = berlinOffsetMs(new Date(ts));
  if (offset2 !== offset1) ts = guess - offset2;
  return new Date(ts);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Kalendertag in Berlin als "YYYY-MM-DD". */
export function toBerlinDateKey(date: Date): string {
  const p = getBerlinParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Addiert Kalendertage zu einem Tages-Key (zeitzonenunabhängige Kalenderarithmetik). */
export function addDaysToKey(key: string, days: number): string {
  const p = parseDateKey(key);
  if (!p) throw new Error(`Ungültiges Datum: ${key}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Beginn (00:00 Uhr Berlin) eines Kalendertags. */
export function startOfBerlinDay(key: string): Date {
  const p = parseDateKey(key);
  if (!p) throw new Error(`Ungültiges Datum: ${key}`);
  return berlinLocalToUtc(p.year, p.month, p.day, 0, 0);
}

/** Ende (23:59:59.999 Uhr Berlin) eines Kalendertags. */
export function endOfBerlinDay(key: string): Date {
  return new Date(startOfBerlinDay(addDaysToKey(key, 1)).getTime() - 1);
}

/** ISO-Wochentag (1 = Mo … 7 = So) eines Tages-Keys. */
export function weekdayOfKey(key: string): number {
  const p = parseDateKey(key);
  if (!p) return 1;
  const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = So
  return wd === 0 ? 7 : wd;
}

/**
 * Berechnet den konkreten Zeitraum für eine Zeitraum-Voreinstellung.
 * Es werden nur zukünftige Spiele berücksichtigt: "from" ist nie vor "now".
 */
export function getDateRange(
  preset: TimePreset,
  now: Date = new Date(),
  customFrom?: string,
  customTo?: string,
): DateRange {
  const today = toBerlinDateKey(now);
  const build = (fromKey: string, toKey: string): DateRange => {
    const start = startOfBerlinDay(fromKey);
    return {
      from: start.getTime() < now.getTime() ? now : start,
      to: endOfBerlinDay(toKey),
      fromKey,
      toKey,
    };
  };

  switch (preset) {
    case 'heute':
      return build(today, today);
    case 'wochenende': {
      // Mo–Fr: kommendes Wochenende (Sa + So). Sa/So: ab jetzt bis Sonntagabend.
      const wd = weekdayOfKey(today);
      const saturday = wd <= 5 ? addDaysToKey(today, 6 - wd) : wd === 6 ? today : addDaysToKey(today, -1);
      const sunday = addDaysToKey(saturday, 1);
      return build(wd <= 5 ? saturday : today, sunday);
    }
    case '7':
    case '14':
    case '30':
      return build(today, addDaysToKey(today, Number(preset)));
    case 'custom': {
      let from = customFrom && parseDateKey(customFrom) ? customFrom : today;
      let to = customTo && parseDateKey(customTo) ? customTo : addDaysToKey(from, 7);
      if (from > to) [from, to] = [to, from];
      if (from < today) from = today;
      // Liegt das Ende in der Vergangenheit, ergibt sich ein leerer Zeitraum (from > to).
      return build(from, to);
    }
  }
}

/**
 * Wandelt Datums-/Zeitangaben einer Datenquelle in einen ISO-UTC-Zeitpunkt um.
 * Unterstützt:
 * - ISO mit Offset/Z: "2026-11-07T15:00:00+01:00" → unverändert interpretiert
 * - ISO ohne Offset:  "2026-11-07T15:00"        → als Berliner Wandzeit
 * - Datum + Zeit:     "2026-11-07" + "15:00", "07.11.2026" + "15:00 Uhr" oder "Sa, 07.11.26" + "15:00"
 */
export function parseKickoff(dateInput: string, timeInput?: string): string | null {
  const date = dateInput.trim();
  if (/T\d{2}:\d{2}/.test(date)) {
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(date)) {
      const d = new Date(date);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const [d, t] = date.split('T');
    return parseKickoff(d, t);
  }

  let y: number, mo: number, da: number;
  // Nicht verankert, damit auch "Sa, 07.11.2026" oder "07.11.26" erkannt werden.
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const de = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/.exec(date);
  if (iso) {
    [y, mo, da] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (de) {
    y = Number(de[3]);
    if (y < 100) y += 2000;
    [mo, da] = [Number(de[2]), Number(de[1])];
  } else {
    return null;
  }

  const t = /(\d{1,2})[:.](\d{2})/.exec(timeInput ?? '');
  const h = t ? Number(t[1]) : 0;
  const mi = t ? Number(t[2]) : 0;
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  return berlinLocalToUtc(y, mo, da, h, mi).toISOString();
}

// ─── Anzeige ───────────────────────────────────────────────────────────────

const fmtWeekdayShort = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, weekday: 'short' });
const fmtDayMonth = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit' });
const fmtTime = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const fmtLong = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Sa." */
export const formatWeekdayShort = (iso: string) => fmtWeekdayShort.format(new Date(iso));
/** "07.11." */
export const formatDayMonth = (iso: string) => fmtDayMonth.format(new Date(iso)).replace(/\.?$/, ".");
/** "15:00" */
export const formatTime = (iso: string) => fmtTime.format(new Date(iso));
/** "Sa., 07.11. · 15:00 Uhr" */
export const formatKickoff = (iso: string) =>
  `${formatWeekdayShort(iso)}, ${formatDayMonth(iso)} · ${formatTime(iso)} Uhr`;

/** Überschrift für einen Tag in der Liste: "Heute", "Morgen" oder "Samstag, 7. November". */
export function formatDayHeading(dateKey: string, now: Date = new Date()): string {
  const today = toBerlinDateKey(now);
  if (dateKey === today) return 'Heute';
  if (dateKey === addDaysToKey(today, 1)) return 'Morgen';
  // Mittag verwenden, damit die Zeitzonenumrechnung den Tag nicht verschiebt.
  const p = parseDateKey(dateKey)!;
  return fmtLong.format(berlinLocalToUtc(p.year, p.month, p.day, 12, 0));
}

/** Kurzform eines Tages-Keys für Hinweise: "07.11.2026". */
export function formatDateKey(key: string): string {
  const p = parseDateKey(key);
  return p ? `${pad(p.day)}.${pad(p.month)}.${p.year}` : key;
}

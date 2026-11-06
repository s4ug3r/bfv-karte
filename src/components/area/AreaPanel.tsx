/**
 * Steuerung der Umgebungserkundung: Status, Startpunkt (nur beim ersten Mal), Fortschritt.
 */
import { useId, useState, type FormEvent } from 'react';
import { config } from '../../config';
import { usePersistentState } from '../../hooks/usePersistentState';
import { estimateMinutes, indexStats, type AreaIndex } from '../../services/bfv/areaIndex';
import type { DiscoveryProgress } from '../../services/bfv/discovery';
import { parseSourceInput, type ParsedSourceInput } from '../../services/bfv/sources';
import { IconAlert, IconSearch, Spinner, buttonHighlight, buttonPrimary, buttonSecondary, inputClass } from '../ui';

interface Props {
  index: AreaIndex;
  radiusKm: number;
  covered: boolean;
  /** Kennt das Verzeichnis schon Vereine im aktuellen Umkreis? (Dann ist kein Startpunkt nötig.) */
  hasClubsNearby: boolean;
  googleReady: boolean;
  running: boolean;
  progress: DiscoveryProgress | null;
  error: string | null;
  onStart: (seed?: ParsedSourceInput) => void;
  onCancel: () => void;
  onReset: () => void;
  onEnableGoogle: () => void;
}

const formatDate = (ts: number) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(ts);

export function AreaPanel(p: Props) {
  const id = useId();
  // Zuletzt eingegebener Vereins-Link bleibt gespeichert
  const [seedInput, setSeedInput] = usePersistentState<string>('bfv.seed.v1', config.bfvSeed, (v) =>
    typeof v === 'string' ? v : config.bfvSeed,
  );
  const [seedError, setSeedError] = useState<string | null>(null);
  const stats = indexStats(p.index);
  const needsSeed = !p.hasClubsNearby;
  const minutes = estimateMinutes(p.radiusKm);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSeedError(null);
    let seed: ParsedSourceInput | undefined;
    if (seedInput.trim()) {
      const parsed = parseSourceInput(seedInput);
      if (!parsed) {
        setSeedError('Keine BFV-ID gefunden. Füge den Link einer Vereins- oder Mannschaftsseite von bfv.de ein.');
        return;
      }
      seed = parsed;
    } else if (needsSeed) {
      setSeedError('Für die erste Erkundung brauchst du einen Startpunkt aus deiner Nähe.');
      return;
    }
    p.onStart(seed);
  };


  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${id}-h`} className="text-sm font-semibold text-slate-700">
          Spiele in der Umgebung
        </h2>
        {stats.clubs > 0 && !p.running && (
          <span className="text-[11px] text-slate-400">
            {stats.clubs} Vereine, Stand {formatDate(p.index.updatedAt)}
          </span>
        )}
      </div>

      {/* Laufende Erkundung */}
      {p.running && p.progress && (
        <div className="space-y-2 rounded-xl bg-bfv-50 p-3 text-sm text-bfv-900" aria-live="polite">
          <div className="flex items-center gap-2 font-semibold">
            <Spinner className="text-bfv-700" /> Umgebung wird erkundet…
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bfv-100">
            <div
              className="h-full rounded-full bg-bfv-700 transition-all"
              style={{
                width: `${Math.round((p.progress.done / Math.max(1, p.progress.done + p.progress.queued)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs">
            {p.progress.done} Vereine erkundet, {p.progress.queued} ausstehend, {p.progress.teams} Mannschaften
          </p>
          <p className="truncate text-xs text-bfv-700">{p.progress.step}</p>
          <button type="button" className={buttonSecondary} onClick={p.onCancel}>
            Abbrechen
          </button>
          <p className="text-[11px] text-bfv-700">
            Bereits Erkundetes bleibt erhalten. Das Ergebnis wird 30 Tage gespeichert.
          </p>
        </div>
      )}

      {/* Umkreis abgedeckt */}
      {!p.running && p.covered && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800 ring-1 ring-green-200">
          ✓ Dein Umkreis ist erkundet – es werden alle Spiele der Vereine darin angezeigt.
        </p>
      )}

      {/* Erkundung nötig */}
      {!p.running && !p.covered && (
        <>
          {!p.googleReady ? (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p>
                Für die Karte und die Erkundung braucht die App Google Maps.
              </p>
              <button type="button" className={buttonPrimary} onClick={p.onEnableGoogle}>
                Google Maps laden
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-sm text-amber-900">
                {stats.clubs === 0 ? (
                  <>
                    <strong>Einmalig:</strong> Die App sucht selbst alle Vereine im Umkreis von {p.radiusKm} km. Sie
                    braucht dafür nur einen Startpunkt – einen Verein oder eine Mannschaft aus deiner Nähe.
                  </>
                ) : (
                  <>Dieser Umkreis ({p.radiusKm} km) ist noch nicht vollständig erkundet.</>
                )}
              </p>

              {(needsSeed || seedInput) && (
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label="bfv.de-Link eines Vereins oder einer Mannschaft"
                    className={`${inputClass} pl-9`}
                    placeholder="bfv.de-Link eines Vereins aus der Nähe"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
              {needsSeed && (
                <p className="text-[11px] leading-relaxed text-amber-800">
                  So geht’s: Auf bfv.de deinen Verein (oder irgendeinen Verein in der Nähe) öffnen und die Adresse aus
                  der Browserzeile hier einfügen, z. B. <span className="break-all">bfv.de/vereine/…/…</span>
                </p>
              )}
              {seedError && (
                <p role="alert" className="text-xs text-red-600">
                  {seedError}
                </p>
              )}

              <button type="submit" className={`${buttonHighlight} w-full`}>
                Umgebung erkunden (ca. {minutes} Min.)
              </button>
              {p.radiusKm >= 50 && (
                <p className="text-[11px] text-amber-800">
                  Bei {p.radiusKm} km sind es schnell mehrere hundert Vereine. Ein kleinerer Radius ist deutlich schneller.
                </p>
              )}
            </form>
          )}
        </>
      )}

      {p.error && !p.running && (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          <IconAlert width={16} height={16} className="shrink-0" />
          {p.error}
        </p>
      )}

      {p.index.lastRun && !p.running && (
        <details
          className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
          open={!!p.index.lastRun.googleError || p.index.lastRun.clubsInRadius <= 1}
        >
          <summary className="cursor-pointer select-none">Details zur letzten Erkundung</summary>
          <ul className="mt-1.5 space-y-0.5 tabular-nums">
            <li>Vereine erkundet: {p.index.lastRun.clubsExpanded}</li>
            <li>Vereine im Umkreis: {p.index.lastRun.clubsInRadius}</li>
            <li>
              Vereine verortet: {p.index.lastRun.clubsLocated}, nicht gefunden: {p.index.lastRun.clubsNotLocated}
            </li>
            <li>
              Spielpläne geladen: {p.index.lastRun.teamsLoaded}, Fehler: {p.index.lastRun.teamErrors}
            </li>
            <li>Spiele gesehen: {p.index.lastRun.matchesSeen}</li>
            <li>
              Gegner ohne Vereins-ID: {p.index.lastRun.opponentsWithoutClubId}, nachgeschlagen:{' '}
              {p.index.lastRun.opponentsResolvedViaTeam}
            </li>
            {p.index.lastRun.locator && <li>Ortssuche über: {p.index.lastRun.locator}</li>}
            {p.index.lastRun.durationSec !== undefined && (
              <li>
                Dauer: {p.index.lastRun.durationSec} s · BFV: {p.index.lastRun.bfvRequests} Anfragen à Ø{' '}
                {p.index.lastRun.bfvAvgMs} ms · Ortssuche: {p.index.lastRun.locateRequests} à Ø {p.index.lastRun.locateAvgMs} ms
              </li>
            )}
            {p.index.lastRun.googleError && (
              <li className="font-medium text-red-700">Fehler bei der Ortssuche: {p.index.lastRun.googleError}</li>
            )}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        {stats.clubs > 0 && !p.running && (
          <button
            type="button"
            className="underline hover:text-slate-800"
            onClick={() => {
              if (window.confirm('Erkundete Umgebung löschen? Sie muss danach neu erkundet werden.')) p.onReset();
            }}
          >
            Erkundung zurücksetzen
          </button>
        )}
      </div>
    </section>
  );
}

/** Sichtbare Versionsnummer – zeigt nach dem Hochladen, ob die neue Version läuft. */
export const APP_VERSION = '2.9.0';

interface Props {
  sourceLabel: string;
  googleConsent: boolean;
  onRevokeGoogle: () => void;
}

/** Hinweise zu Datenquelle und Datenschutz – eingeklappt, damit die Liste im Vordergrund steht. */
export function Footer({ sourceLabel, googleConsent, onRevokeGoogle }: Props) {
  return (
    <footer className="mt-8 border-t border-slate-200 pb-2 pt-3 text-xs leading-relaxed text-slate-500">
      <details className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
          <span>Quellen &amp; Datenschutz</span>
          <span className="flex items-center gap-2 text-slate-400">
            Version {APP_VERSION}
            <span className="transition group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </span>
        </summary>
        <div className="space-y-1.5 pt-1">
          <p>
            Datenquelle: <span className="font-medium text-slate-700">{sourceLabel}</span>. Ansetzungen können sich
            kurzfristig ändern – maßgeblich sind die Angaben auf bfv.de. Kein offizielles Angebot des BFV.
          </p>
          <p>
            Vereinsorte teils über{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
              © OpenStreetMap-Mitwirkende
            </a>{' '}
            (Photon/Nominatim). Wetter:{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
              Open-Meteo
            </a>{' '}
            (dabei werden nur die Koordinaten der Spielorte übertragen, nicht dein Standort).
          </p>
          <p>
            Datenschutz: Dein GPS-Standort wird nur nach Zustimmung abgefragt. Zuletzt gewählter Standort, Filter,
            gemerkte Vereine und Zwischenspeicher liegen nur lokal in deinem Browser.
            {googleConsent && (
              <>
                {' '}
                <button type="button" onClick={onRevokeGoogle} className="font-medium text-bfv-700 underline hover:text-bfv-900">
                  Google-Maps-Einwilligung widerrufen
                </button>
              </>
            )}
          </p>
        </div>
      </details>
    </footer>
  );
}

/** Sichtbare Versionsnummer – zeigt nach dem Hochladen, ob die neue Version läuft. */
export const APP_VERSION = '1.8.0';

interface Props {
  sourceLabel: string;
  googleConsent: boolean;
  onRevokeGoogle: () => void;
}

/** Hinweise zu Datenquelle und Datenschutz. */
export function Footer({ sourceLabel, googleConsent, onRevokeGoogle }: Props) {
  return (
    <footer className="mt-6 space-y-1.5 border-t border-slate-200 pt-4 pb-2 text-xs leading-relaxed text-slate-500">
      <p className="font-medium text-slate-400">Version {APP_VERSION}</p>
      <p>
        Datenquelle: <span className="font-medium text-slate-700">{sourceLabel}</span>. Ansetzungen können sich
        kurzfristig ändern – maßgeblich sind die Angaben auf bfv.de. Kein offizielles Angebot des BFV.
      </p>
      <p>
        Vereinsorte teils über{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          © OpenStreetMap-Mitwirkende
        </a>{' '}
        (Photon/Nominatim).
      </p>
      <p>
        Datenschutz: Dein Standort wird nur nach Zustimmung abgefragt, nur im Browser verarbeitet und nicht
        gespeichert. Filter und Zwischenspeicher (Spiele, Adressen) liegen lokal in deinem Browser.
        {googleConsent && (
          <>
            {' '}
            <button type="button" onClick={onRevokeGoogle} className="font-medium text-bfv-700 underline hover:text-bfv-900">
              Google-Maps-Einwilligung widerrufen
            </button>
          </>
        )}
      </p>
    </footer>
  );
}

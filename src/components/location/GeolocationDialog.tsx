import { useEffect, useRef } from 'react';
import { IconLocate } from '../ui';

interface Props {
  open: boolean;
  googleActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Einwilligungsdialog vor der Standortabfrage. Erst nach "Standort verwenden" wird
 * die Browser-Geolocation-API aufgerufen (die dann ggf. noch selbst nachfragt).
 */
export function GeolocationDialog({ open, googleActive, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="geo-title"
      className="m-auto w-[min(92vw,420px)] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-bfv-50 text-bfv-700">
          <IconLocate width={22} height={22} />
        </div>
        <h2 id="geo-title" className="text-lg font-bold text-slate-900">
          Standort verwenden?
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Dein Standort wird nur in diesem Browser genutzt, um Entfernungen zu berechnen.</li>
          <li>• Er wird nicht gespeichert und nicht an unsere Datenquelle übermittelt.</li>
          {googleActive && (
            <li>• Die Karte wird auf deinen Standort zentriert; dabei erhält Google den Kartenausschnitt.</li>
          )}
          <li>• Du kannst jederzeit stattdessen einen Ort eingeben.</li>
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="rounded-xl bg-bfv-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bfv-800"
          >
            Standort verwenden
          </button>
        </div>
      </div>
    </dialog>
  );
}

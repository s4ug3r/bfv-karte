import type { ReactNode } from 'react';
import { IconAlert, IconBall, buttonPrimary, buttonSecondary } from '../ui';

/** Platzhalter-Karten während des Ladens. */
export function LoadingList() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Spiele werden geladen…</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="h-16 w-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-red-200">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <IconAlert width={22} height={22} />
      </div>
      <h2 className="font-bold text-slate-900">Spiele konnten nicht geladen werden</h2>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      <button type="button" className={`${buttonPrimary} mt-4`} onClick={onRetry}>
        Erneut versuchen
      </button>
    </div>
  );
}

export interface Suggestion {
  label: string;
  onClick: () => void;
}

/** Freundlicher leerer Zustand mit konkreten Vorschlägen (Radius/Zeitraum erhöhen, Filter zurücksetzen). */
export function EmptyState({ title, text, suggestions }: { title: string; text: ReactNode; suggestions: Suggestion[] }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bfv-50 text-bfv-700">
        <IconBall width={24} height={24} />
      </div>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s, i) => (
            <button key={s.label} type="button" className={i === 0 ? buttonPrimary : buttonSecondary} onClick={s.onClick}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

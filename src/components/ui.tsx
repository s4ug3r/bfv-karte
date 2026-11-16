/**
 * Kleine, wiederverwendbare UI-Bausteine und Icons (inline SVG, keine Icon-Bibliothek nötig).
 */
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconPin = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconLocate = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
);
export const IconRoute = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>
);
export const IconMap = (p: IconProps) => (
  <svg {...base(p)}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const IconList = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
export const IconSplit = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M10 4v16" /></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconFilter = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></svg>
);
export const IconExternal = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
);
export const IconX = (p: IconProps) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconCalendar = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M12 14v4M10 16h4" /></svg>
);
export const IconShare = (p: IconProps) => (
  <svg {...base(p)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IconSliders = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);
export const IconBall = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10l4-3Z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" /></svg>
);

/** Segmentierte Auswahl (Radiogruppe) – barrierearm mit role="radiogroup". */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  grid = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  /** Auf schmalen Bildschirmen 2 × 2 statt einer Zeile (für 4 Optionen mit Zählern). */
  grid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`w-full gap-1 rounded-xl bg-slate-100 p-1 ${grid ? 'grid grid-cols-2 sm:flex' : 'flex'}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition
              ${size === 'sm' ? 'min-h-9 px-1.5 py-1.5 text-xs sm:px-2' : 'min-h-10 px-3 py-2 text-sm'}
              ${active ? 'bg-white text-bfv-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
    </label>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Lädt"
    />
  );
}

/* text-base auf dem Handy: iOS zoomt sonst beim Antippen in Felder unter 16 px hinein. */
export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-bfv-600 focus:outline-none focus:ring-2 focus:ring-bfv-600/20';

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-bfv-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-bfv-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-bfv-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bfv-600 disabled:cursor-not-allowed disabled:opacity-50';

/** Hauptaktion einer Seite – groß, in BFV-Blau. */
export const buttonHighlight =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-bfv-700 px-4 py-3 font-display text-lg font-semibold tracking-wide text-white shadow-sm transition hover:bg-bfv-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-bfv-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

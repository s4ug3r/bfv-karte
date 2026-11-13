import { IconBall } from '../ui';

/**
 * Kopfzeile in BFV-Blau mit dem bayerischen Rautenmuster (Hellblau wie im BFV-Logo).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 shrink-0 overflow-hidden bg-gradient-to-r from-bfv-800 via-bfv-700 to-bfv-700 pt-[env(safe-area-inset-top)] text-white shadow-md shadow-bfv-950/10 lg:relative lg:shadow-none">
      {/* Rautenmuster, zum rechten Rand hin auslaufend – rein dekorativ */}
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 text-raute"
        aria-hidden
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="rauten" width="28" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
            <path d="M0 8 L14 0 L28 8 L14 16 Z" fill="currentColor" />
          </pattern>
          <linearGradient id="rauten-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" stopOpacity="0.55" />
          </linearGradient>
          <mask id="rauten-mask">
            <rect width="100%" height="100%" fill="url(#rauten-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#rauten)" mask="url(#rauten-mask)" />
      </svg>
      <div className="relative flex h-14 items-center gap-2.5 px-4 sm:h-16 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25 sm:h-9 sm:w-9">
          <IconBall width={20} height={20} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] font-bold leading-none tracking-wide sm:text-[28px]">
            BFV Spiele in der Nähe
          </h1>
          <p className="mt-0.5 hidden text-xs text-white/75 sm:block">Wer heute in deiner Gegend spielt</p>
        </div>
      </div>
    </header>
  );
}

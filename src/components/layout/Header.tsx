import { IconBall } from '../ui';

/**
 * Kopfzeile in BFV-Blau mit dem bayerischen Rautenmuster (Hellblau wie im BFV-Logo).
 */
export function Header() {
  return (
    <header className="relative z-20 shadow-md shrink-0 overflow-hidden bg-bfv-700 text-white">
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
      <div className="relative flex flex-col gap-1 px-[max(1rem,env(safe-area-inset-left))] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-row sm:items-baseline sm:gap-3 sm:px-5 sm:pb-4 sm:pt-4">
        <h1 className="flex items-center gap-2 font-display text-[22px] font-bold leading-none tracking-wide min-[360px]:text-[26px] sm:text-3xl">
          <IconBall width={24} height={24} className="shrink-0 text-white/90" />
          BFV Spiele in der Nähe
        </h1>
        <p className="text-[13px] text-white/75 sm:text-sm sm:text-white/80">Wer heute in deiner Gegend spielt</p>
      </div>
    </header>
  );
}

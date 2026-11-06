/**
 * Kopfzeile in BFV-Blau mit dem bayerischen Rautenmuster (Hellblau wie im BFV-Logo).
 */
export function Header() {
  return (
    <header className="relative z-20 shrink-0 overflow-hidden bg-bfv-700 text-white">
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
      <div className="relative flex items-baseline gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <h1 className="font-display text-[26px] font-bold leading-none tracking-wide sm:text-3xl">
          BFV Spiele in der Nähe
        </h1>
        <p className="hidden text-sm text-white/80 sm:block">Wer heute in deiner Gegend spielt</p>
      </div>
    </header>
  );
}

/**
 * Kopfzeile: Rasengrün mit Kreidelinien (Mittelkreis und Mittellinie) als Erkennungszeichen.
 */
export function Header() {
  return (
    <header className="relative z-20 shrink-0 overflow-hidden bg-bfv-950 text-white">
      {/* Kreidelinien des Spielfelds, rein dekorativ */}
      <svg
        className="pointer-events-none absolute -right-10 top-1/2 h-[180%] -translate-y-1/2 text-white/12 sm:right-8"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-hidden
      >
        <circle cx="100" cy="100" r="62" />
        <circle cx="100" cy="100" r="4" fill="currentColor" />
        <line x1="100" y1="-20" x2="100" y2="220" />
      </svg>
      <div className="relative flex items-baseline gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <h1 className="font-display text-[26px] font-bold leading-none tracking-wide sm:text-3xl">
          BFV Spiele in der Nähe
        </h1>
        <p className="hidden text-sm text-bfv-100/75 sm:block">Wer heute in deiner Gegend spielt</p>
      </div>
      <div className="h-1 bg-gradient-to-r from-flutlicht via-flutlicht to-transparent" aria-hidden />
    </header>
  );
}

import { IconBall } from '../ui';

export function Header({ isDemo }: { isDemo: boolean }) {
  return (
    <header className="z-20 shrink-0 bg-gradient-to-r from-bfv-950 via-bfv-900 to-bfv-800 text-white shadow-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <IconBall width={22} height={22} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">BFV Spiele in der Nähe</h1>
          <p className="truncate text-xs text-bfv-100/80">Amateurfußball in Bayern – Herren & Jugend auf einen Blick</p>
        </div>
        {isDemo && (
          <span
            className="ml-auto shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950"
            title="Es werden fiktive Demodaten angezeigt – keine echten Ansetzungen."
          >
            Demo
          </span>
        )}
      </div>
    </header>
  );
}

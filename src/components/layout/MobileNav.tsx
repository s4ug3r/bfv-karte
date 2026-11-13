import type { ReactNode } from 'react';
import { IconList, IconMap, IconSliders } from '../ui';

export type MobileTab = 'liste' | 'karte';

interface Props {
  tab: MobileTab;
  count: number;
  loading: boolean;
  filterCount: number;
  filtersOpen: boolean;
  onTabChange: (t: MobileTab) => void;
  onFilters: () => void;
}

/**
 * Untere Navigationsleiste fürs Handy (wie in einer App): Liste, Karte und Filter
 * sind immer mit dem Daumen erreichbar. Ab Desktop-Breite ausgeblendet.
 */
export function MobileNav({ tab, count, loading, filterCount, filtersOpen, onTabChange, onFilters }: Props) {
  return (
    <nav
      aria-label="Ansicht"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(8_33_74/0.08)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3 px-2">
        <NavButton active={tab === 'liste' && !filtersOpen} onClick={() => onTabChange('liste')} label="Liste">
          <IconList width={22} height={22} />
          {!loading && (
            <Badge className="bg-bfv-700 text-white">{count > 99 ? '99+' : count}</Badge>
          )}
        </NavButton>
        <NavButton active={tab === 'karte'} onClick={() => onTabChange('karte')} label="Karte">
          <IconMap width={22} height={22} />
        </NavButton>
        <NavButton active={tab === 'liste' && filtersOpen} onClick={onFilters} label="Filter">
          <IconSliders width={22} height={22} />
          {filterCount > 0 && <Badge className="bg-raute text-white">{filterCount}</Badge>}
        </NavButton>
      </div>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
        active ? 'text-bfv-700' : 'text-slate-500 active:text-slate-800'
      }`}
    >
      <span
        className={`relative flex h-8 w-14 items-center justify-center rounded-full transition ${
          active ? 'bg-bfv-100' : ''
        }`}
      >
        {children}
      </span>
      {label}
    </button>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`absolute -top-1 right-0.5 min-w-[1.25rem] rounded-full px-1 text-center text-[10px] leading-[1.25rem] tabular-nums ring-2 ring-white ${className}`}
    >
      {children}
    </span>
  );
}

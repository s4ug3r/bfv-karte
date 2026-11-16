import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react';
import { IconX } from '../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Für Screenreader, wenn der sichtbare Titel kein reiner Text ist */
  ariaLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Ausklappbare Ansicht: am Handy von unten (Bottom Sheet), am Desktop als Seitenpanel rechts.
 * Baut auf <dialog> auf – Fokus bleibt im Dialog, Escape schließt, Hintergrund ist gesperrt.
 */
export function Sheet({ open, onClose, title, ariaLabel, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);

  // Am Handy: Kopfbereich nach unten ziehen schließt (wie bei App-Sheets)
  const onTouchStart = (e: TouchEvent) => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    drag.current = { startY: e.touches[0].clientY, dy: 0 };
    if (ref.current) ref.current.style.transition = 'none';
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.startY);
    ref.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    const el = ref.current;
    if (!d || !el) return;
    el.style.transition = 'transform 0.2s ease-out';
    if (d.dy > 90) {
      el.style.transform = 'translateY(100%)';
      window.setTimeout(onClose, 150);
    } else {
      el.style.transform = '';
    }
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.style.transform = '';
      d.style.transition = '';
      d.showModal();
      d.querySelector<HTMLElement>('[data-sheet-body]')?.scrollTo(0, 0);
    }
    if (!open && d.open) d.close();
    // Seite dahinter nicht mitscrollen (iOS)
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={ariaLabel}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Klick auf den abgedunkelten Hintergrund schließt
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="sheet m-0 mt-auto max-h-[90dvh] open:flex w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-kreide p-0 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]
        lg:mt-0 lg:ml-auto lg:h-dvh lg:max-h-dvh lg:w-[480px] lg:rounded-none lg:rounded-l-3xl"
    >
      {open && (
        <>
          <div
            className="relative shrink-0 touch-none border-b border-slate-200 bg-white px-4 pb-3 pt-2 lg:touch-auto lg:pt-4"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 lg:hidden" aria-hidden />
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 font-display text-xl font-semibold text-bfv-900">{title}</div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                aria-label="Schließen"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
          </div>
          <div
            data-sheet-body
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 ${
              footer ? 'pb-4' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
            }`}
          >
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

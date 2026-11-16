import { useEffect, useState } from 'react';

/** Aktuelle Uhrzeit, alle `intervalMs` neu – für "in 25 Min." und "läuft". */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

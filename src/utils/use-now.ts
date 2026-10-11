import { useEffect, useState } from 'react';
import { usePlatform } from '../app/providers/PlatformProvider';
import { useDocumentVisible } from './use-document-visible';

/** Re-renders every `intervalMs` with the TimeController's current observation time. */
export function useNow(intervalMs = 1000, enabled = true): Date {
  const { time } = usePlatform();
  const visible = useDocumentVisible();
  const [now, setNow] = useState(() => time.now());
  useEffect(() => {
    if (!enabled || !visible) return;
    setNow(time.now());
    const id = setInterval(() => setNow(time.now()), intervalMs);
    const off = time.subscribe((d) => setNow(d));
    return () => {
      clearInterval(id);
      off();
    };
  }, [intervalMs, enabled, visible, time]);
  return now;
}

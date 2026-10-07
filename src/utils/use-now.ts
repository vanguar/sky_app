import { useEffect, useState } from 'react';
import { timeController } from '../astronomy/time-controller';

/** Re-renders every `intervalMs` with the TimeController's current observation time. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => timeController.now());
  useEffect(() => {
    const id = setInterval(() => setNow(timeController.now()), intervalMs);
    const off = timeController.subscribe((d) => setNow(d));
    return () => {
      clearInterval(id);
      off();
    };
  }, [intervalMs]);
  return now;
}

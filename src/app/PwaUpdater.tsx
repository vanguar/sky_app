import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useUiStore } from '../store/ui-store';

/** Registers the service worker and surfaces "offline ready" / "update available" toasts. */
export function PwaUpdater() {
  const pushToast = useUiStore((s) => s.pushToast);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('[AstroPoint] service worker registration failed', error);
    },
  });

  useEffect(() => {
    if (offlineReady) pushToast({ messageKey: 'pwa.offlineReady', tone: 'info', durationMs: 4000 });
  }, [offlineReady, pushToast]);

  useEffect(() => {
    if (needRefresh)
      pushToast({
        messageKey: 'pwa.updateAvailable',
        tone: 'info',
        durationMs: 0,
        action: { labelKey: 'pwa.update', run: () => void updateServiceWorker(true) },
      });
  }, [needRefresh, pushToast, updateServiceWorker]);

  useEffect(() => {
    const onOffline = () => pushToast({ messageKey: 'pwa.offline', tone: 'info', durationMs: 4000 });
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, [pushToast]);

  return null;
}

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPlatform, type Platform } from './platform';

const PlatformContext = createContext<Platform | null>(null);

export function PlatformProvider({ children, platform }: { children: ReactNode; platform?: Platform }) {
  const [value] = useState<Platform>(() => platform ?? createPlatform());
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlatform(): Platform {
  const p = useContext(PlatformContext);
  if (!p) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return p;
}

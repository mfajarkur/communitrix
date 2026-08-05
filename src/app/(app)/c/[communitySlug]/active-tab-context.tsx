'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type CommunityTab = 'home' | 'sessions' | 'members' | 'leaderboard';

const ActiveTabContext = createContext<{
  activeTab: CommunityTab;
  setActiveTab: (tab: CommunityTab) => void;
} | null>(null);

// Lives in layout.tsx so it survives community switches (the nav and this provider never
// unmount — only `page.tsx`'s content underneath does), letting the nav's section tabs
// (community-nav.tsx) and the page content (community-tabs.tsx) share one activeTab even
// though they're now siblings under the layout instead of one component.
export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabState] = useState<CommunityTab>('home');
  const pathname = usePathname();

  // Re-reads ?tab= (or defaults to home) whenever the pathname changes — i.e. every time we
  // land on a (possibly different) community, mirroring what used to run once per full page
  // load before the nav became persistent across client-side community switches.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['home', 'sessions', 'members', 'leaderboard', 'dashboard'].includes(tab)) {
      setActiveTabState(tab === 'dashboard' ? 'home' : (tab as CommunityTab));
    } else {
      setActiveTabState('home');
    }
  }, [pathname]);

  const setActiveTab = (tab: CommunityTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  return <ActiveTabContext.Provider value={{ activeTab, setActiveTab }}>{children}</ActiveTabContext.Provider>;
}

export function useActiveTab() {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) throw new Error('useActiveTab must be used within ActiveTabProvider');
  return ctx;
}

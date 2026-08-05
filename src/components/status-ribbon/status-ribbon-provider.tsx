'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import StatusRibbon from './status-ribbon';

type StatusEntry = { id: string; message: string };

type StatusRibbonContextValue = {
  /** Pushes a busy message onto the ribbon; returns the id to pass to clearStatus later. */
  showStatus: (message: string, id?: string) => string;
  clearStatus: (id: string) => void;
  /** Read by StatusRibbonBar — exposed on the same context so that component can live inside
   * the app shell's own flex layout (see status-ribbon-provider's render) instead of needing
   * StatusRibbonProvider to render the bar itself, which would force it outside that layout. */
  progress: number;
  visible: boolean;
  message: string;
};

const StatusRibbonContext = createContext<StatusRibbonContextValue | null>(null);

// Degrades to a no-op outside a StatusRibbonProvider (e.g. the public /quick-match sandbox,
// which renders WizardForm — the same component the authenticated app uses — under its own
// standalone layout with no provider) rather than throwing, so shared components don't need to
// special-case which host page they're rendered in.
export function useStatusRibbon(): StatusRibbonContextValue {
  const ctx = useContext(StatusRibbonContext);
  if (!ctx) {
    return { showStatus: () => '', clearStatus: () => {}, progress: 0, visible: false, message: '' };
  }
  return ctx;
}

// Renders the actual ribbon bar — pulled out of StatusRibbonProvider so it can be placed
// wherever the app shell's layout needs it (as a normal flex child, sized into the shell's own
// h-dvh math) instead of as a sibling of the whole shell, which used to add its height on top
// of a full viewport-height shell and get scrolled out of view. Always renders, everywhere in
// the authenticated app — including /communities, which IS the post-login landing page (an
// earlier attempt to special-case "the homepage" hid it there specifically, which turned out to
// be exactly wrong).
export function StatusRibbonBar() {
  const { progress, visible, message } = useStatusRibbon();
  return <StatusRibbon progress={visible ? progress : 0} message={message} />;
}

const NAV_ID = '__nav__';
let autoIdCounter = 0;

// Route-navigation detection, moved verbatim from the old navigation-loader.tsx.
// useSearchParams requires its own Suspense boundary, so this stays a small,
// isolated component instead of living directly in the provider (which wraps
// {children} and must never itself suspend).
function NavDetector({
  showStatus,
  clearStatus,
}: {
  showStatus: (message: string, id?: string) => string;
  clearStatus: (id: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    clearStatus(NAV_ID);
  }, [pathname, searchParams, clearStatus]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      const targetAttr = anchor.getAttribute('target');
      const isExternal = targetAttr === '_blank' || href?.startsWith('http://') || href?.startsWith('https://');
      if (href && !isExternal && !href.startsWith('#')) {
        const currentPath = window.location.pathname + window.location.search;
        if (href !== currentPath) {
          showStatus('Loading page…', NAV_ID);
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [showStatus]);

  return null;
}

export function StatusRibbonProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<StatusEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy = entries.length > 0;
  const message = entries.length > 0 ? entries[entries.length - 1].message : '';

  const showStatus = useCallback((msg: string, id?: string) => {
    const entryId = id ?? `auto-${++autoIdCounter}`;
    setEntries((prev) => [...prev.filter((e) => e.id !== entryId), { id: entryId, message: msg }]);
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
    setVisible(true);
    return entryId;
  }, []);

  const clearStatus = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Climb toward 90% while any busy entry is active; once the last one
  // clears, snap to 100% then fade back to idle — same feel as the ribbon's
  // predecessor, now driven by any caller instead of only route navigation.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isBusy) {
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 12));
      }, 150);
    } else if (visible) {
      setProgress(100);
      fadeTimer.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }
    return () => clearInterval(interval);
  }, [isBusy, visible]);

  return (
    <StatusRibbonContext.Provider value={{ showStatus, clearStatus, progress, visible, message }}>
      <Suspense fallback={null}>
        <NavDetector showStatus={showStatus} clearStatus={clearStatus} />
      </Suspense>
      {children}
    </StatusRibbonContext.Provider>
  );
}

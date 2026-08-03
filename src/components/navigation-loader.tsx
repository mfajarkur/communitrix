'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function NavigationLoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset navigation indicator whenever route changes
  useEffect(() => {
    setIsNavigating(false);
    setProgress(100);
    const timer = setTimeout(() => setProgress(0), 350);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Intercept click events on links & back buttons globally
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest link or button
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        const targetAttr = anchor.getAttribute('target');
        const isExternal = targetAttr === '_blank' || href?.startsWith('http://') || href?.startsWith('https://');

        if (href && !isExternal && !href.startsWith('#')) {
          const currentPath = window.location.pathname + window.location.search;
          if (href !== currentPath) {
            setIsNavigating(true);
            setProgress(35);
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  // Smoothly increment progress bar while loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isNavigating) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 12;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isNavigating]);

  if (!isNavigating && progress === 0) return null;

  return (
    <>
      {/* Top Glowing Orange Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[99999] h-1 bg-zinc-900/30 overflow-hidden pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 transition-all duration-300 ease-out shadow-[0_0_12px_#f97316]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Floating Center Loading Badge */}
      {isNavigating && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none animate-fade-in-up">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/95 text-white border border-orange-500/40 shadow-2xl backdrop-blur-md text-xs font-bold tracking-wide">
            <Loader2 className="h-3.5 w-3.5 text-orange-500 animate-spin" />
            <span>Memuat halaman...</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function NavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderContent />
    </Suspense>
  );
}

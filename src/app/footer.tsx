'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const isDarkPage =
    pathname === '/' ||
    pathname === '/quick-match' ||
    pathname === '/login' ||
    pathname === '/signup';

  return (
    <footer
      className={`w-full py-4 px-4 text-center text-xs font-medium transition-colors select-none shrink-0 z-30 pointer-events-auto ${
        isDarkPage
          ? 'text-white drop-shadow-md font-sans'
          : 'text-zinc-500 hover:text-zinc-800 font-sans'
      }`}
    >
      <div className="flex items-center justify-center gap-2.5">
        <a
          href="https://instagram.com/communitrix.id"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-400 hover:underline transition-colors font-bold"
        >
          Contact Us
        </a>
        <span className="opacity-60">•</span>
        <span className="opacity-90">Version 1.0 © 2026 Communitrix</span>
      </div>
    </footer>
  );
}

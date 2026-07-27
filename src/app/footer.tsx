'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const isDarkPage = pathname === '/' || pathname === '/quick-match' || pathname === '/login' || pathname === '/signup';

  return (
    <footer
      className={`w-full py-4 px-4 text-center text-[10px] sm:text-[11px] font-light transition-colors select-none shrink-0 z-20 ${
        isDarkPage ? 'text-white/60 hover:text-white font-sans' : 'text-zinc-400 hover:text-zinc-600 font-sans'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <a
          href="https://instagram.com/communitrix.id"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-400 hover:underline transition-colors"
        >
          Contact Us
        </a>
        <span>•</span>
        <span>Version 1.0 © 2026 Communitrix</span>
      </div>
    </footer>
  );
}

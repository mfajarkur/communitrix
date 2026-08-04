'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, UsersRound, CalendarClock } from 'lucide-react';

const TABS = [
  { href: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
  {
    href: '/communities',
    label: 'Community',
    icon: UsersRound,
    // Stays highlighted while inside a specific community too, so the nav
    // keeps reinforcing "you're still in the Community space".
    match: (p: string) => p.startsWith('/communities') || p.startsWith('/c/'),
  },
  { href: '/activities', label: 'Activities', icon: CalendarClock, match: (p: string) => p.startsWith('/activities') },
];

// Fixed to the viewport (not a flex child of the scrollable shell) so it can never drift or
// visibly shift mid-scroll on mobile browsers, regardless of viewport-height quirks in the
// layout around it. (app)/layout.tsx reserves matching bottom clearance so page content never
// sits underneath it.
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-2 select-none"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-sm mx-auto flex items-center gap-1 rounded-[28px] bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-1.5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 rounded-3xl transition-all cursor-pointer"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  active ? 'bg-orange-500 shadow-lg shadow-orange-500/40 scale-105' : ''
                }`}
              >
                <Icon className={`h-[18px] w-[18px] transition-colors ${active ? 'text-white' : 'text-zinc-500'}`} />
              </span>
              <span
                className={`text-[10px] mt-1 tracking-tight transition-colors ${
                  active ? 'text-orange-400 font-extrabold' : 'text-zinc-500 font-medium'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

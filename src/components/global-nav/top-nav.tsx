'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, UsersRound, CalendarClock } from 'lucide-react';

const TABS = [
  { href: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
  {
    // Jumps straight into a community (the /c redirect route resolves to whichever one the user
    // looked at last) instead of always landing on the /communities list first — the list is
    // still reachable from the "+" chip in the in-community switcher, or by tapping this same
    // tab again once already inside a community.
    href: '/c',
    label: 'Community',
    icon: UsersRound,
    match: (p: string) => p === '/c' || p.startsWith('/c/') || p.startsWith('/communities'),
  },
  { href: '/activities', label: 'Activities', icon: CalendarClock, match: (p: string) => p.startsWith('/activities') },
];

// Top-level app nav — a normal (non-fixed) flex child in (app)/layout.tsx, stacked directly
// under the status ribbon, so together they read as one clear hierarchy: transient status on
// top, persistent "where in the app am I" nav right below it, then whatever sub-navigation the
// active section has (e.g. community-tabs.tsx's Home/Sessions/Members/Rank strip), then content.
// Being a normal flex sibling rather than position:fixed is deliberate — the same fix already
// applied to the status ribbon (see status-ribbon-provider.tsx's own comment): a fixed nav sized
// on top of an already-viewport-height shell adds its own height on top of the viewport and lets
// scroll-chaining carry it off-screen, which is exactly the bug this avoids by construction.
export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 bg-zinc-950 border-b border-zinc-900 px-2 select-none"
      style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                active ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

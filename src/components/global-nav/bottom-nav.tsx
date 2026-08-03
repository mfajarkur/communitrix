'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Users, Activity } from 'lucide-react';

const TABS = [
  { href: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
  {
    href: '/communities',
    label: 'Community',
    icon: Users,
    // Stays highlighted while inside a specific community too, so the nav
    // keeps reinforcing "you're still in the Community space".
    match: (p: string) => p.startsWith('/communities') || p.startsWith('/c/'),
  },
  { href: '/activities', label: 'Activities', icon: Activity, match: (p: string) => p.startsWith('/activities') },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 z-40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-t border-zinc-800/80 backdrop-blur-xl shadow-2xl px-4 py-2.5 select-none">
      <div className="max-w-2xl mx-auto flex items-center justify-around">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center py-2 rounded-2xl transition-all cursor-pointer relative ${
                active ? 'text-orange-500 font-extrabold' : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              {active && (
                <span className="absolute -top-2 h-1 w-8 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
              )}
              <Icon className={`h-7 w-7 ${active ? 'text-orange-500 scale-110' : ''} transition-transform`} />
              <span className="text-[10px] mt-1.5 tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

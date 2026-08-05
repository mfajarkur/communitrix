'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Zap } from 'lucide-react';

const SUB_TABS = [
  { href: '/activities/sessions', label: 'My Session', Icon: Calendar },
  { href: '/activities/quick-match', label: 'Quick Match', Icon: Zap },
];

// Same shape/style as the community nav's section tabs (community-nav.tsx's "child" row) —
// standardized so every section of the app that has sub-navigation reads the same way: a
// rounded-2xl gradient card holding icon-over-label tabs.
export default function ActivitiesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 via-orange-50/40 to-white border border-orange-100/70 shadow-sm overflow-hidden p-2">
        <div className="flex items-center gap-1 bg-white/70 rounded-xl p-1">
          {SUB_TABS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all cursor-pointer ${
                  active ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'scale-105' : ''} transition-transform`} />
                <span className={`text-[9px] mt-1 tracking-tight ${active ? 'font-extrabold' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}

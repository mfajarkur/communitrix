'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SUB_TABS = [
  { href: '/activities/sessions', label: 'My Session' },
  { href: '/activities/quick-match', label: 'Quick Match' },
];

export default function ActivitiesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full border border-zinc-200/60 w-fit">
        {SUB_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                active ? 'bg-orange-500 text-white shadow-xs font-black' : 'text-zinc-500 hover:text-orange-600'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

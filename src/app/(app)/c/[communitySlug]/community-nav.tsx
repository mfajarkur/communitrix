'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, Trophy, Plus, Shield, User } from 'lucide-react';
import { useActiveTab } from './active-tab-context';
import AddCommunityModal from './add-community-modal';

interface CommunityNavProps {
  communitySlug: string;
  communityName: string;
  bannerImage: string;
  role: 'ADMIN' | 'HOST' | 'MEMBER';
  myCommunities: { id: string; name: string; slug: string; logo_url: string | null }[];
}

// Rendered by layout.tsx, a sibling of {children} (page.tsx) rather than a piece of it — so it
// never unmounts on community switches or any other loading state under this route. Only the
// content below it (page.tsx, wrapped in Suspense via loading.tsx) shows a loading skeleton;
// this shape stays put and simply relabels itself once the new community's data resolves,
// mirroring how the main top nav (Profile/Community/Activities) never disappears either.
//
// layout.tsx wraps every nested route under /c/[communitySlug] too (sessions, players, etc.),
// which have their own dedicated headers — this only ever belonged to the dashboard root, so it
// renders nothing anywhere else.
export default function CommunityNav({ communitySlug, communityName, bannerImage, role, myCommunities }: CommunityNavProps) {
  const { activeTab, setActiveTab } = useActiveTab();
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);

  if (pathname !== `/c/${communitySlug}`) return null;

  return (
    <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 pt-2 pb-3 bg-white/95 backdrop-blur-sm border-b border-zinc-100 mb-4">
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 via-orange-50/40 to-white border border-orange-100/70 shadow-sm overflow-hidden">
        {/* Parent: community switcher */}
        <div className="overflow-x-auto scrollbar-thin p-2">
          <div className="flex items-center gap-2 w-max">
            <div className="shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white shadow-sm border border-orange-200">
              <img
                src={bannerImage}
                alt=""
                className="h-9 w-9 rounded-lg object-cover shrink-0 ring-2 ring-orange-100"
              />
              <div className="min-w-0">
                <p className="text-sm font-black tracking-tight text-zinc-900 truncate max-w-[140px]">{communityName}</p>
                <span className={`inline-flex items-center gap-1 text-[8px] font-black tracking-wider uppercase ${
                  role === 'ADMIN' ? 'text-orange-600' : role === 'HOST' ? 'text-orange-500' : 'text-zinc-500'
                }`}>
                  {role === 'ADMIN' ? <Shield className="h-2 w-2" /> : <User className="h-2 w-2" />}
                  {role}
                </span>
              </div>
            </div>

            {myCommunities
              .filter((c) => c.slug !== communitySlug)
              .map((c) => (
                <Link key={c.id} href={`/c/${c.slug}`} title={c.name} className="shrink-0">
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={c.name}
                      className="h-9 w-9 rounded-full object-cover border-2 border-white shadow-sm hover:border-orange-300 hover:scale-105 transition-all"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-[11px] uppercase border-2 border-white shadow-sm hover:border-orange-300 hover:scale-105 transition-all">
                      {c.name.slice(0, 2)}
                    </div>
                  )}
                </Link>
              ))}

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              title="Add a Community"
              className="shrink-0 h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-orange-600 border-2 border-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Child: section tabs — same shape, directly beneath, only a thin divider between
            them so the pair reads as one parent/child unit instead of two controls. */}
        <div className="border-t border-orange-100/70 p-2">
          <div className="flex items-center gap-1 bg-white/70 rounded-xl p-1">
            {([
              { tab: 'home' as const, label: 'Home', Icon: Home },
              { tab: 'sessions' as const, label: 'Sessions', Icon: Calendar },
              { tab: 'members' as const, label: 'Members', Icon: Users },
              { tab: 'leaderboard' as const, label: 'Rank', Icon: Trophy },
            ]).map(({ tab, label, Icon }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${activeTab === tab ? 'scale-105' : ''} transition-transform`} />
                <span className={`text-[9px] mt-1 tracking-tight ${activeTab === tab ? 'font-extrabold' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <AddCommunityModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, Trophy } from 'lucide-react';
import { useActiveTab } from './active-tab-context';
import CommunityCarousel from './community-carousel';

interface CommunityNavProps {
  communitySlug: string;
  role: 'ADMIN' | 'HOST' | 'MEMBER';
  myCommunities: { id: string; name: string; slug: string; logo_url: string | null; avatar_url: string | null; invite_token: string }[];
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
export default function CommunityNav({ communitySlug, role, myCommunities }: CommunityNavProps) {
  const { activeTab, setActiveTab } = useActiveTab();
  const pathname = usePathname();

  if (pathname !== `/c/${communitySlug}`) return null;

  return (
    <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 pt-2 pb-3 bg-white/95 backdrop-blur-sm border-b border-zinc-100 mb-4 space-y-2">
      {/* Parent: the current community's identity card — banner, profile picture, name, role
          (community-carousel.tsx). The "Switch" button opens a popup to jump directly to any
          other community (community-switcher-modal.tsx). */}
      <CommunityCarousel myCommunities={myCommunities} currentSlug={communitySlug} role={role} />

      {/* Child: section tabs — a separate, lighter pill bar directly beneath, not sharing the
          carousel's border (that suited the old compact chip row, not this richer banner card). */}
      <div className="rounded-xl bg-zinc-100 p-1">
        <div className="flex items-center gap-1">
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
  );
}

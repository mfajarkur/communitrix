'use client';

import { useState } from 'react';
import { Users, Shield, User } from 'lucide-react';
import CommunitySwitcherModal from './community-switcher-modal';

type CommunityItem = { id: string; name: string; slug: string; logo_url: string | null };

// The community identity card: banner, name, role — same "badge" look as before. Switching to
// another community is one button ("Switch Community") instead of stepping through arrows one
// at a time — it opens a grid of every other community (community-switcher-modal.tsx) to jump
// straight to the target, plus the existing Create/Find flow for adding another.
export default function CommunityCarousel({
  myCommunities,
  currentSlug,
  role,
}: {
  myCommunities: CommunityItem[];
  currentSlug: string;
  role: 'ADMIN' | 'HOST' | 'MEMBER';
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const current = myCommunities.find((c) => c.slug === currentSlug) || myCommunities[0];
  const bannerImage = current?.logo_url || '/community_banner_placeholder.png';

  if (!current) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl h-36 sm:h-40 bg-zinc-950 shadow-sm border border-zinc-100">
      <img
        src={bannerImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-orange-600/95 via-orange-600/25 to-transparent" />

      {/* Same semi-transparent overlay-button pattern as the Home tab's banner
          (BannerImageEditor/EditCommunityInfoButton). */}
      <button
        type="button"
        onClick={() => setSwitcherOpen(true)}
        title="Switch Community"
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer text-[11px] font-bold"
      >
        <Users className="h-3.5 w-3.5" />
        Switch
      </button>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-base font-black text-white tracking-tight drop-shadow-sm truncate">{current.name}</p>
        <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase mt-0.5 ${
          role === 'ADMIN' ? 'text-orange-200' : role === 'HOST' ? 'text-orange-100' : 'text-white/80'
        }`}>
          {role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
          {role}
        </span>
      </div>

      <CommunitySwitcherModal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        myCommunities={myCommunities}
        currentSlug={currentSlug}
      />
    </div>
  );
}

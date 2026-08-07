'use client';

import { useState } from 'react';
import { Users, Shield, User, Share2, Check, Calendar, Flame } from 'lucide-react';
import CommunitySwitcherModal from './community-switcher-modal';
import AvatarImageEditor from './avatar-image-editor';
import BannerImageEditor from './banner-image-editor';
import { useActiveTab } from './active-tab-context';

type CommunityItem = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  avatar_url: string | null;
  invite_token: string;
};

// The community identity card: banner, profile picture, name, role. Switching to another
// community is one button ("Switch Community") instead of stepping through arrows one at a
// time — it opens a grid of every other community (community-switcher-modal.tsx) to jump
// straight to the target, plus the existing Create/Find flow for adding another.
export default function CommunityCarousel({
  myCommunities,
  currentSlug,
  role,
}: {
  myCommunities: CommunityItem[];
  currentSlug: string;
  role: 'ADMIN' | 'MEMBER';
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const { stats } = useActiveTab();

  const current = myCommunities.find((c) => c.slug === currentSlug) || myCommunities[0];
  const bannerImage = current?.logo_url || '/community_banner_placeholder.png';

  // Any member can share — the invite link only ever lets someone request to join (still subject
  // to admin approval if the community requires it), same trust level as regenerating it is the
  // one invite-link action still admin-only (edit-community-info-button.tsx). Uses the native
  // share sheet where available (mobile), falling back to a clipboard copy + brief confirmation.
  const handleShare = async () => {
    if (!current) return;
    const inviteLink = `${window.location.origin}/join/${current.invite_token}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: current.name, text: `Join ${current.name} on Communitrix`, url: inviteLink });
      } catch {
        // User cancelled the share sheet — not an error, nothing to do.
      }
      return;
    }

    await navigator.clipboard.writeText(inviteLink);
    setJustShared(true);
    setTimeout(() => setJustShared(false), 2000);
  };

  if (!current) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl h-36 sm:h-40 bg-zinc-950 shadow-sm border border-zinc-100">
      <img
        src={bannerImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-orange-600/95 via-orange-600/25 to-transparent" />

      {/* Top-right button row: banner edit (admin-only), share (everyone), switch (everyone) —
          same semi-transparent overlay-button pattern throughout. */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        {role === 'ADMIN' && <BannerImageEditor communityId={current.id} communitySlug={current.slug} />}
        <button
          type="button"
          onClick={handleShare}
          title="Share invite link"
          className="relative h-8 w-8 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer flex items-center justify-center"
        >
          {justShared ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
          {justShared && (
            <span className="absolute top-full right-0 mt-1 whitespace-nowrap text-[10px] font-bold bg-zinc-900 text-white px-2 py-1 rounded-lg shadow-lg">
              Link copied!
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          title="Switch Community"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer text-[11px] font-bold"
        >
          <Users className="h-3.5 w-3.5" />
          Switch
        </button>
      </div>

      {/* Bottom-left: circular profile picture (proportional to the card, ~1/3 of its height)
          next to the name/role — the two used to be siblings of an absolutely-positioned text
          block alone; now a flex row so the avatar sits directly beside the name instead of
          needing its own separate positioning. */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex items-end gap-3">
        <AvatarImageEditor
          communityId={current.id}
          communitySlug={current.slug}
          avatarUrl={current.avatar_url}
          name={current.name}
          isAdmin={role === 'ADMIN'}
        />
        <div className="min-w-0 pb-0.5">
          <p className="text-base font-black text-white tracking-tight drop-shadow-sm truncate">{current.name}</p>
          <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase mt-0.5 ${
            role === 'ADMIN' ? 'text-orange-200' : 'text-white/80'
          }`}>
            {role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {role}
          </span>
        </div>
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

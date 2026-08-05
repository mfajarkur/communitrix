import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users, ShieldQuestion } from 'lucide-react';
import JoinInviteButton from './join-invite-button';

export const dynamic = 'force-dynamic';

// Top-level (not nested under /c/[communitySlug]) because a non-member has to be able to reach
// this page without tripping that layout's membership gate. get_community_by_invite_token
// (migration 0038) is the one place a private community's identity is visible to a non-member —
// the token itself is the authorization, so this works for both public and private communities.
export default async function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_community_by_invite_token', { p_token: token });
  const community = Array.isArray(data) ? data[0] : data;

  if (error || !community) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 bg-white">
        <ShieldQuestion className="h-10 w-10 mx-auto text-zinc-300" />
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Invite link not found</h2>
        <p className="text-xs text-zinc-500 mt-0.5">This invite link is invalid or has expired.</p>
        <Link
          href="/communities"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          Find a Community
        </Link>
      </div>
    );
  }

  const { data: existingMember } = await supabase
    .from('community_members')
    .select('id')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  const bannerImage = community.logo_url || '/community_banner_placeholder.png';

  return (
    <div className="max-w-md mx-auto space-y-6 bg-white">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950 p-6 text-white shadow-sm border border-zinc-100">
        <img
          src={bannerImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40 select-none pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/15 border border-white/10">
            {community.is_public ? 'Public Community' : 'Private Community'}
          </span>
          <h2 className="text-xl font-black tracking-tight">{community.name}</h2>
          {community.description && (
            <p className="text-xs text-white/75 font-medium leading-relaxed">{community.description}</p>
          )}
          <p className="inline-flex items-center gap-1.5 text-[11px] text-white/80 font-semibold pt-1">
            <Users className="h-3.5 w-3.5" />
            {community.member_count} members · {community.default_sport}
          </p>
        </div>
      </div>

      {existingMember ? (
        <div className="text-center space-y-3 py-4">
          <p className="text-sm text-zinc-600 font-semibold">You're already a member of this community.</p>
          <Link
            href={`/c/${community.slug}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            Go to Community
          </Link>
        </div>
      ) : (
        <JoinInviteButton communityId={community.id} communitySlug={community.slug} inviteToken={token} />
      )}
    </div>
  );
}

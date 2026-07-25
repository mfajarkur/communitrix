import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Shield, User, Trophy } from 'lucide-react';

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // Fetch the community details
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  // Fetch current user's membership details
  const { data: member } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', community.id)
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!member) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-6 bg-white">
        <h2 className="text-2xl font-bold text-zinc-900">Access Denied</h2>
        <p className="text-sm text-zinc-500">
          You are not currently a member of this community. To view its dashboard, you need to join using a code.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/communities"
            className="inline-flex justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 shadow-sm"
          >
            My Communities
          </Link>
          <Link
            href="/communities/join"
            className="inline-flex justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 shadow-sm"
          >
            Join with Code
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = member.role === 'ADMIN';

  const bannerImage = community.logo_url || '/community_banner_placeholder.png';

  return (
    <div className="space-y-6 bg-white">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl h-44 bg-zinc-950 flex flex-col justify-end p-5 text-white shadow-sm border border-zinc-100">
        {/* Banner image */}
        <img
          src={bannerImage}
          alt={community.name}
          className="absolute inset-0 w-full h-full object-cover opacity-60 select-none pointer-events-none"
        />
        {/* Orange to transparent gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-600/90 via-orange-600/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-950/40 via-transparent to-transparent" />

        {/* Back Link Overlay */}
        <div className="absolute top-4 left-4">
          <Link
            href="/communities"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-white/95 hover:text-white transition-all bg-black/30 hover:bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-sm shadow-sm"
          >
            ← Back
          </Link>
        </div>

        {/* Header content on top */}
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black leading-tight text-white tracking-tight drop-shadow-sm font-sans">
              {community.name}
            </h1>
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider uppercase border border-white/20 shadow-sm ${
              member.role === 'ADMIN'
                ? 'bg-orange-500 text-white'
                : member.role === 'HOST'
                ? 'bg-white text-orange-600'
                : 'bg-white/80 text-zinc-800'
            }`}>
              {member.role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
              {member.role}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/90 font-medium pt-0.5">
            <p>
              Default Sport: <span className="font-extrabold uppercase">{community.default_sport}</span>
            </p>
            {community.join_code && (
              <p className="bg-white/15 px-2 py-0.5 rounded font-mono text-[9px] tracking-wider uppercase border border-white/10 shadow-sm">
                Code: {community.join_code}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Users(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

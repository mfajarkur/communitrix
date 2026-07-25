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

  return (
    <div className="space-y-8 bg-white">
      {/* Header Info */}
      <div className="flex flex-col gap-3 pb-5 border-b border-zinc-150">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-[#111827] leading-tight">
              {community.name}
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              member.role === 'ADMIN'
                ? 'bg-orange-500/10 text-orange-600'
                : member.role === 'HOST'
                ? 'bg-orange-500/[0.04] text-orange-600/80'
                : 'bg-zinc-100 text-zinc-500'
            }`}>
              {member.role === 'ADMIN' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {member.role}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Default Sport: <span className="font-bold text-zinc-700">{community.default_sport}</span>
          </p>
        </div>

        {/* Community Nav Options */}
        <div className="flex items-center gap-2 py-1">
          <Link
            href={`/c/${communitySlug}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Trophy className="h-3.5 w-3.5 text-orange-500" />
            Community Workspace
          </Link>
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

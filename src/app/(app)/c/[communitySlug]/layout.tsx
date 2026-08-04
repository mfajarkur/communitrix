import { requireProfile } from '@/server/guards';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

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
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Access Denied</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          You are not currently a member of this community. To view its dashboard, you need to join using a code.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/communities"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            My Communities
          </Link>
          <Link
            href="/communities/join"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            Join with Code
          </Link>
        </div>
      </div>
    );
  }

  return <div className="bg-white">{children}</div>;
}

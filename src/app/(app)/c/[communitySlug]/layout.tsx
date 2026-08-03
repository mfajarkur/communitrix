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

  return <div className="bg-white">{children}</div>;
}

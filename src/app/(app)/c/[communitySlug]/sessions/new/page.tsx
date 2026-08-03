import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityHost } from '@/server/guards';
import { notFound } from 'next/navigation';
import WizardForm from './wizard-form';

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ communitySlug: string }>;
}) {
  const { communitySlug } = await params;
  const supabase = await createClient();

  // 1. Fetch community details
  const { data: community, error: cErr } = await supabase
    .from('communities')
    .select('id, name, slug')
    .eq('slug', communitySlug)
    .single();

  if (cErr || !community) {
    notFound();
  }

  // 2. Enforce admin guard and get current profile
  const profile = await requireCommunityHost(community.id);

  // 3. Fetch active community members
  const { data: members, error: mErr } = await supabase
    .from('community_members')
    .select(`
      role,
      profile:profiles (
        id,
        full_name,
        display_name,
        avatar_url,
        is_guest
      )
    `)
    .eq('community_id', community.id)
    .eq('is_active', true);

  if (mErr || !members) {
    throw new Error('Failed to load community members.');
  }

  // Format members list for client component
  const playerList = members.map((m: any) => ({
    id: m.profile.id,
    fullName: m.profile.display_name || m.profile.full_name,
    isGuest: m.profile.is_guest,
    avatarUrl: m.profile.avatar_url,
  })).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 py-8">
      <Link
        href={`/c/${communitySlug}?tab=sessions`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sessions
      </Link>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">New Match Session</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
          Configure matchmaking parameters, select player attendance, and open the courts.
        </p>
      </div>

      <WizardForm
        communityId={community.id}
        communitySlug={community.slug}
        players={playerList}
        currentProfile={{
          id: profile.id,
          name: profile.display_name || profile.full_name,
          avatarUrl: profile.avatar_url,
        }}
      />
    </div>
  );
}

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProfile } from '@/server/guards';
import { getMyQuickMatches } from '@/server/actions/personal-match.actions';
import QuickMatchHistory from './quick-match-history';

export default async function QuickMatchListPage() {
  await requireProfile();
  const matches = await getMyQuickMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#111827]">Quick Matches</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Personal match history, separate from any community.</p>
        </div>
        <Link
          href="/activities/quick-match/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Quick Match
        </Link>
      </div>

      <QuickMatchHistory matches={matches} />
    </div>
  );
}

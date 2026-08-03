'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Compass, Plus } from 'lucide-react';
import type { CommunityUsage } from '@/server/actions/community.actions';
import UpgradeModal from './upgrade-modal';

export function JoinCodeButton({ usage }: { usage: CommunityUsage }) {
  const [upgradeKind, setUpgradeKind] = useState<'joined' | null>(null);
  const atLimit = usage.joined >= 5;

  return (
    <>
      <Link
        href="/communities/join"
        onClick={(e) => {
          if (atLimit) {
            e.preventDefault();
            setUpgradeKind('joined');
          }
        }}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
      >
        <Compass className="h-3.5 w-3.5 text-zinc-400" />
        Join Code
      </Link>
      <UpgradeModal open={upgradeKind !== null} kind={upgradeKind} onClose={() => setUpgradeKind(null)} />
    </>
  );
}

export function NewCommunityFab({ usage }: { usage: CommunityUsage }) {
  const [upgradeKind, setUpgradeKind] = useState<'created' | null>(null);
  const atLimit = usage.created >= 3;

  return (
    <>
      <Link
        href="/communities/new"
        onClick={(e) => {
          if (atLimit) {
            e.preventDefault();
            setUpgradeKind('created');
          }
        }}
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="New Community"
      >
        <Plus className="h-7 w-7" />
      </Link>
      <UpgradeModal open={upgradeKind !== null} kind={upgradeKind} onClose={() => setUpgradeKind(null)} />
    </>
  );
}

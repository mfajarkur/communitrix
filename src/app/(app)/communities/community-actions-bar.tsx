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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
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
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="New Community"
      >
        <Plus className="h-7 w-7" />
      </Link>
      <UpgradeModal open={upgradeKind !== null} kind={upgradeKind} onClose={() => setUpgradeKind(null)} />
    </>
  );
}

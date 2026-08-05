'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Users, ListOrdered } from 'lucide-react';
import { getMyCommunityUsage, type CommunityUsage } from '@/server/actions/community.actions';
import AddCommunityChooser from '@/app/(app)/communities/add-community-chooser';
import ReorderCommunitiesModal from './reorder-communities-modal';

type CommunityItem = { id: string; name: string; slug: string; logo_url: string | null; avatar_url: string | null };

// Replaces the old arrow-by-arrow carousel navigation: one button on the community card opens
// this, showing every OTHER community as a tappable grid (jump straight there, no stepping
// through neighbors one at a time) plus the existing Create/Find flow (AddCommunityChooser,
// unchanged) below it for adding another. Reorder stays reachable from here too instead of a
// separate trigger — opens on top of this modal (same z-index, later in DOM order so it paints
// above; closing it returns to this one, not a hard navigation away).
export default function CommunitySwitcherModal({
  open,
  onClose,
  myCommunities,
  currentSlug,
}: {
  open: boolean;
  onClose: () => void;
  myCommunities: CommunityItem[];
  currentSlug: string;
}) {
  const router = useRouter();
  const [usage, setUsage] = useState<CommunityUsage | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  useEffect(() => {
    if (open) {
      getMyCommunityUsage().then(setUsage);
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const otherCommunities = myCommunities.filter((c) => c.slug !== currentSlug);

  const handleSwitch = (slug: string) => {
    router.push(`/c/${slug}`);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827] animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Switch Community
          </h3>
          <div className="flex items-center gap-1">
            {myCommunities.length > 1 && (
              <button
                onClick={() => setReorderOpen(true)}
                title="Reorder Communities"
                className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {otherCommunities.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {otherCommunities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSwitch(c.slug)}
                className="group flex flex-col items-center gap-1.5 cursor-pointer"
              >
                {c.avatar_url || c.logo_url ? (
                  <img
                    src={c.avatar_url || c.logo_url || ''}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover shadow-sm border border-zinc-100 group-hover:border-orange-300 group-hover:scale-105 transition-all"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm uppercase shadow-sm group-hover:scale-105 transition-all">
                    {c.name.slice(0, 2)}
                  </div>
                )}
                <span className="text-[10px] font-bold text-zinc-700 text-center leading-tight line-clamp-2 w-full">
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-100" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">or add another</span>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>

        {usage ? (
          <AddCommunityChooser usage={usage} />
        ) : (
          <div className="h-40 animate-pulse bg-zinc-100 rounded-2xl" />
        )}
      </div>

      <ReorderCommunitiesModal open={reorderOpen} onClose={() => setReorderOpen(false)} communities={myCommunities} />
    </div>,
    document.body
  );
}

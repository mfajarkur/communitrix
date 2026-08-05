'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { getMyCommunityUsage, type CommunityUsage } from '@/server/actions/community.actions';
import AddCommunityChooser from '@/app/(app)/communities/add-community-chooser';

// Dialog chrome around AddCommunityChooser — same overlay/card pattern as
// edit-community-info-button.tsx's modal. Triggered by the "+" chip in community-nav.tsx
// instead of that chip navigating to the old membership-list page.
export default function AddCommunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [usage, setUsage] = useState<CommunityUsage | null>(null);

  useEffect(() => {
    if (open) {
      getMyCommunityUsage().then(setUsage);
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827] animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
            <Plus className="h-5 w-5 text-orange-500" />
            Add a Community
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {usage ? (
          <AddCommunityChooser usage={usage} />
        ) : (
          <div className="h-40 animate-pulse bg-zinc-100 rounded-2xl" />
        )}
      </div>
    </div>,
    document.body
  );
}

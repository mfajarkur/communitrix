'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

// Portals to document.body and uses position:fixed rather than being
// positioned against any scrollable ancestor — the app shell's own content
// region scrolls independently, and a sheet positioned relative to it (as an
// earlier mockup was) ends up anchored to the bottom of all scrollable
// content instead of the visible viewport. Portaling sidesteps that class of
// bug entirely instead of having to track which ancestor is "the" fixed one.
export default function BottomSheet({ open, onClose, title, children }: Props) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-white rounded-t-3xl">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 pb-8">{children}</div>
      </div>
    </div>,
    document.body
  );
}

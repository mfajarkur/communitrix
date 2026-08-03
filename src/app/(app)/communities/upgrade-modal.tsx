'use client';

import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

type Props = {
  open: boolean;
  kind: 'created' | 'joined' | null;
  onClose: () => void;
};

const BODY: Record<'created' | 'joined', string> = {
  created: 'Accounts can create up to 3 communities. Upgrade to Communitrix Plus for more.',
  joined: 'Accounts can join up to 5 communities. Upgrade to Communitrix Plus for more.',
};

export default function UpgradeModal({ open, kind, onClose }: Props) {
  if (!open || !kind || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-orange-500" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-black text-zinc-900">You&apos;ve reached your community limit</h3>
          <p className="text-sm text-zinc-500 font-light leading-relaxed">{BODY[kind]}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all cursor-pointer"
        >
          Upgrade to Communitrix Plus
        </button>
      </div>
    </div>,
    document.body
  );
}

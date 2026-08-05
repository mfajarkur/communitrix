'use client';

import { createPortal } from 'react-dom';
import { AlertCircle, type LucideIcon } from 'lucide-react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// The single shared confirmation-dialog design across the app, copied from wizard-form.tsx's
// "End Match Session?" modal (dark card, icon badge, uppercase title, muted body copy, two
// equal-width buttons) — every native window.confirm() call is being replaced with this so every
// "are you sure?" question looks and feels the same, instead of the browser's native dialog
// standing out as a different, unstyled surface.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon: Icon = AlertCircle,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-white shadow-2xl space-y-5 text-center font-sans">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
          <Icon className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
          <p className="text-xs text-zinc-400 font-light leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            {isConfirming ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

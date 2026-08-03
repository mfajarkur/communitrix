'use client';

import Link from 'next/link';
import { BookOpen, AtSign, ChevronRight } from 'lucide-react';
import BottomSheet from '@/components/ui/bottom-sheet';

export default function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Help">
      <div className="space-y-2">
        <Link
          href="/wiki"
          onClick={onClose}
          className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-zinc-100 hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-zinc-900">Wiki & Rulebook</span>
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-300" />
        </Link>

        <a
          href="https://instagram.com/communitrix.id"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-zinc-100 hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <AtSign className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-zinc-900">Contact Us</span>
          </span>
          <span className="text-xs text-zinc-400 font-medium">@communitrix.id</span>
        </a>
      </div>
    </BottomSheet>
  );
}

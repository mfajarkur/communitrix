'use client';

import { Loader2, Plus } from 'lucide-react';

type Props = {
  nextRoundNumber: number;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  // Community only — Quick Match has no session to end.
  onEndSession?: () => void;
  isEndingSession?: boolean;
  showEndSession?: boolean;
};

// The full-width orange "+ Generate Next Round" button shared by Quick Match and the
// community Live Board — see round-carousel.tsx for why this is extracted.
export default function GenerateRoundButton({
  nextRoundNumber,
  onGenerate,
  isGenerating,
  disabled,
  onEndSession,
  isEndingSession,
  showEndSession,
}: Props) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || isGenerating || isEndingSession}
        className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span>+ Generate Next Round (Round {nextRoundNumber})</span>
      </button>
      {showEndSession && onEndSession && (
        <button
          type="button"
          onClick={onEndSession}
          disabled={isEndingSession || isGenerating}
          className="w-full py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-white shadow-sm disabled:opacity-50"
        >
          {isEndingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>End Session</span>
        </button>
      )}
    </div>
  );
}

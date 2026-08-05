'use client';

import { Loader2 } from 'lucide-react';

type Props = {
  scoreA: number | null;
  scoreB: number | null;
  // Optional so a read-only display (e.g. a finished session's results recap, rendered from a
  // Server Component) can render this without a Server Component having to pass a Client
  // Component a newly-created function — not allowed across that boundary. isCompleted already
  // makes the buttons non-interactive in that case, so there's nothing to wire up anyway.
  onTapA?: () => void;
  onTapB?: () => void;
  disabled?: boolean;
  isCompleted?: boolean;
  winnerSide?: 'A' | 'B' | null;
  isSubmitting?: boolean;
};

// The pair of tap-to-score boxes + "vs" divider look, used inside a match card. Shared by Quick
// Match and the community Live Board — see session-view-tabs.tsx for why this is extracted.
export default function ScoreButtonPair({
  scoreA,
  scoreB,
  onTapA,
  onTapB,
  disabled,
  isCompleted,
  winnerSide,
  isSubmitting,
}: Props) {
  const boxClass = (side: 'A' | 'B') => {
    if (isSubmitting) {
      return 'bg-orange-500 text-white animate-pulse shadow-orange-500/30';
    }
    if (isCompleted) {
      return winnerSide === side
        ? 'bg-orange-500 text-white'
        : 'bg-zinc-200 text-zinc-800';
    }
    return 'bg-zinc-900 text-white';
  };

  const interactive = !disabled && !isCompleted && !isSubmitting;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={!interactive}
        onClick={onTapA}
        className={`h-12 w-12 rounded-lg flex items-center justify-center text-lg font-black transition-all shadow-lg ${boxClass('A')} ${
          interactive ? 'cursor-pointer active:scale-95 hover:bg-orange-600' : 'cursor-default'
        }`}
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : (scoreA ?? '-')}
      </button>

      <button
        type="button"
        disabled={!interactive}
        onClick={onTapB}
        className={`h-12 w-12 rounded-lg flex items-center justify-center text-lg font-black transition-all shadow-lg ${boxClass('B')} ${
          interactive ? 'cursor-pointer active:scale-95 hover:bg-orange-600' : 'cursor-default'
        }`}
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : (scoreB ?? '-')}
      </button>
    </div>
  );
}

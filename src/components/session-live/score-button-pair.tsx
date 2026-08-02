'use client';

type Props = {
  scoreA: number | null;
  scoreB: number | null;
  onTapA: () => void;
  onTapB: () => void;
  disabled?: boolean;
  // Once a match is completed, the pair renders as a static (non-interactive) result — the
  // winning side's box in orange, the losing side's muted gray — instead of the neutral
  // "tap to score" look. winnerSide is null for a draw (both boxes stay neutral/dark).
  isCompleted?: boolean;
  winnerSide?: 'A' | 'B' | null;
};

// The pair of tap-to-score boxes + "vs" divider look, used inside a match card. Shared by Quick
// Match and the community Live Board — see round-carousel.tsx for why this is extracted.
export default function ScoreButtonPair({ scoreA, scoreB, onTapA, onTapB, disabled, isCompleted, winnerSide }: Props) {
  const boxClass = (side: 'A' | 'B') => {
    if (isCompleted) {
      return winnerSide === side
        ? 'bg-orange-500 text-white'
        : 'bg-zinc-200 text-zinc-500';
    }
    return 'bg-zinc-900 text-white';
  };

  const interactive = !disabled && !isCompleted;

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        disabled={!interactive}
        onClick={onTapA}
        className={`h-14 w-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all shadow-sm ${boxClass('A')} ${
          interactive ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
      >
        {scoreA ?? '-'}
      </button>
      <button
        type="button"
        disabled={!interactive}
        onClick={onTapB}
        className={`h-14 w-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all shadow-sm ${boxClass('B')} ${
          interactive ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
      >
        {scoreB ?? '-'}
      </button>
    </div>
  );
}

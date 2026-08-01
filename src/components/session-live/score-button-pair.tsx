'use client';

type Props = {
  scoreA: number | null;
  scoreB: number | null;
  onTapA: () => void;
  onTapB: () => void;
  disabled?: boolean;
};

// The pair of 12x12 tap-to-score buttons + colon, used inside a match card. Shared by Quick
// Match and the community Live Board — see round-carousel.tsx for why this is extracted.
export default function ScoreButtonPair({ scoreA, scoreB, onTapA, onTapB, disabled }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onTapA}
        className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all shadow-2xs ${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } ${
          scoreA !== null
            ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
            : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
        }`}
      >
        {scoreA ?? '-'}
      </button>
      <span className="text-zinc-400 font-bold">:</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onTapB}
        className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all shadow-2xs ${
          disabled ? 'cursor-default' : 'cursor-pointer'
        } ${
          scoreB !== null
            ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
            : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
        }`}
      >
        {scoreB ?? '-'}
      </button>
    </div>
  );
}

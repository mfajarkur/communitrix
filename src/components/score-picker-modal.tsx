'use client';

import { X, Check } from 'lucide-react';

interface ScorePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  currentScore: number | null;
  maxTarget?: number;
  maxAllowedScore?: number;
  onSelectScore: (score: number) => void;
}

export default function ScorePickerModal({
  isOpen,
  onClose,
  teamName,
  currentScore,
  maxTarget = 24,
  maxAllowedScore,
  onSelectScore,
}: ScorePickerModalProps) {
  if (!isOpen) return null;

  // Generate 0..maxTarget options — strictly respects the configured target.
  // e.g. "Total of 4" → maxTarget=4 → shows 0,1,2,3,4 only (no higher numbers).
  const numbers = Array.from({ length: maxTarget + 1 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-zinc-200 p-5 sm:p-6 text-zinc-900 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
              Tap to Select Score
            </span>
            <h3 className="text-base font-black text-zinc-900 truncate max-w-[280px]">
              {teamName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tappable Number Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 pt-1">
          {numbers.map((num) => {
            const isSelected = currentScore === num;
            const isDisabled = maxAllowedScore !== undefined && num > maxAllowedScore;
            return (
              <button
                key={num}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onSelectScore(num);
                  onClose();
                }}
                className={`h-12 rounded-xl text-base font-black transition-all flex items-center justify-center shadow-2xs ${
                  isDisabled
                    ? 'opacity-25 cursor-not-allowed bg-zinc-100 text-zinc-300 border border-zinc-200'
                    : isSelected
                    ? 'bg-orange-500 text-white border-2 border-orange-600 shadow-md scale-105 cursor-pointer'
                    : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-800 border border-zinc-200 hover:border-orange-300 hover:text-orange-600 cursor-pointer'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Quick Action Footer */}
        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => {
              onSelectScore(0);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold uppercase transition-all cursor-pointer"
          >
            Set 0
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

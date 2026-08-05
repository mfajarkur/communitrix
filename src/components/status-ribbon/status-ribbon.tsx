'use client';

type StatusRibbonProps = {
  progress: number;
  message: string;
};

export default function StatusRibbon({ progress, message }: StatusRibbonProps) {
  const showBusy = progress > 0;

  return (
    <div className="relative h-[23px] w-full shrink-0 overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 select-none">
      {/* Width still grows literally empty → full so users can gauge real progress speed — the
          shimmer sweeping across it is purely a "something is happening" cue on top of that. */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden bg-gradient-to-r from-black via-orange-600 to-orange-500 transition-[width] duration-300 ease-out shadow-[0_0_10px_#f97316]"
        style={{ width: showBusy ? `${progress}%` : '0%' }}
      >
        {showBusy && (
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        )}
      </div>

      <div className="relative h-full flex items-center justify-center px-3">
        <span
          className={`absolute inset-0 flex items-center justify-center gap-1.5 transition-opacity duration-300 ${
            showBusy ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white">
            communitrix.id
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-breathe" />
        </span>

        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            showBusy ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-[9px] font-light normal-case tracking-wide text-white">
            {message || 'Loading page…'}
          </span>
        </span>
      </div>
    </div>
  );
}

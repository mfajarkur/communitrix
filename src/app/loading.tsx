import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-zinc-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      
      <div className="flex flex-col items-center animate-pulse space-y-4 relative z-10">
        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />
          <span className="relative text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 drop-shadow-sm">
            Communitrix
          </span>
        </div>
        <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          Getting things ready...
        </span>
      </div>
    </div>
  );
}

import { Users, Calendar, Flame, Crown, Medal, Award } from 'lucide-react';

type Props = {
  memberCount: number;
  totalSessionsCount: number;
  totalMatchesCount: number;
  highestElo: number;
  totalMedals: number;
  totalCp: number;
};

export default function CommunityMetrics({
  memberCount,
  totalSessionsCount,
  totalMatchesCount,
  highestElo,
  totalMedals,
  totalCp,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Community Metrics</h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Black Box: Total Members */}
        <div className="rounded-2xl bg-zinc-950 p-4 text-white flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Users className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-white/60 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Members</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter">
            {memberCount}
          </div>
        </div>

        {/* Orange Box: Total Matches */}
        <div className="rounded-2xl bg-orange-500 p-4 text-white flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <Flame className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-white/80 mb-2">
            <Flame className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Matches</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter">
            {totalMatchesCount}
          </div>
        </div>

        {/* White Box: Total Sessions */}
        <div className="rounded-2xl bg-white border border-zinc-200 p-4 text-zinc-900 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Calendar className="h-24 w-24 text-zinc-900" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-zinc-400 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Sessions</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter text-zinc-900">
            {totalSessionsCount}
          </div>
        </div>

        {/* White Box: Highest Elo */}
        <div className="rounded-2xl bg-white border border-zinc-200 p-4 text-zinc-900 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Crown className="h-24 w-24 text-zinc-900" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-zinc-400 mb-2">
            <Crown className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">All Time High Elo</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter text-emerald-600">
            {highestElo > 0 ? highestElo.toFixed(0) : '-'}
          </div>
        </div>

        {/* Black Box: Total Medals */}
        <div className="rounded-2xl bg-zinc-950 p-4 text-white flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Medal className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-amber-500/80 mb-2">
            <Medal className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider text-white/60">Medals Awarded</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter text-amber-500">
            {totalMedals}
          </div>
        </div>

        {/* Orange Box: Total CP */}
        <div className="rounded-2xl bg-orange-500 p-4 text-white flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <Award className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-white/80 mb-2">
            <Award className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">CP Distributed</span>
          </div>
          <div className="relative z-10 text-3xl font-black tracking-tighter">
            {totalCp}
          </div>
        </div>
      </div>
    </div>
  );
}

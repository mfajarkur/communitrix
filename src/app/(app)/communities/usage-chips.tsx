import type { CommunityUsage } from '@/server/actions/community.actions';

export default function UsageChips({ usage }: { usage: CommunityUsage }) {
  const createdAtLimit = usage.created >= 3;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[10px] font-bold px-2 py-1 rounded-full tabular-nums ${
          createdAtLimit ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'
        }`}
      >
        {usage.created} / 3 created
      </span>
    </div>
  );
}

export default function ActivitiesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-zinc-200 rounded" />
          <div className="h-3 w-48 bg-zinc-100 rounded" />
        </div>
        <div className="h-8 w-28 bg-zinc-100 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-zinc-100 rounded-full" />
        <div className="h-8 w-20 bg-zinc-100 rounded-full" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

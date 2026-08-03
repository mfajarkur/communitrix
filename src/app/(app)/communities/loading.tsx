export default function CommunitiesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-5 w-40 bg-zinc-200 rounded" />
            <div className="h-3 w-56 bg-zinc-100 rounded" />
          </div>
          <div className="h-9 w-24 bg-zinc-100 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-24 bg-zinc-100 rounded-full" />
          <div className="h-6 w-24 bg-zinc-100 rounded-full" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 rounded-2xl bg-zinc-100" />
      ))}
    </div>
  );
}

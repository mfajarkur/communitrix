export default function ProfileLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-3xl overflow-hidden border border-orange-200/60 bg-zinc-950">
        <div className="h-20 sm:h-24 bg-zinc-800" />
        <div className="px-5 sm:px-6 pb-6 -mt-12 sm:-mt-14 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-zinc-700 ring-4 ring-zinc-950" />
          <div className="h-4 w-32 bg-zinc-700 rounded mt-4" />
          <div className="h-3 w-20 bg-zinc-800 rounded mt-2" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-16 bg-zinc-200 rounded" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-20 rounded-xl bg-zinc-100" />
            ))}
          </div>
          <div className="h-40 rounded-2xl bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

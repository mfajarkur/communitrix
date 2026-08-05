// Shown instantly while switching communities (or landing on one fresh) — this route is
// `force-dynamic` (page.tsx's data always refetches, never cached), so without this Next.js
// would otherwise hold the previous screen frozen until the new page's data arrives, reading as
// a stall rather than a switch. Only skeletons the content area: the nav above (layout.tsx's
// CommunityNav) is a sibling of this Suspense boundary, not inside it, so it stays mounted and
// visible the whole time — this only needs to stand in for what's actually reloading.
export default function CommunityLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-zinc-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}

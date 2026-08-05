// Shown instantly while switching communities (or landing on one fresh) — this route is
// `force-dynamic` (community-tabs.tsx's data always refetches, never cached), so without this
// Next.js would otherwise hold the previous screen frozen until the new page's data arrives,
// reading as a stall rather than a switch. Roughly mirrors the merged switcher+tabs shape
// (community-tabs.tsx) so the transition feels like a continuation, not a different page.
export default function CommunityLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-2xl bg-zinc-100 p-2 space-y-2">
        <div className="h-12 w-48 bg-zinc-200 rounded-xl" />
        <div className="h-12 bg-zinc-200 rounded-xl" />
      </div>
      <div className="h-28 rounded-2xl bg-zinc-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}

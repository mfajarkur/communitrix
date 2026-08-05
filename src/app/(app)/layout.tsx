import { requireProfile } from '@/server/guards';
import Footer from '@/components/footer';
import { StatusRibbonProvider, StatusRibbonBar } from '@/components/status-ribbon/status-ribbon-provider';
import TopNav from '@/components/global-nav/top-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce auth
  await requireProfile();

  return (
    <StatusRibbonProvider>
      {/* Fixed-height shell: only the middle content region scrolls. Sheets/modals must portal
          to document.body with position:fixed rather than rely on being positioned against this
          scroll boundary. StatusRibbonBar and TopNav are both normal flex children (shrink-0,
          sized by their own height) rather than fixed/siblings of this whole shell — a fixed
          element sized on top of an already-viewport-height shell adds its own height on top of
          the viewport and lets scroll-chaining carry it off-screen, which bit the ribbon before
          it was fixed this same way. All navigation now lives up here, stacked in one clear
          hierarchy (status → main nav → whatever sub-nav the active section has, e.g.
          community-tabs.tsx's own sticky Home/Sessions/Members/Rank strip) — nothing is pinned
          to the bottom of the screen anymore, so page content has no bottom clearance to reserve. */}
      <div className="h-dvh overflow-hidden flex flex-col bg-white w-full text-[#111827]">
        <StatusRibbonBar />
        <TopNav />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full max-w-7xl mx-auto flex flex-col min-h-0">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </StatusRibbonProvider>
  );
}

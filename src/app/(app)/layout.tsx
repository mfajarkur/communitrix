import { requireProfile } from '@/server/guards';
import Footer from '@/components/footer';
import { StatusRibbonProvider } from '@/components/status-ribbon/status-ribbon-provider';
import BottomNav from '@/components/global-nav/bottom-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce auth
  await requireProfile();

  return (
    <StatusRibbonProvider>
      {/* Fixed-height shell: only the middle content region scrolls. Sheets/
          modals must portal to document.body with position:fixed rather than
          rely on being positioned against this scroll boundary. */}
      <div className="h-dvh overflow-hidden flex flex-col bg-white w-full text-[#111827]">
        <div className="flex-1 overflow-y-auto">
          <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full max-w-7xl mx-auto flex flex-col min-h-0">
            {children}
          </main>
          <Footer />
        </div>
        <BottomNav />
      </div>
    </StatusRibbonProvider>
  );
}

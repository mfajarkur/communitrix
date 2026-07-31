import { requireProfile } from '@/server/guards';
import Footer from '@/components/footer';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce auth
  await requireProfile();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white w-full text-[#111827]">
      <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 w-full max-w-7xl mx-auto flex flex-col min-h-0">
        {children}
      </main>
      <Footer />
    </div>
  );
}

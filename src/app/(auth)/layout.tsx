import { Trophy } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-black uppercase tracking-widest text-[#111827] font-sans">
            Communitrix
          </h2>
          <p className="text-sm text-zinc-500 mt-2">
            Matchmaking and ratings for active sports clubs.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

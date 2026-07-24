import { Trophy } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none mb-4">
            <Trophy className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-extrabold text-zinc-950 dark:text-white">Communitrix</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Matchmaking and ratings for active sports clubs.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 shadow-xl shadow-zinc-100/50 dark:shadow-none">
          {children}
        </div>
      </div>
    </div>
  );
}

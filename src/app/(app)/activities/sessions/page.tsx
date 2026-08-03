import { requireProfile } from '@/server/guards';
import { getMySessions } from '@/server/actions/session.actions';
import MySessionsList from './my-sessions-list';

export default async function MySessionsPage() {
  await requireProfile();
  const sessions = await getMySessions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">My Session</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Every session you&apos;ve played, live or ended, across all your communities.
        </p>
      </div>

      <MySessionsList sessions={sessions} />
    </div>
  );
}

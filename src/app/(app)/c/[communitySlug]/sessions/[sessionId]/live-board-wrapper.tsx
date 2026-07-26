'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  generateNextRoundAction,
  persistRoundAction,
} from '@/server/actions/round.actions';
import { finalizeSessionAction } from '@/server/actions/session.actions';
import {
  Trophy,
  Users,
  Grid,
  Zap,
  Play,
  CheckCircle,
  HelpCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { getDisplayName } from '@/lib/utils/profile';

interface MatchPlayer {
  profile_id: string;
  team: 'A' | 'B';
  slot: number;
  profile: {
    full_name?: string | null;
    display_name?: string | null;
  };
}

interface Match {
  id: string;
  court_number: number;
  round_number: number;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
  winner_side: 'A' | 'B' | null;
  match_players: MatchPlayer[];
}

interface SitOut {
  id: string;
  name: string;
}

interface SessionPlayer {
  id: string;
  name: string;
  pointsFor: number;
  pointsAgainst: number;
  wins: number;
  losses: number;
  draws: number;
}

interface LiveBoardWrapperProps {
  sessionId: string;
  communitySlug: string;
  isAdmin: boolean;
  latestRound: { id: string; round_number: number; status: string } | null;
  matches: Match[];
  sitOuts: SitOut[];
  sessionPlayers: SessionPlayer[];
}

export default function LiveBoardWrapper({
  sessionId,
  communitySlug,
  isAdmin,
  latestRound,
  matches,
  sitOuts,
  sessionPlayers,
}: LiveBoardWrapperProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [previewRound, setPreviewRound] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFinalizeClick = async () => {
    if (!confirm('Are you sure you want to end this match session? This will finalize all ratings.')) return;
    setIsFinalizing(true);
    setError(null);
    const result = await finalizeSessionAction(sessionId);
    setIsFinalizing(false);
    if (result.ok) {
      router.push(`/c/${communitySlug}`);
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  // 1. Setup Supabase Realtime subscription for instant updates (PRD Phase 6)
  useEffect(() => {
    const channel = supabase
      .channel(`session-board:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Trigger data revalidation
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, router]);

  // Round parameters calculations
  const nextRoundNumber = latestRound ? latestRound.round_number + 1 : 1;
  const allMatchesCompleted =
    matches.length > 0 && matches.every(m => m.status === 'COMPLETED');
  const canGenerateNextRound = !latestRound || allMatchesCompleted;

  // Handle generating matchmaking proposal preview
  const handleGenerateClick = async () => {
    setIsGenerating(true);
    setError(null);
    setPreviewRound(null);

    const result = await generateNextRoundAction(sessionId, nextRoundNumber);
    setIsGenerating(false);

    if (result.ok) {
      setPreviewRound(result.data);
    } else {
      setError(result.message);
    }
  };

  // Confirm and persist the generated matchmaking proposal
  const handlePersistConfirm = async () => {
    if (!previewRound) return;
    setIsGenerating(true);
    setError(null);

    const formattedCourts = previewRound.courts.map((c: any) => ({
      courtNumber: c.courtNumber,
      teamA: c.teamA.map((p: any) => p.id),
      teamB: c.teamB.map((p: any) => p.id),
    }));

    const result = await persistRoundAction({
      sessionId,
      roundNumber: previewRound.roundNumber,
      courts: formattedCourts,
      sitOuts: previewRound.sitOuts.map((p: any) => p.id),
    });

    setIsGenerating(false);

    if (result.ok) {
      setPreviewRound(null);
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  // Session stats calculations
  const sortedLeaderboard = [...sessionPlayers].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffB = b.pointsFor - b.pointsAgainst;
    const diffA = a.pointsFor - a.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.pointsFor - a.pointsFor;
  });

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
      {/* Matches Grid and Playback controls */}
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-sm text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* Generate / match controls */}
        {isAdmin && (
          <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-[#111827] flex items-center gap-1.5 text-sm">
                <Calendar className="h-4.5 w-4.5 text-orange-500" />
                Round Playback Controls
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {!latestRound
                  ? 'No rounds created. Start the first round.'
                  : allMatchesCompleted
                  ? `All matches in Round ${latestRound.round_number} completed. Ready for next round.`
                  : `Waiting for matches in Round ${latestRound.round_number} to finish.`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {latestRound && (
                <button
                  onClick={handleFinalizeClick}
                  disabled={isFinalizing || isGenerating}
                  className="h-10 px-4 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 transition-all cursor-pointer flex items-center gap-1.5 bg-white shadow-sm"
                >
                  {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>End Session</span>
                </button>
              )}
              <button
                onClick={handleGenerateClick}
                disabled={!canGenerateNextRound || isGenerating || isFinalizing}
                className="h-10 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Generate Round {nextRoundNumber}</span>
              </button>
            </div>
          </div>
        )}

        {/* Court Cards listing */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
            <Grid className="h-4 w-4" />
            Active Courts - Round {latestRound?.round_number || 0}
          </h3>

          {!latestRound ? (
            <div className="text-center py-16 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 text-zinc-400 space-y-3">
              <HelpCircle className="h-10 w-10 mx-auto opacity-50" />
              <p className="text-sm">No rounds have been generated for this session yet.</p>
              {isAdmin && (
                <button
                  onClick={handleGenerateClick}
                  className="mt-2 text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                >
                  Generate Round 1
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {matches.map(m => {
                const teamA = m.match_players.filter(mp => mp.team === 'A');
                const teamB = m.match_players.filter(mp => mp.team === 'B');
                const isCompleted = m.status === 'COMPLETED';

                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl border border-zinc-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                      <span className="text-xs font-bold text-zinc-500">
                        Court {m.court_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-orange-500/10 text-orange-600'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div className="py-4 flex justify-between items-center gap-6">
                      <div className="space-y-1 flex-1">
                        {teamA.map(mp => (
                          <p key={mp.profile_id} className="text-sm font-bold text-zinc-800 truncate">
                            {getDisplayName(mp.profile)}
                          </p>
                        ))}
                      </div>

                      <div className="text-center font-black tabular-nums tracking-tight px-3 py-1 bg-zinc-50 rounded-xl flex items-center gap-3">
                        <span className={`text-xl ${isCompleted && m.winner_side === 'A' ? 'text-orange-500' : 'text-zinc-400'}`}>
                          {m.team_a_score ?? 0}
                        </span>
                        <span className="text-zinc-300 text-xs">—</span>
                        <span className={`text-xl ${isCompleted && m.winner_side === 'B' ? 'text-orange-500' : 'text-zinc-400'}`}>
                          {m.team_b_score ?? 0}
                        </span>
                      </div>

                      <div className="space-y-1 flex-1 text-right">
                        {teamB.map(mp => (
                          <p key={mp.profile_id} className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                            {getDisplayName(mp.profile)}
                          </p>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <Link
                        href={`/c/${communitySlug}/sessions/${sessionId}/m/${m.id}`}
                        className="mt-2 text-center text-xs font-bold py-2 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl border border-zinc-200/60 transition-all text-zinc-700"
                      >
                        {isCompleted ? 'Edit Score' : 'Score Court'}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Standings and Sit-outs */}
      <div className="space-y-6">
        {/* Roster sit-outs */}
        {latestRound && (
          <div className="p-6 rounded-2xl border border-zinc-100 bg-white shadow-sm space-y-4">
            <h4 className="font-bold text-[#111827] flex items-center gap-2 text-sm border-b border-zinc-100 pb-3">
              <Users className="h-4.5 w-4.5 text-orange-500" />
              Sit-outs this Round ({sitOuts.length})
            </h4>
            {sitOuts.length === 0 ? (
              <p className="text-xs text-zinc-400">All players are currently active on court.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sitOuts.map(p => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-zinc-150 bg-zinc-50/50 text-xs font-bold text-zinc-700 truncate"
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Session leaderboard */}
        <div className="p-6 rounded-2xl border border-zinc-100 bg-white shadow-sm space-y-4">
          <h4 className="font-bold text-[#111827] flex items-center gap-2 text-sm border-b border-zinc-100 pb-3">
            <Trophy className="h-4.5 w-4.5 text-orange-500" />
            Session Leaderboard
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 uppercase tracking-widest text-[10px] font-semibold">
                  <th className="py-2 font-semibold">Player</th>
                  <th className="py-2 text-center font-semibold">Record</th>
                  <th className="py-2 text-right font-semibold">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {sortedLeaderboard.map((p, idx) => {
                  const diff = p.pointsFor - p.pointsAgainst;
                  return (
                    <tr key={p.id} className="text-zinc-800">
                      <td className="py-2.5 flex items-center gap-2 truncate max-w-[120px] font-bold">
                        <span className="text-zinc-400">{idx + 1}.</span>
                        {p.name}
                      </td>
                      <td className="py-2.5 text-center font-bold text-zinc-500">
                        {p.wins}–{p.losses}{p.draws > 0 ? `–${p.draws}` : ''}
                      </td>
                      <td className={`py-2.5 text-right font-extrabold ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-500' : 'text-zinc-400'}`}>
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Matchmaking proposal preview modal/dialog */}
      {previewRound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-white border border-zinc-100 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="text-center space-y-1 shrink-0">
              <Zap className="h-8 w-8 text-orange-500 mx-auto" />
              <h3 className="text-lg font-extrabold tracking-tight text-[#111827] mt-2">
                Verify Round {previewRound.roundNumber} Pairings
              </h3>
              <p className="text-xs text-zinc-500">
                Confirm match generation courts and player sit-out roster allocation before starting.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 gap-2">
                {previewRound.courts.map((c: any) => (
                  <div
                    key={c.courtNumber}
                    className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/60 flex flex-col gap-2"
                  >
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-100 pb-1.5">
                      Court {c.courtNumber}
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-800">
                        {c.teamA.map((p: any) => p.name).join(' / ')}
                      </p>
                      <span className="text-[9px] font-black text-orange-500 block py-0.5">VS</span>
                      <p className="text-xs font-bold text-zinc-800">
                        {c.teamB.map((p: any) => p.name).join(' / ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {previewRound.sitOuts.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/60 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                    Sit-outs ({previewRound.sitOuts.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewRound.sitOuts.map((p: any) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-[10px] font-bold text-zinc-600 shadow-sm"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 shrink-0 pt-2 border-t border-zinc-250/60">
              <button
                type="button"
                onClick={() => setPreviewRound(null)}
                disabled={isGenerating}
                className="flex-1 h-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handlePersistConfirm}
                disabled={isGenerating}
                className="flex-1 h-10 rounded-lg bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGenerating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Open Courts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

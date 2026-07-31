'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  generateNextRoundAction,
  persistRoundAction,
  submitMatchScoreAction,
} from '@/server/actions/round.actions';
import { finalizeSessionAction } from '@/server/actions/session.actions';
import {
  Trophy,
  Zap,
  Plus,
  HelpCircle,
  Loader2,
  Send,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { getDisplayName } from '@/lib/utils/profile';
import ScorePickerModal from '@/components/score-picker-modal';
import LeaderboardPrintSection from '@/app/(app)/communities/quick-match/[id]/leaderboard-print-section';
import type { PosterStanding } from '@/components/leaderboard-poster';

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
  round_id: string;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
  winner_side: 'A' | 'B' | null;
  match_players: MatchPlayer[];
}

interface Round {
  id: string;
  round_number: number;
  status: string;
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

interface SessionScoringConfig {
  scoringType: 'POINTS' | 'GAMES';
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED';
  maxScoreTarget: number;
}

interface LiveBoardWrapperProps {
  sessionId: string;
  communitySlug: string;
  isHostOrAdmin: boolean;
  sessionConfig: SessionScoringConfig;
  sessionMeta: { name: string; sport: string; format: string };
  rounds: Round[];
  matches: Match[];
  sessionPlayers: SessionPlayer[];
  standings: PosterStanding[];
}

interface ScoreDraft {
  scoreA: number | null;
  scoreB: number | null;
}

export default function LiveBoardWrapper({
  sessionId,
  communitySlug,
  isHostOrAdmin,
  sessionConfig,
  sessionMeta,
  rounds,
  matches,
  sessionPlayers,
  standings,
}: LiveBoardWrapperProps) {
  const router = useRouter();
  const supabase = createClient();

  const [viewMode, setViewMode] = useState<'MATCHES' | 'LEADERBOARD'>('MATCHES');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline scoring (Quick Match-style tap-to-pick), staged locally per match until "Send Score"
  const [scoreDrafts, setScoreDrafts] = useState<Map<string, ScoreDraft>>(new Map());
  const [activePicker, setActivePicker] = useState<{
    matchId: string;
    team: 'A' | 'B';
    teamName: string;
    currentScore: number | null;
  } | null>(null);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);

  const isPointsSystem = sessionConfig.scoringType === 'POINTS' || sessionConfig.pointsMode === 'FIXED_TOTAL';
  const targetN = sessionConfig.maxScoreTarget || 24;

  const totalRounds = rounds.length;
  const latestRoundNumber = totalRounds > 0 ? rounds[totalRounds - 1].round_number : 0;
  const nextRoundNumber = latestRoundNumber + 1;

  const [selectedRound, setSelectedRound] = useState(latestRoundNumber || 1);

  // Auto-advance to a newly generated round, without fighting manual prev/next navigation
  // among rounds that already existed.
  const prevLatestRoundRef = useRef(latestRoundNumber);
  useEffect(() => {
    if (latestRoundNumber > prevLatestRoundRef.current) {
      setSelectedRound(latestRoundNumber);
    }
    prevLatestRoundRef.current = latestRoundNumber;
  }, [latestRoundNumber]);

  const selectedRoundMatches = useMemo(
    () => matches.filter((m) => m.round_number === selectedRound),
    [matches, selectedRound]
  );

  const sitOuts = useMemo(() => {
    const playingIds = new Set(selectedRoundMatches.flatMap((m) => m.match_players.map((mp) => mp.profile_id)));
    return sessionPlayers.filter((p) => !playingIds.has(p.id));
  }, [selectedRoundMatches, sessionPlayers]);

  const latestRoundMatches = useMemo(
    () => matches.filter((m) => m.round_number === latestRoundNumber),
    [matches, latestRoundNumber]
  );
  const allMatchesCompleted = latestRoundMatches.length > 0 && latestRoundMatches.every((m) => m.status === 'COMPLETED');
  const canGenerateNextRound = totalRounds === 0 || allMatchesCompleted;

  const getDraft = (matchId: string): ScoreDraft => scoreDrafts.get(matchId) || { scoreA: null, scoreB: null };

  const handleDraftScoreSelect = (matchId: string, team: 'A' | 'B', score: number) => {
    setScoreDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(matchId) || { scoreA: null, scoreB: null };
      let { scoreA, scoreB } = current;
      if (team === 'A') {
        scoreA = Math.max(0, score);
        if (isPointsSystem && targetN > 0) scoreB = Math.max(0, targetN - scoreA);
      } else {
        scoreB = Math.max(0, score);
        if (isPointsSystem && targetN > 0) scoreA = Math.max(0, targetN - scoreB);
      }
      next.set(matchId, { scoreA, scoreB });
      return next;
    });
  };

  const handleSendScore = async (matchId: string) => {
    const draft = scoreDrafts.get(matchId);
    if (!draft || draft.scoreA === null || draft.scoreB === null) return;
    setSubmittingMatchId(matchId);
    setError(null);

    const result = await submitMatchScoreAction({
      matchId,
      scoreA: draft.scoreA,
      scoreB: draft.scoreB,
      communitySlug,
    });

    setSubmittingMatchId(null);

    if (result.ok) {
      setScoreDrafts((prev) => {
        const next = new Map(prev);
        next.delete(matchId);
        return next;
      });
      if (result.data?.alreadyScored) {
        setError('Someone else already submitted a score for this match — showing their result instead.');
      }
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const handleFinalizeClick = async () => {
    if (!confirm('Are you sure you want to end this match session? This will finalize all ratings.')) return;
    setIsFinalizing(true);
    setError(null);
    const result = await finalizeSessionAction(sessionId);
    setIsFinalizing(false);
    if (result.ok) {
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
        { event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${sessionId}` },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${sessionId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, router]);

  const handleGenerateClick = async () => {
    // Generate + persist in one step, matching Quick Match: a single click produces the
    // round and shows it immediately, with no separate "verify pairings" confirmation step.
    setIsGenerating(true);
    setError(null);

    const result = await generateNextRoundAction(sessionId, nextRoundNumber);
    if (!result.ok) {
      setIsGenerating(false);
      setError(result.message);
      return;
    }

    const preview = result.data;
    const formattedCourts = preview.courts.map((c: any) => ({
      courtNumber: c.courtNumber,
      teamA: c.teamA.map((p: any) => p.id),
      teamB: c.teamB.map((p: any) => p.id),
    }));

    const persistResult = await persistRoundAction({
      sessionId,
      roundNumber: preview.roundNumber,
      courts: formattedCourts,
      sitOuts: preview.sitOuts.map((p: any) => p.id),
    });

    setIsGenerating(false);

    if (persistResult.ok) {
      router.refresh();
    } else {
      setError(persistResult.message);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-sm text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50">
          {error}
        </div>
      )}

      {/* LIVE MATCHES / LEADERBOARD 2-tab switcher — same pattern as Quick Match */}
      <div className="w-full pb-2 border-b border-zinc-100">
        <div className="flex p-1 bg-zinc-100 rounded-2xl max-w-md mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('MATCHES')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              viewMode === 'MATCHES' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>LIVE MATCHES</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('LEADERBOARD')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              viewMode === 'LEADERBOARD' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>LEADERBOARD</span>
          </button>
        </div>
      </div>

      {viewMode === 'MATCHES' ? (
        <div className="space-y-5">
          {/* Round Carousel Navigation Bar — always visible, same dark card Quick Match uses,
              showing a "No Rounds Yet" state before the host generates the first one. */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-white shadow-md space-y-3">
            {totalRounds > 0 ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedRound((prev) => Math.max(1, prev - 1))}
                  disabled={selectedRound <= 1}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-all text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed text-white shadow-xs"
                >
                  <ChevronLeft className="h-4 w-4 text-orange-400" />
                  <span className="hidden sm:inline">Prev Round</span>
                </button>

                <div className="text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
                    Match Round Navigation
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                    ROUND {selectedRound} <span className="text-zinc-500 font-normal">/ {totalRounds}</span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRound((prev) => Math.min(totalRounds, prev + 1))}
                  disabled={selectedRound >= totalRounds}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 transition-all text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed text-white shadow-xs"
                >
                  <span className="hidden sm:inline">Next Round</span>
                  <ChevronRight className="h-4 w-4 text-orange-400" />
                </button>
              </div>
            ) : (
              <div className="text-center py-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
                  Match Round Navigation
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">No Rounds Yet</h2>
              </div>
            )}

            {totalRounds > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2.5 border-t border-zinc-800/80 overflow-x-auto py-1">
                {rounds.map((r) => {
                  const isSelected = r.round_number === selectedRound;
                  const roundMatchesList = matches.filter((m) => m.round_number === r.round_number);
                  const isCompleted = roundMatchesList.length > 0 && roundMatchesList.every((m) => m.status === 'COMPLETED');

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRound(r.round_number)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSelected ? 'bg-orange-500 text-white shadow-sm' : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      <span>Round {r.round_number}</span>
                      {isCompleted && <Check className="h-3 w-3 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generate / End Session — same full-width orange button pattern as Quick Match's
              "+ Generate Next Round" button, instead of a separate boxed control panel. */}
          {isHostOrAdmin && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={!canGenerateNextRound || isGenerating || isFinalizing}
                className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>+ Generate Next Round (Round {nextRoundNumber})</span>
              </button>
              {totalRounds > 0 && (
                <button
                  type="button"
                  onClick={handleFinalizeClick}
                  disabled={isFinalizing || isGenerating}
                  className="w-full py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-white shadow-sm disabled:opacity-50"
                >
                  {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>End Session</span>
                </button>
              )}
            </div>
          )}

          {/* Sitting Out / Bye Players Banner for Selected Round */}
          {sitOuts.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-medium flex items-center gap-2">
              <span className="font-extrabold uppercase text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded shrink-0">
                Sitting Out (Bye)
              </span>
              <span className="truncate font-bold text-amber-900">{sitOuts.map((p) => p.name).join(', ')}</span>
            </div>
          )}

          {/* Match Cards List for Selected Round */}
          {totalRounds === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 text-zinc-400 space-y-3">
              <HelpCircle className="h-10 w-10 mx-auto opacity-50" />
              <p className="text-sm">No rounds have been generated for this session yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedRoundMatches.map((m) => {
                const teamA = m.match_players.filter((mp) => mp.team === 'A');
                const teamB = m.match_players.filter((mp) => mp.team === 'B');
                const isCompleted = m.status === 'COMPLETED';
                const teamAName = teamA.map((mp) => getDisplayName(mp.profile)).join(' / ');
                const teamBName = teamB.map((mp) => getDisplayName(mp.profile)).join(' / ');
                const draft = getDraft(m.id);
                const isSubmittingThis = submittingMatchId === m.id;
                const canSend = isHostOrAdmin && !isCompleted && draft.scoreA !== null && draft.scoreB !== null;

                return (
                  <div key={m.id} className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <span className="font-black text-xs text-[#111827] uppercase tracking-wider">
                        Court {m.court_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                          isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-500/10 text-orange-600'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 text-center">
                      <div className="sm:col-span-2 space-y-0.5 text-center sm:text-right">
                        {teamA.map((mp) => (
                          <p key={mp.profile_id} className="text-xs font-bold text-zinc-900 truncate">
                            {getDisplayName(mp.profile)}
                          </p>
                        ))}
                      </div>

                      {isCompleted ? (
                        <div className="sm:col-span-1 text-center font-black tabular-nums tracking-tight px-3 py-1 bg-zinc-50 rounded-xl flex items-center justify-center gap-3">
                          <span className={`text-xl ${m.winner_side === 'A' ? 'text-orange-500' : 'text-zinc-400'}`}>
                            {m.team_a_score ?? 0}
                          </span>
                          <span className="text-zinc-300 text-xs">—</span>
                          <span className={`text-xl ${m.winner_side === 'B' ? 'text-orange-500' : 'text-zinc-400'}`}>
                            {m.team_b_score ?? 0}
                          </span>
                        </div>
                      ) : (
                        <div className="sm:col-span-1 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={!isHostOrAdmin || isSubmittingThis}
                            onClick={() =>
                              setActivePicker({ matchId: m.id, team: 'A', teamName: teamAName, currentScore: draft.scoreA })
                            }
                            className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all shadow-2xs ${
                              !isHostOrAdmin ? 'cursor-default' : 'cursor-pointer'
                            } ${
                              draft.scoreA !== null
                                ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
                            }`}
                          >
                            {draft.scoreA ?? '-'}
                          </button>
                          <span className="text-zinc-400 font-bold">:</span>
                          <button
                            type="button"
                            disabled={!isHostOrAdmin || isSubmittingThis}
                            onClick={() =>
                              setActivePicker({ matchId: m.id, team: 'B', teamName: teamBName, currentScore: draft.scoreB })
                            }
                            className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all shadow-2xs ${
                              !isHostOrAdmin ? 'cursor-default' : 'cursor-pointer'
                            } ${
                              draft.scoreB !== null
                                ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
                            }`}
                          >
                            {draft.scoreB ?? '-'}
                          </button>
                        </div>
                      )}

                      <div className="sm:col-span-2 space-y-0.5 text-center sm:text-left">
                        {teamB.map((mp) => (
                          <p key={mp.profile_id} className="text-xs font-bold text-zinc-900 truncate">
                            {getDisplayName(mp.profile)}
                          </p>
                        ))}
                      </div>
                    </div>

                    {isHostOrAdmin && isCompleted && (
                      <Link
                        href={`/c/${communitySlug}/sessions/${sessionId}/m/${m.id}`}
                        className="block text-center text-xs font-bold py-2 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl border border-zinc-200/60 transition-all text-zinc-700"
                      >
                        Edit Score
                      </Link>
                    )}

                    {canSend && (
                      <button
                        type="button"
                        onClick={() => handleSendScore(m.id)}
                        disabled={isSubmittingThis}
                        className="w-full text-center text-xs font-black uppercase tracking-wider py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl transition-all text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm"
                      >
                        {isSubmittingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        <span>Send Score</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#111827]">Leaderboard Standings</h2>
            <p className="text-xs text-zinc-500 mt-1">
              <span className="font-bold text-zinc-700 uppercase">{sessionMeta.format}</span>
              <span className="mx-1.5 text-zinc-300">•</span>
              <span className="font-bold text-orange-600 uppercase">{sessionMeta.sport}</span>
              <span className="mx-1.5 text-zinc-300">•</span>
              Ratings/ELO apply live per completed match
            </p>
          </div>

          <LeaderboardPrintSection
            activityName={sessionMeta.name}
            gameType={sessionMeta.format}
            sport={sessionMeta.sport}
            standings={standings}
          />

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden space-y-2">
            <div className="overflow-x-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-zinc-200">
              <table className="w-full text-left text-xs font-sans min-w-[560px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 pl-2">Rank</th>
                    <th className="pb-3">Player</th>
                    <th className="pb-3 text-center">Matches</th>
                    <th className="pb-3 text-center">W-L-T</th>
                    <th className="pb-3 text-center">Diff</th>
                    <th className="pb-3 text-right pr-2">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {standings.map((s) => (
                    <tr key={s.playerId} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 pl-2 font-black text-sm text-[#111827]">
                        {s.rank === 1 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white font-black text-xs shadow-sm">1</span>
                        ) : s.rank === 2 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 font-black text-xs shadow-sm">2</span>
                        ) : s.rank === 3 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-white font-black text-xs shadow-sm">3</span>
                        ) : (
                          `#${s.rank}`
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600 uppercase shrink-0">
                            {s.name.slice(0, 2)}
                          </div>
                          <p className="font-bold text-zinc-900 truncate max-w-[130px] sm:max-w-none">{s.name}</p>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-zinc-900">
                        {s.realMatchesPlayed ?? s.wins + s.losses + s.ties}
                      </td>
                      <td className="py-3 text-center font-mono font-bold text-zinc-700">
                        {s.wins}-{s.losses}-{s.ties}
                      </td>
                      <td className="py-3 text-center font-mono font-bold text-zinc-900">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs ${
                            (s.diff ?? 0) > 0
                              ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                              : (s.diff ?? 0) < 0
                              ? 'bg-rose-50 text-rose-600 font-extrabold'
                              : 'text-zinc-500'
                          }`}
                        >
                          {(s.diff ?? 0) > 0 ? `+${s.diff}` : s.diff ?? 0}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-black text-sm text-[#111827] whitespace-nowrap">{s.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Score Picker Modal (inline scoring, same component Quick Match uses) */}
      {activePicker && (() => {
        const draft = getDraft(activePicker.matchId);
        let maxAllowed = targetN;
        if (!isPointsSystem) {
          const otherScore = activePicker.team === 'A' ? draft.scoreB : draft.scoreA;
          if (otherScore !== null) {
            maxAllowed = Math.max(0, targetN - otherScore);
          }
        }

        return (
          <ScorePickerModal
            isOpen={!!activePicker}
            onClose={() => setActivePicker(null)}
            teamName={activePicker.teamName}
            currentScore={activePicker.currentScore}
            maxTarget={targetN}
            maxAllowedScore={maxAllowed}
            onSelectScore={(score) => handleDraftScoreSelect(activePicker.matchId, activePicker.team, score)}
          />
        );
      })()}
    </div>
  );
}

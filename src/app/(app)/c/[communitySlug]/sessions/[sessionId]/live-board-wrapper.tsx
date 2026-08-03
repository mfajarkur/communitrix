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
import { HelpCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { getDisplayName, getAvatarUrl } from '@/lib/utils/profile';
import ScorePickerModal from '@/components/score-picker-modal';
import type { PosterStanding } from '@/components/leaderboard-poster';
import RoundCarousel from '@/components/session-live/round-carousel';
import LiveLeaderboardTabs from '@/components/session-live/live-leaderboard-tabs';
import GenerateRoundButton from '@/components/session-live/generate-round-button';
import ScoreButtonPair from '@/components/session-live/score-button-pair';
import StandingsTable from '@/components/session-live/standings-table';
import { isFixedSumSessionConfig } from '@/lib/matchmaking/scoring-format';

interface MatchPlayer {
  profile_id: string;
  team: 'A' | 'B';
  slot: number;
  elo_before: number | null;
  elo_delta: number | null;
  elo_after: number | null;
  profile: {
    full_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
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
  const [expandedEloMatchId, setExpandedEloMatchId] = useState<string | null>(null);

  const isPointsSystem = isFixedSumSessionConfig(sessionConfig.scoringType, sessionConfig.pointsMode);
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

  // Tapping a score auto-submits the instant both teams' scores are set — same feel as Quick
  // Match (tap and done, no separate confirm step). In POINTS/FIXED_TOTAL scoring, picking
  // one team's score already auto-fills the other via the complement below, so a single tap
  // is often enough. The "Send Score" button this replaced added a network round-trip's
  // worth of extra friction on top of an already-required server call.
  const handleDraftScoreSelect = (matchId: string, team: 'A' | 'B', score: number) => {
    const current = scoreDrafts.get(matchId) || { scoreA: null, scoreB: null };
    let { scoreA, scoreB } = current;
    if (team === 'A') {
      scoreA = Math.max(0, score);
      if (isPointsSystem && targetN > 0) scoreB = Math.max(0, targetN - scoreA);
    } else {
      scoreB = Math.max(0, score);
      if (isPointsSystem && targetN > 0) scoreA = Math.max(0, targetN - scoreB);
    }

    setScoreDrafts((prev) => {
      const next = new Map(prev);
      next.set(matchId, { scoreA, scoreB });
      return next;
    });

    if (scoreA !== null && scoreB !== null) {
      submitScore(matchId, scoreA, scoreB);
    }
  };

  const submitScore = async (matchId: string, scoreA: number, scoreB: number) => {
    setSubmittingMatchId(matchId);
    setError(null);

    const result = await submitMatchScoreAction({ matchId, scoreA, scoreB, communitySlug });

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

  // 1. Setup Supabase Realtime subscription for instant updates (PRD Phase 6).
  //
  // postgres_changes doesn't replay missed events after a dropped connection — a host whose
  // phone loses signal mid-session and reconnects a minute later won't get the score updates
  // another host submitted during that gap, just whatever changes happen after. The realtime-js
  // client auto-reconnects the websocket on its own, but resubscribing after a drop fires this
  // same 'SUBSCRIBED' status as the very first connect, so treating every 'SUBSCRIBED' as "catch
  // up now" closes that gap without needing to track connection state ourselves. The 'online'
  // and visibility listeners below are a second safety net for cases (mobile browsers
  // suspending JS in the background, flaky mobile networks) where the socket doesn't reliably
  // signal the drop/reconnect on its own.
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') router.refresh();
      });

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('online', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
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

      <LiveLeaderboardTabs value={viewMode} onChange={setViewMode} />

      {viewMode === 'MATCHES' ? (
        <div className="space-y-5">
          <RoundCarousel
            rounds={rounds.map((r) => {
              const roundMatchesList = matches.filter((m) => m.round_number === r.round_number);
              return {
                number: r.round_number,
                isCompleted: roundMatchesList.length > 0 && roundMatchesList.every((m) => m.status === 'COMPLETED'),
              };
            })}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
          />

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
                const hasEloData = m.match_players.some((mp) => mp.elo_delta !== null && mp.elo_delta !== undefined);
                const isEloExpanded = expandedEloMatchId === m.id;

                const renderTeam = (players: MatchPlayer[], side: 'A' | 'B') => {
                  const isWinner = isCompleted && m.winner_side === side;
                  return (
                    <div className={`flex-1 space-y-1.5 flex flex-col ${side === 'A' ? 'items-start' : 'items-end'}`}>
                      {players.map((mp) => (
                        <div
                          key={mp.profile_id}
                          className={`flex items-center gap-1.5 min-w-0 ${side === 'B' ? 'flex-row-reverse' : ''}`}
                        >
                          <img
                            src={getAvatarUrl({ id: mp.profile_id, avatar_url: mp.profile.avatar_url, full_name: mp.profile.full_name })}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover shrink-0 border border-zinc-200"
                          />
                          <span className={`text-xs truncate max-w-[100px] ${isWinner ? 'text-orange-600 font-bold' : 'text-zinc-700 font-medium'}`}>
                            {getDisplayName(mp.profile)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                };

                const eloRow = (mp: MatchPlayer) => {
                  const delta = mp.elo_delta ?? 0;
                  const isPositive = delta >= 0;
                  return (
                    <div key={mp.profile_id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getAvatarUrl({ id: mp.profile_id, avatar_url: mp.profile.avatar_url, full_name: mp.profile.full_name })}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover shrink-0 border border-zinc-200"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-800 truncate">{getDisplayName(mp.profile)}</p>
                          {mp.elo_before !== null && mp.elo_after !== null && (
                            <p className="text-[10px] text-zinc-400 font-mono tabular-nums">
                              {Math.round(mp.elo_before)} → {Math.round(mp.elo_after)}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`font-black shrink-0 tabular-nums ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? '+' : ''}
                        {delta.toFixed(1)}
                      </span>
                    </div>
                  );
                };

                return (
                  <div
                    key={m.id}
                    className={`relative rounded-2xl border transition-all overflow-hidden ${
                      isSubmittingThis
                        ? 'border-orange-500 ring-2 ring-orange-400/50 bg-orange-50/40 animate-pulse shadow-md'
                        : isCompleted
                        ? 'border-zinc-200 bg-white shadow-sm'
                        : 'border-zinc-200 border-l-4 border-l-orange-500 bg-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                      <span className="font-bold text-base text-[#111827]">Court {m.court_number}</span>
                      {isSubmittingThis ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-500 text-white animate-pulse flex items-center gap-1.5 shadow-sm">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Updating Score & ELO...
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            isCompleted ? 'bg-zinc-100 text-zinc-500' : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {isCompleted ? 'Completed' : 'In Progress'}
                        </span>
                      )}
                    </div>

                    <div className="relative px-4 pt-7 pb-4">
                      {/* Score badge floats over the header/content seam */}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                        <ScoreButtonPair
                          scoreA={isCompleted ? m.team_a_score : draft.scoreA}
                          scoreB={isCompleted ? m.team_b_score : draft.scoreB}
                          isCompleted={isCompleted}
                          winnerSide={m.winner_side}
                          disabled={!isHostOrAdmin}
                          isSubmitting={isSubmittingThis}
                          onTapA={() =>
                            setActivePicker({ matchId: m.id, team: 'A', teamName: teamAName, currentScore: draft.scoreA })
                          }
                          onTapB={() =>
                            setActivePicker({ matchId: m.id, team: 'B', teamName: teamBName, currentScore: draft.scoreB })
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {renderTeam(teamA, 'A')}
                        <span className="shrink-0 h-6 w-6 rounded-full bg-white border border-zinc-200 text-zinc-400 text-[9px] font-bold flex items-center justify-center uppercase">
                          vs
                        </span>
                        {renderTeam(teamB, 'B')}
                      </div>

                      {isCompleted && hasEloData && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedEloMatchId(isEloExpanded ? null : m.id)}
                            className="w-full flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 py-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                          >
                            <span>{isEloExpanded ? 'Hide' : 'Show'} ELO Changes</span>
                            {isEloExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>

                          {isEloExpanded && (
                            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                              <div className="space-y-2.5">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Team A</span>
                                {teamA.map(eloRow)}
                              </div>
                              <div className="space-y-2.5">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Team B</span>
                                {teamB.map(eloRow)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isHostOrAdmin && isCompleted && (
                        <Link
                          href={`/c/${communitySlug}/sessions/${sessionId}/m/${m.id}`}
                          className="block text-center text-xs font-bold py-2 mt-2 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl border border-zinc-200/60 transition-all text-zinc-700"
                        >
                          Edit Score
                        </Link>
                      )}

                      {isSubmittingThis && (
                        <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider text-orange-600 bg-orange-100/90 py-2.5 px-3 rounded-xl border border-orange-200 mt-3 animate-pulse">
                          <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                          <span>Updating system & calculating ELO...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generate Next Round Button — placed at bottom of match list */}
          {isHostOrAdmin && (
            <div className="pt-2">
              <GenerateRoundButton
                nextRoundNumber={nextRoundNumber}
                onGenerate={handleGenerateClick}
                isGenerating={isGenerating}
                disabled={!canGenerateNextRound || isFinalizing}
                showEndSession={false}
              />
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

          <StandingsTable standings={standings} />

          {/* End Session Button — only shown in Leaderboard tab */}
          {isHostOrAdmin && totalRounds > 0 && (
            <div className="pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleFinalizeClick}
                disabled={isFinalizing || isGenerating}
                className="w-full py-3 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-white shadow-sm disabled:opacity-50"
              >
                {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>End Session & Finalize Ratings</span>
              </button>
            </div>
          )}
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

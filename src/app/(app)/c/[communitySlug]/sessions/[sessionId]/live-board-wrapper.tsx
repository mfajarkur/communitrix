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
import { setMatchSubstituteAction } from '@/server/actions/substitute.actions';
import { HelpCircle, Loader2, ChevronDown, ChevronUp, Repeat, X } from 'lucide-react';
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
import { explainEloMatch } from '@/lib/elo/calculate';
import { useStatusRibbon } from '@/components/status-ribbon/status-ribbon-provider';

interface MatchPlayer {
  profile_id: string;
  team: 'A' | 'B';
  slot: number;
  elo_before: number | null;
  elo_delta: number | null;
  elo_after: number | null;
  k_factor: number | null;
  // Set when this slot was "joki'd" — someone else played this match in the original player's
  // place. Game/session stats (renderTeam, standings) always stay on `profile`; only the Elo
  // breakdown (eloRow) attributes to `elo_profile` instead. See supabase/migrations/0037.
  elo_profile_id: string | null;
  profile: {
    full_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  elo_profile: {
    full_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
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
  formula_version: number;
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
  avatarUrl?: string | null;
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
  rounds: roundsProp,
  matches: matchesProp,
  sessionPlayers,
  standings,
}: LiveBoardWrapperProps) {
  const router = useRouter();
  const supabase = createClient();
  const { showStatus, clearStatus } = useStatusRibbon();

  // Local copies so a just-submitted score or a just-generated round can be shown optimistically
  // the instant the request succeeds, instead of waiting on router.refresh()'s server round-trip
  // (a real network+re-render cost, easily ~2s) even though the button's own submitting
  // animation already ended. Re-synced from the props whenever fresh server data lands
  // (router.refresh() completing, or a Realtime event from another host), which naturally
  // reconciles/corrects the optimistic guess with the real thing (e.g. once Elo deltas are
  // computed) — see submitScore/handleGenerateClick below.
  const [matches, setMatches] = useState<Match[]>(matchesProp);
  useEffect(() => {
    setMatches(matchesProp);
  }, [matchesProp]);

  const [rounds, setRounds] = useState<Round[]>(roundsProp);
  useEffect(() => {
    setRounds(roundsProp);
  }, [roundsProp]);

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

  // "Joki" mid-match substitute picker — only offered while a match is unscored (see
  // set_match_substitute's own server-side guard for the authoritative version of this rule).
  const [subPickerFor, setSubPickerFor] = useState<{
    matchId: string;
    originalProfileId: string;
    originalName: string;
  } | null>(null);
  const [isSettingSub, setIsSettingSub] = useState(false);

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

  // For filling in avatar/name on an optimistically-rendered round — generateNextRoundAction's
  // preview only returns {id, name} per player, not avatar_url.
  const sessionPlayerMap = useMemo(() => new Map(sessionPlayers.map((p) => [p.id, p])), [sessionPlayers]);

  const latestRoundMatches = useMemo(
    () => matches.filter((m) => m.round_number === latestRoundNumber),
    [matches, latestRoundNumber]
  );
  const allMatchesCompleted = latestRoundMatches.length > 0 && latestRoundMatches.every((m) => m.status === 'COMPLETED');
  // Mexicano seeds each round off the standings/results of the round before it, so generating
  // ahead of an unfinished round pairs players against stale data — repeat opponents, wrong
  // seeding. Americano's pairing doesn't depend on results, so it stays ungated here (mirrors
  // the same format branch enforced server-side in generateNextRoundAction).
  const canGenerateNextRound =
    totalRounds === 0 || sessionMeta.format !== 'MEXICANO' || allMatchesCompleted;

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

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshBoard = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
    }, 250);
  };

  const submitScore = async (matchId: string, scoreA: number, scoreB: number) => {
    setSubmittingMatchId(matchId);
    setError(null);
    const statusId = showStatus('Updating score…');

    try {
      const result = await submitMatchScoreAction({ matchId, scoreA, scoreB, communitySlug });

      if (result.ok) {
        setScoreDrafts((prev) => {
          const next = new Map(prev);
          next.delete(matchId);
          return next;
        });
        if (result.data?.alreadyScored) {
          setError('Someone else already submitted a score for this match — showing their result instead.');
        } else {
          // Optimistic: we already know the score that was just accepted, so show it (and mark
          // the match complete) right now rather than waiting for refreshBoard()'s round-trip.
          // Elo/CP deltas aren't known yet — those still arrive once the refresh below lands.
          setMatches((prev) =>
            prev.map((m) =>
              m.id === matchId
                ? {
                    ...m,
                    status: 'COMPLETED',
                    team_a_score: scoreA,
                    team_b_score: scoreB,
                    winner_side: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null,
                  }
                : m
            )
          );
        }
        refreshBoard();
      } else {
        setError(result.message || 'Failed to submit score.');
      }
    } catch (err: any) {
      console.error('Error submitting match score:', err);
      setError(err?.message || 'An unexpected error occurred while saving the score.');
    } finally {
      setSubmittingMatchId(null);
      clearStatus(statusId);
    }
  };

  // Marks/changes (substituteProfileId set) or unmarks (substituteProfileId null) a joki
  // substitute for one match slot — see set_match_substitute for the actual Elo/CP split.
  const handleSetSubstitute = async (matchId: string, originalProfileId: string, substituteProfileId: string | null) => {
    setIsSettingSub(true);
    setError(null);
    try {
      const result = await setMatchSubstituteAction({ matchId, originalProfileId, substituteProfileId, communitySlug });
      if (result.ok) {
        setSubPickerFor(null);
        refreshBoard();
      } else {
        setError(result.message || 'Failed to set match substitute.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while setting the substitute.');
    } finally {
      setIsSettingSub(false);
    }
  };

  const handleFinalizeClick = async () => {
    // Ending a session no longer requires every court to be scored first — finalize_session
    // (0033) auto-voids anything still unfinished instead of rejecting. Warn the host up front
    // so voided courts aren't a silent surprise.
    const unfinishedCount = matches.filter((m) => m.status !== 'COMPLETED' && m.status !== 'VOIDED').length;
    const confirmMessage =
      unfinishedCount > 0
        ? `${unfinishedCount} match${unfinishedCount === 1 ? ' is' : 'es are'} still unscored and will be voided (won't count toward ratings or standings). End this session anyway?`
        : 'Are you sure you want to end this match session? This will finalize all ratings.';
    if (!confirm(confirmMessage)) return;
    setIsFinalizing(true);
    setError(null);
    const statusId = showStatus('Finalizing session…');
    try {
      const result = await finalizeSessionAction(sessionId);
      if (result.ok) {
        window.location.reload();
      } else {
        setIsFinalizing(false);
        clearStatus(statusId);
        setError(result.message || 'Failed to finalize session.');
      }
    } catch (err: any) {
      setIsFinalizing(false);
      clearStatus(statusId);
      setError(err?.message || 'An unexpected error occurred while finalizing session.');
    }
  };

  // Setup Supabase Realtime subscription for instant updates with debounced refreshBoard
  useEffect(() => {
    const channel = supabase
      .channel(`session-board:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${sessionId}` },
        () => refreshBoard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${sessionId}` },
        () => refreshBoard()
      )
      .subscribe();

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') refreshBoard();
    };
    window.addEventListener('online', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener('online', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [sessionId, supabase]);

  const handleGenerateClick = async () => {
    // Generate + persist in one step, matching Quick Match: a single click produces the
    // round and shows it immediately, with no separate "verify pairings" confirmation step.
    setIsGenerating(true);
    setError(null);
    const statusId = showStatus('Generating next round…');

    const result = await generateNextRoundAction(sessionId, nextRoundNumber);
    if (!result.ok) {
      setIsGenerating(false);
      setError(result.message);
      clearStatus(statusId);
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
    clearStatus(statusId);

    if (persistResult.ok) {
      // Optimistic: render this round from the preview we already have (real match ids came
      // back from persistRoundAction) instead of waiting on router.refresh()'s round-trip to
      // find out what we just asked the server to create. Elo/formula_version don't matter yet
      // — nothing in this round is scored — and get filled in for real once the refresh below
      // reconciles.
      const toMatchPlayer = (p: { id: string; name: string }, team: 'A' | 'B', slot: number): MatchPlayer => ({
        profile_id: p.id,
        team,
        slot,
        elo_before: null,
        elo_delta: null,
        elo_after: null,
        k_factor: null,
        elo_profile_id: null,
        profile: {
          full_name: sessionPlayerMap.get(p.id)?.name ?? p.name,
          display_name: null,
          avatar_url: sessionPlayerMap.get(p.id)?.avatarUrl ?? null,
        },
        elo_profile: null,
      });

      const newMatches: Match[] = preview.courts.map((c: any) => ({
        id: persistResult.data.matches.find((pm) => pm.courtNumber === c.courtNumber)?.id ?? `temp-${c.courtNumber}`,
        court_number: c.courtNumber,
        round_number: preview.roundNumber,
        round_id: persistResult.data.roundId,
        team_a_score: null,
        team_b_score: null,
        status: 'SCHEDULED',
        winner_side: null,
        formula_version: 2,
        match_players: [
          ...c.teamA.map((p: any, i: number) => toMatchPlayer(p, 'A', i + 1)),
          ...c.teamB.map((p: any, i: number) => toMatchPlayer(p, 'B', i + 1)),
        ],
      }));

      setMatches((prev) => [...prev, ...newMatches]);
      setRounds((prev) => [...prev, { id: persistResult.data.roundId, round_number: preview.roundNumber, status: 'ACTIVE' }]);
      refreshBoard();
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

                // Reconstructs the win-expectation / MoV / gap-penalty steps behind the already-
                // persisted delta, for the "Show ELO Changes" detail panel below — see
                // explainEloMatch's own comment for why this is a read-only recomputation rather
                // than newly-fetched data.
                const eloExplain =
                  hasEloData && m.team_a_score !== null && m.team_b_score !== null && teamA.length > 0 && teamB.length > 0
                    ? explainEloMatch({
                        teamARatings: teamA.map((mp) => mp.elo_before ?? 1000),
                        teamBRatings: teamB.map((mp) => mp.elo_before ?? 1000),
                        scoreA: m.team_a_score,
                        scoreB: m.team_b_score,
                        scoringType: sessionConfig.scoringType,
                        pointsMode: sessionConfig.pointsMode,
                        maxScoreTarget: sessionConfig.maxScoreTarget,
                        formulaVersion: m.formula_version,
                      })
                    : null;

                const renderTeam = (players: MatchPlayer[], side: 'A' | 'B') => {
                  const isWinner = isCompleted && m.winner_side === side;
                  return (
                    <div className={`flex-1 space-y-1.5 flex flex-col ${side === 'A' ? 'items-start' : 'items-end'}`}>
                      {players.map((mp) => (
                        <div
                          key={mp.profile_id}
                          className={`flex flex-col gap-0.5 min-w-0 ${side === 'B' ? 'items-end' : 'items-start'}`}
                        >
                          <div className={`flex items-center gap-1.5 min-w-0 ${side === 'B' ? 'flex-row-reverse' : ''}`}>
                            <img
                              src={getAvatarUrl({ id: mp.profile_id, avatar_url: mp.profile.avatar_url, full_name: mp.profile.full_name })}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover shrink-0 border border-zinc-200"
                            />
                            <span className={`font-bold text-xs sm:text-sm md:text-base truncate max-w-[100px] sm:max-w-[140px] md:max-w-[180px] ${isWinner ? 'text-orange-600' : 'text-zinc-700'}`}>
                              {getDisplayName(mp.profile)}
                            </span>
                          </div>
                          {!isCompleted && isHostOrAdmin && (
                            mp.elo_profile_id ? (
                              <button
                                type="button"
                                onClick={() => handleSetSubstitute(m.id, mp.profile_id, null)}
                                disabled={isSettingSub}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded-full transition-all cursor-pointer disabled:opacity-50"
                                title="Remove substitute — ELO reverts to this player"
                              >
                                <Repeat className="h-2.5 w-2.5" />
                                Subbed by {getDisplayName(mp.elo_profile)}
                                <X className="h-2.5 w-2.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setSubPickerFor({ matchId: m.id, originalProfileId: mp.profile_id, originalName: getDisplayName(mp.profile) })
                                }
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-zinc-400 hover:text-orange-600 px-1.5 py-0.5 rounded-full transition-all cursor-pointer"
                                title="Mark a substitute for this player"
                              >
                                <Repeat className="h-2.5 w-2.5" /> Sub
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  );
                };

                const eloRow = (mp: MatchPlayer) => {
                  const delta = mp.elo_delta ?? 0;
                  const isPositive = delta >= 0;
                  // A joki'd slot's ELO belongs to the substitute, not the roster name shown
                  // elsewhere on this card — see the MatchPlayer interface comment above.
                  const eloIdentity = mp.elo_profile_id ? mp.elo_profile : mp.profile;
                  return (
                    <div key={mp.profile_id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getAvatarUrl({ id: mp.elo_profile_id ?? mp.profile_id, avatar_url: eloIdentity?.avatar_url, full_name: eloIdentity?.full_name })}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover shrink-0 border border-zinc-200"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-800 truncate">
                            {getDisplayName(eloIdentity)}
                            {mp.elo_profile_id && (
                              <span className="text-[9px] font-bold text-orange-600 uppercase ml-1">(sub)</span>
                            )}
                          </p>
                          {mp.elo_before !== null && mp.elo_after !== null && (
                            <p className="text-[10px] text-zinc-400 font-mono tabular-nums">
                              {Math.round(mp.elo_before)} → {Math.round(mp.elo_after)}
                              {mp.k_factor !== null && ` · K ${mp.k_factor.toFixed(1)}`}
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
                        ? 'border-orange-500 ring-2 ring-orange-400/50 bg-orange-50/40 shadow-md'
                        : isCompleted
                        ? 'border-zinc-200 bg-white shadow-sm'
                        : 'border-zinc-200 border-l-4 border-l-orange-500 bg-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                      <span className="font-bold text-base text-[#111827]">Court {m.court_number}</span>
                      {isSubmittingThis ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-500 text-white shadow-sm">
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
                            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-4 animate-in fade-in duration-150">
                              {eloExplain && (
                                <div className="space-y-2.5 pb-3.5 border-b border-zinc-200/70">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Calculation Breakdown</span>
                                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                                    <div>
                                      <p className="text-zinc-500 font-semibold">Team A Rating</p>
                                      <p className="font-mono font-black text-zinc-800 tabular-nums">
                                        {Math.round(eloExplain.avgRatingA)}
                                        {m.formula_version >= 2 && eloExplain.gapA > 0 && (
                                          <span className="text-zinc-400 font-medium">
                                            {' '}→ {Math.round(eloExplain.effRatingA)} (gap −{Math.round(0.25 * eloExplain.gapA)})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-zinc-500 font-semibold">Team B Rating</p>
                                      <p className="font-mono font-black text-zinc-800 tabular-nums">
                                        {Math.round(eloExplain.avgRatingB)}
                                        {m.formula_version >= 2 && eloExplain.gapB > 0 && (
                                          <span className="text-zinc-400 font-medium">
                                            {' '}→ {Math.round(eloExplain.effRatingB)} (gap −{Math.round(0.25 * eloExplain.gapB)})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-zinc-500 font-semibold">Win Expectation</p>
                                      <p className="font-mono font-black text-zinc-800 tabular-nums">
                                        A {Math.round(eloExplain.expectedScoreA * 100)}% · B {Math.round(eloExplain.expectedScoreB * 100)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-zinc-500 font-semibold">Margin of Victory</p>
                                      <p className="font-mono font-black text-zinc-800 tabular-nums">×{eloExplain.mov.toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    Delta = K-Factor × MoV × (Actual Result − Win Expectation). Actual result for Team A:{' '}
                                    {eloExplain.outcomeA === 'WIN' ? 'Win (1.0)' : eloExplain.outcomeA === 'LOSS' ? 'Loss (0.0)' : 'Draw (0.5)'}.
                                  </p>
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2.5">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Team A</span>
                                  {teamA.map(eloRow)}
                                </div>
                                <div className="space-y-2.5">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Team B</span>
                                  {teamB.map(eloRow)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isHostOrAdmin && isCompleted && (
                        <Link
                          href={`/c/${communitySlug}/sessions/${sessionId}/m/${m.id}`}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 mt-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-sm w-full"
                        >
                          Edit Score
                        </Link>
                      )}

                      {isSubmittingThis && (
                        <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider text-orange-600 bg-orange-100/90 py-2.5 px-3 rounded-xl border border-orange-200 mt-3">
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
            <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Leaderboard Standings</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
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

      {/* "Joki" Substitute Picker Modal — candidates are whoever is sitting out this round
          (the same pool the "Sitting Out (Bye)" banner already shows) since anyone already on
          another court can't also sub in here. */}
      {subPickerFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-extrabold text-sm text-zinc-900 flex items-center gap-2">
                <Repeat className="h-4 w-4 text-orange-500" />
                Substitute for {subPickerFor.originalName}
              </h3>
              <button
                onClick={() => setSubPickerFor(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              ELO from this match goes to the substitute. {subPickerFor.originalName} keeps the game score and takes a CP penalty for being subbed out.
            </p>

            {sitOuts.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">No one is sitting out this round to substitute in.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {sitOuts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSetSubstitute(subPickerFor.matchId, subPickerFor.originalProfileId, p.id)}
                    disabled={isSettingSub}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-zinc-200 hover:border-orange-400 hover:bg-orange-50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <img
                      src={getAvatarUrl({ id: p.id, avatar_url: p.avatarUrl, full_name: p.name })}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-zinc-200 shrink-0"
                    />
                    <span className="text-xs font-bold text-zinc-800 truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

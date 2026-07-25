'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateElo } from '@/lib/elo/calculate';
import {
  submitMatchScoreAction,
  amendMatchScoreAction,
  voidMatchAction,
} from '@/server/actions/match.actions';
import {
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface ScorerPlayer {
  id: string;
  fullName: string;
  eloBefore: number;
  totalMatchesPlayed: number;
}

interface ScorerFormProps {
  matchId: string;
  sessionId: string;
  communitySlug: string;
  teamAPlayers: ScorerPlayer[];
  teamBPlayers: ScorerPlayer[];
  sessionConfig: {
    sport: 'PADEL' | 'TENNIS';
    scoringType: 'POINTS' | 'GAMES';
    pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED';
    maxScoreTarget: number;
    roundsPlanned: number | null;
    courtCount: number;
    matchType: 'SINGLES' | 'DOUBLES';
    format: 'AMERICANO' | 'MEXICANO';
    attendeeCount: number;
  };
  initialScoreA?: number;
  initialScoreB?: number;
  initialStatus?: string;
}

export default function ScorerForm({
  matchId,
  sessionId,
  communitySlug,
  teamAPlayers,
  teamBPlayers,
  sessionConfig,
  initialScoreA,
  initialScoreB,
  initialStatus,
}: ScorerFormProps) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState(initialScoreA ?? 0);
  const [scoreB, setScoreB] = useState(initialScoreB ?? 0);
  const [isOnline, setIsOnline] = useState(true);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(`courtside-draft-${matchId}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setScoreA(draft.a);
        setScoreB(draft.b);
      } catch (e) {}
    }
  }, [matchId]);

  // 2. Save draft when score modifications occur
  const updateScoreA = (val: number) => {
    setScoreA(val);
    localStorage.setItem(
      `courtside-draft-${matchId}`,
      JSON.stringify({ a: val, b: scoreB, dirty: false })
    );
  };

  const updateScoreB = (val: number) => {
    setScoreB(val);
    localStorage.setItem(
      `courtside-draft-${matchId}`,
      JSON.stringify({ a: scoreA, b: val, dirty: false })
    );
  };

  // 3. Keep track of online connectivity status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      // Auto-submit once on reconnect if a dirty draft exists
      const saved = localStorage.getItem(`courtside-draft-${matchId}`);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.dirty) {
            console.log('Reconnected! Auto-submitting cached score draft...');
            setError(null);
            setIsSubmitting(true);
            const result = await submitMatchScoreAction({
              matchId,
              scoreA: draft.a,
              scoreB: draft.b,
            });
            setIsSubmitting(false);
            if (result.ok) {
              localStorage.removeItem(`courtside-draft-${matchId}`);
              router.push(`/c/${communitySlug}/sessions/${sessionId}`);
              router.refresh();
            } else {
              setError(`Reconnected but submit failed: ${result.message}`);
            }
          }
        } catch (e) {}
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [matchId, router, communitySlug, sessionId]);

  // Client-side ELO preview calculation using Phase 3 TypeScript logic
  const playersPerMatch =
    sessionConfig.sport === 'PADEL' || sessionConfig.matchType === 'DOUBLES'
      ? 4
      : 2;

  const eloInput = {
    teamA: teamAPlayers.map(p => ({
      id: p.id,
      ratingBefore: p.eloBefore,
      totalMatchesPlayed: p.totalMatchesPlayed,
    })),
    teamB: teamBPlayers.map(p => ({
      id: p.id,
      ratingBefore: p.eloBefore,
      totalMatchesPlayed: p.totalMatchesPlayed,
    })),
    scoreA,
    scoreB,
    scoringType: sessionConfig.scoringType,
    pointsMode: sessionConfig.pointsMode,
    maxScoreTarget: sessionConfig.maxScoreTarget,
    roundsPlanned: sessionConfig.roundsPlanned,
    courtCount: sessionConfig.courtCount,
    playersPerMatch: playersPerMatch as 2 | 4,
    attendeeCount: sessionConfig.attendeeCount,
  };

  let eloResults = { teamADeltas: [] as any[], teamBDeltas: [] as any[] };
  try {
    eloResults = calculateElo(eloInput);
  } catch (e) {
    // Suppress calculation errors during transient score states (like scoreA = scoreB = 0)
  }

  const handleIncrementA = () => {
    updateScoreA(Math.min(scoreA + 1, 99));
  };

  const handleDecrementA = () => {
    updateScoreA(Math.max(scoreA - 1, 0));
  };

  const handleIncrementB = () => {
    updateScoreB(Math.min(scoreB + 1, 99));
  };

  const handleDecrementB = () => {
    updateScoreB(Math.max(scoreB - 1, 0));
  };

  const handleSubmit = async () => {
    setError(null);

    // If browser is offline, save score as a dirty draft and notify user
    if (!navigator.onLine) {
      localStorage.setItem(
        `courtside-draft-${matchId}`,
        JSON.stringify({ a: scoreA, b: scoreB, dirty: true })
      );
      setError('Offline: Koneksi terputus! Skor Anda telah disimpan sementara di perangkat ini dan akan dikirim otomatis saat internet terhubung kembali.');
      setShowConfirm(false);
      return;
    }

    setIsSubmitting(true);

    const isAmendment = initialStatus === 'COMPLETED';
    
    if (isAmendment && reason.trim().length === 0) {
      setError('Please enter a reason for the amendment.');
      setIsSubmitting(false);
      return;
    }

    const result = isAmendment
      ? await amendMatchScoreAction({
          matchId,
          scoreA,
          scoreB,
          reason: reason.trim(),
        })
      : await submitMatchScoreAction({
          matchId,
          scoreA,
          scoreB,
        });

    if (result.ok) {
      localStorage.removeItem(`courtside-draft-${matchId}`);
      router.push(`/c/${communitySlug}/sessions/${sessionId}`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setShowConfirm(false);
      setError(result.message);
    }
  };

  const handleVoidSubmit = async () => {
    if (reason.trim().length === 0) {
      setError('Please enter a reason for voiding this match.');
      return;
    }
    setIsVoiding(true);
    setError(null);

    const result = await voidMatchAction({
      matchId,
      reason: reason.trim(),
    });

    if (result.ok) {
      router.push(`/c/${communitySlug}/sessions/${sessionId}`);
      router.refresh();
    } else {
      setIsVoiding(false);
      setShowVoidConfirm(false);
      setError(result.message);
    }
  };

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="flex items-center gap-2.5 rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm text-orange-850 animate-pulse">
          <AlertCircle className="h-5 w-5 shrink-0 text-orange-500" />
          <span>Offline: Koneksi terputus! Skor Anda tersimpan sementara di perangkat ini.</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Back button */}
      <Link
        href={`/c/${communitySlug}/sessions/${sessionId}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-550 hover:text-orange-500 transition-all"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Session Board
      </Link>

      <div className="grid grid-cols-2 gap-4 text-zinc-900">
        {/* Team A score adjustment */}
        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center gap-4 shadow-sm">
          <span className="text-xs font-bold text-zinc-500">TEAM A</span>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleDecrementA}
              className="h-14 w-14 rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-all border border-zinc-200 text-zinc-800 shadow-sm"
            >
              <Minus className="h-6 w-6" />
            </button>
            <span className="text-5xl font-black tabular-nums tracking-tight text-[#111827]">
              {scoreA}
            </span>
            <button
              type="button"
              onClick={handleIncrementA}
              className="h-14 w-14 rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-all border border-zinc-200 text-zinc-800 shadow-sm"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <div className="text-center space-y-1 mt-2">
            {teamAPlayers.map(p => (
              <p key={p.id} className="text-sm font-bold text-zinc-800">
                {p.fullName}
              </p>
            ))}
          </div>
        </div>

        {/* Team B score adjustment */}
        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center gap-4 shadow-sm">
          <span className="text-xs font-bold text-zinc-500">TEAM B</span>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleDecrementB}
              className="h-14 w-14 rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-all border border-zinc-200 text-zinc-800 shadow-sm"
            >
              <Minus className="h-6 w-6" />
            </button>
            <span className="text-5xl font-black tabular-nums tracking-tight text-[#111827]">
              {scoreB}
            </span>
            <button
              type="button"
              onClick={handleIncrementB}
              className="h-14 w-14 rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-all border border-zinc-200 text-zinc-800 shadow-sm"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <div className="text-center space-y-1 mt-2">
            {teamBPlayers.map(p => (
              <p key={p.id} className="text-sm font-bold text-zinc-800">
                {p.fullName}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Live Elo Forecast Rating deltas */}
      {eloResults.teamADeltas.length > 0 && (
        <div className="p-4 rounded-xl bg-orange-500/[0.04] border border-orange-500/10 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
            Live ELO Rating Forecast
          </h4>
          <div className="grid grid-cols-2 gap-6 pt-1">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Team A Elo shifts</span>
              {eloResults.teamADeltas.map(d => {
                const player = teamAPlayers.find(p => p.id === d.id);
                const isPositive = d.delta >= 0;
                return (
                  <div key={d.id} className="flex justify-between items-center text-xs">
                    <span className="text-zinc-700 font-bold truncate pr-2 max-w-[120px]">
                      {player?.fullName}
                    </span>
                    <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? '+' : ''}
                      {d.delta.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Team B Elo shifts</span>
              {eloResults.teamBDeltas.map(d => {
                const player = teamBPlayers.find(p => p.id === d.id);
                const isPositive = d.delta >= 0;
                return (
                  <div key={d.id} className="flex justify-between items-center text-xs">
                    <span className="text-zinc-700 font-bold truncate pr-2 max-w-[120px]">
                      {player?.fullName}
                    </span>
                    <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? '+' : ''}
                      {d.delta.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Submit & Admin panel */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all font-bold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{initialStatus === 'COMPLETED' ? 'Amend Match Score' : 'Submit Match Score'}</span>
        </button>

        {initialStatus === 'COMPLETED' && (
          <button
            type="button"
            onClick={() => setShowVoidConfirm(true)}
            className="w-full h-12 rounded-xl border border-red-200 bg-white hover:bg-red-50 transition-all font-bold text-red-650 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <span>Void Match</span>
          </button>
        )}
      </div>

      {/* Confirmation Dialog Sheet for scoring / amending */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-zinc-100 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1">
              <CheckCircle2 className="h-8 w-8 text-orange-500 mx-auto" />
              <h3 className="text-lg font-extrabold tracking-tight text-[#111827] mt-2">
                {initialStatus === 'COMPLETED' ? 'Confirm Amendment' : 'Confirm Match Score'}
              </h3>
              <p className="text-xs text-zinc-500">
                Are you sure? This will trigger a full ELO ratings recalculation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-center gap-6 text-2xl font-black text-zinc-900 shadow-sm">
              <div className="text-center">
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Team A
                </span>
                <span className="text-[#111827] mt-1 block">{scoreA}</span>
              </div>
              <span className="text-zinc-400 font-semibold">—</span>
              <div className="text-center">
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Team B
                </span>
                <span className="text-[#111827] mt-1 block">{scoreB}</span>
              </div>
            </div>

            {initialStatus === 'COMPLETED' && (
              <div className="space-y-1.5 text-zinc-900">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Reason for Amendment
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Typo in previous score entry"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none shadow-sm"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 h-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 h-10 rounded-lg bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Sheet for voiding */}
      {showVoidConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-zinc-100 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
              <h3 className="text-lg font-extrabold tracking-tight text-[#111827] mt-2">
                Void Match
              </h3>
              <p className="text-xs text-zinc-500">
                Are you sure you want to void this match? This will remove all ELO calculations for this match and recalculate.
              </p>
            </div>

            <div className="space-y-1.5 text-zinc-900">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Reason for Voiding
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Player withdrew mid-match"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none shadow-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowVoidConfirm(false)}
                disabled={isVoiding}
                className="flex-1 h-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoidSubmit}
                disabled={isVoiding || reason.trim().length === 0}
                className="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isVoiding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Void Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

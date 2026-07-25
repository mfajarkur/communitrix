'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startSessionAction } from '@/server/actions/session.actions';
import {
  Trophy,
  Users,
  LayoutGrid,
  Calendar,
  AlertCircle,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';

interface Player {
  id: string;
  fullName: string;
  isGuest: boolean;
  avatarUrl: string | null;
}

interface WizardFormProps {
  communityId: string;
  communitySlug: string;
  players: Player[];
}

export default function WizardForm({
  communityId,
  communitySlug,
  players,
}: WizardFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(
    `Match Session - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`
  );
  const [sport, setSport] = useState<'PADEL' | 'TENNIS'>('PADEL');
  const [format, setFormat] = useState<'AMERICANO' | 'MEXICANO'>('AMERICANO');
  const [matchType, setMatchType] = useState<'DOUBLES' | 'SINGLES'>('DOUBLES');
  const [scoringType, setScoringType] = useState<'POINTS' | 'GAMES'>('POINTS');
  const [pointsMode, setPointsMode] = useState<
    'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED'
  >('FIRST_TO_TARGET');
  const [maxScoreTarget, setMaxScoreTarget] = useState(21);
  const [courtCount, setCourtCount] = useState(2);
  const [roundsPlanned, setRoundsPlanned] = useState<number | null>(8);

  // Attendance states
  const [selectedIds, setSelectedIds] = useState<string[]>(
    players.map(p => p.id)
  );

  // Dynamic capacity calculations
  const playersPerMatch = sport === 'PADEL' || matchType === 'DOUBLES' ? 4 : 2;
  const activeCount = selectedIds.length;
  const playingSlots =
    Math.min(Math.floor(activeCount / playersPerMatch), courtCount) *
    playersPerMatch;
  const sitOutCount = activeCount - playingSlots;
  const activeCourts = playingSlots / playersPerMatch;

  const handleTogglePlayer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(players.map(p => p.id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Frontend validations
    if (selectedIds.length === 0) {
      setError('Please select at least one player.');
      setIsSubmitting(false);
      return;
    }

    if (sport === 'PADEL' && selectedIds.length < 4) {
      setError('Padel requires at least 4 players.');
      setIsSubmitting(false);
      return;
    }

    if (sport === 'TENNIS' && format === 'AMERICANO' && selectedIds.length < 2) {
      setError('Tennis Americano requires at least 2 players.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await startSessionAction({
        communityId,
        name,
        format,
        sport,
        scoringType,
        pointsMode,
        maxScoreTarget,
        courtCount,
        roundsPlanned,
        attendeeIds: selectedIds,
      });

      if (result.ok) {
        // Redirect directly to the live board of the newly started session
        router.push(`/c/${communitySlug}/sessions/${result.data.sessionId}`);
        router.refresh();
      } else {
        setIsSubmitting(false);
        setError(result.message);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'An unexpected client-side error occurred. Please check console logs.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-8 items-start">
      {/* Configuration column */}
      <div className="md:col-span-2 space-y-6">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <LayoutGrid className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-zinc-900 dark:text-white">1. Session Parameters</h3>
          </div>

          <div className="space-y-4">
            {/* Session Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-sm focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:focus:bg-zinc-950"
                required
              />
            </div>

            {/* Sport & Format */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Sport Type
                </label>
                <div className="grid grid-cols-2 gap-2 h-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSport('PADEL');
                      setMatchType('DOUBLES');
                    }}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      sport === 'PADEL'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Padel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSport('TENNIS')}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      sport === 'TENNIS'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Tennis
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Session Format
                </label>
                <div className="grid grid-cols-2 gap-2 h-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormat('AMERICANO')}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      format === 'AMERICANO'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Americano
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('MEXICANO')}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      format === 'MEXICANO'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Mexicano
                  </button>
                </div>
              </div>
            </div>

            {/* Match Type for Tennis */}
            {sport === 'TENNIS' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Tennis Match Type
                </label>
                <div className="grid grid-cols-2 gap-2 h-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMatchType('DOUBLES')}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      matchType === 'DOUBLES'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Doubles (4 Players)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchType('SINGLES')}
                    className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      matchType === 'SINGLES'
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    Singles (2 Players)
                  </button>
                </div>
              </div>
            )}

            {/* Courts and Rounds configuration */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Court Count (1 - 12)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={courtCount}
                  onChange={e => setCourtCount(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-sm focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:focus:bg-zinc-950"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Rounds Planned (1 - 30)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={roundsPlanned || ''}
                  onChange={e =>
                    setRoundsPlanned(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-sm focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:focus:bg-zinc-950"
                  placeholder="Unlimited / Auto"
                />
              </div>
            </div>

            {/* Scoring Settings */}
            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Scoring Unit
                  </label>
                  <div className="grid grid-cols-2 gap-2 h-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setScoringType('POINTS')}
                      className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        scoringType === 'POINTS'
                          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Points (e.g. 21)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScoringType('GAMES');
                        setPointsMode('FIRST_TO_TARGET');
                      }}
                      className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        scoringType === 'GAMES'
                          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Games (e.g. Sets)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Max Score Target
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={maxScoreTarget}
                    onChange={e => setMaxScoreTarget(parseInt(e.target.value) || 1)}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-sm focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:focus:bg-zinc-950"
                    required
                  />
                </div>
              </div>

              {scoringType === 'POINTS' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Points Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2 h-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPointsMode('FIRST_TO_TARGET')}
                      className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        pointsMode === 'FIRST_TO_TARGET'
                          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Target Race
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsMode('FIXED_TOTAL')}
                      className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        pointsMode === 'FIXED_TOTAL'
                          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Fixed Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsMode('TIMED')}
                      className={`text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        pointsMode === 'TIMED'
                          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Timed Match
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live capacity dashboard indicator */}
        <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 dark:bg-indigo-950/20 dark:border-indigo-900/50 dark:text-indigo-300">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h4 className="font-bold text-sm">Live Court Capacity Calculations</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-3 border-t border-indigo-100/50 dark:border-indigo-900/30">
            <div>
              <span className="text-xs text-indigo-600/75 dark:text-indigo-400/80">Attendees</span>
              <p className="text-xl font-bold mt-0.5">{activeCount}</p>
            </div>
            <div>
              <span className="text-xs text-indigo-600/75 dark:text-indigo-400/80">Active Courts</span>
              <p className="text-xl font-bold mt-0.5">{activeCourts}</p>
            </div>
            <div>
              <span className="text-xs text-indigo-600/75 dark:text-indigo-400/80">Playing</span>
              <p className="text-xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{playingSlots}</p>
            </div>
            <div>
              <span className="text-xs text-indigo-600/75 dark:text-indigo-400/80">Sitting Out</span>
              <p className={`text-xl font-bold mt-0.5 ${sitOutCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {sitOutCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance selection column */}
      <div className="space-y-6">
        <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col max-h-[600px]">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-zinc-900 dark:text-white">2. Attendance</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {selectedIds.length} / {players.length}
            </span>
          </div>

          {/* Quick Select Actions */}
          <div className="flex items-center gap-2 py-3 shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex-1 text-xs font-semibold py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-all dark:border-zinc-800 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="flex-1 text-xs font-semibold py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-all dark:border-zinc-800 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Clear All
            </button>
          </div>

          {/* Players list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
            {players.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400">
                No members found in this community yet.
              </div>
            ) : (
              players.map(p => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleTogglePlayer(p.id)}
                    className={`flex items-center justify-between w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500/50'
                        : 'border-zinc-150 hover:bg-zinc-55/40 hover:border-zinc-250 dark:border-zinc-800 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
                        {p.fullName.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">
                          {p.fullName}
                        </p>
                        {p.isGuest && (
                          <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                            Guest
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 dark:shadow-none cursor-pointer shrink-0"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Trophy className="h-5 w-5" />
          )}
          <span>Start Match Session</span>
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { startSessionAction } from '@/server/actions/session.actions';
import { addGuestPlayerAction } from '@/server/actions/member.actions';
import {
  Trophy,
  Users,
  LayoutGrid,
  AlertCircle,
  Loader2,
  Check,
  Zap,
  ArrowLeft,
  ChevronDown,
  Plus,
  UserPlus,
  Flame,
  Award,
  Sparkles,
} from 'lucide-react';

// ==========================================
// 1. DATA MODELS & STATE INTERFACES
// ==========================================

export type SportType = 'PADEL' | 'TENNIS';
export type GameType = 'AMERICANO' | 'MEXICANO' | 'TEAM_AMERICANO' | 'TEAM_MEXICANO';
export type ScoringSystem = 'POINTS' | 'GENERAL';
export type LeaderboardRankBy = 'POINT' | 'WIN';

export interface GameConfiguration {
  sport: SportType;
  gameType: GameType;
  activityName: string;
  courtCount: number;
  scoringSystem: ScoringSystem;
  pointTarget: string;
  leaderboardRankedBy: LeaderboardRankBy;
}

export interface PlayerRegistration {
  id: string;
  name: string;
  isGuest: boolean;
  avatarUrl?: string | null;
}

export interface Match {
  id: string;
  roundNumber: number;
  courtNumber: number;
  teamA: [string, string]; // Player IDs or names
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
  isCompleted: boolean;
}

export interface PlayerStanding {
  rank: number;
  playerId: string;
  name: string;
  avatarUrl?: string | null;
  isGuest: boolean;
  wins: number;
  losses: number;
  ties: number;
  pointsWon: number;
  pointsLost: number;
  diff: number;
  totalPoints: number;
  lastMatchPoints: number;
}

interface Player {
  id: string;
  fullName: string;
  isGuest: boolean;
  avatarUrl: string | null;
}

interface CurrentProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface WizardFormProps {
  communityId: string;
  communitySlug: string;
  players: Player[];
  currentProfile: CurrentProfile;
}

const POINTS_TARGET_OPTIONS = [
  '16 Points',
  '24 Points',
  '32 Points',
  '12 Points',
  '21 Points',
  '25 Points',
];

const GENERAL_TARGET_OPTIONS = [
  'Total of 3',
  'Total of 4',
  'Total of 5',
  'Total of 6',
  'Total of 7',
  'First to 3',
  'First to 4',
  'First to 5',
  'First to 6',
  'First to 7',
  'First to 8',
  'First to 10',
  'First to 11',
  'First to 15',
  'First to 21',
  'First to 25',
];

export default function WizardForm({
  communityId,
  communitySlug,
  players: initialPlayers,
  currentProfile,
}: WizardFormProps) {
  const router = useRouter();

  // Wizard Step State (1: Game Type, 2: Setup Config, 3: Registration, 4: Match Generation, 5: Leaderboard)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ------------------------------------------
  // STEP 1 & 2: CONFIGURATION STATE
  // ------------------------------------------
  const [config, setConfig] = useState<GameConfiguration>({
    sport: 'PADEL',
    gameType: 'AMERICANO',
    activityName: `Match Session - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    courtCount: 1,
    scoringSystem: 'POINTS',
    pointTarget: '16 Points',
    leaderboardRankedBy: 'POINT',
  });

  // ------------------------------------------
  // STEP 3: PLAYER REGISTRATION STATE
  // ------------------------------------------
  const [registeredPlayers, setRegisteredPlayers] = useState<PlayerRegistration[]>([]);
  const [manualInputName, setManualInputName] = useState('');
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(null);

  // Community member list for selection
  const [availableCommunityPlayers, setAvailableCommunityPlayers] = useState<Player[]>(initialPlayers);

  // ------------------------------------------
  // STEP 4: MATCHES STATE
  // ------------------------------------------
  const [matches, setMatches] = useState<Match[]>([]);

  // System Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper map for fast player lookup by ID
  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerRegistration>();
    registeredPlayers.forEach((p) => map.set(p.id, p));
    return map;
  }, [registeredPlayers]);

  // ==========================================
  // HELPER ACTIONS & LOGIC
  // ==========================================

  // Step 1: Select Game Type
  const handleSelectGameType = (type: GameType) => {
    setConfig((prev) => ({ ...prev, gameType: type }));
    setStep(2);
  };

  // Step 2: Confirm Configuration
  const handleConfirmConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.activityName.trim()) {
      setErrorMessage('Please enter an activity name.');
      return;
    }
    setErrorMessage(null);
    setStep(3);
  };

  // Step 3: Add Yourself
  const handleAddYourself = () => {
    if (registeredPlayers.some((p) => p.id === currentProfile.id)) return;
    setRegisteredPlayers((prev) => [
      ...prev,
      {
        id: currentProfile.id,
        name: currentProfile.name,
        isGuest: false,
        avatarUrl: currentProfile.avatarUrl,
      },
    ]);
  };

  // Step 3: Add Existing Member from List
  const handleToggleCommunityPlayer = (p: Player) => {
    if (registeredPlayers.some((existing) => existing.id === p.id)) {
      setRegisteredPlayers((prev) => prev.filter((existing) => existing.id !== p.id));
    } else {
      setRegisteredPlayers((prev) => [
        ...prev,
        {
          id: p.id,
          name: p.fullName,
          isGuest: p.isGuest,
          avatarUrl: p.avatarUrl,
        },
      ]);
    }
  };

  // Step 3: Add Manual Player (Regular or Guest)
  const handleAddManualPlayer = async (isGuest: boolean) => {
    const name = manualInputName.trim();
    if (!name) return;

    if (isGuest) {
      setIsAddingGuest(true);
      setGuestErrorMessage(null);
      // Create guest profile in database
      const result = await addGuestPlayerAction({ communityId, fullName: name });
      setIsAddingGuest(false);

      if (result.ok && result.data) {
        const newGuest: PlayerRegistration = {
          id: result.data.id,
          name: result.data.full_name || name,
          isGuest: true,
          avatarUrl: null,
        };
        setRegisteredPlayers((prev) => [...prev, newGuest]);
        setManualInputName('');
      } else {
        // Fallback to local guest if offline / dev
        const tempGuestId = `guest-${Date.now()}`;
        setRegisteredPlayers((prev) => [
          ...prev,
          { id: tempGuestId, name: `${name} (Guest)`, isGuest: true, avatarUrl: null },
        ]);
        setManualInputName('');
      }
    } else {
      const tempId = `player-${Date.now()}`;
      setRegisteredPlayers((prev) => [
        ...prev,
        { id: tempId, name, isGuest: false, avatarUrl: null },
      ]);
      setManualInputName('');
    }
  };

  const handleRemovePlayer = (id: string) => {
    setRegisteredPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Step 3 -> 4: Generate Matches
  const handleGenerateMatches = () => {
    if (registeredPlayers.length < 4) {
      setErrorMessage('Minimum 4 players required to generate matches.');
      return;
    }
    setErrorMessage(null);

    // Round-robin / Americano doubles match generation algorithm
    const generated: Match[] = [];
    const p = registeredPlayers;
    const numPlayers = p.length;

    let matchCounter = 1;
    // Generate balanced 2v2 doubles matches
    for (let i = 0; i < numPlayers; i++) {
      for (let j = i + 1; j < numPlayers; j++) {
        for (let k = j + 1; k < numPlayers; k++) {
          for (let l = k + 1; l < numPlayers; l++) {
            if (matchCounter > 12) break; // Cap at 12 matches for smooth session play

            const courtNum = ((matchCounter - 1) % config.courtCount) + 1;
            const roundNum = Math.ceil(matchCounter / config.courtCount);

            generated.push({
              id: `match-${matchCounter}`,
              roundNumber: roundNum,
              courtNumber: courtNum,
              teamA: [p[i].id, p[j].id],
              teamB: [p[k].id, p[l].id],
              scoreA: null,
              scoreB: null,
              isCompleted: false,
            });

            matchCounter++;
          }
        }
      }
    }

    setMatches(generated);
    setStep(4);
  };

  // Step 4: Update Score in Match
  const handleUpdateScore = (matchId: string, scoreA: number | null, scoreB: number | null) => {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        const isComp = scoreA !== null && scoreB !== null && !isNaN(scoreA) && !isNaN(scoreB);
        return {
          ...m,
          scoreA,
          scoreB,
          isCompleted: isComp,
        };
      })
    );
  };

  // ==========================================
  // STEP 5: CALCULATE DYNAMIC LEADERBOARD
  // ==========================================
  const standings: PlayerStanding[] = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        wins: number;
        losses: number;
        ties: number;
        pointsWon: number;
        pointsLost: number;
        lastMatchPoints: number;
      }
    >();

    registeredPlayers.forEach((p) => {
      statsMap.set(p.id, {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsWon: 0,
        pointsLost: 0,
        lastMatchPoints: 0,
      });
    });

    matches.forEach((m) => {
      if (m.scoreA === null || m.scoreB === null || !m.isCompleted) return;

      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);

      const teamAWin = sA > sB;
      const teamBWin = sB > sA;
      const isTie = sA === sB;

      // Update Team A Players
      m.teamA.forEach((pId) => {
        const stat = statsMap.get(pId);
        if (!stat) return;
        stat.pointsWon += sA;
        stat.pointsLost += sB;
        stat.lastMatchPoints = sA;
        if (teamAWin) stat.wins += 1;
        else if (teamBWin) stat.losses += 1;
        else if (isTie) stat.ties += 1;
      });

      // Update Team B Players
      m.teamB.forEach((pId) => {
        const stat = statsMap.get(pId);
        if (!stat) return;
        stat.pointsWon += sB;
        stat.pointsLost += sA;
        stat.lastMatchPoints = sB;
        if (teamBWin) stat.wins += 1;
        else if (teamAWin) stat.losses += 1;
        else if (isTie) stat.ties += 1;
      });
    });

    const list: PlayerStanding[] = registeredPlayers.map((p) => {
      const stat = statsMap.get(p.id) || {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsWon: 0,
        pointsLost: 0,
        lastMatchPoints: 0,
      };
      const diff = stat.pointsWon - stat.pointsLost;
      return {
        rank: 0,
        playerId: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isGuest: p.isGuest,
        wins: stat.wins,
        losses: stat.losses,
        ties: stat.ties,
        pointsWon: stat.pointsWon,
        pointsLost: stat.pointsLost,
        diff,
        totalPoints: stat.pointsWon,
        lastMatchPoints: stat.lastMatchPoints,
      };
    });

    // Dynamic Sorting Logic based on config.leaderboardRankedBy ('POINT' or 'WIN')
    list.sort((a, b) => {
      if (config.leaderboardRankedBy === 'WIN') {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.totalPoints - a.totalPoints;
      } else {
        // Ranked by POINT
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.wins - a.wins;
      }
    });

    // Assign rank numbers
    list.forEach((item, index) => {
      item.rank = index + 1;
    });

    return list;
  }, [registeredPlayers, matches, config.leaderboardRankedBy]);

  // Submit Session to backend
  const handleStartRealSession = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await startSessionAction({
        communityId,
        name: config.activityName,
        format: config.gameType.includes('MEXICANO') ? 'MEXICANO' : 'AMERICANO',
        sport: config.sport,
        scoringType: config.scoringSystem === 'POINTS' ? 'POINTS' : 'GAMES',
        pointsMode: 'FIRST_TO_TARGET',
        maxScoreTarget: parseInt(config.pointTarget) || 16,
        courtCount: config.courtCount,
        roundsPlanned: matches.length,
        attendeeIds: registeredPlayers.map((p) => p.id),
      });

      if (result.ok) {
        router.push(`/c/${communitySlug}/sessions/${result.data.sessionId}`);
        router.refresh();
      } else {
        setIsSubmitting(false);
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Failed to start session');
    }
  };

  // ==========================================
  // RENDER SCREENS
  // ==========================================

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Wizard Progress Navigation Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        {step > 1 ? (
          <button
            onClick={() => setStep((prev) => (prev - 1) as any)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-orange-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Step {step - 1}
          </button>
        ) : (
          <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
            Step 1 of 5
          </span>
        )}

        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2.5 rounded-full transition-all ${
                s === step
                  ? 'w-7 bg-orange-500'
                  : s < step
                  ? 'w-2.5 bg-orange-200'
                  : 'w-2.5 bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 1: GAME TYPE SELECTION SCREEN */}
      {/* ========================================================= */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#111827]">
              1. Choose Game Type
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Select sport & tournament format before creating session parameters.
            </p>
          </div>

          {/* Sport Selector Tab */}
          <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl max-w-xs">
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, sport: 'PADEL' }))}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                config.sport === 'PADEL'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Padel
            </button>
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, sport: 'TENNIS' }))}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                config.sport === 'TENNIS'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Tennis
            </button>
          </div>

          {/* 4 Tournament Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Americano */}
            <div
              onClick={() => handleSelectGameType('AMERICANO')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group space-y-3 ${
                config.gameType === 'AMERICANO'
                  ? 'border-orange-500 bg-orange-500/10 shadow-md'
                  : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-zinc-50/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-[#111827] uppercase tracking-wide group-hover:text-orange-600">
                  Americano
                </h3>
                <Sparkles className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-xs text-zinc-500 font-light leading-relaxed">
                All players play with everyone. Ideal for friendly social match sessions and fair partner rotation.
              </p>
            </div>

            {/* Mexicano */}
            <div
              onClick={() => handleSelectGameType('MEXICANO')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group space-y-3 ${
                config.gameType === 'MEXICANO'
                  ? 'border-orange-500 bg-orange-500/10 shadow-md'
                  : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-zinc-50/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-[#111827] uppercase tracking-wide group-hover:text-orange-600">
                  Mexicano
                </h3>
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-xs text-zinc-500 font-light leading-relaxed">
                Like Americano but results in more even games. After every round, a new game is generated depending on the current scoreboard.
              </p>
            </div>

            {/* Team Americano */}
            <div
              onClick={() => handleSelectGameType('TEAM_AMERICANO')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group space-y-3 ${
                config.gameType === 'TEAM_AMERICANO'
                  ? 'border-orange-500 bg-orange-500/10 shadow-md'
                  : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-zinc-50/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-[#111827] uppercase tracking-wide group-hover:text-orange-600">
                  Team Americano
                </h3>
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-xs text-zinc-500 font-light leading-relaxed">
                Each team plays against all other teams one time. Fixed pair teams competing across rounds.
              </p>
            </div>

            {/* Team Mexicano */}
            <div
              onClick={() => handleSelectGameType('TEAM_MEXICANO')}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group space-y-3 ${
                config.gameType === 'TEAM_MEXICANO'
                  ? 'border-orange-500 bg-orange-500/10 shadow-md'
                  : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-zinc-50/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-[#111827] uppercase tracking-wide group-hover:text-orange-600">
                  Team Mexicano
                </h3>
                <Trophy className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-xs text-zinc-500 font-light leading-relaxed">
                Mexicano with fixed teams. Keeps pre-paired teams matching against closest leaderboard competitors.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 2: GAME SETUP FORM (CONFIGURATION) */}
      {/* ========================================================= */}
      {step === 2 && (
        <form onSubmit={handleConfirmConfig} className="space-y-6 animate-in fade-in duration-200">
          {/* Top Banner Card showing selected Game Type */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 text-white shadow-md space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
              Selected Format
            </span>
            <h2 className="text-2xl font-black uppercase tracking-wide">
              {config.gameType.replace('_', ' ')} ({config.sport})
            </h2>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-white space-y-5 shadow-sm">
            {/* Activity Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Activity Name
              </label>
              <input
                type="text"
                value={config.activityName}
                onChange={(e) => setConfig((prev) => ({ ...prev, activityName: e.target.value }))}
                placeholder="e.g. Wednesday Padel Night"
                className="w-full h-11 px-4 rounded-xl border border-zinc-200 text-sm font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                required
              />
            </div>

            {/* Numbers of Court */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Numbers of Court
              </label>
              <div className="relative">
                <select
                  value={config.courtCount}
                  onChange={(e) => setConfig((prev) => ({ ...prev, courtCount: Number(e.target.value) }))}
                  className="w-full h-11 pl-4 pr-10 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none transition-all cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Court' : 'Courts'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Scoring System */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Scoring System
              </label>
              <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-xl max-w-xs">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      scoringSystem: 'POINTS',
                      pointTarget: '16 Points',
                    }))
                  }
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    config.scoringSystem === 'POINTS'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Points
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      scoringSystem: 'GENERAL',
                      pointTarget: 'Total of 4',
                    }))
                  }
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    config.scoringSystem === 'GENERAL'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  General
                </button>
              </div>

              {/* Point Target Dropdown */}
              <div className="relative mt-2">
                <select
                  value={config.pointTarget}
                  onChange={(e) => setConfig((prev) => ({ ...prev, pointTarget: e.target.value }))}
                  className="w-full h-11 pl-4 pr-10 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none transition-all cursor-pointer"
                >
                  {(config.scoringSystem === 'POINTS' ? POINTS_TARGET_OPTIONS : GENERAL_TARGET_OPTIONS).map(
                    (opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    )
                  )}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Leaderboard Ranked by */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Leaderboard Ranked by
              </label>
              <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-xl max-w-xs">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, leaderboardRankedBy: 'POINT' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    config.leaderboardRankedBy === 'POINT'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Point
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, leaderboardRankedBy: 'WIN' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    config.leaderboardRankedBy === 'WIN'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Win
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
          >
            Confirm Configuration
          </button>
        </form>
      )}

      {/* ========================================================= */}
      {/* SCREEN 3: PLAYER REGISTRATION SCREEN */}
      {/* ========================================================= */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Header Card */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 text-white shadow-md text-center space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-wide text-white">
              {config.activityName}
            </h2>
            <div className="flex items-center justify-center gap-8 text-xs text-zinc-400 font-medium pt-1">
              <div>
                <span className="block text-[10px] uppercase font-bold text-orange-400">Court</span>
                <span className="text-base font-bold text-white">{config.courtCount}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-orange-400">Points</span>
                <span className="text-base font-bold text-white">{config.pointTarget}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-white space-y-5 shadow-sm">
            {/* Input Field & Add Guest Button */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInputName}
                  onChange={(e) => setManualInputName(e.target.value)}
                  placeholder="Input Player Manually"
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-xs font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleAddManualPlayer(true)}
                  disabled={!manualInputName.trim() || isAddingGuest}
                  className="px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 transition-all disabled:opacity-40 cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  {isAddingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  <span>+ Add Guest Player</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 font-light text-center">
                Guest player can be added, Exp will not be counted
              </p>
            </div>

            {/* Action Buttons: Add Yourself & Add Player */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddYourself}
                disabled={registeredPlayers.some((p) => p.id === currentProfile.id)}
                className="py-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-600 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
              >
                + ADD YOURSELF
              </button>
              <button
                type="button"
                onClick={() => handleAddManualPlayer(false)}
                disabled={!manualInputName.trim()}
                className="py-3 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
              >
                + ADD PLAYER
              </button>
            </div>

            {/* Player List Counter Header */}
            <div className="pt-4 border-t border-zinc-100 text-center space-y-1">
              <h3 className="text-xl font-black uppercase tracking-wide text-[#111827]">
                Player List ({registeredPlayers.length})
              </h3>
              <p className="text-xs text-zinc-400 italic font-light">*Minimum 4 players</p>
            </div>

            {/* Selected Registered Players Badges */}
            {registeredPlayers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {registeredPlayers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-800"
                  >
                    <span>{p.name}</span>
                    {p.isGuest && (
                      <span className="text-[9px] uppercase font-extrabold bg-amber-200 text-amber-900 px-1 rounded">
                        Guest
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      className="text-zinc-400 hover:text-red-500 text-sm leading-none ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Community Member Selection Checklist */}
            <div className="space-y-2 pt-4 border-t border-zinc-100">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                Or Select From Community Members ({availableCommunityPlayers.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableCommunityPlayers.map((p) => {
                  const isSelected = registeredPlayers.some((reg) => reg.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleCommunityPlayer(p)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 text-orange-950'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span className="truncate">{p.fullName}</span>
                      {isSelected && <Check className="h-4 w-4 text-orange-500 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Button to Generate Matches */}
          <button
            type="button"
            onClick={handleGenerateMatches}
            disabled={registeredPlayers.length < 4}
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <Trophy className="h-4 w-4" />
            Generate Matches & Open Session
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 4: MATCH GENERATION & SCORE INPUT SCREEN */}
      {/* ========================================================= */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-[#111827]">
                4. Live Matches ({matches.length})
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Input scores directly on match cards to update leaderboard live.
              </p>
            </div>
            <button
              onClick={() => setStep(5)}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-wider hover:bg-orange-600 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Award className="h-4 w-4" />
              View Leaderboard
            </button>
          </div>

          {/* Match Cards List */}
          <div className="space-y-4">
            {matches.map((m, idx) => {
              const teamANames = m.teamA.map((id) => playerMap.get(id)?.name || 'Player').join(' & ');
              const teamBNames = m.teamB.map((id) => playerMap.get(id)?.name || 'Player').join(' & ');

              return (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <span className="font-black text-xs text-[#111827] uppercase tracking-wider">
                      Match {idx + 1}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20">
                      Court {m.courtNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-4 text-center">
                    {/* Team A */}
                    <div className="sm:col-span-2 space-y-1 text-center sm:text-right">
                      <p className="text-xs font-bold text-zinc-900 truncate">{teamANames}</p>
                      <span className="text-[10px] font-extrabold text-orange-600 uppercase">Team A</span>
                    </div>

                    {/* Interactive Score Inputs */}
                    <div className="sm:col-span-1 flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={m.scoreA !== null ? m.scoreA : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          handleUpdateScore(m.id, val, m.scoreB);
                        }}
                        placeholder="00"
                        className="w-12 h-12 text-center text-lg font-black rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <span className="text-zinc-400 font-bold">:</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={m.scoreB !== null ? m.scoreB : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          handleUpdateScore(m.id, m.scoreA, val);
                        }}
                        placeholder="00"
                        className="w-12 h-12 text-center text-lg font-black rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>

                    {/* Team B */}
                    <div className="sm:col-span-2 space-y-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-zinc-900 truncate">{teamBNames}</p>
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase">Team B</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setStep(5)}
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
          >
            View Live Leaderboard Standings
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 5: FINAL RESULT / LEADERBOARD SCREEN */}
      {/* ========================================================= */}
      {step === 5 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-[#111827]">
                5. Leaderboard Standings
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Ranked by <span className="font-bold text-orange-600 uppercase">{config.leaderboardRankedBy}</span>
              </p>
            </div>

            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold uppercase hover:bg-zinc-50 transition-all cursor-pointer"
            >
              Edit Scores
            </button>
          </div>

          {/* Standings Table Card */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 pl-2">Rank</th>
                  <th className="pb-3">Player</th>
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
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white font-black text-xs shadow-sm">
                          1
                        </span>
                      ) : s.rank === 2 ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 font-black text-xs shadow-sm">
                          2
                        </span>
                      ) : s.rank === 3 ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-white font-black text-xs shadow-sm">
                          3
                        </span>
                      ) : (
                        `#${s.rank}`
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600 uppercase">
                          {s.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{s.name}</p>
                          {s.isGuest && (
                            <span className="text-[9px] uppercase font-extrabold bg-amber-100 text-amber-800 px-1 rounded">
                              Guest
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-zinc-700">
                      {s.wins}-{s.losses}-{s.ties}
                    </td>
                    <td className="py-3 text-center font-bold">
                      <span className={s.diff > 0 ? 'text-green-600' : s.diff < 0 ? 'text-red-500' : 'text-zinc-400'}>
                        {s.diff > 0 ? `+${s.diff}` : s.diff}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2 font-black text-sm text-[#111827]">
                      {s.lastMatchPoints > 0 && (
                        <span className="text-[11px] font-bold text-orange-500 mr-1.5">
                          (+{s.lastMatchPoints})
                        </span>
                      )}
                      {s.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Start Real Live Session Button */}
          <button
            onClick={handleStartRealSession}
            disabled={isSubmitting}
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Trophy className="h-5 w-5" />
            )}
            <span>Save & Open Live Court Session</span>
          </button>
        </div>
      )}
    </div>
  );
}

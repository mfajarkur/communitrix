'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { generateAmericanoRound } from '@/lib/matchmaking/americano';
import { generateMexicanoRound } from '@/lib/matchmaking/mexicano';
import { Attendee, PastPairing } from '@/lib/matchmaking/types';
import ScorePickerModal from '@/components/score-picker-modal';

// ==========================================
// 1. DATA MODELS & STATE INTERFACES
// ==========================================

export type SportType = 'PADEL' | 'TENNIS';
export type GameType = 'AMERICANO' | 'MEXICANO' | 'TEAM_AMERICANO' | 'TEAM_MEXICANO';
export type ScoringSystem = 'POINTS' | 'GENERAL';
export type LeaderboardRankBy = 'POINT' | 'WIN';

export type ByeScoringMethod = 'PLAYER_AVERAGE' | 'HALF_N';

export interface GameConfiguration {
  sport: SportType;
  gameType: GameType;
  activityName: string;
  courtCount: number;
  scoringSystem: ScoringSystem;
  pointTarget: string;
  leaderboardRankedBy: LeaderboardRankBy;
  // Bye Point Method — locked once Round 1 is generated (brief §4)
  // PLAYER_AVERAGE: average of player's own MATCH entries, fallback round(N/2)
  // HALF_N: always round(N/2), fixed & non-adaptive
  byeScoringMethod: ByeScoringMethod;
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
  byePoints?: number;      // total accumulated bye points (dynamic)
  byesCount?: number;      // number of bye rounds
  realMatchesPlayed?: number;
  byeIsPlaceholder?: boolean; // true = player still has at least one PLACEHOLDER bye (no actual matches played yet)
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
  isGuestDemoMode?: boolean;
}

const POINTS_TARGET_OPTIONS = [
  '12 Points',
  '16 Points',
  '21 Points',
  '24 Points',
  '25 Points',
  '32 Points',
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
  isGuestDemoMode = false,
}: WizardFormProps) {
  const router = useRouter();

  // Wizard Step State (1: Game Type, 2: Setup Config, 3: Registration, 4: Match Generation, 5: Leaderboard)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showDemoCompleteModal, setShowDemoCompleteModal] = useState(false);

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
    byeScoringMethod: 'PLAYER_AVERAGE', // default per brief §3
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
  // STEP 4: MATCH GENERATION & SCORE PICKER STATE
  // ------------------------------------------
  const [matches, setMatches] = useState<Match[]>([]);
  // roundSitOuts: Map<roundNumber, Set<playerId>> — records who sat out each generated round
  // This is the source of truth for bye detection, set at round-generation time (not derived from completed matches)
  const [roundSitOuts, setRoundSitOuts] = useState<Map<number, string[]>>(new Map());
  const [activePicker, setActivePicker] = useState<{
    matchId: string;
    team: 'A' | 'B';
    teamName: string;
    currentScore: number | null;
  } | null>(null);

  // System Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper map for fast player lookup by ID
  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerRegistration>();
    registeredPlayers.forEach((p) => map.set(p.id, p));
    return map;
  }, [registeredPlayers]);

  // ------------------------------------------
  // QUICK MATCH PERSISTENCE (AUTO-SAVE & AUTO-RESTORE ON REFRESH)
  // ------------------------------------------
  // 1. Restore saved Quick Match session state on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !isGuestDemoMode) return;
    const saved = localStorage.getItem('communitrix_quick_match_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step) setStep(parsed.step);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.registeredPlayers) setRegisteredPlayers(parsed.registeredPlayers);
        if (parsed.matches) setMatches(parsed.matches);
        if (parsed.roundSitOuts) {
          // Restore Map from serialized plain object {"1": ["id1", "id2"], ...}
          const restoredMap = new Map<number, string[]>();
          Object.entries(parsed.roundSitOuts).forEach(([k, v]) => {
            restoredMap.set(Number(k), v as string[]);
          });
          setRoundSitOuts(restoredMap);
        }
      } catch (e) {
        console.error('Failed to restore quick match session state', e);
      }
    }
  }, [isGuestDemoMode]);

  // 2. Auto-save Quick Match session state when state changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isGuestDemoMode) return;
    // Convert Map to plain object for JSON serialization
    const sitOutsObj: Record<string, string[]> = {};
    roundSitOuts.forEach((v, k) => { sitOutsObj[String(k)] = v; });
    const payload = {
      step,
      config,
      registeredPlayers,
      matches,
      roundSitOuts: sitOutsObj,
    };
    localStorage.setItem('communitrix_quick_match_session', JSON.stringify(payload));
  }, [isGuestDemoMode, step, config, registeredPlayers, matches, roundSitOuts]);

  // 3. Reset Quick Match session
  const handleResetQuickMatchSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('communitrix_quick_match_session');
    }
    setStep(1);
    setRegisteredPlayers([]);
    setMatches([]);
    setRoundSitOuts(new Map());
  };

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

  // Helper function to format strings to Title Case (e.g., "fajar kurniawan" -> "Fajar Kurniawan")
  const formatTitleCase = (str: string) =>
    str
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  // Step 3: Add Manual Player (Regular or Guest)
  const handleAddManualPlayer = async (isGuest: boolean) => {
    const rawName = formatTitleCase(manualInputName);
    if (!rawName) return;

    // Check duplicate name and append numeric suffix (e.g., Albert 2, Albert 3)
    let name = rawName;
    const existingNames = registeredPlayers.map((p) => p.name.trim().toLowerCase());
    if (existingNames.includes(name.toLowerCase())) {
      let count = 2;
      while (existingNames.includes(`${rawName} ${count}`.toLowerCase())) {
        count++;
      }
      name = `${rawName} ${count}`;
    }

    if (isGuest && !isGuestDemoMode) {
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
          { id: tempGuestId, name, isGuest: true, avatarUrl: null },
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

  // Step 3 -> 4: Generate Matches based on official Ruleset (Americano / Mexicano)
  const handleGenerateMatches = () => {
    if (registeredPlayers.length < 4) {
      setErrorMessage('Minimum 4 players required to generate matches.');
      return;
    }
    setErrorMessage(null);

    const attendees: Attendee[] = registeredPlayers.map((p, idx) => ({
      id: p.id,
      seedElo: 1000 - idx,
      matchesPlayed: 0,
      sitOutCount: 0,
      lastSitOutRound: null,
    }));

    const generated: Match[] = [];
    const newRoundSitOuts = new Map<number, string[]>();
    const history: PastPairing[] = [];
    let matchCounter = 1;

    const isMexicano = config.gameType.includes('MEXICANO');
    // For Americano: pre-compute 3-4 rounds upfront.
    // For Mexicano: generate Round 1 upfront (Round 2+ generated sequentially after scores per Rule 2.2).
    const totalRoundsToGenerate = isMexicano ? 1 : Math.min(4, Math.max(1, registeredPlayers.length - 1));

    for (let r = 1; r <= totalRoundsToGenerate; r++) {
      try {
        const roundOutput = isMexicano
          ? generateMexicanoRound({
              roundNumber: r,
              playersPerMatch: 4,
              courtCount: config.courtCount,
              attendees,
              history,
              standings: [],
              seed: `session-wizard-${r}`,
            })
          : generateAmericanoRound({
              roundNumber: r,
              playersPerMatch: 4,
              courtCount: config.courtCount,
              attendees,
              history,
              seed: `session-wizard-${r}`,
            });

        roundOutput.courts.forEach((c) => {
          generated.push({
            id: `match-${matchCounter}`,
            roundNumber: r,
            courtNumber: c.courtNumber,
            teamA: [c.teamA[0], c.teamA[1] || c.teamA[0]] as [string, string],
            teamB: [c.teamB[0], c.teamB[1] || c.teamB[0]] as [string, string],
            scoreA: null,
            scoreB: null,
            isCompleted: false,
          });

          history.push({
            roundNumber: r,
            teamA: c.teamA,
            teamB: c.teamB,
          });

          matchCounter++;
        });

        // Update attendees state for next round sit-out selection so sit-outs are balanced
        const sitOutSet = new Set(roundOutput.sitOuts);
        attendees.forEach((att) => {
          if (sitOutSet.has(att.id)) {
            att.sitOutCount += 1;
            att.lastSitOutRound = r;
          } else {
            att.matchesPlayed += 1;
          }
        });

        // Store sit-outs for this round in the roundSitOuts map (source of truth for bye detection)
        if (roundOutput.sitOuts.length > 0) {
          newRoundSitOuts.set(r, roundOutput.sitOuts);
        }
      } catch (e: any) {
        console.error('Matchmaking error for round', r, e);
      }
    }

    setMatches(generated);
    setRoundSitOuts(newRoundSitOuts);
    setStep(4);
  };

  // Step 4: Generate Next Match Round
  const handleGenerateNextRound = () => {
    const maxRound = matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 0);
    const nextRoundNumber = maxRound + 1;

    const attendees: Attendee[] = registeredPlayers.map((p, idx) => {
      const matchesPlayed = matches.filter(
        (m) => m.isCompleted && (m.teamA.includes(p.id) || m.teamB.includes(p.id))
      ).length;
      return {
        id: p.id,
        seedElo: 1000 - idx,
        matchesPlayed,
        sitOutCount: 0,
        lastSitOutRound: null,
      };
    });

    const history: PastPairing[] = matches.map((m) => ({
      roundNumber: m.roundNumber || 1,
      teamA: m.teamA,
      teamB: m.teamB,
    }));

    const activeStandings = standings.map((s) => ({
      profileId: s.playerId,
      matchesPlayed: s.wins + s.losses + s.ties,
      sessionPointsFor: s.pointsWon,
      sessionPointsAgainst: s.pointsLost,
      sessionWins: s.wins,
      sessionLosses: s.losses,
      sessionDraws: s.ties,
      seedElo: 1000,
    }));

    const isMexicano = config.gameType.includes('MEXICANO');
    try {
      const roundOutput = isMexicano
        ? generateMexicanoRound({
            roundNumber: nextRoundNumber,
            playersPerMatch: 4,
            courtCount: config.courtCount,
            attendees,
            history,
            standings: activeStandings,
            seed: `session-wizard-${nextRoundNumber}`,
          })
        : generateAmericanoRound({
            roundNumber: nextRoundNumber,
            playersPerMatch: 4,
            courtCount: config.courtCount,
            attendees,
            history,
            seed: `session-wizard-${nextRoundNumber}`,
          });

      let matchCounter = matches.length + 1;
      const newMatches: Match[] = roundOutput.courts.map((c) => ({
        id: `match-${matchCounter++}`,
        roundNumber: nextRoundNumber,
        courtNumber: c.courtNumber,
        teamA: [c.teamA[0], c.teamA[1] || c.teamA[0]] as [string, string],
        teamB: [c.teamB[0], c.teamB[1] || c.teamB[0]] as [string, string],
        scoreA: null,
        scoreB: null,
        isCompleted: false,
      }));

      // Store sit-outs for this new round in roundSitOuts state
      if (roundOutput.sitOuts.length > 0) {
        setRoundSitOuts((prev) => {
          const updated = new Map(prev);
          updated.set(nextRoundNumber, roundOutput.sitOuts);
          return updated;
        });
      }

      setMatches((prev) => [...prev, ...newMatches]);
    } catch (e: any) {
      setErrorMessage(`Failed to generate round ${nextRoundNumber}: ${e.message || 'Unknown error'}`);
    }
  };

  // Step 4: Update Score in Match (auto-calculates complementary score N - X when scoringSystem === 'POINTS')
  const handleUpdateScore = (
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    updatedTeam?: 'A' | 'B'
  ) => {
    const isPointsMode = config.scoringSystem === 'POINTS';
    const targetN = parseInt(config.pointTarget) || 24;

    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;

        let finalA = scoreA;
        let finalB = scoreB;

        if (isPointsMode && targetN > 0) {
          if (updatedTeam === 'A' && scoreA !== null) {
            finalB = Math.max(0, targetN - scoreA);
          } else if (updatedTeam === 'B' && scoreB !== null) {
            finalA = Math.max(0, targetN - scoreB);
          }
        }

        const isComp = finalA !== null && finalB !== null && !isNaN(finalA) && !isNaN(finalB);
        return {
          ...m,
          scoreA: finalA,
          scoreB: finalB,
          isCompleted: isComp,
        };
      })
    );
  };

  // ==========================================
  // STEP 5: CALCULATE DYNAMIC LEADERBOARD
  // Per bye-point-brief.md v2 — Strict Rules
  //
  // DATA MODEL: One entry per (player, round) — either MATCH or BYE, never both.
  // BYE entries use roundSitOuts state as source of truth (populated at generation time).
  //
  // HARD CONSTRAINT: 0 <= byeScore <= N always. Never cap after the fact — if violated,
  // the formula itself is wrong (likely including BYE entries in average).
  // ==========================================
  const standings: PlayerStanding[] = useMemo(() => {
    const N = parseInt(config.pointTarget) || 24; // match points target (N)

    // Helper: round(N/2) — the HALF_N formula and PLAYER_AVERAGE fallback
    const halfN = Math.round(N / 2);

    // Helper: calculate bye score per brief §3
    // ONLY receives MATCH-type scores (never BYE entries) — brief §6 anti-pattern
    const calcByeScore = (matchScores: number[]): number => {
      let score: number;
      if (config.byeScoringMethod === 'HALF_N' || matchScores.length === 0) {
        // HALF_N or no match history yet → N/2 fallback
        score = halfN;
      } else {
        // PLAYER_AVERAGE: average of real MATCH entries only (brief §3 Method A)
        score = Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length);
      }
      // HARD CONSTRAINT per brief BUG #1 fix: 0 <= byeScore <= N (always, no exceptions)
      return Math.max(0, Math.min(N, score));
    };

    // --- Build per-player MATCH score history (chronological, excluding BYE entries) ---
    const completedMatches = matches.filter((m) => m.isCompleted && m.scoreA !== null && m.scoreB !== null);
    const matchScoreHistory = new Map<string, number[]>(); // playerId → list of real match scores
    registeredPlayers.forEach((p) => matchScoreHistory.set(p.id, []));

    completedMatches.forEach((m) => {
      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);
      m.teamA.forEach((pId) => { matchScoreHistory.get(pId)?.push(sA); });
      m.teamB.forEach((pId) => { matchScoreHistory.get(pId)?.push(sB); });
    });

    // --- Compute stats per player from real MATCH entries only ---
    const statsMap = new Map<string, {
      wins: number; losses: number; ties: number;
      actualPointsWon: number; actualPointsLost: number;
      lastMatchPoints: number; realMatchesPlayed: number;
    }>();

    registeredPlayers.forEach((p) => {
      statsMap.set(p.id, {
        wins: 0, losses: 0, ties: 0,
        actualPointsWon: 0, actualPointsLost: 0,
        lastMatchPoints: 0, realMatchesPlayed: 0,
      });
    });

    completedMatches.forEach((m) => {
      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);
      const teamAWin = sA > sB, teamBWin = sB > sA, isTie = sA === sB;

      m.teamA.forEach((pId) => {
        const stat = statsMap.get(pId);
        if (!stat) return;
        stat.actualPointsWon += sA;
        stat.actualPointsLost += sB;
        stat.lastMatchPoints = sA;
        stat.realMatchesPlayed += 1;
        if (teamAWin) stat.wins += 1;
        else if (teamBWin) stat.losses += 1;
        else if (isTie) stat.ties += 1;
      });

      m.teamB.forEach((pId) => {
        const stat = statsMap.get(pId);
        if (!stat) return;
        stat.actualPointsWon += sB;
        stat.actualPointsLost += sA;
        stat.lastMatchPoints = sB;
        stat.realMatchesPlayed += 1;
        if (teamBWin) stat.wins += 1;
        else if (teamAWin) stat.losses += 1;
        else if (isTie) stat.ties += 1;
      });
    });

    // --- BUG FIX: Only count BYE entries for rounds that have actually been PLAYED ---
    // Americano pre-generates 3-4 rounds at once. roundSitOuts is populated for ALL pre-generated
    // rounds, including future ones. This caused players who played in round 1 to incorrectly show
    // bye badges from rounds 2/3/4 that haven't been played yet.
    //
    // Rule: a bye entry for round R only counts once round R has been "played" —
    // i.e., at least one completed match exists for that round number.
    // Future pre-generated rounds are ignored until they actually happen.
    const completedRoundNumbers = new Set(completedMatches.map((m) => m.roundNumber));

    const byeScoresPerPlayer = new Map<string, { roundNum: number; score: number }[]>();
    registeredPlayers.forEach((p) => byeScoresPerPlayer.set(p.id, []));

    roundSitOuts.forEach((sitOutPlayerIds, roundNumber) => {
      // Skip bye entries for rounds that haven't been played yet (no completed matches)
      if (!completedRoundNumbers.has(roundNumber)) return;

      sitOutPlayerIds.forEach((pId) => {
        // Only compute bye score for players actually in this session
        const byeList = byeScoresPerPlayer.get(pId);
        if (!byeList) return;

        // Get ONLY this player's MATCH scores from rounds BEFORE this bye round
        // (brief §3 Method A: "all of this player's entries where type == MATCH")
        // Filter to rounds < roundNumber to avoid using future rounds in the average.
        const matchScoresBeforeBye = completedMatches
          .filter((m) => m.roundNumber < roundNumber && (m.teamA.includes(pId) || m.teamB.includes(pId)))
          .map((m) => (m.teamA.includes(pId) ? Number(m.scoreA) : Number(m.scoreB)));

        const byeScore = calcByeScore(matchScoresBeforeBye);
        byeList.push({ roundNum: roundNumber, score: byeScore });
      });
    });

    // --- Build final standings ---
    const list: PlayerStanding[] = registeredPlayers.map((p) => {
      const stat = statsMap.get(p.id) || {
        wins: 0, losses: 0, ties: 0,
        actualPointsWon: 0, actualPointsLost: 0,
        lastMatchPoints: 0, realMatchesPlayed: 0,
      };

      const byeEntries = byeScoresPerPlayer.get(p.id) || [];
      const byePointsTotal = byeEntries.reduce((sum, e) => sum + e.score, 0);

      // byeIsPlaceholder = player has bye(s) but has NOT yet played any real match
      // (all bye scores are N/2 fallback = temporary placeholder, brief §3 PLAYER_AVERAGE fallback)
      const byeIsPlaceholder = byeEntries.length > 0 && stat.realMatchesPlayed === 0;

      // Total score = SUM(all MATCH scores) + SUM(all BYE scores) — brief §1 data model
      const totalPoints = stat.actualPointsWon + byePointsTotal;
      const diff = totalPoints - stat.actualPointsLost;

      return {
        rank: 0,
        playerId: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isGuest: p.isGuest,
        wins: stat.wins,
        losses: stat.losses,
        ties: stat.ties,
        pointsWon: stat.actualPointsWon,
        pointsLost: stat.actualPointsLost,
        diff,
        totalPoints,
        lastMatchPoints: stat.lastMatchPoints,
        byePoints: byePointsTotal,
        byesCount: byeEntries.length,
        realMatchesPlayed: stat.realMatchesPlayed,
        byeIsPlaceholder,
      };
    });

    // Dynamic Sorting Logic based on config.leaderboardRankedBy ('POINT' or 'WIN')
    list.sort((a, b) => {
      if (config.leaderboardRankedBy === 'WIN') {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.totalPoints - a.totalPoints;
      } else {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.wins - a.wins;
      }
    });

    list.forEach((item, index) => { item.rank = index + 1; });
    return list;
  }, [registeredPlayers, matches, roundSitOuts, config.leaderboardRankedBy, config.pointTarget, config.byeScoringMethod]);

  // Submit Session to backend (or finish Sandbox Demo)
  const handleStartRealSession = async () => {
    if (isGuestDemoMode) {
      setShowDemoCompleteModal(true);
      return;
    }

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
      {/* Wizard Progress Navigation Header / Live Session 2-Tab Switcher */}
      {step >= 4 ? (
        <div className="w-full pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl max-w-md mx-auto shadow-inner">
            <button
              type="button"
              onClick={() => setStep(4)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                step === 4
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>LIVE MATCHES</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(5)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                step === 5
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>LEADERBOARD</span>
            </button>
          </div>
        </div>
      ) : (
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
              Step 1 of 3
            </span>
          )}

          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
            {[1, 2, 3].map((s) => (
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
      )}

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
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${config.sport === 'PADEL'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
                }`}
            >
              Padel
            </button>
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, sport: 'TENNIS' }))}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${config.sport === 'TENNIS'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
                }`}
            >
              Tennis
            </button>
          </div>

          {/* 4 Tournament Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                type: 'AMERICANO',
                title: 'Americano',
                description: 'All players play with everyone. Ideal for friendly social match sessions and fair partner rotation.',
                icon: Sparkles,
              },
              {
                type: 'MEXICANO',
                title: 'Mexicano',
                description: 'Like Americano but results in more even games. After every round, a new game is generated depending on current scoreboard.',
                icon: Flame,
              },
              {
                type: 'TEAM_AMERICANO',
                title: 'Team Americano',
                description: 'Each team plays against all other teams one time. Fixed pair teams competing across rounds.',
                icon: Users,
              },
              {
                type: 'TEAM_MEXICANO',
                title: 'Team Mexicano',
                description: 'Mexicano with fixed teams. Keeps pre-paired teams matching against closest leaderboard competitors.',
                icon: Trophy,
              },
            ].map((gt) => {
              const isSelected = config.gameType === gt.type;
              const Icon = gt.icon;
              return (
                <div
                  key={gt.type}
                  onClick={() => handleSelectGameType(gt.type as any)}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer space-y-3 relative overflow-hidden ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/80 shadow-md shadow-orange-500/10'
                      : 'border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3
                      className={`font-black text-lg uppercase tracking-wide transition-colors ${
                        isSelected ? 'text-orange-600' : 'text-zinc-900'
                      }`}
                    >
                      {gt.title}
                    </h3>
                    <div
                      className={`p-2 rounded-xl transition-colors ${
                        isSelected ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-400'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                    </div>
                  </div>
                  <p
                    className={`text-xs font-light leading-relaxed transition-colors ${
                      isSelected ? 'text-zinc-800' : 'text-zinc-500'
                    }`}
                  >
                    {gt.description}
                  </p>
                </div>
              );
            })}
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${config.scoringSystem === 'POINTS'
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${config.scoringSystem === 'GENERAL'
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${config.leaderboardRankedBy === 'POINT'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                  Point
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, leaderboardRankedBy: 'WIN' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${config.leaderboardRankedBy === 'WIN'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                  Win
                </button>
              </div>
            </div>

            {/* Bye Point Method — required before Round 1, locked once started (brief §4) */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Bye Point Method
                  </label>
                  <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                    Score awarded when a player sits out a round
                  </p>
                </div>
              </div>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, byeScoringMethod: 'PLAYER_AVERAGE' }))}
                  className={`flex-1 py-3 px-3 rounded-xl text-left border-2 transition-all cursor-pointer ${
                    config.byeScoringMethod === 'PLAYER_AVERAGE'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <p className={`text-xs font-extrabold uppercase ${
                    config.byeScoringMethod === 'PLAYER_AVERAGE' ? 'text-orange-600' : 'text-zinc-600'
                  }`}>
                    Player's Own Average
                  </p>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5 leading-snug">
                    Uses each player's real match average (adaptive)
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, byeScoringMethod: 'HALF_N' }))}
                  className={`flex-1 py-3 px-3 rounded-xl text-left border-2 transition-all cursor-pointer ${
                    config.byeScoringMethod === 'HALF_N'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <p className={`text-xs font-extrabold uppercase ${
                    config.byeScoringMethod === 'HALF_N' ? 'text-orange-600' : 'text-zinc-600'
                  }`}>
                    Half of Match Points
                  </p>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5 leading-snug">
                    Fixed N÷2 for everyone (predictable)
                  </p>
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
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 sm:p-6 text-white shadow-md text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-white">
              {config.activityName}
            </h2>
            <div className="flex items-center justify-center gap-6 sm:gap-8 text-xs text-zinc-400 font-medium pt-1">
              <div>
                <span className="block text-[10px] uppercase font-bold text-orange-400">Court</span>
                <span className="text-base font-bold text-white">{config.courtCount}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-orange-400 font-sans">Points</span>
                <span className="text-base font-bold text-white">{config.pointTarget}</span>
              </div>
            </div>
          </div>

          {/* Registration Form Card */}
          <div className="p-5 sm:p-6 rounded-2xl border border-zinc-200 bg-white space-y-5 shadow-sm">
            {/* Input Field & Add Button */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Add Player Name
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualInputName.trim()) {
                    handleAddManualPlayer(isGuestDemoMode);
                  }
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <input
                  type="text"
                  value={manualInputName}
                  onChange={(e) => setManualInputName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (manualInputName.trim()) {
                        handleAddManualPlayer(isGuestDemoMode);
                      }
                    }
                  }}
                  placeholder="Type player name and press Enter..."
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-zinc-50 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!manualInputName.trim() || isAddingGuest}
                  className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isAddingGuest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>+ Add Player</span>
                </button>
              </form>
            </div>

            {/* Action Button: Add Yourself (Community Mode Only) */}
            {!isGuestDemoMode && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAddYourself}
                  disabled={registeredPlayers.some((p) => p.id === currentProfile.id)}
                  className="w-full py-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-600 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
                >
                  + ADD YOURSELF ({currentProfile.name})
                </button>
              </div>
            )}

            {/* Player List Counter Header */}
            <div className="pt-4 border-t border-zinc-100 text-center space-y-1">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide text-[#111827]">
                Player Roster ({registeredPlayers.length})
              </h3>
              <p className="text-xs text-zinc-400 italic font-light">*Minimum 4 players required</p>
            </div>

            {/* Selected Registered Players Badges */}
            {registeredPlayers.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {registeredPlayers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-800 shadow-2xs"
                  >
                    <span className="truncate max-w-[150px]">{p.name}</span>
                    {p.isGuest && (
                      <span className="text-[9px] uppercase font-extrabold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                        Guest
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      className="text-zinc-400 hover:text-red-500 text-base leading-none ml-1 cursor-pointer font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-zinc-200 text-center text-xs text-zinc-400 font-light">
                No players added yet. Add at least 4 players to start the session.
              </div>
            )}

            {/* Quick Community Member Selection Checklist (Community Mode Only) */}
            {!isGuestDemoMode && availableCommunityPlayers.length > 0 && (
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
            )}
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
                Live Matches ({matches.length})
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Input scores directly on match cards to update leaderboard live.
              </p>
            </div>
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

                    {/* Interactive Score Picker Buttons */}
                    <div className="sm:col-span-1 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActivePicker({
                            matchId: m.id,
                            team: 'A',
                            teamName: `Team A (${teamANames})`,
                            currentScore: m.scoreA,
                          })
                        }
                        className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all cursor-pointer shadow-2xs ${
                          m.scoreA !== null
                            ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                            : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
                        }`}
                      >
                        {m.scoreA !== null ? m.scoreA : '-'}
                      </button>
                      <span className="text-zinc-400 font-bold">:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePicker({
                            matchId: m.id,
                            team: 'B',
                            teamName: `Team B (${teamBNames})`,
                            currentScore: m.scoreB,
                          })
                        }
                        className={`w-12 h-12 flex items-center justify-center text-lg font-black rounded-xl border transition-all cursor-pointer shadow-2xs ${
                          m.scoreB !== null
                            ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                            : 'bg-zinc-50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-600 border-zinc-300'
                        }`}
                      >
                        {m.scoreB !== null ? m.scoreB : '-'}
                      </button>
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

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateNextRound}
              className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>+ Generate Next Round (Round {matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 0) + 1})</span>
            </button>
          </div>
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
                Leaderboard Standings
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Ranked by <span className="font-bold text-orange-600 uppercase">{config.leaderboardRankedBy}</span>
              </p>
            </div>
          </div>

          {/* Standings Table Card */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 pl-2">Rank</th>
                  <th className="pb-3">Player</th>
                  <th className="pb-3 text-center">Matches</th>
                  <th className="pb-3 text-center">W-L-T</th>
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
                          {!isGuestDemoMode && s.isGuest && (
                            <span className="text-[9px] uppercase font-extrabold bg-amber-100 text-amber-800 px-1 rounded">
                              Guest
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-zinc-900">
                      {s.realMatchesPlayed !== undefined ? s.realMatchesPlayed : (s.wins + s.losses + s.ties)}
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-zinc-700">
                      {s.wins}-{s.losses}-{s.ties}
                    </td>
                    <td className="py-3 text-right pr-2 font-black text-sm text-[#111827]">
                      {s.byePoints && s.byePoints > 0 ? (
                        <span
                          title={s.byeIsPlaceholder
                            ? 'Temporary placeholder score (no actual matches played yet)'
                            : 'Dynamic bye points based on player average'}
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md mr-1.5 border ${
                            s.byeIsPlaceholder
                              ? 'text-zinc-500 bg-zinc-100 border-zinc-300' // greyed out = placeholder
                              : 'text-amber-700 bg-amber-100 border-amber-300'  // amber = real average
                          }`}
                        >
                          {s.byeIsPlaceholder ? '~' : '+'}{s.byePoints} Bye
                        </span>
                      ) : null}
                      {s.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Start Real Live Session or Finish Demo Button */}
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
            <span>{isGuestDemoMode ? '⚡ Finish Quick Match (Sandbox)' : 'Save & Open Live Court Session'}</span>
          </button>
        </div>
      )}

      {/* Demo Completion Modal for Guest Quick Match Mode */}
      {showDemoCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-white shadow-2xl space-y-5 text-center font-sans">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black uppercase tracking-wide">
                Quick Match Completed! 🎉
              </h3>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                This was a sandbox demonstration session. No data or player names were saved.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 text-left">
              <span className="text-[10px] font-bold uppercase text-orange-400">Match Summary</span>
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Winner:</span>
                <span className="font-bold text-white">
                  {standings[0]?.name || 'N/A'} ({standings[0]?.totalPoints || 0} pts)
                </span>
              </div>
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Format:</span>
                <span className="font-bold text-white">
                  {config.gameType} ({config.sport})
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setShowDemoCompleteModal(false);
                  handleResetQuickMatchSession();
                }}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
              >
                ⚡ Play Another Quick Match
              </button>

              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Create Account to Join Communities & Save History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Score Picker Modal */}
      {activePicker && (
        <ScorePickerModal
          isOpen={!!activePicker}
          onClose={() => setActivePicker(null)}
          teamName={activePicker.teamName}
          currentScore={activePicker.currentScore}
          maxTarget={parseInt(config.pointTarget) || 24}
          onSelectScore={(score) => {
            const match = matches.find((m) => m.id === activePicker.matchId);
            if (match) {
              if (activePicker.team === 'A') {
                handleUpdateScore(activePicker.matchId, score, match.scoreB, 'A');
              } else {
                handleUpdateScore(activePicker.matchId, match.scoreA, score, 'B');
              }
            }
          }}
        />
      )}
    </div>
  );
}

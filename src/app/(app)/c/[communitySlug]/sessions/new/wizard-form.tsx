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
  ChevronLeft,
  ChevronRight,
  Plus,
  UserPlus,
  Flame,
  Award,
  Sparkles,
  Crown,
  RotateCcw,
  Download,
} from 'lucide-react';
import { generateAmericanoRound } from '@/lib/matchmaking/americano';
import { generateMexicanoRound } from '@/lib/matchmaking/mexicano';
import { Attendee, PastPairing, MatchHistory, StandingRow } from '@/lib/matchmaking/types';
import { sortStandings, StandingsMetric } from '@/lib/matchmaking/standings';
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
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
  const [teamNameInput, setTeamNameInput] = useState('');
  const [player1NameInput, setPlayer1NameInput] = useState('');
  const [player2NameInput, setPlayer2NameInput] = useState('');
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
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const totalRounds = useMemo(() => {
    return matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 1);
  }, [matches]);

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

  // Extracts the numeric target N from ANY pointTarget string format:
  //   POINTS mode:  "16 Points" → 16,  "21 Points" → 21
  //   GENERAL mode: "Total of 4" → 4,  "First to 5" → 5
  // Uses last-integer regex so it works for all formats without hardcoding.
  const extractN = (pt: string | undefined | null, fallback = 16): number => {
    if (!pt) return fallback;
    const m = String(pt).match(/(\d+)(?!.*\d)/); // last number in the string
    const n = m ? parseInt(m[1], 10) : NaN;
    return isNaN(n) || n <= 0 ? fallback : n;
  };

  // configN = the numeric target for the current match (N)
  // Used for: bye score calculation, score picker max, auto-complement in POINTS mode
  const configN = extractN(
    config.pointTarget,
    config.scoringSystem === 'POINTS' ? 16 : 4
  );

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
        if (parsed.selectedRound) setSelectedRound(parsed.selectedRound);
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
      selectedRound,
    };
    localStorage.setItem('communitrix_quick_match_session', JSON.stringify(payload));
  }, [isGuestDemoMode, step, config, registeredPlayers, matches, roundSitOuts, selectedRound]);

  // 3. Reset Quick Match session
  const handleResetQuickMatchSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('communitrix_quick_match_session');
    }
    setStep(1);
    setRegisteredPlayers([]);
    setMatches([]);
    setRoundSitOuts(new Map());
    setSelectedRound(1);
    setShowPodium(false);
    setShowConfirmEndModal(false);
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
  const handleAddManualPlayer = (isGuest: boolean) => {
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

    const tempId = crypto.randomUUID();
    const newPlayer: PlayerRegistration = {
      id: tempId,
      name,
      isGuest: true,
      avatarUrl: null,
    };

    // INSTANT UI UPDATE - 0ms delay, clears input immediately
    setRegisteredPlayers((prev) => [...prev, newPlayer]);
    setManualInputName('');

    // Asynchronously create guest member in DB for community mode
    if (!isGuestDemoMode && communityId) {
      addGuestPlayerAction({ communityId, fullName: name })
        .then((result) => {
          if (result.ok && result.data) {
            const dbId = result.data.id;
            setRegisteredPlayers((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, id: dbId, name: result.data.full_name || name } : p))
            );
          }
        })
        .catch((err) => console.error('Background guest creation error:', err));
    }
  };

  // Step 3: Add Manual Team
  const handleAddTeam = () => {
    const rawP1 = formatTitleCase(player1NameInput);
    const rawP2 = formatTitleCase(player2NameInput);
    const rawT = formatTitleCase(teamNameInput);
    if (!rawP1 || !rawP2) return;

    let fullName = rawT ? `${rawT} (${rawP1} / ${rawP2})` : `${rawP1} / ${rawP2}`;

    // Check duplicate name and append numeric suffix
    const existingNames = registeredPlayers.map((p) => p.name.trim().toLowerCase());
    if (existingNames.includes(fullName.toLowerCase())) {
      let count = 2;
      let checkName = rawT ? `${rawT} ${count} (${rawP1} / ${rawP2})` : `${rawP1} / ${rawP2} ${count}`;
      while (existingNames.includes(checkName.toLowerCase())) {
        count++;
        checkName = rawT ? `${rawT} ${count} (${rawP1} / ${rawP2})` : `${rawP1} / ${rawP2} ${count}`;
      }
      fullName = checkName;
    }

    const tempId = crypto.randomUUID();
    const newTeam: PlayerRegistration = {
      id: tempId,
      name: fullName,
      isGuest: true,
      avatarUrl: null,
    };

    // INSTANT UI UPDATE - 0ms delay, clears input fields immediately
    setRegisteredPlayers((prev) => [...prev, newTeam]);
    setTeamNameInput('');
    setPlayer1NameInput('');
    setPlayer2NameInput('');

    // Asynchronously create guest member in DB for community mode
    if (!isGuestDemoMode && communityId) {
      addGuestPlayerAction({ communityId, fullName })
        .then((result) => {
          if (result.ok && result.data) {
            const dbId = result.data.id;
            setRegisteredPlayers((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, id: dbId } : p))
            );
          }
        })
        .catch((err) => console.error('Background team creation error:', err));
    }
  };

  const handleRemovePlayer = (id: string) => {
    setRegisteredPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Step 3 -> 4: Generate Matches based on official Ruleset (Americano / Mexicano)
  const handleGenerateMatches = () => {
    const isTeamMode = config.gameType.includes('TEAM_');
    const minRequired = isTeamMode ? 2 : 4;

    if (registeredPlayers.length < minRequired) {
      setErrorMessage(`Minimum ${minRequired} ${isTeamMode ? 'teams' : 'players'} required to generate matches.`);
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
    const playersPerMatch = isTeamMode ? 2 : 4;
    // For Americano: pre-compute 3-4 rounds upfront.
    // For Mexicano: generate Round 1 upfront (Round 2+ generated sequentially after scores per Rule 2.2).
    const totalRoundsToGenerate = isMexicano ? 1 : Math.min(4, Math.max(1, registeredPlayers.length - 1));

    for (let r = 1; r <= totalRoundsToGenerate; r++) {
      try {
        const roundOutput = isMexicano
          ? generateMexicanoRound({
              roundNumber: r,
              playersPerMatch,
              courtCount: config.courtCount,
              attendees,
              history,
              standings: [],
              seed: `session-wizard-${r}`,
            })
          : generateAmericanoRound({
              roundNumber: r,
              playersPerMatch,
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
            teamA: [c.teamA[0], c.teamA[1] || ''] as [string, string],
            teamB: [c.teamB[0], c.teamB[1] || ''] as [string, string],
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
    setSelectedRound(1);
    setStep(4);
  };

  // Step 4: Generate Next Match Round
  const handleGenerateNextRound = () => {
    const maxRound = matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 0);
    const nextRoundNumber = maxRound + 1;

    const attendees: Attendee[] = registeredPlayers.map((p, idx) => {
      const matchesPlayed = matches.filter(
        (m) => m.teamA.includes(p.id) || m.teamB.includes(p.id)
      ).length;

      let sitOutCount = 0;
      let lastSitOutRound: number | null = null;
      roundSitOuts.forEach((players, rNum) => {
        if (players.includes(p.id)) {
          sitOutCount++;
          if (lastSitOutRound === null || rNum > lastSitOutRound) {
            lastSitOutRound = rNum;
          }
        }
      });

      return {
        id: p.id,
        seedElo: 1000 - idx,
        matchesPlayed,
        sitOutCount,
        lastSitOutRound,
      };
    });

    const isTeamMode = config.gameType.includes('TEAM_');
    const playersPerMatch = isTeamMode ? 2 : 4;

    const history: PastPairing[] = matches.map((m) => ({
      roundNumber: m.roundNumber || 1,
      teamA: m.teamA.filter(Boolean),
      teamB: m.teamB.filter(Boolean),
    }));

    const activeStandings = standings.map((s) => ({
      profileId: s.playerId,
      matchesPlayed: s.realMatchesPlayed + s.byesCount,
      sessionPointsFor: s.totalPoints,
      sessionPointsAgainst: s.pointsLost,
      sessionWins: s.wins,
      sessionLosses: s.losses,
      sessionDraws: s.ties,
      seedElo: 1000 - registeredPlayers.findIndex((p) => p.id === s.playerId),
    }));

    const completedMatches = matches.filter((m) => m.isCompleted && m.scoreA !== null && m.scoreB !== null);
    const matchHistory: MatchHistory[] = completedMatches.map((m) => ({
      id: m.id,
      roundNumber: m.roundNumber || 1,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    }));

    const standingsMetric: StandingsMetric = config.leaderboardRankedBy === 'WIN' ? 'WINS' : 'TOTAL_POINTS';

    const isMexicano = config.gameType.includes('MEXICANO');
    try {
      const roundOutput = isMexicano
        ? generateMexicanoRound({
            roundNumber: nextRoundNumber,
            playersPerMatch,
            courtCount: config.courtCount,
            attendees,
            history,
            standings: activeStandings,
            seed: `session-wizard-${nextRoundNumber}`,
            options: { avoidRepeatPartner: true },
            metric: standingsMetric,
            matchHistory,
          })
        : generateAmericanoRound({
            roundNumber: nextRoundNumber,
            playersPerMatch,
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
        teamA: [c.teamA[0], c.teamA[1] || ''] as [string, string],
        teamB: [c.teamB[0], c.teamB[1] || ''] as [string, string],
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
      setSelectedRound(nextRoundNumber);
    } catch (e: any) {
      setErrorMessage(`Failed to generate round ${nextRoundNumber}: ${e.message || 'Unknown error'}`);
    }
  };

  // Step 4: Update Score in Match
  // Enforces that total score (Score A + Score B) NEVER exceeds targetN:
  // - POINTS & "Total of N": Score A + Score B = targetN (auto-complementary)
  // - "First to N" / General: Score A + Score B <= targetN (capped)
  const handleUpdateScore = (
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    updatedTeam?: 'A' | 'B'
  ) => {
    const isPointsMode = config.scoringSystem === 'POINTS';
    const isTotalOf = config.pointTarget.toLowerCase().includes('total of');
    const targetN = configN;

    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;

        let finalA = scoreA;
        let finalB = scoreB;

        if (targetN > 0) {
          if (isPointsMode || isTotalOf) {
            // POINTS or "Total of N": Total score MUST equal targetN (Score A + Score B = targetN)
            if (updatedTeam === 'A' && scoreA !== null) {
              finalA = Math.min(targetN, Math.max(0, scoreA));
              finalB = Math.max(0, targetN - finalA);
            } else if (updatedTeam === 'B' && scoreB !== null) {
              finalB = Math.min(targetN, Math.max(0, scoreB));
              finalA = Math.max(0, targetN - finalB);
            }
          } else {
            // "First to N" / General: Total score (finalA + finalB) MUST NOT exceed targetN
            if (updatedTeam === 'A' && finalA !== null) {
              finalA = Math.min(targetN, Math.max(0, finalA));
              if (finalB !== null && finalA + finalB > targetN) {
                finalB = Math.max(0, targetN - finalA);
              }
            } else if (updatedTeam === 'B' && finalB !== null) {
              finalB = Math.min(targetN, Math.max(0, finalB));
              if (finalA !== null && finalA + finalB > targetN) {
                finalA = Math.max(0, targetN - finalB);
              }
            }
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
  //
  // BYE POINT LOGIC — simple rule:
  //   1. Find maxMatchesPlayed = highest match count among all players
  //   2. Any player with fewer matches gets bye points to compensate
  //   3. matchesBehind = maxMatchesPlayed - player.matchesPlayed
  //   4. byeScore per missing match:
  //      - PLAYER_AVERAGE: their own match score average (or N/2 if no history yet)
  //      - HALF_N: always round(N/2)
  //   5. Hard constraint: 0 <= byeScore <= N always
  // ==========================================
  const standings: PlayerStanding[] = useMemo(() => {
    const N = configN;
    const halfN = Math.round(N / 2);

    // Helper: calculate bye score per missing match
    // matchScores = this player's actual match scores (never from bye rounds)
    const calcByeScore = (matchScores: number[]): number => {
      let score: number;
      if (config.byeScoringMethod === 'HALF_N' || matchScores.length === 0) {
        score = halfN; // HALF_N method, or PLAYER_AVERAGE with no history yet → N/2 fallback
      } else {
        // PLAYER_AVERAGE: simple average of all actual match scores
        score = Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length);
      }
      return Math.max(0, Math.min(N, score)); // hard constraint: 0 <= byeScore <= N
    };

    const completedMatches = matches.filter((m) => m.isCompleted && m.scoreA !== null && m.scoreB !== null);

    // Build stats per player from completed matches
    const statsMap = new Map<string, {
      wins: number; losses: number; ties: number;
      actualPointsWon: number; actualPointsLost: number;
      lastMatchPoints: number; realMatchesPlayed: number;
      matchScores: number[]; // for PLAYER_AVERAGE calculation
    }>();

    registeredPlayers.forEach((p) => {
      statsMap.set(p.id, {
        wins: 0, losses: 0, ties: 0,
        actualPointsWon: 0, actualPointsLost: 0,
        lastMatchPoints: 0, realMatchesPlayed: 0,
        matchScores: [],
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
        stat.matchScores.push(sA);
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
        stat.matchScores.push(sB);
        if (teamBWin) stat.wins += 1;
        else if (teamAWin) stat.losses += 1;
        else if (isTie) stat.ties += 1;
      });
    });

    // Find the max matches played by any player — bye goes to players BEHIND this number
    let maxMatchesPlayed = 0;
    statsMap.forEach((stat) => {
      if (stat.realMatchesPlayed > maxMatchesPlayed) maxMatchesPlayed = stat.realMatchesPlayed;
    });

    // Build final standings
    const list: PlayerStanding[] = registeredPlayers.map((p) => {
      const stat = statsMap.get(p.id) || {
        wins: 0, losses: 0, ties: 0,
        actualPointsWon: 0, actualPointsLost: 0,
        lastMatchPoints: 0, realMatchesPlayed: 0,
        matchScores: [],
      };

      // How many matches is this player behind the leader?
      const matchesBehind = maxMatchesPlayed - stat.realMatchesPlayed;

      // Bye points = matchesBehind × byeScore per round
      // byeIsPlaceholder = true when player has ZERO real matches (pure N/2 fallback)
      const byeScore = calcByeScore(stat.matchScores);
      const byePointsTotal = matchesBehind > 0 ? matchesBehind * byeScore : 0;
      const byeIsPlaceholder = matchesBehind > 0 && stat.realMatchesPlayed === 0;

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
        byesCount: matchesBehind,
        realMatchesPlayed: stat.realMatchesPlayed,
        byeIsPlaceholder,
      };
    });

    // Sort using sortStandings to keep visual standings 100% aligned with matchmaking
    const standingsRows: StandingRow[] = list.map((item) => ({
      profileId: item.playerId,
      matchesPlayed: item.realMatchesPlayed + item.byesCount,
      sessionPointsFor: item.totalPoints,
      sessionPointsAgainst: item.pointsLost,
      sessionWins: item.wins,
      sessionLosses: item.losses,
      sessionDraws: item.ties,
      seedElo: 1000 - registeredPlayers.findIndex((p) => p.id === item.playerId),
    }));

    const standingsMetric: StandingsMetric = config.leaderboardRankedBy === 'WIN' ? 'WINS' : 'TOTAL_POINTS';
    const matchHistory: MatchHistory[] = completedMatches.map((m) => ({
      id: m.id,
      roundNumber: m.roundNumber || 1,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    }));

    const sortedRows = sortStandings(standingsRows, matchHistory, standingsMetric, 'wizard-session-seed');
    const rankMap = new Map(sortedRows.map((row, idx) => [row.profileId, idx]));
    list.sort((a, b) => (rankMap.get(a.playerId) ?? 0) - (rankMap.get(b.playerId) ?? 0));

    list.forEach((item, index) => { item.rank = index + 1; });
    return list;
  }, [registeredPlayers, matches, config.leaderboardRankedBy, config.pointTarget, config.byeScoringMethod]);

  // Submit Session to backend (or finish Sandbox Demo / Community Session)
  const handleStartRealSession = async () => {
    setShowConfirmEndModal(true);
  };

  const handleConfirmEndMatch = async () => {
    setShowConfirmEndModal(false);
    setShowPodium(true);

    if (!isGuestDemoMode) {
      setIsSubmitting(true);
      try {
        await startSessionAction({
          communityId,
          name: config.activityName,
          format: config.gameType.includes('MEXICANO') ? 'MEXICANO' : 'AMERICANO',
          sport: config.sport,
          scoringType: config.scoringSystem === 'POINTS' ? 'POINTS' : 'GAMES',
          pointsMode: 'FIRST_TO_TARGET',
          maxScoreTarget: configN,
          courtCount: config.courtCount,
          roundsPlanned: matches.length,
          attendeeIds: registeredPlayers.map((p) => p.id),
        });
      } catch (err: any) {
        console.error('Failed to save community session to DB:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    try {
      const { toBlob } = await import('html-to-image');
      const node = document.getElementById('podium-download-area');
      if (!node) {
        setIsDownloading(false);
        return;
      }

      // Wait a short tick to ensure elements are fully settled
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Force exact dimensions to prevent clipping on mobile viewports
      const targetWidth = 640;
      const targetHeight = node.offsetHeight;

      const blob = await toBlob(node, {
        cacheBust: true,
        backgroundColor: '#09090b',
        width: targetWidth,
        height: targetHeight,
        style: {
          borderRadius: '0px',
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          margin: '0px',
          padding: '32px',
          transform: 'none',
        },
      });

      if (!blob) {
        throw new Error('Generated image blob is null');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `communitrix-${config.activityName.toLowerCase().replace(/\s+/g, '-')}-results.png`;
      link.href = url;
      
      // Append to body is required for some mobile and desktop browsers to trigger click
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
      alert('Failed to export standings as image. Please take a screenshot or try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ==========================================
  // RENDER SCREENS
  // ==========================================

  if (showPodium) {
    const firstPlace = standings.find((s) => s.rank === 1) || standings[0];
    const secondPlace = standings.find((s) => s.rank === 2) || standings[1];
    const thirdPlace = standings.find((s) => s.rank === 3) || standings[2];

    return (
      <div className="space-y-6 font-sans">
        {/* Scrollable Wrapper for Mobile Viewports to prevent clipping */}
        <div className="overflow-x-auto w-full pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* Downloadable Poster Container with fixed width to ensure unclipped image output */}
          <div
            id="podium-download-area"
            className="w-[640px] shrink-0 mx-auto bg-zinc-950 text-white p-6 sm:p-8 rounded-3xl border border-orange-500/25 relative shadow-2xl overflow-hidden bg-gradient-to-br from-[#09090b] via-[#2c0f02] to-[#09090b]"
          >
          {/* Decorative background grid and shapes */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Header Branding */}
          <div className="flex justify-between items-center border-b border-zinc-800/80 pb-4 mb-6 shrink-0 relative z-10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                COMMUNITRIX SANDBOX
              </span>
              <h4 className="text-sm font-black uppercase tracking-tight text-white mt-0.5">
                {config.activityName}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-extrabold text-zinc-500 block">Format & Sport</span>
              <span className="text-xs font-bold text-zinc-350">{config.gameType} ({config.sport})</span>
            </div>
          </div>

          {/* Header section with Trophy/Sparkles */}
          <div className="text-center space-y-2 relative z-10 py-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 animate-celebrate shadow-sm">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Final Match Standings
            </h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto font-light leading-relaxed">
              Match session completed! Here are the champions and final player rankings.
            </p>
          </div>

          {/* Podium Pedestals Row */}
          <div className="flex justify-center items-end gap-3 sm:gap-6 pt-12 pb-6 max-w-md mx-auto relative border-b border-zinc-800/80 z-10">
            {/* 2nd Place */}
            {secondPlace && (
              <div className="flex flex-col items-center flex-1 animate-fade-in-up animation-delay-200 opacity-0">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-3 border-zinc-400 bg-zinc-900 flex items-center justify-center text-sm sm:text-base font-bold text-zinc-300 uppercase shadow-md shrink-0">
                    {secondPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-200 mt-2 text-center truncate max-w-[80px] sm:max-w-[100px]">
                    {secondPlace.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold">
                    {secondPlace.totalPoints} pts
                  </p>
                </div>
                <div className="w-full h-24 sm:h-32 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-t-xl flex flex-col items-center justify-center border border-zinc-700/50 shadow-md">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-300 drop-shadow-sm">2</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-450">Silver</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {firstPlace && (
              <div className="flex flex-col items-center flex-1 z-10 animate-fade-in-up opacity-0">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <Crown className="h-6 w-6 text-amber-400 absolute -top-5 transform -rotate-12 animate-bounce" />
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-amber-500 bg-zinc-900 flex items-center justify-center text-base sm:text-lg font-black text-amber-400 uppercase shadow-lg shadow-amber-450/20 shrink-0">
                    {firstPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-xs sm:text-sm font-extrabold text-white mt-2 text-center truncate max-w-[90px] sm:max-w-[120px]">
                    {firstPlace.name}
                  </p>
                  <p className="text-[11px] text-amber-400 font-black">
                    {firstPlace.totalPoints} pts
                  </p>
                </div>
                <div className="w-full h-32 sm:h-40 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 rounded-t-2xl flex flex-col items-center justify-center border border-amber-500/50 shadow-xl shadow-amber-500/10">
                  <span className="text-4xl sm:text-5xl font-black text-amber-100 drop-shadow-md">1</span>
                  <span className="text-[10px] uppercase tracking-wider font-black text-amber-900/90">Champion</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {thirdPlace && (
              <div className="flex flex-col items-center flex-1 animate-fade-in-up animation-delay-400 opacity-0">
                <div className="relative mb-2.5 flex flex-col items-center">
                  <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full border-3 border-amber-800 bg-zinc-900 flex items-center justify-center text-xs sm:text-sm font-bold text-amber-650 uppercase shadow-sm shrink-0">
                    {thirdPlace.name.slice(0, 2)}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-200 mt-2 text-center truncate max-w-[80px] sm:max-w-[100px]">
                    {thirdPlace.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-bold">
                    {thirdPlace.totalPoints} pts
                  </p>
                </div>
                <div className="w-full h-18 sm:h-24 bg-gradient-to-b from-amber-800 via-orange-950 to-amber-950 rounded-t-xl flex flex-col items-center justify-center border border-amber-800/40 shadow-sm">
                  <span className="text-2xl sm:text-3xl font-black text-amber-500 drop-shadow-2xs">3</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400/70">Bronze</span>
                </div>
              </div>
            )}
          </div>
          {/* Detailed Leaderboard Table */}
          <div className="space-y-4 pt-6 relative z-10 max-w-xl mx-auto w-full">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-550 pl-2">
              Complete Standings
            </h3>
            <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-600 to-amber-600 shadow-lg overflow-hidden">
              <div className="overflow-x-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-orange-100/30">
                <table className="w-full text-left text-xs font-sans text-white">
                  <thead>
                    <tr className="border-b border-white/10 text-orange-100/90 font-black uppercase text-[10px] tracking-wider">
                      <th className="pb-3 pl-2 w-12 sm:w-16">Rank</th>
                      <th className="pb-3 w-auto">Player</th>
                      <th className="pb-3 text-center w-16 sm:w-20">Matches</th>
                      <th className="pb-3 text-center w-20 sm:w-24">W-L-T</th>
                      <th className="pb-3 text-center w-16 sm:w-20">Diff</th>
                      <th className="pb-3 text-right pr-2 w-16 sm:w-20">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {standings.map((s) => (
                      <tr key={s.playerId} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-2 font-black text-sm text-white w-12 sm:w-16">
                          {s.rank === 1 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-orange-600 font-black text-xs shadow-sm">
                              1
                            </span>
                          ) : s.rank === 2 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200/90 text-zinc-900 font-black text-xs shadow-sm">
                              2
                            </span>
                          ) : s.rank === 3 ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-900/90 text-amber-100 font-black text-xs shadow-sm">
                              3
                            </span>
                          ) : (
                            <span className="text-orange-100/80 font-bold">#{s.rank}</span>
                          )}
                        </td>
                        <td className="py-3 w-auto">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
                              {s.name.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-extrabold text-white truncate max-w-[120px] sm:max-w-none">{s.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-center font-bold text-white w-16 sm:w-20">
                          {s.realMatchesPlayed !== undefined ? s.realMatchesPlayed : (s.wins + s.losses + s.ties)}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-orange-100/90 w-20 sm:w-24">
                          {s.wins}-{s.losses}-{s.ties}
                        </td>
                        <td className="py-3 text-center font-mono font-bold w-16 sm:w-20">
                          <span className={`px-2 py-0.5 rounded-md text-xs ${
                            s.diff > 0
                              ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30'
                              : s.diff < 0
                              ? 'bg-rose-500/20 text-rose-300 font-extrabold border border-rose-500/30'
                              : 'text-orange-100/60'
                          }`}>
                            {s.diff > 0 ? `+${s.diff}` : s.diff}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 font-black text-sm text-white w-16 sm:w-20">
                          {s.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Powered By Branding */}
          <div className="flex flex-col items-center justify-center border-t border-zinc-800/80 pt-6 mt-6 shrink-0 relative z-10 gap-1 text-center">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3 text-orange-500 animate-pulse" />
              Powered by
            </span>
            <span className="text-xs font-extrabold text-orange-500 tracking-wider uppercase">
              communitrix.id
            </span>
          </div>
        </div>
      </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Download Image Button */}
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="w-full sm:flex-1 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-550/70 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isDownloading ? 'Exporting Image...' : '📥 Download as Image'}</span>
          </button>
        </div>

        {/* Wizard Reset / Create Account Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-zinc-150">
          <button
            type="button"
            onClick={handleResetQuickMatchSession}
            className="flex-1 py-3.5 rounded-xl border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>⚡ Play Again</span>
          </button>

          {isGuestDemoMode ? (
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="flex-1 py-3.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>Create Communitrix Account</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/c/${communitySlug}`)}
              className="flex-1 py-3.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>Back to Community</span>
            </button>
          )}
        </div>
      </div>
    );
  }

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
            {config.gameType.includes('TEAM_') ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Register New Team
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (player1NameInput.trim() && player2NameInput.trim()) {
                      handleAddTeam();
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={teamNameInput}
                      onChange={(e) => setTeamNameInput(e.target.value)}
                      placeholder="Team Name (Optional)"
                      className="px-4 py-3 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-zinc-50 focus:bg-white"
                    />
                    <input
                      type="text"
                      value={player1NameInput}
                      onChange={(e) => setPlayer1NameInput(e.target.value)}
                      placeholder="Player 1 Name (Required)"
                      className="px-4 py-3 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-zinc-50 focus:bg-white"
                      required
                    />
                    <input
                      type="text"
                      value={player2NameInput}
                      onChange={(e) => setPlayer2NameInput(e.target.value)}
                      placeholder="Player 2 Name (Required)"
                      className="px-4 py-3 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-zinc-50 focus:bg-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!player1NameInput.trim() || !player2NameInput.trim() || isAddingGuest}
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isAddingGuest ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span>+ Add Team</span>
                  </button>
                </form>
              </div>
            ) : (
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
            )}

            {/* Action Button: Add Yourself (Community Mode Only) */}
            {!config.gameType.includes('TEAM_') && !isGuestDemoMode && (
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
                {config.gameType.includes('TEAM_') ? 'Team Roster' : 'Player Roster'} ({registeredPlayers.length})
              </h3>
              <p className="text-xs text-zinc-400 italic font-light">
                {config.gameType.includes('TEAM_') ? '*Minimum 2 teams required' : '*Minimum 4 players required'}
              </p>
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
                    {!isGuestDemoMode && p.isGuest && (
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
                {config.gameType.includes('TEAM_')
                  ? 'No teams added yet. Add at least 2 teams to start the session.'
                  : 'No players added yet. Add at least 4 players to start the session.'}
              </div>
            )}

            {/* Quick Community Member Selection Checklist (Community Mode Only) */}
            {!config.gameType.includes('TEAM_') && !isGuestDemoMode && availableCommunityPlayers.length > 0 && (
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
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Round Carousel Navigation Bar */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-white shadow-md space-y-3">
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

            {/* Quick Round Selector Pills */}
            {totalRounds > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2.5 border-t border-zinc-800/80 overflow-x-auto py-1">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((rNum) => {
                  const isSelected = rNum === selectedRound;
                  const roundMatchesList = matches.filter((m) => (m.roundNumber || 1) === rNum);
                  const isCompleted = roundMatchesList.length > 0 && roundMatchesList.every((m) => m.isCompleted);

                  return (
                    <button
                      key={rNum}
                      type="button"
                      onClick={() => setSelectedRound(rNum)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      <span>Round {rNum}</span>
                      {isCompleted && <Check className="h-3 w-3 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sitting Out / Bye Players Banner for Selected Round */}
          {(() => {
            const sitOutIds = roundSitOuts.get(selectedRound) || [];
            if (sitOutIds.length === 0) return null;
            const sitOutNames = sitOutIds
              .map((id) => playerMap.get(id)?.name || 'Player')
              .join(', ');

            return (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-medium flex items-center gap-2">
                <span className="font-extrabold uppercase text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded shrink-0">
                  Sitting Out (Bye)
                </span>
                <span className="truncate font-bold text-amber-900">{sitOutNames}</span>
              </div>
            );
          })()}

          {/* Match Cards List for Selected Round */}
          <div className="space-y-4">
            {(() => {
              const currentRoundMatches = matches.filter(
                (m) => (m.roundNumber || 1) === selectedRound
              );

              if (currentRoundMatches.length === 0) {
                return (
                  <div className="p-8 rounded-2xl border border-dashed border-zinc-200 bg-white text-center text-xs text-zinc-400 font-light">
                    No matches generated for Round {selectedRound} yet.
                  </div>
                );
              }

              return currentRoundMatches.map((m, idx) => {
                const teamANamesJoined = config.gameType.includes('TEAM_')
                  ? (playerMap.get(m.teamA[0])?.name || 'Team')
                  : m.teamA.map((id) => playerMap.get(id)?.name || 'Player').join(' / ');
                const teamBNamesJoined = config.gameType.includes('TEAM_')
                  ? (playerMap.get(m.teamB[0])?.name || 'Team')
                  : m.teamB.map((id) => playerMap.get(id)?.name || 'Player').join(' / ');

                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <span className="font-black text-xs text-[#111827] uppercase tracking-wider">
                        Court {m.courtNumber}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20">
                        Match {idx + 1}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 text-center">
                      {/* Team A (stacked vertically, no Team A label) */}
                      <div className="sm:col-span-2 space-y-0.5 text-center sm:text-right">
                        {m.teamA.filter(Boolean).map((id, pIdx) => (
                          <p key={`${id}-${pIdx}`} className="text-xs font-bold text-zinc-900 truncate">
                            {playerMap.get(id)?.name || 'Player'}
                          </p>
                        ))}
                      </div>

                      {/* Interactive Score Picker Buttons */}
                      <div className="sm:col-span-1 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActivePicker({
                              matchId: m.id,
                              team: 'A',
                              teamName: teamANamesJoined,
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
                              teamName: teamBNamesJoined,
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

                      {/* Team B (stacked vertically, no Team B label) */}
                      <div className="sm:col-span-2 space-y-0.5 text-center sm:text-left">
                        {m.teamB.filter(Boolean).map((id, pIdx) => (
                          <p key={`${id}-${pIdx}`} className="text-xs font-bold text-zinc-900 truncate">
                            {playerMap.get(id)?.name || 'Player'}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateNextRound}
              className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>+ Generate Next Round (Round {totalRounds + 1})</span>
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
                <span className="mx-1.5 text-zinc-300">•</span>
                <span className="font-bold text-zinc-700 uppercase">{config.gameType.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          {/* Standings Table Card with Horizontal Scroll */}
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
                          <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600 uppercase shrink-0">
                            {s.name.slice(0, 2)}
                          </div>
                          <div className="truncate max-w-[130px] sm:max-w-none">
                            <p className="font-bold text-zinc-900 truncate">{s.name}</p>
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
                      <td className="py-3 text-center font-mono font-bold text-zinc-900">
                        <span className={`px-2 py-0.5 rounded-md text-xs ${
                          s.diff > 0
                            ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                            : s.diff < 0
                            ? 'bg-rose-50 text-rose-600 font-extrabold'
                            : 'text-zinc-500'
                        }`}>
                          {s.diff > 0 ? `+${s.diff}` : s.diff}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-black text-sm text-[#111827] whitespace-nowrap">
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
            <div className="block sm:hidden text-center text-[10px] text-zinc-400 font-medium py-2 bg-zinc-50 border-t border-zinc-100">
              ← Scroll horizontally to view full stats →
            </div>
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
            <span>⚡ End Match Session</span>
          </button>
        </div>
      )}

      {/* Confirmation End Session Modal */}
      {showConfirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-white shadow-2xl space-y-5 text-center font-sans">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
              <Trophy className="h-7 w-7 animate-celebrate" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black uppercase tracking-wide">
                End Match Session? ⚡
              </h3>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                Are you sure you want to end this Quick Match session? The match will be finalized, and the final results will be displayed on the podium.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmEndModal(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndMatch}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
              >
                Yes, End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Score Picker Modal */}
      {activePicker && (() => {
        const activeMatch = matches.find((m) => m.id === activePicker.matchId);
        const isPointsMode = config.scoringSystem === 'POINTS';
        const isTotalOf = config.pointTarget.toLowerCase().includes('total of');
        
        let maxAllowed = configN;
        if (!isPointsMode && !isTotalOf && activeMatch) {
          // For First to N / General mode: max score allowed for this team = configN - (other team's score || 0)
          const otherScore = activePicker.team === 'A' ? activeMatch.scoreB : activeMatch.scoreA;
          if (otherScore !== null && otherScore !== undefined) {
            maxAllowed = Math.max(0, configN - Number(otherScore));
          }
        }

        return (
          <ScorePickerModal
            isOpen={!!activePicker}
            onClose={() => setActivePicker(null)}
            teamName={activePicker.teamName}
            currentScore={activePicker.currentScore}
            maxTarget={configN}
            maxAllowedScore={maxAllowed}
            onSelectScore={(score) => {
              if (activeMatch) {
                if (activePicker.team === 'A') {
                  handleUpdateScore(activePicker.matchId, score, activeMatch.scoreB, 'A');
                } else {
                  handleUpdateScore(activePicker.matchId, activeMatch.scoreA, score, 'B');
                }
              }
            }}
          />
        );
      })()}
    </div>
  );
}

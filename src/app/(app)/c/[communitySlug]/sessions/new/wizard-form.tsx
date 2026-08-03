'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startSessionAction, uploadOfflineSessionAction } from '@/server/actions/session.actions';
import { generateNextRoundAction, persistRoundAction } from '@/server/actions/round.actions';
import { addGuestPlayerAction } from '@/server/actions/member.actions';
import { saveQuickMatchStateAction } from '@/server/actions/personal-match.actions';
import LeaderboardPoster from '@/components/leaderboard-poster';
import RoundCarousel from '@/components/session-live/round-carousel';
import LiveLeaderboardTabs from '@/components/session-live/live-leaderboard-tabs';
import GenerateRoundButton from '@/components/session-live/generate-round-button';
import ScoreButtonPair from '@/components/session-live/score-button-pair';
import StandingsTable from '@/components/session-live/standings-table';
import { getAvatarUrl } from '@/lib/utils/profile';
import {
  Trophy,
  Users,
  LayoutGrid,
  AlertCircle,
  Loader2,
  Check,
  ArrowLeft,
  ChevronDown,
  UserPlus,
  Flame,
  Award,
  Sparkles,
  Search,
  RotateCcw,
} from 'lucide-react';
import { generateAmericanoRound } from '@/lib/matchmaking/americano';
import { generateMexicanoRound } from '@/lib/matchmaking/mexicano';
import { Attendee, PastPairing, MatchHistory, StandingRow } from '@/lib/matchmaking/types';
import { sortStandings, StandingsMetric } from '@/lib/matchmaking/standings';
import { isFixedSumWizardConfig } from '@/lib/matchmaking/scoring-format';
import ScorePickerModal from '@/components/score-picker-modal';

// ==========================================
// 1. DATA MODELS & STATE INTERFACES
// ==========================================

export type SportType = 'PADEL' | 'TENNIS';
export type GameType = 'AMERICANO' | 'MEXICANO' | 'TEAM_AMERICANO' | 'TEAM_MEXICANO';
export type ScoringSystem = 'POINTS' | 'GENERAL';
export type LeaderboardRankBy = 'POINT' | 'WIN';

export type ByeScoringMethod = 'PLAYER_AVERAGE' | 'HALF_N';

export type SessionMode = 'ONLINE' | 'OFFLINE';

export type MatchType = 'SINGLES' | 'DOUBLES';

export interface GameConfiguration {
  sport: SportType;
  gameType: GameType;
  // Real community sessions only — respected by both Online and Offline. Hidden in Quick
  // Match, which always plays Doubles. Padel is always Doubles; the DB rejects Padel+SINGLES
  // outright, so the UI only offers this choice for Tennis.
  matchType: MatchType;
  activityName: string;
  courtCount: number;
  scoringSystem: ScoringSystem;
  pointTarget: string;
  leaderboardRankedBy: LeaderboardRankBy;
  // Bye Point Method — locked once Round 1 is generated (brief §4)
  // PLAYER_AVERAGE: average of player's own MATCH entries, fallback round(N/2)
  // HALF_N: always round(N/2), fixed & non-adaptive
  byeScoringMethod: ByeScoringMethod;
  // Community sessions only (ignored in Quick Match) — ONLINE is today's realtime, multi-host,
  // per-round server sync. OFFLINE plays entirely on this device with the same local engine
  // Quick Match uses, uploading everything to the server only once, when the session ends.
  sessionMode: SessionMode;
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
  // Player IDs. Always a 2-slot tuple even for Singles (matchType === 'SINGLES') — the second
  // slot is '' when there's no partner. Every consumer must .filter(Boolean) before use; this
  // stays a fixed tuple rather than string[] to avoid a wider type change across the file.
  teamA: [string, string];
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
  // Personal Quick Match (from the Profile page): local play like guest demo mode, but the
  // finished match is saved to the logged-in user's own profile (not a community, no ELO).
  saveToProfile?: boolean;
  // Resume an existing OPEN Personal Quick Match (from a "Continue" link on the Profile
  // page's history) — hydrates straight into Live Matches instead of starting a new session.
  initialState?: {
    matchId: string;
    version: number;
    config: GameConfiguration;
    registeredPlayers: PlayerRegistration[];
    matches: Match[];
    roundSitOuts: Record<string, string[]>;
    selectedRound: number;
  };
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
  saveToProfile = false,
  initialState,
}: WizardFormProps) {
  const router = useRouter();

  // Wizard Step State (1: Game Type, 2: Setup Config, 3: Registration, 4: Match Generation, 5: Leaderboard)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialState ? 4 : 1);
  const [showDemoCompleteModal, setShowDemoCompleteModal] = useState(false);
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [showPodium, setShowPodium] = useState(false);

  // Tracks the personal_quick_matches row id once the session has been created in the DB
  // (as soon as the first round is generated), so a lost connection or a dead phone doesn't
  // lose the match — it's already saved as OPEN and resumable from the Profile page.
  const [profileMatchId, setProfileMatchId] = useState<string | null>(initialState?.matchId ?? null);
  // Optimistic-concurrency version for the row above — prevents two tabs/devices resuming the
  // same match from silently overwriting each other (see syncConflict below).
  const [profileMatchVersion, setProfileMatchVersion] = useState<number>(initialState?.version ?? 0);
  const [syncConflict, setSyncConflict] = useState(false);

  // ------------------------------------------
  // STEP 1 & 2: CONFIGURATION STATE
  // ------------------------------------------
  const [config, setConfig] = useState<GameConfiguration>(
    initialState?.config ?? {
      sport: 'PADEL',
      gameType: 'AMERICANO',
      activityName: `Match Session - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      courtCount: 1,
      scoringSystem: 'POINTS',
      pointTarget: '16 Points',
      leaderboardRankedBy: 'POINT',
      byeScoringMethod: 'PLAYER_AVERAGE', // default per brief §3
      sessionMode: 'ONLINE',
      matchType: 'DOUBLES',
    }
  );

  // ------------------------------------------
  // STEP 3: PLAYER REGISTRATION STATE
  // ------------------------------------------
  const [registeredPlayers, setRegisteredPlayers] = useState<PlayerRegistration[]>(
    initialState?.registeredPlayers ?? []
  );
  const [manualInputName, setManualInputName] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [player1NameInput, setPlayer1NameInput] = useState('');
  const [player2NameInput, setPlayer2NameInput] = useState('');
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [guestErrorMessage, setGuestErrorMessage] = useState<string | null>(null);
  // Maps a temp client-side guest id to the promise resolving its real DB profile id
  // (set by addGuestPlayerAction's background call). Awaited before starting a real
  // community session so attendeeIds sent to the DB are never stale temp ids.
  const pendingGuestCreations = useRef<Map<string, Promise<string>>>(new Map());

  // Community member list for selection
  const [availableCommunityPlayers, setAvailableCommunityPlayers] = useState<Player[]>(initialPlayers);
  const [communityMemberSearch, setCommunityMemberSearch] = useState('');

  // ------------------------------------------
  // STEP 4: MATCH GENERATION & SCORE PICKER STATE
  // ------------------------------------------
  const [matches, setMatches] = useState<Match[]>(initialState?.matches ?? []);
  // roundSitOuts: Map<roundNumber, Set<playerId>> — records who sat out each generated round
  // This is the source of truth for bye detection, set at round-generation time (not derived from completed matches)
  const [roundSitOuts, setRoundSitOuts] = useState<Map<number, string[]>>(() => {
    if (!initialState) return new Map();
    const restored = new Map<number, string[]>();
    Object.entries(initialState.roundSitOuts).forEach(([k, v]) => restored.set(Number(k), v));
    return restored;
  });
  const [selectedRound, setSelectedRound] = useState<number>(initialState?.selectedRound ?? 1);
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

  // Guards local round generation against rapid double-clicks. handleGenerateNextRound reads
  // `matches` from a closure and appends to it — two clicks fired before React re-renders both
  // capture the SAME stale `matches`, compute the SAME "next round number", and each append
  // their own full set of matches for it, silently duplicating an entire round's worth of
  // points under one round label. A ref (not state) is required here specifically because it
  // updates synchronously, before any re-render — state-based disabling reacts too late to stop
  // a second click fired in the same tick as the first.
  const isGeneratingRoundRef = useRef(false);
  const [isGeneratingRound, setIsGeneratingRound] = useState(false);

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
  // Separate keys per entry point so they never bleed into each other's in-progress local
  // state: public sandbox, a logged-in user's Personal Quick Match, and an Offline community
  // session (scoped per community, since a host could run Offline sessions for more than one).
  const quickMatchStorageKey = saveToProfile
    ? 'communitrix_quick_match_session_profile'
    : !isGuestDemoMode
    ? `communitrix_offline_session_${communityId}`
    : 'communitrix_quick_match_session';

  // System Submission State (declared early so handleConfirmEndMatch below can use it)
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveResultError, setSaveResultError] = useState<string | null>(null);
  // Offline community session upload — same shape as the Personal Quick Match save state above,
  // but for the one-shot bulk upload that happens when an Offline session ends.
  const [isUploadingOffline, setIsUploadingOffline] = useState(false);
  const [uploadOfflineError, setUploadOfflineError] = useState<string | null>(null);
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null);
  // Tracks failures from the background OPEN-match sync below, surfaced in the UI (not
  // silent) so a lost connection is visible instead of only discovered after data is gone.
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Restore saved Quick Match session state on mount.
  // - Sandbox mode: restores everything, including in-progress matches (unchanged behavior).
  // - Personal Quick Match (saveToProfile): once a match reaches step 4 (rounds generated),
  //   the database is the source of truth, resumed only via an explicit "Continue This Match"
  //   link (initialState) — never silently from local browser state. But steps 1-3 (game
  //   type, config, player registration) happen before any DB row exists, so a local draft is
  //   still restored there — otherwise a crash while just picking players loses everything
  //   with zero recovery, which defeats the point of this feature.
  // - Community sessions (Online or Offline): same resilience, using the community-scoped key
  //   above. Online never reaches step 4 locally (redirects to the server-backed Live Board
  //   before that's possible), so in practice this only ever restores steps 1-3 for Online; a
  //   full in-progress Offline session (any step) restores fully.
  useEffect(() => {
    if (typeof window === 'undefined' || initialState) return;
    const saved = localStorage.getItem(quickMatchStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (saveToProfile && (!parsed.step || parsed.step >= 4)) return; // never restore a generated match locally in profile mode
        if (parsed.step) setStep(parsed.step);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.registeredPlayers) setRegisteredPlayers(parsed.registeredPlayers);
        if (!saveToProfile) {
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
        }
      } catch (e) {
        console.error('Failed to restore quick match session state', e);
      }
    }
  }, [isGuestDemoMode, saveToProfile, quickMatchStorageKey, initialState]);

  // 2. Auto-save Quick Match session state on every change. In profile mode this only matters
  // for steps 1-3 (see above) — once matches exist, the DB sync below takes over and this
  // local draft is cleared so it's never mistaken for a resumable session on next visit.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (saveToProfile && step >= 4) {
      localStorage.removeItem(quickMatchStorageKey);
      return;
    }
    const sitOutsObj: Record<string, string[]> = {};
    roundSitOuts.forEach((v, k) => { sitOutsObj[String(k)] = v; });
    const payload = { step, config, registeredPlayers, matches, roundSitOuts: sitOutsObj, selectedRound };
    localStorage.setItem(quickMatchStorageKey, JSON.stringify(payload));
  }, [isGuestDemoMode, saveToProfile, quickMatchStorageKey, step, config, registeredPlayers, matches, roundSitOuts, selectedRound]);

  // Serializes the current match state into the shape saveQuickMatchStateAction expects.
  const buildQuickMatchStatePayload = (status: 'OPEN' | 'ENDED') => {
    const sitOutsObj: Record<string, string[]> = {};
    roundSitOuts.forEach((v, k) => { sitOutsObj[String(k)] = v; });
    return {
      activityName: config.activityName,
      sport: config.sport,
      gameType: config.gameType,
      scoringSystem: config.scoringSystem,
      pointTarget: config.pointTarget,
      config,
      players: registeredPlayers,
      matches,
      standings,
      roundSitOuts: sitOutsObj,
      status,
    };
  };

  // Creates the row on first call (profileMatchId still null), updates it on every call after.
  // Used by the debounced sync, the retry-on-failure loop, and the flush-on-background handler
  // below, so every one of them is also a natural retry opportunity for a failed creation.
  // Stops entirely once a version conflict is detected (another tab/device has newer changes)
  // rather than risk silently overwriting them.
  const syncQuickMatchToProfile = async () => {
    if (!saveToProfile || matches.length === 0 || syncConflict) return;
    const payload = buildQuickMatchStatePayload('OPEN');
    const result = profileMatchId
      ? await saveQuickMatchStateAction({ id: profileMatchId, expectedVersion: profileMatchVersion, ...payload })
      : await saveQuickMatchStateAction(payload);
    if (result.ok) {
      setSyncError(null);
      if (result.id && !profileMatchId) setProfileMatchId(result.id);
      if (typeof result.version === 'number') setProfileMatchVersion(result.version);
    } else if (result.conflict) {
      setSyncConflict(true);
    } else {
      setSyncError(result.message || 'Could not save this match to your profile — will keep retrying.');
    }
  };

  // Keep a ref to the latest sync function so the visibility/pagehide listener (registered
  // once) always calls the version closed over the current match state, not a stale one.
  const syncQuickMatchToProfileRef = useRef(syncQuickMatchToProfile);
  syncQuickMatchToProfileRef.current = syncQuickMatchToProfile;

  // 3. Personal Quick Match resilience — debounced sync to the DB (create on first round,
  // update on every score/round change after) so a lost connection or a dead phone after this
  // point doesn't lose the match: it's already saved as OPEN and resumable from the Profile page.
  useEffect(() => {
    if (!saveToProfile || matches.length === 0 || syncConflict) return;
    syncDebounceRef.current = setTimeout(() => { syncQuickMatchToProfile(); }, 1000);
    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToProfile, matches, roundSitOuts, syncConflict]);

  // 4. If a sync failed, keep retrying every 5s until it succeeds — a failure with no further
  // score/round changes (e.g. player walks away right after a network blip) would otherwise
  // never get another chance via effect 3 above.
  useEffect(() => {
    if (!saveToProfile || !syncError || syncConflict) return;
    const retryTimer = setInterval(() => { syncQuickMatchToProfile(); }, 5000);
    return () => clearInterval(retryTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToProfile, syncError, syncConflict, profileMatchId]);

  // 5. Flush immediately when the app is backgrounded/closed, instead of waiting out the
  // debounce — shrinks the window in which a dead phone could lose the last few seconds of play.
  useEffect(() => {
    if (!saveToProfile || syncConflict) return;
    const flushNow = () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncQuickMatchToProfileRef.current();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flushNow);
    };
  }, [saveToProfile, syncConflict]);

  // 6. Reset Quick Match session
  const handleResetQuickMatchSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(quickMatchStorageKey);
    }
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    setStep(1);
    setRegisteredPlayers([]);
    setMatches([]);
    setRoundSitOuts(new Map());
    setSelectedRound(1);
    setProfileMatchId(null);
    setProfileMatchVersion(0);
    setSyncError(null);
    setSyncConflict(false);
    setShowPodium(false);
    setShowConfirmEndModal(false);
    setIsUploadingOffline(false);
    setUploadOfflineError(null);
    setUploadedSessionId(null);
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
      const creationPromise = addGuestPlayerAction({ communityId, fullName: name })
        .then((result) => {
          if (result.ok && result.data) {
            const dbId = result.data.id;
            setRegisteredPlayers((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, id: dbId, name: result.data.full_name || name } : p))
            );
            return dbId;
          }
          return tempId;
        })
        .catch((err) => {
          console.error('Background guest creation error:', err);
          return tempId;
        });
      pendingGuestCreations.current.set(tempId, creationPromise);
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
      const creationPromise = addGuestPlayerAction({ communityId, fullName })
        .then((result) => {
          if (result.ok && result.data) {
            const dbId = result.data.id;
            setRegisteredPlayers((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, id: dbId } : p))
            );
            return dbId;
          }
          return tempId;
        })
        .catch((err) => {
          console.error('Background team creation error:', err);
          return tempId;
        });
      pendingGuestCreations.current.set(tempId, creationPromise);
    }
  };

  const handleRemovePlayer = (id: string) => {
    setRegisteredPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Step 3 -> 4: Generate Matches based on official Ruleset (Americano / Mexicano)
  const handleGenerateMatches = () => {
    const isTeamMode = config.gameType.includes('TEAM_');
    const minRequired = isTeamMode ? 2 : config.matchType === 'SINGLES' ? 2 : 4;

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
    // config.matchType is only ever 'SINGLES' for real (non-Quick-Match) sessions — the toggle
    // that sets it is hidden entirely in Quick Match, so this always evaluates to Doubles there.
    const playersPerMatch = isTeamMode ? 2 : config.matchType === 'SINGLES' ? 2 : 4;
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

  // Step 3 -> Live Board: Community sessions skip local play entirely. Create the
  // session in the DB and hand off to the real-time Live Board (sessions/[sessionId]),
  // which drives round generation + scoring live via generateNextRoundAction /
  // submitMatchScoreAction — this is what actually applies Elo/CP, and it supports
  // multiple Hosts scoring the same session concurrently, which local wizard state cannot.
  const handleStartCommunitySession = async () => {
    const isTeamMode = config.gameType.includes('TEAM_');
    const minRequired = isTeamMode ? 2 : config.matchType === 'SINGLES' ? 2 : 4;

    if (registeredPlayers.length < minRequired) {
      setErrorMessage(`Minimum ${minRequired} ${isTeamMode ? 'teams' : 'players'} required to start a session.`);
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Wait for any in-flight guest-player DB creations so attendeeIds are all real profile ids.
      const attendeeIds = await Promise.all(
        registeredPlayers.map((p) => pendingGuestCreations.current.get(p.id) ?? Promise.resolve(p.id))
      );

      // The DB only allows points_mode='FIXED_TOTAL' when scoring_type='POINTS' (see
      // sessions_points_mode_valid), so "Total of N" is stored as POINTS/FIXED_TOTAL even though
      // it was picked from the GENERAL tab in the UI.
      const isFixedSum = isFixedSumWizardConfig(config.scoringSystem, config.pointTarget);

      const result = await startSessionAction({
        communityId,
        name: config.activityName,
        format: config.gameType.includes('MEXICANO') ? 'MEXICANO' : 'AMERICANO',
        sport: config.sport,
        scoringType: isFixedSum ? 'POINTS' : 'GAMES',
        pointsMode: isFixedSum ? 'FIXED_TOTAL' : 'FIRST_TO_TARGET',
        maxScoreTarget: configN,
        courtCount: config.courtCount,
        roundsPlanned: null, // open-ended — Live Board generates rounds until a Host ends the session
        attendeeIds,
        byeScoringMethod: config.byeScoringMethod,
        sessionMode: 'ONLINE', // this path is only ever reached for Online sessions — see handleProceedFromRegistration
        matchType: config.matchType,
      });

      if (!result.ok) {
        setIsSubmitting(false);
        setErrorMessage(result.message || 'Failed to start the session.');
        return;
      }

      const sessionId = result.data.sessionId;

      // Generate & persist Round 1 immediately, matching Quick Match: one action both starts
      // the session and shows Round 1 already on court — no separate empty "Generate Round 1"
      // step. Not blocking on failure here — the Live Board still has its own Generate button
      // as a fallback if this happens to fail.
      const genResult = await generateNextRoundAction(sessionId, 1);
      if (genResult.ok) {
        const formattedCourts = genResult.data.courts.map((c: any) => ({
          courtNumber: c.courtNumber,
          teamA: c.teamA.map((p: any) => p.id),
          teamB: c.teamB.map((p: any) => p.id),
        }));
        await persistRoundAction({
          sessionId,
          roundNumber: 1,
          courts: formattedCourts,
          sitOuts: genResult.data.sitOuts.map((p: any) => p.id),
        });
      }

      // Session now exists server-side — clear the steps-1-3 local draft so re-opening the
      // wizard for this community doesn't restore stale state from this finished attempt.
      if (typeof window !== 'undefined') {
        localStorage.removeItem(quickMatchStorageKey);
      }

      router.push(`/c/${communitySlug}/sessions/${sessionId}`);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to start the session.');
    }
  };

  // Step 3 -> Step 4/Live Board: dispatch by mode. Offline community sessions reuse the exact
  // same local engine as Quick Match (handleGenerateMatches) instead of creating a session on
  // the server — nothing touches the database until handleUploadOfflineSession runs at the end.
  const handleProceedFromRegistration = () => {
    if (isGuestDemoMode || config.sessionMode === 'OFFLINE') {
      handleGenerateMatches();
    } else {
      handleStartCommunitySession();
    }
  };

  // Step 4: Generate Next Match Round
  const handleGenerateNextRound = () => {
    if (isGeneratingRoundRef.current) return;
    isGeneratingRoundRef.current = true;
    setIsGeneratingRound(true);

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
    const playersPerMatch = isTeamMode ? 2 : config.matchType === 'SINGLES' ? 2 : 4;

    const history: PastPairing[] = matches.map((m) => ({
      roundNumber: m.roundNumber || 1,
      teamA: m.teamA.filter(Boolean),
      teamB: m.teamB.filter(Boolean),
    }));

    const activeStandings = standings.map((s) => ({
      profileId: s.playerId,
      matchesPlayed: (s.realMatchesPlayed ?? 0) + (s.byesCount ?? 0),
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
      teamA: m.teamA.filter(Boolean),
      teamB: m.teamB.filter(Boolean),
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
    } finally {
      isGeneratingRoundRef.current = false;
      setIsGeneratingRound(false);
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
    const isFixedSum = isFixedSumWizardConfig(config.scoringSystem, config.pointTarget);
    const targetN = configN;

    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;

        let finalA = scoreA;
        let finalB = scoreB;

        if (targetN > 0) {
          if (isFixedSum) {
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
      matchesPlayed: (item.realMatchesPlayed ?? 0) + (item.byesCount ?? 0),
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
      teamA: m.teamA.filter(Boolean),
      teamB: m.teamB.filter(Boolean),
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

  // Quick Match only — Community sessions never reach step 4/5 (they hand off to the
  // Live Board in handleStartCommunitySession above). Sandbox mode has nothing to persist;
  // Personal Quick Match (saveToProfile) saves the finished match to the user's own profile.
  const handleConfirmEndMatch = async () => {
    setShowConfirmEndModal(false);

    if (saveToProfile) {
      // Cancel any pending/looping OPEN-status sync so it can't fire after (and silently
      // undo) the ENDED save below — the retry loop in particular would otherwise keep
      // flipping this match back to OPEN forever if it had a failure right before ending.
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      setSyncError(null);

      setIsSavingResult(true);
      setSaveResultError(null);
      const result = await saveQuickMatchStateAction({
        id: profileMatchId ?? undefined,
        expectedVersion: profileMatchVersion,
        ...buildQuickMatchStatePayload('ENDED'),
      });
      setIsSavingResult(false);
      if (result.conflict) {
        setSaveResultError('This match was already updated somewhere else — refresh the Profile page to see its latest state instead of ending it from here.');
      } else if (!result.ok) {
        setSaveResultError(result.message || 'Failed to save this match to your profile.');
      } else if (result.id) {
        setProfileMatchId(result.id);
        if (typeof result.version === 'number') setProfileMatchVersion(result.version);
      }

      // The match is finished (saved or not) — clear the draft so re-opening Quick Match
      // from the Profile page always starts a brand new match instead of restoring this one.
      if (typeof window !== 'undefined') {
        localStorage.removeItem(quickMatchStorageKey);
      }
    } else if (!isGuestDemoMode && config.sessionMode === 'OFFLINE') {
      // Offline community session — this is the one and only point it ever touches the
      // database. Replay every fully-scored round through the same RPCs a live Online host
      // would call, in order, then finalize.
      setIsUploadingOffline(true);
      setUploadOfflineError(null);

      try {
        // Resolve every player to a real profile id — a guest's creation may still be in
        // flight (or, after a page reload mid-session, its promise may be gone entirely, in
        // which case there's nothing to await and the id is used as-is).
        const idEntries = await Promise.all(
          registeredPlayers.map(async (p) => {
            const realId = await (pendingGuestCreations.current.get(p.id) ?? Promise.resolve(p.id));
            return [p.id, realId] as const;
          })
        );
        const idMap = new Map(idEntries);
        const remap = (id: string) => idMap.get(id) || id;

        // Group local matches by round, keeping only rounds where every court has both
        // scores — an in-progress round with any unscored court is dropped rather than
        // blocking "End Session" or inventing a void step.
        const roundNumbers = Array.from(new Set(matches.map((m) => m.roundNumber))).sort((a, b) => a - b);
        const rounds = roundNumbers
          .map((roundNumber) => {
            const roundMatches = matches.filter((m) => m.roundNumber === roundNumber);
            const fullyScored = roundMatches.length > 0 && roundMatches.every((m) => m.scoreA !== null && m.scoreB !== null);
            if (!fullyScored) return null;
            return {
              roundNumber,
              courts: roundMatches.map((m) => ({
                courtNumber: m.courtNumber,
                teamA: m.teamA.filter(Boolean).map(remap),
                teamB: m.teamB.filter(Boolean).map(remap),
                scoreA: m.scoreA as number,
                scoreB: m.scoreB as number,
              })),
              sitOuts: (roundSitOuts.get(roundNumber) || []).map(remap),
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rounds.length === 0) {
          setIsUploadingOffline(false);
          setUploadOfflineError('No fully-scored rounds to upload — score at least one full round before ending the session.');
          setShowPodium(true);
          return;
        }

        const isFixedSum = isFixedSumWizardConfig(config.scoringSystem, config.pointTarget);

        const result = await uploadOfflineSessionAction({
          communityId,
          communitySlug,
          name: config.activityName,
          format: config.gameType.includes('MEXICANO') ? 'MEXICANO' : 'AMERICANO',
          sport: config.sport,
          scoringType: isFixedSum ? 'POINTS' : 'GAMES',
          pointsMode: isFixedSum ? 'FIXED_TOTAL' : 'FIRST_TO_TARGET',
          maxScoreTarget: configN,
          courtCount: config.courtCount,
          byeScoringMethod: config.byeScoringMethod,
          matchType: config.matchType,
          attendeeIds: registeredPlayers.map((p) => remap(p.id)),
          rounds,
        });

        setIsUploadingOffline(false);

        if (result.ok) {
          setUploadedSessionId(result.data.sessionId);
          if (typeof window !== 'undefined') localStorage.removeItem(quickMatchStorageKey);
        } else {
          setUploadOfflineError(result.message || 'Failed to upload this session.');
        }
      } catch (err: any) {
        setIsUploadingOffline(false);
        setUploadOfflineError(err?.message || 'Failed to upload this session.');
      }
    }

    setShowPodium(true);
  };

  // ==========================================
  // RENDER SCREENS
  // ==========================================

  if (showPodium) {
    return (
      <div className="space-y-6 font-sans">
        {saveToProfile && (
          <div
            className={`flex items-center gap-2.5 rounded-2xl border p-4 text-xs font-medium ${
              saveResultError
                ? 'bg-red-50 border-red-200 text-red-700'
                : isSavingResult
                ? 'bg-zinc-50 border-zinc-200 text-zinc-600'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            {isSavingResult ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                <span>Saving this match to your profile...</span>
              </>
            ) : saveResultError ? (
              <>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveResultError} Your results are still shown below, but weren&apos;t saved to My Quick Matches.</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span>Saved to My Quick Matches on your profile.</span>
              </>
            )}
          </div>
        )}

        {!isGuestDemoMode && config.sessionMode === 'OFFLINE' && (
          <div
            className={`flex items-center gap-2.5 rounded-2xl border p-4 text-xs font-medium ${
              uploadOfflineError
                ? 'bg-red-50 border-red-200 text-red-700'
                : isUploadingOffline
                ? 'bg-zinc-50 border-zinc-200 text-zinc-600'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            {isUploadingOffline ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                <span>Uploading this session to the community — applying Elo, bye points, and Community Points...</span>
              </>
            ) : uploadOfflineError ? (
              <>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadOfflineError} Your results are still shown below, but this session has not been saved to the community yet.</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span>Uploaded to the community — Elo, bye points, and Community Points have been applied.</span>
              </>
            )}
          </div>
        )}

        <LeaderboardPoster
          activityName={config.activityName}
          gameType={config.gameType}
          sport={config.sport}
          standings={standings}
        />

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

          {saveToProfile ? (
            <button
              type="button"
              onClick={() => router.push('/communities')}
              className="flex-1 py-3.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>Back to My Profile</span>
            </button>
          ) : isGuestDemoMode ? (
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
              onClick={() =>
                router.push(
                  uploadedSessionId
                    ? `/c/${communitySlug}/sessions/${uploadedSessionId}`
                    : `/c/${communitySlug}`
                )
              }
              className="flex-1 py-3.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>{uploadedSessionId ? 'View Uploaded Session' : 'Back to Community'}</span>
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
        <LiveLeaderboardTabs
          value={step === 5 ? 'LEADERBOARD' : 'MATCHES'}
          onChange={(v: 'MATCHES' | 'LEADERBOARD') => setStep(v === 'LEADERBOARD' ? 5 : 4)}
        />
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

      {saveToProfile && syncConflict && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>
            This match is open somewhere else with newer changes — this tab has stopped saving to
            avoid overwriting them. Refresh the Profile page to continue from the latest version.
          </span>
        </div>
      )}

      {saveToProfile && !syncConflict && syncError && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 animate-pulse" />
          <span>Not saved to your profile yet — {syncError} Keep this tab open if you can.</span>
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
              onClick={() => setConfig((prev) => ({ ...prev, sport: 'PADEL', matchType: 'DOUBLES' }))}
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

          {/* Singles / Doubles Toggle — Tennis only. Padel is always Doubles (padel courts are
              always 2v2), so this is hidden entirely rather than shown disabled. Real community
              sessions only (Online and Offline both respect it) — hidden in Quick Match, which
              always plays Doubles. */}
          {!isGuestDemoMode && config.sport === 'TENNIS' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Match Type</label>
              <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl max-w-xs">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, matchType: 'DOUBLES' }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${config.matchType === 'DOUBLES'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                >
                  Doubles
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, matchType: 'SINGLES' }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${config.matchType === 'SINGLES'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                >
                  Singles
                </button>
              </div>
            </div>
          )}

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

            {/* Session Mode — community sessions only; Quick Match has no server to be
                online/offline about. Online = today's realtime, multi-host behavior. Offline =
                score locally on this device (fast, no per-match network round-trip), uploading
                everything only once, when the session ends. */}
            {!isGuestDemoMode && (
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <div>
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Session Mode
                  </label>
                  <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                    How this session syncs with the server while you play
                  </p>
                </div>
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, sessionMode: 'ONLINE' }))}
                    className={`flex-1 py-3 px-3 rounded-xl text-left border-2 transition-all cursor-pointer ${
                      config.sessionMode === 'ONLINE'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <p className={`text-xs font-extrabold uppercase ${
                      config.sessionMode === 'ONLINE' ? 'text-orange-600' : 'text-zinc-600'
                    }`}>
                      Online
                    </p>
                    <p className="text-[10px] text-zinc-400 font-light mt-0.5 leading-snug">
                      Real-time — every host sees updates instantly. Best with multiple hosts.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, sessionMode: 'OFFLINE' }))}
                    className={`flex-1 py-3 px-3 rounded-xl text-left border-2 transition-all cursor-pointer ${
                      config.sessionMode === 'OFFLINE'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <p className={`text-xs font-extrabold uppercase ${
                      config.sessionMode === 'OFFLINE' ? 'text-orange-600' : 'text-zinc-600'
                    }`}>
                      Offline
                    </p>
                    <p className="text-[10px] text-zinc-400 font-light mt-0.5 leading-snug">
                      Score on this device only, upload everything when you end the session.
                    </p>
                  </button>
                </div>
                {config.sessionMode === 'OFFLINE' && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-start gap-1 pt-0.5">
                    <span>⚠</span>
                    <span>Only this device can score — other hosts won't see live updates, and nothing is saved to the community until you end the session.</span>
                  </p>
                )}
              </div>
            )}
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
                {config.gameType.includes('TEAM_')
                  ? '*Minimum 2 teams required'
                  : `*Minimum ${config.matchType === 'SINGLES' ? 2 : 4} players required`}
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
                  : `No players added yet. Add at least ${config.matchType === 'SINGLES' ? 2 : 4} players to start the session.`}
              </div>
            )}

            {/* Quick Community Member Selection Checklist (Community Mode Only) */}
            {!config.gameType.includes('TEAM_') && !isGuestDemoMode && availableCommunityPlayers.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-zinc-100">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  Or Select From Community Members ({availableCommunityPlayers.length})
                </span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={communityMemberSearch}
                    onChange={(e) => setCommunityMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                  />
                </div>
                {(() => {
                  const filteredMembers = availableCommunityPlayers.filter((p) =>
                    p.fullName.toLowerCase().includes(communityMemberSearch.trim().toLowerCase())
                  );
                  if (filteredMembers.length === 0) {
                    return <p className="text-xs text-zinc-400 text-center py-3">No members match your search.</p>;
                  }
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {filteredMembers.map((p) => {
                        const isSelected = registeredPlayers.some((reg) => reg.id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleToggleCommunityPlayer(p)}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'border-orange-500 bg-orange-500/10 text-orange-950'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            <img
                              src={getAvatarUrl({ id: p.id, avatar_url: p.avatarUrl, full_name: p.fullName })}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover shrink-0 border border-zinc-200"
                            />
                            <span className="truncate flex-1">{p.fullName}</span>
                            {isSelected && <Check className="h-4 w-4 text-orange-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Action Button: local match generation (Quick Match) or start real session (Community) */}
          <button
            type="button"
            onClick={handleProceedFromRegistration}
            disabled={registeredPlayers.length < 4 || isSubmitting}
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting Session...
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4" />
                {isGuestDemoMode
                  ? 'Generate Matches & Open Session'
                  : config.sessionMode === 'OFFLINE'
                  ? 'Generate Matches & Play Offline'
                  : 'Start Session & Open Live Board'}
              </>
            )}
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 4: MATCH GENERATION & SCORE INPUT SCREEN */}
      {/* ========================================================= */}
      {step === 4 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <RoundCarousel
            rounds={Array.from({ length: totalRounds }, (_, i) => i + 1).map((rNum) => {
              const roundMatchesList = matches.filter((m) => (m.roundNumber || 1) === rNum);
              return { number: rNum, isCompleted: roundMatchesList.length > 0 && roundMatchesList.every((m) => m.isCompleted) };
            })}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
          />

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

              return currentRoundMatches.map((m) => {
                const teamANamesJoined = config.gameType.includes('TEAM_')
                  ? (playerMap.get(m.teamA[0])?.name || 'Team')
                  : m.teamA.filter(Boolean).map((id) => playerMap.get(id)?.name || 'Player').join(' / ');
                const teamBNamesJoined = config.gameType.includes('TEAM_')
                  ? (playerMap.get(m.teamB[0])?.name || 'Team')
                  : m.teamB.filter(Boolean).map((id) => playerMap.get(id)?.name || 'Player').join(' / ');
                const winnerSide: 'A' | 'B' | null =
                  m.scoreA !== null && m.scoreB !== null
                    ? m.scoreA > m.scoreB
                      ? 'A'
                      : m.scoreB > m.scoreA
                      ? 'B'
                      : null
                    : null;

                const renderTeam = (ids: string[], side: 'A' | 'B') => {
                  const isWinner = m.isCompleted && winnerSide === side;
                  return (
                    <div className={`flex-1 space-y-1.5 flex flex-col ${side === 'A' ? 'items-start' : 'items-end'}`}>
                      {ids.filter(Boolean).map((id, pIdx) => {
                        const p = playerMap.get(id);
                        return (
                          <div
                            key={`${id}-${pIdx}`}
                            className={`flex items-center gap-1.5 min-w-0 ${side === 'B' ? 'flex-row-reverse' : ''}`}
                          >
                            <img
                              src={getAvatarUrl({ id, avatar_url: p?.avatarUrl, full_name: p?.name })}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover shrink-0 border border-zinc-200"
                            />
                            <span className={`text-xs truncate max-w-[100px] ${isWinner ? 'text-orange-600 font-bold' : 'text-zinc-700 font-medium'}`}>
                              {p?.name || 'Player'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <div
                    key={m.id}
                    className={`relative rounded-2xl border bg-white shadow-sm transition-all overflow-hidden ${
                      m.isCompleted ? 'border-zinc-200' : 'border-zinc-200 border-l-4 border-l-orange-500'
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                      <span className="font-bold text-base text-[#111827]">Court {m.courtNumber}</span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          m.isCompleted ? 'bg-zinc-100 text-zinc-500' : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {m.isCompleted ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    <div className="relative px-4 pt-7 pb-4">
                      {/* Score badge floats over the header/content seam */}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                        <ScoreButtonPair
                          scoreA={m.scoreA}
                          scoreB={m.scoreB}
                          isCompleted={m.isCompleted}
                          winnerSide={winnerSide}
                          onTapA={() =>
                            setActivePicker({ matchId: m.id, team: 'A', teamName: teamANamesJoined, currentScore: m.scoreA })
                          }
                          onTapB={() =>
                            setActivePicker({ matchId: m.id, team: 'B', teamName: teamBNamesJoined, currentScore: m.scoreB })
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {renderTeam(m.teamA, 'A')}
                        <span className="shrink-0 h-6 w-6 rounded-full bg-white border border-zinc-200 text-zinc-400 text-[9px] font-bold flex items-center justify-center uppercase">
                          vs
                        </span>
                        {renderTeam(m.teamB, 'B')}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <div className="pt-2">
            <GenerateRoundButton
              nextRoundNumber={totalRounds + 1}
              onGenerate={handleGenerateNextRound}
              isGenerating={isGeneratingRound}
            />
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

          <StandingsTable
            standings={standings.map((s) => ({
              rank: s.rank,
              playerId: s.playerId,
              name: s.name,
              totalPoints: s.totalPoints,
              wins: s.wins,
              losses: s.losses,
              ties: s.ties,
              diff: s.diff,
              realMatchesPlayed: s.realMatchesPlayed,
              isGuest: !isGuestDemoMode && s.isGuest,
              byePoints: s.byePoints,
              byeIsPlaceholder: s.byeIsPlaceholder,
            }))}
          />

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
                {!isGuestDemoMode && config.sessionMode === 'OFFLINE'
                  ? 'Every fully-scored round will be uploaded to the community — Elo, bye points, and Community Points applied. This cannot be undone.'
                  : 'Are you sure you want to end this Quick Match session? The match will be finalized, and the final results will be displayed on the podium.'}
              </p>
              {!isGuestDemoMode && config.sessionMode === 'OFFLINE' && (() => {
                const latestRound = matches.reduce((acc, m) => Math.max(acc, m.roundNumber || 1), 0);
                const latestRoundMatches = matches.filter((m) => m.roundNumber === latestRound);
                const hasUnscored = latestRoundMatches.some((m) => m.scoreA === null || m.scoreB === null);
                if (!hasUnscored) return null;
                return (
                  <p className="text-[11px] text-amber-400 font-bold leading-relaxed pt-1">
                    ⚠ Round {latestRound} isn&apos;t fully scored and won&apos;t be uploaded.
                  </p>
                );
              })()}
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
        const isFixedSum = isFixedSumWizardConfig(config.scoringSystem, config.pointTarget);

        let maxAllowed = configN;
        if (!isFixedSum && activeMatch) {
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

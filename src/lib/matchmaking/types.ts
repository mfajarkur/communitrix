export interface Attendee {
  id: string;
  seedElo: number;
  matchesPlayed: number;
  sitOutCount: number;
  lastSitOutRound: number | null; // null if never sat out
}

export interface PastPairing {
  roundNumber: number;
  teamA: string[]; // player IDs
  teamB: string[]; // player IDs
}

export interface MatchHistory {
  id: string;
  roundNumber: number;
  teamA: string[];
  teamB: string[];
  scoreA: number | null;
  scoreB: number | null;
}

export interface StandingRow {
  profileId: string;
  matchesPlayed: number;
  sessionPointsFor: number;
  sessionPointsAgainst: number;
  sessionWins: number;
  sessionLosses: number;
  sessionDraws: number;
  seedElo: number;
}

export interface RoundInput {
  sessionId: string;
  roundNumber: number;
  format: 'AMERICANO' | 'MEXICANO';
  playersPerMatch: 2 | 4;
  courtCount: number;
  attendees: Attendee[];       // status ACTIVE only
  history: PastPairing[];      // partner + opponent pairings so far
  standings: StandingRow[];    // for MEXICANO, round >= 2
  seed: string;                // `${sessionId}:${roundNumber}` — deterministic
}

export interface PlannedMatch {
  courtNumber: number;
  teamA: string[]; // player IDs
  teamB: string[]; // player IDs
}

export interface RoundOutput {
  courts: PlannedMatch[];
  sitOuts: string[]; // player IDs
}

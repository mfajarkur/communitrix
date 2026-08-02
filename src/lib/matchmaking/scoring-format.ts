// A match's scoring format is either fixed-sum (one team's score determines the other's — the
// POINTS system and "Total of N" both split a fixed total between two teams) or open-ended
// ("First to N" is a race with no fixed total). Score-entry auto-complement should only fire
// for the fixed-sum case. This check has independently drifted out of sync between the wizard,
// the community Live Board, and the mobile scorer form before (community's "Total of N" sessions
// silently lost auto-complement because only the wizard's copy knew about the "total of" string
// match) — centralizing it here is what prevents that from happening again.

// Wizard-time config, before a session is persisted: scoringSystem is 'POINTS' | 'GENERAL',
// pointTarget is a free-form label like "16 Points", "Total of 4", or "First to 8".
export function isFixedSumWizardConfig(scoringSystem: string, pointTarget: string): boolean {
  return scoringSystem === 'POINTS' || pointTarget.toLowerCase().includes('total of');
}

// Persisted session config, as stored on `sessions.scoring_type` / `sessions.points_mode` once
// a community session has been created.
export function isFixedSumSessionConfig(
  scoringType: 'POINTS' | 'GAMES',
  pointsMode: 'FIRST_TO_TARGET' | 'FIXED_TOTAL' | 'TIMED'
): boolean {
  return scoringType === 'POINTS' || pointsMode === 'FIXED_TOTAL';
}

export function getDisplayName(profile?: {
  display_name?: string | null;
  full_name?: string | null;
  username?: string | null;
} | null): string {
  if (!profile) return 'Unknown Player';
  return profile.display_name?.trim() || profile.full_name?.trim() || 'Player';
}

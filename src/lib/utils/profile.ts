export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getDisplayName(profile?: {
  display_name?: string | null;
  full_name?: string | null;
  username?: string | null;
} | null): string {
  if (!profile) return 'Unknown Player';
  const rawName =
    profile.full_name?.trim() ||
    profile.display_name?.trim() ||
    profile.username?.trim() ||
    'Player';
  return toTitleCase(rawName);
}

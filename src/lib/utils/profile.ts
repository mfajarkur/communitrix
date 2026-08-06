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

export function getTwoWordName(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name.trim();
  return `${words[0]} ${words[1]}`;
}

export function getPlayerGender(profile?: {
  gender?: string | null;
  full_name?: string | null;
  display_name?: string | null;
} | null): 'MALE' | 'FEMALE' {
  if (profile?.gender === 'MALE' || profile?.gender === 'FEMALE') {
    return profile.gender;
  }
  const name = (profile?.full_name || profile?.display_name || '').toLowerCase();
  const femaleKeywords = [
    'aisyah', 'amalia', 'anisa', 'clara', 'desi', 'dewi', 'dian', 'elina', 'endah',
    'fitri', 'gadis', 'gita', 'hesti', 'ira', 'isyana', 'jajang c', 'kartika', 'krisdayanti',
    'lesty', 'mulan', 'nabila', 'najwa', 'niken', 'novia', 'oky', 'prilly', 'raisa',
    'raline', 'ria', 'rosa', 'sandrina', 'siti', 'syahrini', 'tantri', 'titi', 'via',
    'wika', 'yura', 'zaskia', 'aryna', 'iga', 'elena', 'putri', 'rahma', 'lestari', 'sastrowardoyo'
  ];

  if (femaleKeywords.some((kw) => name.includes(kw))) {
    return 'FEMALE';
  }
  return 'MALE';
}

export const INSTAGRAM_BLANK_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e4e4e7'/><circle cx='50' cy='36' r='20' fill='%23a1a1aa'/><path d='M 16 92 C 16 68, 30 58, 50 58 C 70 58, 84 68, 84 92 Z' fill='%23a1a1aa'/></svg>";

export function getAvatarUrl(profile?: {
  id?: string | null;
  avatar_url?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  gender?: string | null;
} | null): string {
  if (profile?.avatar_url && profile.avatar_url.trim().length > 0) {
    return profile.avatar_url;
  }
  return INSTAGRAM_BLANK_AVATAR;
}

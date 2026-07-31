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

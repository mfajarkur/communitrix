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

const MALE_SPORTS_AVATARS = [
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80"
];

const FEMALE_SPORTS_AVATARS = [
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&auto=format&fit=crop&q=80"
];

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
  const gender = getPlayerGender(profile);
  const idStr = profile?.id || profile?.full_name || profile?.display_name || 'player';
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash);
  if (gender === 'FEMALE') {
    return FEMALE_SPORTS_AVATARS[index % FEMALE_SPORTS_AVATARS.length];
  }
  return MALE_SPORTS_AVATARS[index % MALE_SPORTS_AVATARS.length];
}

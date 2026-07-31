import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lzzzjtijagandsrodaaj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Curated small high-performance tennis & padel sports photo URLs (w=200px)
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
  "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&auto=format&fit=crop&q=80"
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
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548142813-c348350df52b?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&auto=format&fit=crop&q=80"
];

function getPlayerGender(profile) {
  if (profile.gender === 'MALE' || profile.gender === 'FEMALE') return profile.gender;
  const name = (profile.full_name || profile.display_name || '').toLowerCase();
  const femaleKeywords = [
    'aisyah', 'amalia', 'anisa', 'clara', 'desi', 'dewi', 'dian', 'elina', 'endah',
    'fitri', 'gadis', 'gita', 'hesti', 'ira', 'isyana', 'jajang c', 'kartika', 'krisdayanti',
    'lesty', 'mulan', 'nabila', 'najwa', 'niken', 'novia', 'oky', 'prilly', 'raisa',
    'raline', 'ria', 'rosa', 'sandrina', 'siti', 'syahrini', 'tantri', 'titi', 'via',
    'wika', 'yura', 'zaskia', 'aryna', 'iga', 'elena', 'putri', 'rahma', 'lestari', 'sastrowardoyo'
  ];

  return femaleKeywords.some((kw) => name.includes(kw)) ? 'FEMALE' : 'MALE';
}

async function uploadAvatarToSupabase(imageUrl, fileName) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadErr) {
      console.warn(`Upload warning for ${fileName}:`, uploadErr.message);
      return imageUrl; // Fallback to direct CDN URL
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn(`Fetch error for ${fileName}, fallback to URL:`, err.message);
    return imageUrl;
  }
}

async function seedAvatarsForDummyCommunity() {
  console.log("📸 Starting profile avatar seeding for 'Komunitas Dummy'...");

  // 1. Fetch community
  const { data: comm } = await supabase.from('communities').select('id').eq('slug', 'komunitas-dummy').single();
  if (!comm) {
    console.error("❌ 'komunitas-dummy' not found!");
    return;
  }

  // 2. Fetch all members with profiles
  const { data: members } = await supabase
    .from('community_members')
    .select(`
      profile_id,
      profile:profiles (
        id,
        full_name,
        display_name,
        gender
      )
    `)
    .eq('community_id', comm.id);

  if (!members || members.length === 0) {
    console.error("❌ No members found in 'komunitas-dummy'.");
    return;
  }

  console.log(`Found ${members.length} members. Uploading & setting sports avatars...`);

  let maleIndex = 0;
  let femaleIndex = 0;
  let successCount = 0;

  for (let i = 0; i < members.length; i++) {
    const p = members[i].profile;
    if (!p) continue;

    const gender = getPlayerGender(p);
    let avatarSourceUrl = '';

    if (gender === 'FEMALE') {
      avatarSourceUrl = FEMALE_SPORTS_AVATARS[femaleIndex % FEMALE_SPORTS_AVATARS.length];
      femaleIndex++;
    } else {
      avatarSourceUrl = MALE_SPORTS_AVATARS[maleIndex % MALE_SPORTS_AVATARS.length];
      maleIndex++;
    }

    const fileName = `dummy_avatars/avatar_${p.id}.jpg`;
    const finalAvatarUrl = await uploadAvatarToSupabase(avatarSourceUrl, fileName);

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: finalAvatarUrl })
      .eq('id', p.id);

    if (updateErr) {
      console.error(`Failed to update avatar for ${p.full_name}:`, updateErr.message);
    } else {
      successCount++;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Processed ${i + 1}/${members.length} avatars...`);
    }
  }

  console.log(`\n🎉 SUCCESS! Uploaded & updated sports avatars for ${successCount}/${members.length} members in Supabase!`);
}

seedAvatarsForDummyCommunity().catch(console.error);

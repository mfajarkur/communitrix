'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Loader2,
  Settings,
  HelpCircle,
  Target,
  TrendingUp,
  Trophy,
  Crown,
  Shield,
  Users,
  Star,
  Flame,
  Mars,
  Venus,
  ChevronRight,
} from 'lucide-react';
import { uploadAvatar, updateProfile } from '../profile-actions';
import type { ProfileWithCommunities } from '../profile-actions';
import type { CommunityStats, EloTrend, Sport, PerSportStats } from './profile-actions';
import AvatarCropModal from '../avatar-crop-modal';
import EloTrendChart from './elo-trend-chart';
import SettingsSheet from './settings-sheet';
import HelpSheet from './help-sheet';

type Props = {
  profileData: ProfileWithCommunities;
  communityStats: CommunityStats[];
  eloTrends: Record<Sport, EloTrend>;
};

const SPORT_ORDER: Sport[] = ['TENNIS', 'PADEL'];
const SPORT_LABEL: Record<Sport, string> = { TENNIS: 'Tennis', PADEL: 'Padel' };

const ROLE_BADGE: Record<string, { label: string; icon: typeof Crown; className: string }> = {
  ADMIN: { label: 'Admin', icon: Crown, className: 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30' },
  HOST: { label: 'Host', icon: Shield, className: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/30' },
  MEMBER: { label: 'Member', icon: Users, className: 'bg-zinc-100 text-zinc-600 border border-zinc-200' },
};

const SKILL_BADGE: Record<string, { label: string; icon: typeof Star; className: string }> = {
  BEGINNER: { label: 'Beginner', icon: Star, className: 'bg-zinc-100 text-zinc-600 border border-zinc-200' },
  INTERMEDIATE: { label: 'Intermediate', icon: Star, className: 'bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-sm shadow-blue-500/30' },
  ADVANCED: { label: 'Advanced', icon: Flame, className: 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm shadow-orange-500/30' },
};

function Badge({ icon: Icon, label, className }: { icon: typeof Crown; label: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${className}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

export default function ProfileView({ profileData, communityStats, eloTrends }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(profileData.profile.avatar_url ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = profileData.profile.display_name ?? profileData.profile.full_name;
  const username = profileData.profile.username;
  const gender = profileData.profile.gender;

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be under 2MB');
      return;
    }
    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropSave = async (croppedFile: File) => {
    setIsUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('avatar', croppedFile);

    const result = await uploadAvatar(fd);
    setIsUploading(false);

    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }

    if ('url' in result) {
      const saveFd = new FormData();
      saveFd.append('avatar_url', result.url);
      const saveResult = await updateProfile(saveFd);
      if (saveResult?.error) {
        setUploadError(`Photo uploaded but failed to save: ${saveResult.error}`);
      } else {
        setAvatarUrl(result.url);
      }
    } else {
      setUploadError(result.error);
    }
  };

  // A sport's trend chart is worth showing if it's been played in at least one community.
  const availableSports = SPORT_ORDER.filter((sport) =>
    communityStats.some((c) => c.bySport[sport] !== undefined)
  );

  return (
    <div className="space-y-5">
      <div className="rounded-3xl overflow-hidden border border-orange-200/60 shadow-sm bg-zinc-950">
        <div className="h-20 sm:h-24 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600" />

        <div className="px-5 sm:px-6 pb-6 -mt-12 sm:-mt-14 flex flex-col items-center text-center">
          <div className="w-full flex justify-end gap-1.5 -mt-1 mb-1">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-zinc-950 shadow-lg cursor-pointer group shrink-0 bg-zinc-800"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="bg-orange-500 w-full h-full flex items-center justify-center text-2xl font-black text-white font-sans">
                {initials}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-3">{displayName}</h2>
          {username && <p className="text-xs text-white/50 font-medium">@{username}</p>}

          {gender && (
            <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-white/15 to-white/5 border border-white/20 text-[10px] font-extrabold text-white/90">
              {gender === 'MALE' ? <Mars className="h-3 w-3" /> : <Venus className="h-3 w-3" />}
              {gender === 'MALE' ? 'Male' : 'Female'}
            </span>
          )}

          {uploadError && <p className="text-xs text-red-400 font-light mt-2">{uploadError}</p>}
        </div>
      </div>

      {availableSports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Elo Trend · All Communities</h3>
          {availableSports.map((sport) => (
            <EloTrendChart key={sport} sport={SPORT_LABEL[sport]} trend={eloTrends[sport]} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">Communities</h3>

        {communityStats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
            No communities yet. Join one and play a scored session to see your stats here.
          </div>
        ) : (
          <div className="space-y-3">
            {communityStats.map((c) => (
              <CommunityStatsCard key={c.communityId} stats={c} />
            ))}
          </div>
        )}
      </div>

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={() => {
            if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
          onCropComplete={handleCropSave}
        />
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} profileData={profileData} />
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function CommunityStatsCard({ stats }: { stats: CommunityStats }) {
  const roleBadge = ROLE_BADGE[stats.role] ?? ROLE_BADGE.MEMBER;
  const skillBadge = stats.skillLevel ? SKILL_BADGE[stats.skillLevel] : null;
  const sportsPlayed = SPORT_ORDER.filter((sport) => stats.bySport[sport] !== undefined);
  const initials = stats.communityName.slice(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-orange-200 transition-all">
      <Link
        href={`/c/${stats.communitySlug}`}
        className="flex items-center gap-3 p-4 pb-3 bg-gradient-to-br from-orange-50 via-white to-white border-b border-zinc-100 group"
      >
        {stats.logoUrl ? (
          <img
            src={stats.logoUrl}
            alt=""
            className="h-11 w-11 rounded-xl object-cover border border-zinc-200 shadow-xs shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm text-zinc-900 truncate group-hover:underline">{stats.communityName}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge icon={roleBadge.icon} label={roleBadge.label} className={roleBadge.className} />
            {skillBadge && <Badge icon={skillBadge.icon} label={skillBadge.label} className={skillBadge.className} />}
          </div>
        </div>
        {stats.cpTotal > 0 && (
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-amber-600 tabular-nums leading-none">{stats.cpTotal}</p>
            <p className="text-[9px] font-bold uppercase text-zinc-400 mt-0.5">CP</p>
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-orange-400 transition-colors shrink-0" />
      </Link>

      <div className="p-4 space-y-3">
        {sportsPlayed.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-2">No matches played yet in this community.</p>
        ) : (
          sportsPlayed.map((sport) => {
            const sportStats = stats.bySport[sport] as PerSportStats;
            return (
              <div key={sport}>
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  {SPORT_LABEL[sport]}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat icon={Target} label="Matches" value={String(sportStats.totalMatches)} />
                  <MiniStat
                    icon={TrendingUp}
                    label="Win Rate"
                    value={sportStats.winRate !== null ? `${sportStats.winRate}%` : '—'}
                  />
                  <MiniStat
                    icon={Trophy}
                    label="Peak Elo"
                    value={sportStats.peakElo !== null ? String(Math.round(sportStats.peakElo)) : '—'}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-2.5 text-center space-y-1">
      <div className="h-6 w-6 rounded-full bg-orange-50 flex items-center justify-center mx-auto">
        <Icon className="h-3 w-3 text-orange-500" />
      </div>
      <p className="text-base font-black text-zinc-900 tabular-nums">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}

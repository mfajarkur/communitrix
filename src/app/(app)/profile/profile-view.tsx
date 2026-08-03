'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Settings, HelpCircle, Target, TrendingUp, Trophy } from 'lucide-react';
import { uploadAvatar, updateProfile } from '../profile-actions';
import type { ProfileWithCommunities } from '../profile-actions';
import type { PerSportStats, EloTrend, Sport } from './profile-actions';
import AvatarCropModal from '../avatar-crop-modal';
import EloTrendChart from './elo-trend-chart';
import SettingsSheet from './settings-sheet';
import HelpSheet from './help-sheet';

type Props = {
  profileData: ProfileWithCommunities;
  perSportStats: Record<Sport, PerSportStats | null>;
  eloTrends: Record<Sport, EloTrend>;
};

const SPORT_ORDER: Sport[] = ['TENNIS', 'PADEL'];
const SPORT_LABEL: Record<Sport, string> = { TENNIS: 'Tennis', PADEL: 'Padel' };

export default function ProfileView({ profileData, perSportStats, eloTrends }: Props) {
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

  const availableSports = SPORT_ORDER.filter((sport) => perSportStats[sport] !== null);

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
            <span className="mt-2 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-[10px] font-extrabold text-white/80">
              {gender === 'MALE' ? 'Male' : 'Female'}
            </span>
          )}

          {uploadError && <p className="text-xs text-red-400 font-light mt-2">{uploadError}</p>}
        </div>
      </div>

      {availableSports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          No matches played yet. Join a community and play a scored session to see your stats here.
        </div>
      ) : (
        availableSports.map((sport) => {
          const stats = perSportStats[sport]!;
          return (
            <div key={sport} className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">{SPORT_LABEL[sport]}</h3>

              <div className="grid grid-cols-3 gap-2">
                <StatTile icon={Target} label="Matches" value={String(stats.totalMatches)} />
                <StatTile icon={TrendingUp} label="Win Rate" value={stats.winRate !== null ? `${stats.winRate}%` : '—'} />
                <StatTile
                  icon={Trophy}
                  label="Peak Elo"
                  value={stats.peakElo !== null ? String(Math.round(stats.peakElo)) : '—'}
                />
              </div>

              <EloTrendChart sport={SPORT_LABEL[sport]} trend={eloTrends[sport]} />
            </div>
          );
        })
      )}

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

function StatTile({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white shadow-sm p-3 text-center space-y-1">
      <Icon className="h-3.5 w-3.5 text-orange-500 mx-auto" />
      <p className="text-lg font-black text-zinc-900 tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}

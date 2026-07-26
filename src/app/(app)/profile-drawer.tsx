'use client';

import { useState, useRef, useTransition, useEffect, useCallback } from 'react';
import { X, Camera, Check, Loader2, LogOut, AlertCircle, ChevronRight } from 'lucide-react';
import { updateProfile, checkUsernameAvailable, uploadAvatar } from './profile-actions';
import type { ProfileWithCommunities } from './profile-actions';

const SPORT_LABELS: Record<string, string> = {
  PADEL: 'Padel',
  TENNIS: 'Tennis',
  BADMINTON: 'Badminton',
  SQUASH: 'Squash',
  TABLE_TENNIS: 'Table Tennis',
};

type Props = {
  profileData: ProfileWithCommunities;
  signOutAction: () => Promise<void>;
};

export default function ProfileDrawer({ profileData, signOutAction }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profileData.profile.display_name ?? profileData.profile.full_name);
  const [username, setUsername] = useState(profileData.profile.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profileData.profile.avatar_url ?? '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = (profileData.profile.display_name ?? profileData.profile.full_name)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Debounced username check
  const handleUsernameChange = useCallback((val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameStatus('idle');
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (cleaned.length < 3) {
      setUsernameStatus(cleaned.length > 0 ? 'invalid' : 'idle');
      return;
    }
    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      // Skip check if same as current
      if (cleaned === profileData.profile.username) {
        setUsernameStatus('available');
        return;
      }
      const available = await checkUsernameAvailable(cleaned);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);
  }, [profileData.profile.username]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append('avatar', file);
    const result = await uploadAvatar(fd);
    setIsUploading(false);
    if ('url' in result) {
      setAvatarUrl(result.url);
      // Auto-save avatar URL immediately
      const saveFd = new FormData();
      saveFd.append('avatar_url', result.url);
      await updateProfile(saveFd);
    } else {
      setUploadError(result.error);
    }
  };

  const handleSave = () => {
    if (usernameStatus === 'taken' || usernameStatus === 'checking') return;
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('display_name', displayName);
      if (username) fd.append('username', username);
      if (avatarUrl) fd.append('avatar_url', avatarUrl);
      const result = await updateProfile(fd);
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    });
  };

  // Close on backdrop click
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <>
      {/* Avatar trigger button in header */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/40 hover:ring-white transition-all cursor-pointer flex items-center justify-center shrink-0"
        aria-label="Open profile settings"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="bg-orange-700 w-full h-full flex items-center justify-center text-[10px] font-black text-white font-sans">
            {initials}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-up Drawer */}
      <div
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="font-black text-base uppercase tracking-widest text-gray-900 font-sans">My Profile</h2>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-orange-100 hover:ring-orange-300 transition-all cursor-pointer group"
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
            <p className="text-xs text-gray-400 font-light">Tap to change photo · Max 2MB</p>
            {uploadError && (
              <p className="text-xs text-red-500 font-light">{uploadError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 font-sans">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-light text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-gray-400 font-light">Appears in matches and leaderboards</p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 font-sans">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-light">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={30}
                placeholder="yourhandle"
                className={`w-full pl-8 pr-10 py-3 rounded-xl border text-sm font-light text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  usernameStatus === 'taken' ? 'border-red-300 focus:ring-red-400' :
                  usernameStatus === 'available' ? 'border-green-300 focus:ring-green-400' :
                  'border-gray-200 focus:ring-orange-400'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                {usernameStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                {usernameStatus === 'taken' && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <p className={`text-[11px] font-light ${
              usernameStatus === 'taken' ? 'text-red-500' :
              usernameStatus === 'available' ? 'text-green-600' :
              usernameStatus === 'invalid' ? 'text-orange-500' :
              'text-gray-400'
            }`}>
              {usernameStatus === 'taken' ? 'Username already taken' :
               usernameStatus === 'available' ? 'Username available!' :
               usernameStatus === 'invalid' ? 'At least 3 characters (a-z, 0-9, _)' :
               'Unique across all Communitrix members · lowercase only'}
            </p>
          </div>

          {/* Save Error / Success */}
          {saveError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isPending || usernameStatus === 'taken' || usernameStatus === 'checking' || isUploading}
            className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-widest font-sans transition-all ${
              saveSuccess
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
            }`}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </span>
            ) : saveSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> Saved!
              </span>
            ) : 'Save Changes'}
          </button>

          {/* My Communities */}
          {profileData.communities && profileData.communities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 font-sans">My Communities</h3>
              <div className="space-y-2">
                {profileData.communities.map((c) => (
                  <a
                    key={c.id}
                    href={`/c/${c.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black font-sans shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 font-sans">{c.name}</p>
                        <p className="text-[11px] text-gray-400 font-light">{SPORT_LABELS[c.sport] ?? c.sport} · {c.role}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Logout */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest font-sans text-red-500 border border-red-100 hover:bg-red-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

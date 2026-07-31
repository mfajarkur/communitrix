'use client';

import { useState, useRef, useTransition, useCallback } from 'react';
import {
  Camera,
  Check,
  Loader2,
  LogOut,
  AlertCircle,
  Pencil,
  ChevronUp,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  updateProfile,
  checkUsernameAvailable,
  uploadAvatar,
  updatePasswordAction,
  updateGenderAction,
  signOutAction,
} from '../profile-actions';
import type { ProfileWithCommunities } from '../profile-actions';
import AvatarCropModal from '../avatar-crop-modal';

type Props = {
  profileData: ProfileWithCommunities;
};

export default function ProfileCard({ profileData }: Props) {
  const [displayName, setDisplayName] = useState(profileData.profile.display_name ?? profileData.profile.full_name);
  const [username, setUsername] = useState(profileData.profile.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profileData.profile.avatar_url ?? '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>(profileData.profile.gender ?? 'MALE');
  const [isSavingGender, setIsSavingGender] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = (profileData.profile.display_name ?? profileData.profile.full_name)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleGenderChange = async (g: 'MALE' | 'FEMALE') => {
    setGender(g);
    setIsSavingGender(true);
    await updateGenderAction(g);
    setIsSavingGender(false);
  };

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
      if (cleaned === profileData.profile.username) {
        setUsernameStatus('available');
        return;
      }
      const available = await checkUsernameAvailable(cleaned);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);
  }, [profileData.profile.username]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be under 5MB');
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
      setAvatarUrl(result.url);
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

  const handleSavePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSavingPassword(true);
    const result = await updatePasswordAction(newPassword);
    setIsSavingPassword(false);

    if (result.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  return (
    <div className="rounded-3xl bg-white border border-zinc-100 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header row: avatar, name, gender, actions */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-orange-100 hover:ring-orange-300 transition-all cursor-pointer group shrink-0"
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

        <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#111827] truncate">{displayName}</h2>
            {username && <p className="text-sm text-zinc-400 font-medium">@{username}</p>}
          </div>

          <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
            <button
              type="button"
              onClick={() => handleGenderChange('MALE')}
              disabled={isSavingGender}
              className={`px-3 py-1 rounded text-xs font-extrabold cursor-pointer transition-all ${
                gender === 'MALE' ? 'bg-orange-500 text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              ♂️ Male
            </button>
            <button
              type="button"
              onClick={() => handleGenderChange('FEMALE')}
              disabled={isSavingGender}
              className={`px-3 py-1 rounded text-xs font-extrabold cursor-pointer transition-all ${
                gender === 'FEMALE' ? 'bg-orange-500 text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              ♀️ Female
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-500 font-light">{uploadError}</p>}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-bold text-zinc-700 transition-all cursor-pointer shadow-sm"
          >
            {isEditing ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isEditing ? 'Close' : 'Edit Profile'}
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-red-100 bg-white hover:bg-red-50 text-sm font-bold text-red-500 transition-all cursor-pointer shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Expandable Edit Profile section */}
      {isEditing && (
        <div className="pt-6 border-t border-zinc-100 space-y-6 animate-in fade-in duration-150">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-zinc-500 font-sans">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-zinc-400 font-light">Appears in matches and leaderboards</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-zinc-500 font-sans">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-light">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={30}
                placeholder="yourhandle"
                className={`w-full pl-8 pr-10 py-3 rounded-xl border text-sm font-light text-zinc-900 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  usernameStatus === 'taken' ? 'border-red-300 focus:ring-red-400' :
                  usernameStatus === 'available' ? 'border-green-300 focus:ring-green-400' :
                  'border-zinc-200 focus:ring-orange-400'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />}
                {usernameStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                {usernameStatus === 'taken' && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <p className={`text-[11px] font-light ${
              usernameStatus === 'taken' ? 'text-red-500' :
              usernameStatus === 'available' ? 'text-green-600' :
              usernameStatus === 'invalid' ? 'text-orange-500' :
              'text-zinc-400'
            }`}>
              {usernameStatus === 'taken' ? 'Username already taken' :
               usernameStatus === 'available' ? 'Username available!' :
               usernameStatus === 'invalid' ? 'At least 3 characters (a-z, 0-9, _)' :
               'Unique across all Communitrix members · lowercase only'}
            </p>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isPending || usernameStatus === 'taken' || usernameStatus === 'checking' || isUploading}
            className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-widest font-sans transition-all cursor-pointer ${
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
            ) : 'Save Profile Details'}
          </button>

          {/* Account Password Section */}
          <div className="pt-4 border-t border-zinc-100 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 font-sans flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-orange-500" />
              Password for Username Login
            </h3>
            <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
              Set a password so you can sign in using your username or email instead of Google OAuth.
            </p>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min. 6 chars)"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>

            {passwordError && (
              <p className="text-[11px] text-red-500 font-light">{passwordError}</p>
            )}

            <button
              onClick={handleSavePassword}
              disabled={isSavingPassword || !newPassword}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest font-sans transition-all cursor-pointer ${
                passwordSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40'
              }`}
            >
              {isSavingPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...
                </span>
              ) : passwordSuccess ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="h-3.5 w-3.5" /> Password Set Successfully!
                </span>
              ) : (
                'Set / Change Password'
              )}
            </button>
          </div>
        </div>
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
    </div>
  );
}

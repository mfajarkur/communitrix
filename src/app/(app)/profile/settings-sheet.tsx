'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { Check, Loader2, AlertCircle, Lock, Eye, EyeOff, LogOut, Languages } from 'lucide-react';
import {
  updateProfile,
  checkUsernameAvailable,
  updatePasswordAction,
  updateGenderAction,
  signOutAction,
} from '../profile-actions';
import type { ProfileWithCommunities } from '../profile-actions';
import BottomSheet from '@/components/ui/bottom-sheet';
import { useStatusRibbon } from '@/components/status-ribbon/status-ribbon-provider';

type Props = {
  open: boolean;
  onClose: () => void;
  profileData: ProfileWithCommunities;
};

export default function SettingsSheet({ open, onClose, profileData }: Props) {
  const { showStatus, clearStatus } = useStatusRibbon();
  const [displayName, setDisplayName] = useState(profileData.profile.display_name ?? profileData.profile.full_name);
  const [username, setUsername] = useState(profileData.profile.username ?? '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>(profileData.profile.gender ?? 'MALE');
  const [isSavingGender, setIsSavingGender] = useState(false);
  const [genderError, setGenderError] = useState<string | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleGenderChange = async (g: 'MALE' | 'FEMALE') => {
    const previous = gender;
    setGender(g);
    setGenderError(null);
    setIsSavingGender(true);
    const result = await updateGenderAction(g);
    setIsSavingGender(false);
    if (result.error) {
      setGender(previous);
      setGenderError(result.error);
    }
  };

  const handleUsernameChange = useCallback(
    (val: string) => {
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
    },
    [profileData.profile.username]
  );

  const handleSave = () => {
    if (usernameStatus === 'taken' || usernameStatus === 'checking') return;
    setSaveError(null);
    setSaveSuccess(false);
    const statusId = showStatus('Saving profile…');
    startTransition(async () => {
      const fd = new FormData();
      fd.append('display_name', displayName);
      if (username) fd.append('username', username);
      const result = await updateProfile(fd);
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
      clearStatus(statusId);
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
    <BottomSheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-6">
        {/* Edit Account */}
        <div className="space-y-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Edit Account</h3>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-light text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-light">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={30}
                placeholder="yourhandle"
                className={`w-full pl-8 pr-10 py-3 rounded-xl border text-sm font-light text-zinc-900 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  usernameStatus === 'taken'
                    ? 'border-red-300 focus:ring-red-400'
                    : usernameStatus === 'available'
                    ? 'border-green-300 focus:ring-green-400'
                    : 'border-zinc-200 focus:ring-orange-400'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />}
                {usernameStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                {usernameStatus === 'taken' && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            {usernameStatus === 'taken' && <p className="text-[11px] text-red-500 font-light">Username already taken</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Gender</label>
            <div className="inline-flex p-0.5 bg-zinc-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleGenderChange('MALE')}
                disabled={isSavingGender}
                className={`px-3 py-1.5 rounded text-xs font-extrabold cursor-pointer transition-all ${
                  gender === 'MALE' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => handleGenderChange('FEMALE')}
                disabled={isSavingGender}
                className={`px-3 py-1.5 rounded text-xs font-extrabold cursor-pointer transition-all ${
                  gender === 'FEMALE' ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Female
              </button>
            </div>
            {genderError && <p className="text-[11px] text-red-500 font-light">{genderError}</p>}
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isPending || usernameStatus === 'taken' || usernameStatus === 'checking'}
            className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all cursor-pointer ${
              saveSuccess ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
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
            ) : (
              'Save Account Details'
            )}
          </button>
        </div>

        {/* Password */}
        <div className="pt-5 border-t border-zinc-100 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-orange-500" />
            Password
          </h3>
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
                onClick={() => setShowPassword((v) => !v)}
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
          {passwordError && <p className="text-[11px] text-red-500 font-light">{passwordError}</p>}
          <button
            onClick={handleSavePassword}
            disabled={isSavingPassword || !newPassword}
            className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              passwordSuccess ? 'bg-green-500 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40'
            }`}
          >
            {isSavingPassword ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...
              </span>
            ) : passwordSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="h-3.5 w-3.5" /> Password Set!
              </span>
            ) : (
              'Set / Change Password'
            )}
          </button>
        </div>

        {/* Language */}
        <div className="pt-5 border-t border-zinc-100 space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5 text-orange-500" />
            Language
          </h3>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-100 bg-zinc-50">
            <span className="text-sm text-zinc-400 font-light">English / Bahasa Indonesia</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Coming soon</span>
          </div>
        </div>

        {/* Log Out */}
        <div className="pt-5 border-t border-zinc-100">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </form>
        </div>
      </div>
    </BottomSheet>
  );
}

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfileAction } from '@/server/actions/profile.actions';
import { Edit3, Upload, Loader2, X } from 'lucide-react';

interface ProfileEditorProps {
  fullName: string;
  avatarUrl: string | null;
}

export default function ProfileEditor({ fullName, avatarUrl }: ProfileEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize to 128x128
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw image cropped to square
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
          // Convert to jpeg base64
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError('Name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await updateProfileAction({
      fullName: name.trim(),
      avatarUrl: avatar || '',
    });

    if (result.ok) {
      setIsOpen(false);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setError(result.message);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
      >
        <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
        Edit Profile
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-zinc-100 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold tracking-tight text-[#111827]">
                Edit Profile
              </h3>
              <p className="text-xs text-zinc-500">
                Update your name and profile picture.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar Selector */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Preview"
                      className="h-20 w-20 rounded-2xl object-cover border border-zinc-100 bg-zinc-50 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-650 font-extrabold text-2xl uppercase shadow-sm">
                      {name.slice(0, 2)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all cursor-pointer border border-white"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <span className="text-[10px] text-zinc-400 font-medium">
                  Max size 2MB (resizes to 128x128 px)
                </span>
              </div>

              {/* Name Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none shadow-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 h-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 rounded-lg bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

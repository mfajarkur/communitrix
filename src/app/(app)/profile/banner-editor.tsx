'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import AvatarCropModal from '@/app/(app)/avatar-crop-modal';
import { uploadProfileBanner } from '@/app/(app)/profile-actions';

type Props = {
  onSaved: (url: string) => void;
};

// The player-level counterpart to community-tabs.tsx's banner-image-editor.tsx — same wide
// 2.5:1 crop, same small icon-button trigger, self-only (no admin gate needed here). Renders
// just the trigger + crop modal; the actual <img> backdrop lives in profile-view.tsx so this can
// sit anywhere on top of it.
export default function BannerEditor({ onSaved }: Props) {
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
      return;
    }
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropSave = async (croppedFile: File) => {
    setIsUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append('banner', croppedFile);

    const result = await uploadProfileBanner(fd);
    setIsUploading(false);

    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }

    if ('error' in result) {
      setError(result.error);
    } else {
      onSaved(result.url);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        title="Change Profile Banner"
        className="h-8 w-8 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer flex items-center justify-center"
      >
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      </button>

      {error && (
        <div className="absolute right-0 top-full mt-1 bg-red-600 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap z-20">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          aspect={2.5}
          cropShape="rect"
          outputWidth={1200}
          outputHeight={480}
          title="Adjust Profile Banner"
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

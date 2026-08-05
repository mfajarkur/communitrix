'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import AvatarCropModal from '@/app/(app)/avatar-crop-modal';
import { uploadCommunityLogoAction } from '@/server/actions/community.actions';

type Props = {
  communityId: string;
  communitySlug: string;
};

// A normal-flow icon button (not self-positioned) so it can sit directly in the header card's
// top-right button row (community-carousel.tsx) alongside Share/Switch, matching where the
// admin-only avatar edit control also lives — moved here from the Home tab's "About" card, where
// it was easy to miss since it wasn't co-located with the image it actually edits.
export default function BannerImageEditor({ communityId, communitySlug }: Props) {
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
    fd.append('community_id', communityId);
    fd.append('community_slug', communitySlug);
    fd.append('logo', croppedFile);

    const result = await uploadCommunityLogoAction(fd);
    setIsUploading(false);

    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }

    if (result?.error) {
      setError(result.error);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        title="Change Community Banner Image"
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
          title="Adjust Community Banner"
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

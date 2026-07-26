'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import AvatarCropModal from '@/app/(app)/avatar-crop-modal';
import { uploadCommunityLogoAction } from '@/server/actions/community.actions';

type Props = {
  communityId: string;
  communitySlug: string;
};

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
    <>
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-black/40 hover:bg-orange-500 transition-all px-3 py-1.5 rounded-xl backdrop-blur-md shadow-md border border-white/20 cursor-pointer group"
          title="Change Community Badge/Banner Image"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          )}
          <span>{isUploading ? 'Uploading...' : 'Edit Badge'}</span>
        </button>

        {error && (
          <div className="absolute right-0 top-10 bg-red-600 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
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
    </>
  );
}

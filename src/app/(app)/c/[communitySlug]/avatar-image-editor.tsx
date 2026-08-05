'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import AvatarCropModal from '@/app/(app)/avatar-crop-modal';
import { uploadCommunityAvatarAction } from '@/server/actions/community.actions';

type Props = {
  communityId: string;
  communitySlug: string;
  avatarUrl: string | null;
  name: string;
  isAdmin: boolean;
};

// The circular community profile picture, distinct from the wide header banner/"badge"
// (logo_url, edited via banner-image-editor.tsx's "Edit Badge" button elsewhere). Renders the
// circle itself plus, for admins only, a small edit-pencil badge overlaid on its corner — the
// same tap-the-avatar-to-edit pattern used for personal profile pictures — so no new control
// needs to be squeezed into the existing "Edit Badge"/"Edit Info" row.
export default function AvatarImageEditor({ communityId, communitySlug, avatarUrl, name, isAdmin }: Props) {
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
    fd.append('avatar', croppedFile);

    const result = await uploadCommunityAvatarAction(fd);
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
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover ring-2 ring-white/90 shadow-md"
        />
      ) : (
        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm uppercase ring-2 ring-white/90 shadow-md">
          {name.slice(0, 2)}
        </div>
      )}

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Change Community Profile Picture"
            className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center border-2 border-white shadow-sm transition-all cursor-pointer"
          >
            {isUploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Camera className="h-2.5 w-2.5" />}
          </button>

          {error && (
            <div className="absolute left-0 top-full mt-1 bg-red-600 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap z-20">
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
        </>
      )}

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          aspect={1}
          cropShape="round"
          outputWidth={400}
          outputHeight={400}
          title="Adjust Community Profile Picture"
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

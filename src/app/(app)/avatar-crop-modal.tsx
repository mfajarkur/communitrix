'use client';

import { useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import { ZoomIn, ZoomOut, X, Check, Loader2 } from 'lucide-react';
import { getCroppedImg } from '@/lib/crop-image';

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onCropComplete: (croppedFile: File) => Promise<void>;
};

export default function AvatarCropModal({ imageSrc, onCancel, onCropComplete }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropChange = (location: Point) => {
    setCrop(location);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const handleCropCompleteInternal = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onCropComplete(croppedFile);
    } catch (err) {
      console.error('Failed to crop image', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 text-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="font-black text-sm uppercase tracking-widest text-white font-sans">
            Adjust Photo
          </h3>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-72 bg-black select-none">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={handleCropChange}
            onZoomChange={handleZoomChange}
            onCropComplete={handleCropCompleteInternal}
          />
        </div>

        {/* Zoom Controls */}
        <div className="p-5 space-y-5 bg-zinc-900">
          <div className="flex items-center gap-3 px-2">
            <ZoomOut className="h-4 w-4 text-zinc-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
            />
            <ZoomIn className="h-4 w-4 text-zinc-400 shrink-0" />
          </div>

          <p className="text-[11px] text-center text-zinc-400 font-light">
            Drag photo to reposition · Use slider to zoom
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl border border-zinc-700 text-xs font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply & Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

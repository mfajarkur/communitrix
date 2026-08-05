'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Shield, User, Plus, ListOrdered } from 'lucide-react';
import AddCommunityModal from './add-community-modal';
import ReorderCommunitiesModal from './reorder-communities-modal';

type CommunityItem = { id: string; name: string; slug: string; logo_url: string | null };

const SWIPE_THRESHOLD = 60;

// Replaces the old horizontal row of chips: one community shown full-size at a time (banner,
// name, role), swipe or tap the arrows to move to the neighboring one in the user's
// drag-reordered order (sort_order, reorder-communities-modal.tsx) — the same order the dots
// below reflect. Swiping/tapping navigates via router.push, same as the old chips' plain Links;
// this component itself doesn't own any cross-fade/slide transition between communities since
// that's a full route change — the persistent nav + loading.tsx skeleton (layout.tsx) already
// handles that transition, this only owns the drag gesture and the settle-back animation when a
// swipe doesn't cross the threshold.
export default function CommunityCarousel({
  myCommunities,
  currentSlug,
  role,
}: {
  myCommunities: CommunityItem[];
  currentSlug: string;
  role: 'ADMIN' | 'HOST' | 'MEMBER';
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentIndex = myCommunities.findIndex((c) => c.slug === currentSlug);
  const current = currentIndex >= 0 ? myCommunities[currentIndex] : myCommunities[0];
  const bannerImage = current?.logo_url || '/community_banner_placeholder.png';

  const goTo = (index: number) => {
    if (index < 0 || index >= myCommunities.length || index === currentIndex) return;
    router.push(`/c/${myCommunities[index].slug}`);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    setIsDragging(true);
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    setDragX(e.clientX - dragStartX.current);
  };

  const handlePointerUp = () => {
    if (dragStartX.current === null) return;
    if (dragX <= -SWIPE_THRESHOLD) {
      goTo(currentIndex + 1);
    } else if (dragX >= SWIPE_THRESHOLD) {
      goTo(currentIndex - 1);
    }
    dragStartX.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  if (!current) return null;

  return (
    <div className="space-y-2">
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'pan-y', transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.25s ease-out' }}
        className="relative overflow-hidden rounded-2xl h-36 sm:h-40 bg-zinc-950 select-none cursor-grab active:cursor-grabbing shadow-sm border border-zinc-100"
      >
        <img
          src={bannerImage}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none select-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-orange-600/95 via-orange-600/25 to-transparent" />

        {/* Top-left: reorder, top-right: add — same semi-transparent overlay-button pattern as
            the Home tab's banner (BannerImageEditor/EditCommunityInfoButton). */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          {myCommunities.length > 1 ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setReorderOpen(true)}
              title="Reorder Communities"
              className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setAddOpen(true)}
            title="Add a Community"
            className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/95 backdrop-blur-sm transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Prev/next arrows, vertically centered on the edges — dimmed and inert at the ends
            instead of hidden, so the layout never shifts. onPointerDown stopPropagation keeps
            the card's own drag/swipe handler (bound one level up) from swallowing the click via
            setPointerCapture. */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex <= 0}
          title="Previous community"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex >= myCommunities.length - 1}
          title="Next community"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-4 z-[5]">
          <p className="text-base font-black text-white tracking-tight drop-shadow-sm truncate">{current.name}</p>
          <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase mt-0.5 ${
            role === 'ADMIN' ? 'text-orange-200' : role === 'HOST' ? 'text-orange-100' : 'text-white/80'
          }`}>
            {role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {role}
          </span>
        </div>
      </div>

      {myCommunities.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {myCommunities.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => goTo(idx)}
              title={c.name}
              className={`rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'h-1.5 w-4 bg-orange-500' : 'h-1.5 w-1.5 bg-zinc-300 hover:bg-zinc-400'
              }`}
            />
          ))}
        </div>
      )}

      <AddCommunityModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ReorderCommunitiesModal open={reorderOpen} onClose={() => setReorderOpen(false)} communities={myCommunities} />
    </div>
  );
}

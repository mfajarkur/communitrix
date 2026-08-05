'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, GripVertical, ListOrdered, Loader2, Star } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderCommunitiesAction } from '@/server/actions/community.actions';

type CommunityItem = { id: string; name: string; slug: string; logo_url: string | null };

function SortableRow({ community, isDefault }: { community: CommunityItem; isDefault: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: community.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 p-2.5 rounded-2xl border bg-white ${
        isDragging ? 'border-orange-300 shadow-lg z-10' : 'border-zinc-100 shadow-2xs'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="shrink-0 p-1.5 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {community.logo_url ? (
        <img src={community.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-xs uppercase shrink-0">
          {community.name.slice(0, 2)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-900 truncate">{community.name}</p>
        {isDefault && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-orange-600">
            <Star className="h-2.5 w-2.5 fill-current" /> Default
          </span>
        )}
      </div>
    </div>
  );
}

// Drag-reorder list for the user's communities — the first one becomes their "default" (what
// the top-nav Community tab's /c redirect lands on), replacing the old last-visited-cookie
// behavior with an explicit, user-controlled order. Persisted via reorder_communities (a
// security-definer RPC, not a plain client update — community_members' UPDATE RLS policy only
// allows a community ADMIN to touch a row, so a regular member has no other way to save this).
export default function ReorderCommunitiesModal({
  open,
  onClose,
  communities,
}: {
  open: boolean;
  onClose: () => void;
  communities: CommunityItem[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState<CommunityItem[]>(communities);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setOrder(communities);
  }, [open, communities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.findIndex((c) => c.id === active.id);
      const newIndex = items.findIndex((c) => c.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await reorderCommunitiesAction(order.map((c) => c.id));
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save the new order');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827] animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 shrink-0">
          <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-orange-500" />
            Reorder Communities
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 -mt-1 shrink-0">
          Drag to reorder. The top community becomes your default — where the Community tab takes you.
        </p>

        <div className="overflow-y-auto space-y-2 -mx-1 px-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {order.map((community, idx) => (
                <SortableRow key={community.id} community={community} isDefault={idx === 0} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex items-center gap-3 pt-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

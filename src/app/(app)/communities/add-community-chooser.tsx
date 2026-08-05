'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users, ChevronRight, ChevronLeft, Loader2, Lock, Compass } from 'lucide-react';
import type { CommunityUsage } from '@/server/actions/community.actions';
import { searchPublicCommunitiesAction, requestJoinCommunityByIdAction, type PublicCommunityResult } from '@/server/actions/community.actions';
import UpgradeModal from './upgrade-modal';

type Mode = 'choose' | 'find';

// The single shared "add a community" surface — rendered full-width, chrome-free by
// /communities/page.tsx (the fallback landing page), and embedded in
// community-switcher-modal.tsx (the "Switch" popup inside a community). Two modes: pick Create
// or Find, then Find becomes an inline search — no separate route for the search step.
export default function AddCommunityChooser({ usage }: { usage: CommunityUsage }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicCommunityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [upgradeKind, setUpgradeKind] = useState<'created' | 'joined' | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const createAtLimit = usage.created >= 3;
  const joinedAtLimit = usage.joined >= 5;

  useEffect(() => {
    if (mode !== 'find') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPublicCommunitiesAction(query);
      if (res.ok) {
        setResults(res.data);
        setSearchError(null);
      } else {
        setSearchError(res.message);
        setResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  const handleJoin = async (community: PublicCommunityResult) => {
    if (joinedAtLimit) {
      setUpgradeKind('joined');
      return;
    }
    setJoiningId(community.id);
    try {
      const res = await requestJoinCommunityByIdAction(community.id);
      if (res.ok) {
        if (res.data.status === 'JOINED') {
          setJoinedIds((prev) => new Set(prev).add(community.id));
          router.push(`/c/${community.slug}`);
        } else {
          setPendingIds((prev) => new Set(prev).add(community.id));
        }
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to join community');
    } finally {
      setJoiningId(null);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="space-y-3">
        <Link
          href="/communities/new"
          onClick={(e) => {
            if (createAtLimit) {
              e.preventDefault();
              setUpgradeKind('created');
            }
          }}
          className="group flex items-center gap-4 p-5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md cursor-pointer"
        >
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Plus className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold">Create New Community</h3>
            <p className="text-[11px] text-white/80 font-medium mt-0.5">Start your own — you'll be the admin.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>

        <button
          type="button"
          onClick={() => setMode('find')}
          className="group w-full flex items-center gap-4 p-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-md cursor-pointer"
        >
          <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Search className="h-6 w-6 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <h3 className="text-sm font-extrabold">Find Community</h3>
            <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Search public communities by name.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <UpgradeModal open={upgradeKind !== null} kind={upgradeKind} onClose={() => setUpgradeKind(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode('choose')}
        className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-orange-600 cursor-pointer"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          autoFocus
          type="text"
          placeholder="Search community name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-zinc-100 focus:bg-white text-sm font-semibold rounded-xl text-zinc-900 placeholder-zinc-400 border border-transparent focus:border-orange-500 focus:outline-none transition-all"
        />
      </div>

      {!query.trim() ? (
        <div className="text-center py-10 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Lock className="h-7 w-7 mx-auto text-zinc-300" />
          <p className="text-xs text-zinc-500 font-semibold max-w-xs mx-auto px-4">
            Type a community name to search. Private communities won't show up here — ask an admin for an invite link instead.
          </p>
        </div>
      ) : isSearching ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        </div>
      ) : searchError ? (
        <p className="text-xs text-red-600 font-semibold text-center py-6">{searchError}</p>
      ) : results.length === 0 ? (
        <div className="text-center py-10 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
          <Compass className="h-7 w-7 mx-auto text-zinc-300" />
          <p className="text-xs text-zinc-500 font-semibold">No public communities found for "{query}".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((c) => {
            const isJoined = joinedIds.has(c.id);
            const isPending = pendingIds.has(c.id);
            const isJoining = joiningId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 bg-white shadow-2xs"
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="h-11 w-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm uppercase shrink-0">
                    {c.name.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-zinc-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-zinc-500 font-semibold inline-flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />
                    {c.member_count} members · {c.default_sport}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isJoining || isJoined || isPending}
                  onClick={() => handleJoin(c)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed ${
                    isJoined
                      ? 'bg-green-50 text-green-600'
                      : isPending
                      ? 'bg-zinc-100 text-zinc-500'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
                  }`}
                >
                  {isJoining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isJoined ? (
                    'Joined'
                  ) : isPending ? (
                    'Requested'
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <UpgradeModal open={upgradeKind !== null} kind={upgradeKind} onClose={() => setUpgradeKind(null)} />
    </div>
  );
}

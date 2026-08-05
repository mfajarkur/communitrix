'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDisplayName } from '@/lib/utils/profile';
import { Plus, X, UserCheck, UserPlus, Shield, Loader2 } from 'lucide-react';

interface HostProfile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface SessionHostsBarProps {
  sessionId: string;
  communityId: string;
  hosts: HostProfile[];
  communityMembers: HostProfile[];
  isHostOrAdmin: boolean;
}

export default function SessionHostsBar({
  sessionId,
  communityId,
  hosts,
  communityMembers,
  isHostOrAdmin,
}: SessionHostsBarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);

  const hostIds = new Set(hosts.map((h) => h.id));

  const filteredMembers = communityMembers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const name = getDisplayName(m).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleAddHost = async (targetProfileId: string) => {
    setLoadingProfileId(targetProfileId);
    try {
      const { error } = await supabase.rpc('add_session_host', {
        p_session_id: sessionId,
        p_target_profile_id: targetProfileId,
      });

      if (error) {
        // Fallback to direct table insert if RPC not loaded yet
        await supabase
          .from('session_hosts')
          .insert({ session_id: sessionId, profile_id: targetProfileId });
      }
      router.refresh();
    } catch (err) {
      console.error('Failed to add session host:', err);
    } finally {
      setLoadingProfileId(null);
    }
  };

  const handleRemoveHost = async (targetProfileId: string) => {
    setLoadingProfileId(targetProfileId);
    try {
      const { error } = await supabase.rpc('remove_session_host', {
        p_session_id: sessionId,
        p_target_profile_id: targetProfileId,
      });

      if (error) {
        // Fallback to direct table delete
        await supabase
          .from('session_hosts')
          .delete()
          .eq('session_id', sessionId)
          .eq('profile_id', targetProfileId);
      }
      router.refresh();
    } catch (err) {
      console.error('Failed to remove session host:', err);
    } finally {
      setLoadingProfileId(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Session Hosts:</span>
      
      <div className="flex items-center gap-1.5 flex-wrap">
        {hosts.map((host) => {
          const name = getDisplayName(host);
          const firstName = name.split(/\s+/)[0] || name;

          return (
            <div
              key={host.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-bold text-[11px]"
            >
              {host.avatar_url ? (
                <img src={host.avatar_url} alt={name} className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <div className="h-4 w-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[9px] font-black">
                  {firstName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span>{firstName}</span>
            </div>
          );
        })}

        {isHostOrAdmin && (
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-zinc-900 hover:bg-orange-500 text-white transition-all shadow-xs cursor-pointer"
            title="Add or manage session hosts"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Modal Manage Session Hosts */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-900">Assign Session Hosts</h3>
                <p className="text-[11px] text-zinc-500">Hosts can input & update scores for this session.</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-100 text-xs font-semibold rounded-xl border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none"
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredMembers.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3 text-center">No community members found.</p>
              ) : (
                filteredMembers.map((m) => {
                  const isHost = hostIds.has(m.id);
                  const name = getDisplayName(m);
                  const isLoading = loadingProfileId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-bold text-zinc-800 truncate">{name}</span>
                      </div>

                      {isHost ? (
                        <button
                          onClick={() => handleRemoveHost(m.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-700 hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>Host</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddHost(m.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-200 text-zinc-700 hover:bg-orange-500 hover:text-white transition-all cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-3 w-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

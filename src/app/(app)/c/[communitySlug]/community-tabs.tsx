'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  Trophy,
  HelpCircle,
  Activity,
  UserCheck,
  ChevronRight,
  Shield,
  User,
  Star,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import AddGuestForm from './add-guest-form';
import { getDisplayName } from '@/lib/utils/profile';
import { requestClaimAction, resolveClaimAction } from '@/server/actions/claim.actions';
import { updateMemberRoleAction, removeMemberAction } from '@/server/actions/member.actions';

interface CommunityTabsProps {
  communityId: string;
  communitySlug: string;
  communityName: string;
  defaultSport: string;
  isAdmin: boolean;
  isHostOrAdmin?: boolean;
  memberCount: number;
  activeSessionsCount: number;
  totalMatchesCount: number;
  sessions: any[];
  members: any[];
  rankings: any[];
  cpMap?: Record<string, number>;
  pendingClaims?: any[];
  myClaimedGuestIds?: string[];
}

export default function CommunityTabs({
  communityId,
  communitySlug,
  communityName,
  defaultSport,
  isAdmin,
  isHostOrAdmin = false,
  memberCount,
  activeSessionsCount,
  totalMatchesCount,
  sessions,
  members,
  rankings,
  cpMap = {},
  pendingClaims = [],
  myClaimedGuestIds = [],
}: CommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'members' | 'info'>('dashboard');
  const [guestToClaim, setGuestToClaim] = useState<{ id: string; name: string } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // User submits claim request (pending admin approval)
  const handleClaimSubmit = async () => {
    if (!guestToClaim) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const result = await requestClaimAction(guestToClaim.id, communityId, communitySlug);
      if (result?.error) {
        setClaimError(result.error);
      } else {
        setGuestToClaim(null);
        window.location.reload();
      }
    } catch (err: any) {
      setClaimError(err?.message || 'An unexpected error occurred');
    } finally {
      setIsClaiming(false);
    }
  };

  // Admin approves or rejects a claim request
  const handleResolve = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setResolvingId(requestId);
    try {
      const result = await resolveClaimAction(requestId, action, communitySlug, communityId);
      if (result?.success) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to resolve claim request', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Admin assigns role to member (ADMIN / HOST / MEMBER)
  const handleUpdateRole = async (targetProfileId: string, newRole: 'ADMIN' | 'HOST' | 'MEMBER') => {
    try {
      const result = await updateMemberRoleAction({
        communityId,
        targetProfileId,
        newRole,
        communitySlug,
      });
      if (result.ok) {
        window.location.reload();
      } else {
        alert(result.message || 'Failed to update role');
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating role');
    }
  };

  // Admin removes member from community
  const handleRemoveMember = async (targetProfileId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove "${memberName}" from this community?`)) return;
    try {
      const result = await removeMemberAction({
        communityId,
        targetProfileId,
        communitySlug,
      });
      if (result.ok) {
        window.location.reload();
      } else {
        alert(result.message || 'Failed to remove member');
      }
    } catch (err: any) {
      alert(err?.message || 'Error removing member');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['dashboard', 'leaderboard', 'members', 'info'].includes(tab)) {
        setActiveTab(tab as any);
      }
    }
  }, []);

  const handleTabChange = (tab: 'dashboard' | 'leaderboard' | 'members' | 'info') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  return (
    <>
      <div className="space-y-6 bg-white">
      {/* Dynamic Tab Switcher - Segmented pills layout */}
      <div className="flex gap-2 p-1.5 bg-zinc-50 border border-zinc-200/70 rounded-2xl overflow-x-auto whitespace-nowrap scroll-smooth shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-sm">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTab === 'dashboard'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-800'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Dashboard
        </button>
        <button
          onClick={() => handleTabChange('leaderboard')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTab === 'leaderboard'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-800'
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          Leaderboard
        </button>
        <button
          onClick={() => handleTabChange('members')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTab === 'members'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-800'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Members
        </button>
        <button
          onClick={() => handleTabChange('info')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0 ${
            activeTab === 'info'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-800'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Glossary
        </button>
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Overview Stat Cards */}
            <div className="grid gap-3 grid-cols-1">
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-450 font-medium">Total Players</p>
                  <h4 className="text-xl font-extrabold text-[#111827] mt-0.5">{memberCount}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-450 font-medium">Active Sessions</p>
                  <h4 className="text-xl font-extrabold text-[#111827] mt-0.5">{activeSessionsCount}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-650">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-455 font-medium">Matches Played</p>
                  <h4 className="text-xl font-extrabold text-[#111827] mt-0.5">{totalMatchesCount}</h4>
                </div>
              </div>
            </div>

            {/* Sessions History section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-orange-500" />
                  Matchmaking Sessions History
                </h3>
                {isAdmin && (
                  <Link
                    href={`/c/${communitySlug}/sessions/new`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white hover:bg-orange-600 transition-all shadow-sm cursor-pointer"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Start Session
                  </Link>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50 text-zinc-400 space-y-3">
                  <Calendar className="h-10 w-10 mx-auto opacity-50 text-orange-500" />
                  <p className="text-sm font-semibold">No sessions created yet.</p>
                  {isAdmin && (
                    <Link
                      href={`/c/${communitySlug}/sessions/new`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600 transition-all cursor-pointer"
                    >
                      Start First Session
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sessions.map((s) => {
                    const isActive = s.status === 'ACTIVE';
                    return (
                      <div
                        key={s.id}
                        className={`p-5 rounded-2xl border bg-zinc-50 flex flex-col justify-between gap-4 transition-all shadow-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] ${
                          isActive
                            ? 'border-orange-500/30 bg-orange-500/[0.01]'
                            : 'border-zinc-100'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isActive
                                  ? 'bg-orange-500/10 text-orange-600'
                                  : 'bg-zinc-100 text-zinc-500'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                                  Active Live
                                  </>
                              ) : (
                                'Completed'
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                              {s.sport} • {s.format}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-[#111827]">
                            {s.session_name}
                          </h4>
                          <p className="text-xs text-zinc-500">
                            Created: {new Date(s.created_at).toLocaleDateString()} • {s.court_count} Courts
                          </p>
                        </div>

                        <Link
                          href={`/c/${communitySlug}/sessions/${s.id}`}
                          className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                          }`}
                        >
                          {isActive ? 'Open Live Board' : 'View Final Results'}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">
                {defaultSport} ELO Standings
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Official leaderboard standings computed using the mathematical ELO formulas.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
              {rankings.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 space-y-2">
                  <Trophy className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
                  <p className="text-sm font-semibold">No standings computed yet for {defaultSport}.</p>
                  <p className="text-xs">Start a session and enter scores to compute ELO ratings.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <th className="p-3 w-12 text-center">Rank</th>
                        <th className="p-3">Name</th>
                        <th className="p-3 text-center">Elo Rating</th>
                        <th className="p-3 text-center">CP</th>
                        <th className="p-3 text-center">Skill Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {rankings.map((r: any, idx) => {
                        const rank = idx + 1;
                        const winRate =
                          r.total_matches > 0
                            ? Math.round((r.total_wins / r.total_matches) * 100)
                            : 0;

                        const pDiff = r.points_for - r.points_against;
                        const playerCp = Math.round(cpMap[r.profile.id] || 0);
                        const skillRating = Number(r.skill_rating_official || 1.0).toFixed(2);

                        return (
                          <tr
                            key={r.id}
                            className="group hover:bg-zinc-50/40 transition-all text-xs text-[#111827]"
                          >
                            <td className="p-3 text-center align-middle font-extrabold">
                              {rank === 1 ? (
                                <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-orange-500/10 text-orange-650 text-xs font-black border border-orange-500/20 shadow-2xs">
                                  🏆
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 text-xs font-black border border-zinc-200 shadow-2xs">
                                  🥈
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-orange-500/[0.04] text-orange-600 text-xs font-black border border-orange-500/10 shadow-2xs">
                                  🥉
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-zinc-400">#{rank}</span>
                              )}
                            </td>

                            <td className="p-3 align-middle">
                              <Link
                                href={`/c/${communitySlug}/players/${r.profile.id}`}
                                className="flex items-center gap-2.5 hover:underline"
                              >
                                {r.profile.avatar_url ? (
                                  <img
                                    src={r.profile.avatar_url}
                                    alt={getDisplayName(r.profile)}
                                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-zinc-100"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 font-extrabold text-xs uppercase">
                                    {getDisplayName(r.profile).slice(0, 2)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-extrabold text-[#111827] truncate flex items-center gap-1.5">
                                    {getDisplayName(r.profile)}
                                    {r.profile.is_guest && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 text-[8px] font-bold uppercase">
                                        Guest
                                      </span>
                                    )}
                                    {r.is_provisional && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-600 text-[8px] font-bold uppercase border border-orange-500/20">
                                        <Star className="h-2 w-2 fill-current" />
                                        Prov
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 font-bold mt-0.5">
                                    {r.total_wins}W–{r.total_losses}L ({winRate}% WR) • {pDiff > 0 ? `+${pDiff}` : pDiff} Diff
                                  </p>
                                </div>
                              </Link>
                            </td>

                            <td className="p-3 text-center align-middle font-mono font-black text-xs text-orange-600">
                              {Number(r.elo_rating).toFixed(0)}
                              <span className="block text-[9px] text-zinc-400 font-bold">
                                Peak: {Number(r.elo_peak).toFixed(0)}
                              </span>
                            </td>

                            <td className="p-3 text-center align-middle font-mono font-bold text-xs">
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-black text-[11px] shadow-2xs">
                                {playerCp} CP
                              </span>
                            </td>

                            <td className="p-3 text-center align-middle font-mono font-bold text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 font-black text-[11px] shadow-2xs">
                                ⭐ {skillRating}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (() => {
          const adminsAndHosts = members.filter(m => m.role === 'ADMIN' || m.role === 'HOST');
          const generalMembers = members.filter(m => m.role === 'MEMBER');

          return (
            <div className="grid gap-6 grid-cols-1">
              <div className="space-y-6">
                {/* ADMIN & HOST SECTION */}
                <div className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <Shield className="h-4.5 w-4.5 text-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ADMINS & HOSTS ({adminsAndHosts.length})</h3>
                  </div>
                  
                  {adminsAndHosts.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">No admins or hosts registered.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                      {adminsAndHosts.map((m: any) => {
                        const p = m.profile;
                        if (!p) return null;
                        const pName = getDisplayName(p);
                        return (
                          <div key={p.id} className="flex flex-col items-center group w-full text-center relative">
                            <Link
                              href={`/c/${communitySlug}/players/${p.id}`}
                              className="flex flex-col items-center w-full"
                            >
                              <div className="relative">
                                {p.avatar_url ? (
                                  <img
                                    src={p.avatar_url}
                                    alt={pName}
                                    className="h-12 w-12 rounded-full object-cover border border-zinc-100 bg-zinc-50"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-650 font-extrabold text-sm uppercase">
                                    {pName.slice(0, 2)}
                                  </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full p-0.5 text-white shadow-sm border border-white">
                                  <Shield className="h-2.5 w-2.5" />
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-[#111827] mt-1.5 truncate w-full group-hover:underline">
                                {pName.split(' ')[0]}
                              </span>
                              <span className="text-[8px] font-extrabold uppercase tracking-wider mt-0.5 text-orange-500">
                                {m.role}
                              </span>
                            </Link>
                            {isAdmin && (
                              <div className="flex items-center justify-center gap-1 mt-1.5 z-10">
                                <select
                                  value={m.role}
                                  onChange={(e) => handleUpdateRole(p.id, e.target.value as any)}
                                  className="text-[9px] font-extrabold uppercase bg-white border border-zinc-200 rounded px-1 py-0.5 text-zinc-700 cursor-pointer shadow-2xs"
                                >
                                  <option value="ADMIN">ADMIN</option>
                                  <option value="HOST">HOST</option>
                                  <option value="MEMBER">MEMBER</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(p.id, pName)}
                                  className="text-[9px] font-black uppercase bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white px-1.5 py-0.5 rounded transition-all cursor-pointer border border-rose-200"
                                  title="Remove member"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MEMBERS SECTION */}
                <div className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <Users className="h-4.5 w-4.5 text-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">MEMBERS ({generalMembers.length})</h3>
                  </div>

                  {generalMembers.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">No regular members registered.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                      {generalMembers.map((m: any) => {
                        const p = m.profile;
                        if (!p) return null;
                        const pName = getDisplayName(p);
                        return (
                          <div key={p.id} className="flex flex-col items-center group w-full text-center relative">
                            <Link
                              href={`/c/${communitySlug}/players/${p.id}`}
                              className="flex flex-col items-center w-full"
                            >
                              {p.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt={pName}
                                  className="h-12 w-12 rounded-full object-cover border border-zinc-100 bg-zinc-55"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-bold text-sm uppercase">
                                  {pName.slice(0, 2)}
                                </div>
                              )}
                              <span className="text-[10px] font-black text-[#111827] mt-1.5 truncate w-full group-hover:underline">
                                {pName.split(' ')[0]}
                              </span>
                            </Link>
                            {p.is_guest ? (
                              myClaimedGuestIds.includes(p.id) ? (
                                <span className="text-[7px] font-extrabold uppercase bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">
                                  Pending
                                </span>
                              ) : (
                                <button
                                  onClick={() => setGuestToClaim({ id: p.id, name: pName })}
                                  className="text-[7px] font-extrabold uppercase bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white px-1.5 py-0.5 rounded transition-all mt-0.5 cursor-pointer border border-orange-500/20"
                                  title="Request to claim this guest profile"
                                >
                                  Claim
                                </button>
                              )
                            ) : null}
                            {isAdmin && (
                              <div className="flex items-center justify-center gap-1 mt-1.5 z-10">
                                <select
                                  value={m.role}
                                  onChange={(e) => handleUpdateRole(p.id, e.target.value as any)}
                                  className="text-[9px] font-extrabold uppercase bg-white border border-zinc-200 rounded px-1 py-0.5 text-zinc-700 cursor-pointer shadow-2xs"
                                >
                                  <option value="ADMIN">ADMIN</option>
                                  <option value="HOST">HOST</option>
                                  <option value="MEMBER">MEMBER</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(p.id, pName)}
                                  className="text-[9px] font-black uppercase bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white px-1.5 py-0.5 rounded transition-all cursor-pointer border border-rose-200"
                                  title="Remove member"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Admin Side Panel: Pending Claims & Add Guest */}
              <div className="space-y-6">
                {/* PENDING CLAIM REQUESTS (Admin Only) */}
                {isAdmin && pendingClaims.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
                      <h3 className="font-black text-xs uppercase tracking-widest text-amber-800 flex items-center gap-1.5 font-sans">
                        <CheckCircle className="h-4 w-4 text-amber-600" />
                        Pending Claims ({pendingClaims.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {pendingClaims.map((req) => {
                        const guestName = getDisplayName(req.guest_profile);
                        const reqName = getDisplayName(req.requester_profile);
                        const username = req.requester_profile?.username ? `@${req.requester_profile.username}` : '';
                        const isProcessingThis = resolvingId === req.id;

                        return (
                          <div
                            key={req.id}
                            className="p-3.5 rounded-xl bg-white border border-amber-200/80 space-y-3 shadow-xs"
                          >
                            <div className="text-xs text-gray-800 space-y-1 font-sans">
                              <p className="font-bold">
                                {reqName} <span className="text-gray-400 font-normal">{username}</span>
                              </p>
                              <p className="text-gray-500 font-light text-[11px]">
                                Requests to claim guest: <span className="font-extrabold text-orange-600">{guestName}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResolve(req.id, 'APPROVE')}
                                disabled={isProcessingThis}
                                className="flex-1 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {isProcessingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleResolve(req.id, 'REJECT')}
                                disabled={isProcessingThis}
                                className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ADD GUEST FORM (Host & Admin) */}
                {isHostOrAdmin ? (
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-[#111827]">Add Guest Player</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Register quick guest profiles for sessions without account verification emails.
                      </p>
                    </div>
                    <AddGuestForm communityId={communityId} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-6 text-center">
                    <p className="text-xs text-zinc-400">
                      Only community hosts or administrators can register guest players or manage sessions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* INFO & GLOSSARY TAB */}
        {activeTab === 'info' && (
          <div className="grid gap-6 grid-cols-1">
            {/* Left Nav for Glossary */}
            <div className="space-y-6">
              {/* ELO RATING SYSTEM SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-orange-500 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Sistem ELO Rating
                </h3>
                <p className="text-sm text-zinc-650 leading-relaxed">
                  <strong>ELO Rating</strong> adalah metode matematis untuk mengukur tingkat keahlian relatif pemain dalam permainan 1-lawan-1 atau ganda. Dibandingkan dengan sistem skor kumulatif, nilai ELO naik atau turun berdasarkan **ekspektasi kemenangan** (Expectation).
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-orange-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-[#111827]">1. Nilai Ekspektasi (Probability of Winning)</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Sistem menghitung probabilitas kemenangan tim Anda ($E_A$) berdasarkan perbandingan ELO tim Anda melawan ELO tim lawan. Jika Anda mengalahkan lawan dengan ELO yang jauh lebih tinggi, rating Anda akan naik pesat. Sebaliknya, kalah dari lawan dengan ELO lebih rendah akan mengurangi poin Anda secara signifikan.
                    </p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-[#111827]">2. Margin Kemenangan (Margin of Victory)</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Kalkulator ELO kami menggunakan pengali **Margin of Victory (MoV)**. Kemenangan mutlak (misalnya skor 21-5) akan memberikan pengali bonus ELO yang lebih besar dibandingkan kemenangan tipis (misalnya 21-19). MoV dihitung menggunakan formula logaritma alami agar sebaran poin tetap proporsional dan tidak mengalami inflasi.
                    </p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-[#111827]">3. Skala K-Factor & Pemain Provisional</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      <strong>K-Factor</strong> menentukan seberapa sensitif rating Anda terhadap hasil pertandingan terakhir:
                      <br />• <strong>Pemain Baru (Provisional)</strong>: Pemain dengan jumlah tanding di bawah 10 mendapat $K = 48$. Ini mempercepat sistem menemukan kisaran rating aslinya.
                      <br />• <strong>Pemain Mapat (Settled)</strong>: Setelah melewati 10 pertandingan, K-Factor turun menjadi $K = 24$ agar rating tetap stabil.
                    </p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-[#111827]">4. Keseimbangan Nol (Zero-Sum Invariant)</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Semua perhitungan dilakukan dengan prinsip seimbang. Jumlah total ELO yang didapatkan oleh tim pemenang sama persis dengan total ELO yang dikurangi dari tim yang kalah (jumlah net = 0). Di akhir laga ganda, rata-rata K-Factor and delta didistribusikan secara adil kepada setiap rekan setim. Batas rating terendah adalah **100.00** guna mencegah rating jatuh negatif.
                    </p>
                  </div>
                </div>
              </div>

              {/* AMERICANO FORMAT SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-orange-500 flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Format Turnamen: Americano
                </h3>
                <p className="text-sm text-zinc-650 leading-relaxed">
                  Dalam format <strong>Americano</strong>, tujuannya adalah agar setiap pemain merasakan bermain berpasangan (rekan satu tim) dengan semua orang lainnya, sekaligus bermain berhadapan (sebagai lawan) secara merata.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827]">Skema Rotasi Berputar</h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Sistem menggunakan tabel rotasi matematis untuk jumlah pemain genap ($N = 4, 8$) demi rotasi sempurna. Untuk jumlah pemain lainnya, algoritma melakukan simulasi pencarian lokal 10.000 iterasi untuk menyusun jadwal terbaik dengan penalti partner tumpuk seminimal mungkin.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827]">Sistem Sit-Out yang Adil</h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Jika jumlah pemain tidak kelipatan 4, beberapa pemain harus beristirahat (*sit-out*) bergantian di tiap ronde. Algoritma menjamin:
                      <br />• Tidak ada pemain yang beristirahat 2 kali sebelum semua orang mendapat giliran istirahat 1 kali.
                      <br />• Proteksi ketat mencegah satu orang istirahat berturut-turut (*consecutive sit-out*).
                    </p>
                  </div>
                </div>
              </div>

              {/* MEXICANO FORMAT SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-orange-500 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Format Turnamen: Mexicano
                </h3>
                <p className="text-sm text-zinc-655 leading-relaxed">
                  Dalam format <strong>Mexicano</strong>, jadwal dipasangkan secara dinamis berdasarkan klasemen sesi berjalan (*standing-based pairings*). Tujuannya agar tercipta laga seru antar pemain dengan tingkat kekuatan yang setara di lapangan yang sama.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827]">Pengelompokan Lapangan (Court Grouping)</h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Ronde pertama dipasangkan acak. Untuk ronde selanjutnya, pemain diurutkan berdasarkan poin klasemen sesi berjalan:
                      <br />• <strong>Lapangan 1</strong>: Diisi oleh peringkat 1 sampai 4.
                      <br />• <strong>Lapangan 2</strong>: Diisi oleh peringkat 5 sampai 8, dan seterusnya.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827]">Skema Pairing Dalam Lapangan</h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Di dalam tiap lapangan, peringkat dipasangkan dengan skema **$1+4$ vs $2+3$** (peringkat 1 berpasangan dengan peringkat 4 melawan peringkat 2 dan 3) untuk menciptakan kekuatan tim yang paling seimbang.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827]">Pencegahan Partner Berulang</h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Algoritma menyimpan memori riwayat tanding. Jika di lapangan tersebut peringkat $1+4$ sudah pernah berpasangan sebelumnya, sistem otomatis melakukan pergeseran peringkat (*shifting*) agar Anda tidak bosan berpasangan dengan orang yang sama.
                    </p>
                  </div>
                </div>
              </div>

              {/* MEMBER ROLES SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-orange-500 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Peran & Hak Akses Anggota (ADMIN, HOST, MEMBER)
                </h3>
                <p className="text-sm text-zinc-650 leading-relaxed">
                  Dalam Communitrix, setiap komunitas memiliki pembagian hak akses teratur demi kelancaran pengelolaan dan pencegahan penyalahgunaan data:
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-orange-500 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      1. ADMIN (Tingkat Tertinggi)
                    </h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Admin memiliki kontrol penuh atas seluruh komunitas. Hanya Admin yang dapat **menambah/mengundang member baru**, **mengeluarkan/kick member**, **mengubah tingkat peran keanggotaan**, serta melakukan tindakan administratif sensitif seperti **amend (koreksi skor)** dan **void (membatalkan laga)** yang mempengaruhi recalculation ELO global.
                    </p>
                  </div>

                  <div className="border-l-4 border-orange-500/50 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-400" />
                      2. HOST (Penyelenggara Lapangan)
                    </h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Host adalah asisten pengelola yang bertanggung jawab di lapangan. Host dapat **membuat sesi tanding baru**, **mendaftarkan profil tamu (guest)** di tempat, **mengatur antrean main**, dan **menginput/submit skor pertandingan aktif**. Namun, Host **tidak memiliki hak** untuk mengedit, membatalkan (void/amend) skor yang sudah final, ataupun mengeluarkan/kick member dari komunitas.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-200 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-[#111827] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-300" />
                      3. MEMBER (Pemain Biasa)
                    </h4>
                    <p className="text-xs text-zinc-550 leading-relaxed">
                      Member adalah pemain terdaftar dalam komunitas. Member memiliki hak baca penuh (Read-Only) untuk **melihat statistik umum**, **leaderboard ELO**, **profil pemain (termasuk grafik tren ELO)**, serta **pantauan Live Board** pertandingan yang sedang berjalan secara real-time dari HP mereka.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Glossary Sidebar */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm space-y-4">
                <h4 className="font-bold text-[#111827] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <BookOpen className="h-4.5 w-4.5 text-orange-500" />
                  Glosarium Singkat
                </h4>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="font-extrabold text-[#111827]">ELO Rating</span>
                    <p className="text-zinc-500 mt-0.5">Rating kepiawaian relatif pemain. Angka default 1000.00.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-[#111827]">K-Factor</span>
                    <p className="text-zinc-500 mt-0.5">Sensitivitas perubahan ELO per pertandingan (24 atau 48).</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-[#111827]">Provisional</span>
                    <p className="text-zinc-500 mt-0.5">Status pemain dengan kurang dari 10 pertandingan.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-[#111827]">Zero-Sum</span>
                    <p className="text-zinc-500 mt-0.5">Sistem perolehan nilai seimbang; poin plus sama dengan poin minus.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-[#111827]">MoV</span>
                    <p className="text-zinc-500 mt-0.5">Margin of Victory; bobot tambahan ELO untuk skor kemenangan telak.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-[#111827]">Sit-Out</span>
                    <p className="text-zinc-500 mt-0.5">Istirahat giliran tanding demi keadilan pembagian waktu bermain.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Claim Guest Modal */}
      {guestToClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base uppercase tracking-widest text-orange-500 font-sans">
                Claim Guest Profile
              </h3>
              <button
                onClick={() => setGuestToClaim(null)}
                disabled={isClaiming}
                className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-zinc-800">
                Are you claiming <span className="font-extrabold text-orange-600">"{guestToClaim.name}"</span>?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed font-light">
                All match history, wins/losses, and Elo rating records previously registered under this guest profile will be transferred and merged into your account.
              </p>
            </div>

            {claimError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                {claimError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setGuestToClaim(null)}
                disabled={isClaiming}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClaimSubmit}
                disabled={isClaiming}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/20"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

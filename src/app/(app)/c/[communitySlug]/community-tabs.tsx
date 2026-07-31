'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  Calendar,
  Users,
  Trophy,
  BookOpen,
  Plus,
  Search,
  Shield,
  Star,
  Activity,
  CheckCircle,
  X,
  Loader2,
  ChevronRight,
  Share2,
  Copy,
  Edit3,
  UserCheck,
  Flame,
  Award,
  Sparkles,
  Building2,
  CalendarDays,
  User,
  LogOut,
  Clock,
} from 'lucide-react';
import AddGuestForm from './add-guest-form';
import BannerImageEditor from './banner-image-editor';
import { getDisplayName, getPlayerGender, getAvatarUrl } from '@/lib/utils/profile';
import { requestClaimAction, resolveClaimAction } from '@/server/actions/claim.actions';
import { updateMemberRoleAction, removeMemberAction } from '@/server/actions/member.actions';
import { updateCommunityInfoAction } from '@/server/actions/community.actions';

interface CommunityTabsProps {
  community?: any;
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
  rankingsBySport?: Record<string, any[]>;
  cpMap?: Record<string, number>;
  pendingClaims?: any[];
  myClaimedGuestIds?: string[];
  callerProfile?: any;
}

export default function CommunityTabs({
  community,
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
  rankingsBySport = {},
  cpMap = {},
  pendingClaims = [],
  myClaimedGuestIds = [],
  callerProfile,
}: CommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'sessions' | 'members' | 'leaderboard' | 'wiki'>('home');
  const [selectedLeaderboardSport, setSelectedLeaderboardSport] = useState<'PADEL' | 'TENNIS'>(
    defaultSport === 'TENNIS' ? 'TENNIS' : 'PADEL'
  );
  const [starSportTab, setStarSportTab] = useState<'PADEL' | 'TENNIS'>('PADEL');
  const [guestToClaim, setGuestToClaim] = useState<{ id: string; name: string } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [targetRoleToAdd, setTargetRoleToAdd] = useState<'ADMIN' | 'HOST' | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');

  // Admin Home Info Edit state
  const [isEditHomeOpen, setIsEditHomeOpen] = useState(false);
  const communityDescription =
    community?.description ||
    community?.settings?.description ||
    'Official community hub for sports matches, ELO rankings, and tournament sessions.';

  const [editDescription, setEditDescription] = useState(
    community?.description || community?.settings?.description || ''
  );
  const [editEstablishedDate, setEditEstablishedDate] = useState(community?.established_date || '');
  const [editSport, setEditSport] = useState(defaultSport);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['home', 'sessions', 'members', 'leaderboard', 'wiki', 'dashboard'].includes(tab)) {
        if (tab === 'dashboard') setActiveTab('home');
        else setActiveTab(tab as any);
      }
    }
  }, []);

  const handleTabChange = (tab: 'home' | 'sessions' | 'members' | 'leaderboard' | 'wiki') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  const handleCopyCode = () => {
    if (community?.code && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(community.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSaveHomeInfo = async () => {
    setIsSavingHome(true);
    try {
      const res = await updateCommunityInfoAction({
        communityId,
        communitySlug,
        description: editDescription,
        defaultSport: editSport,
      });
      if (res.ok) {
        setIsEditHomeOpen(false);
        window.location.reload();
      } else {
        alert(res.message || 'Failed to save community info');
      }
    } catch (err: any) {
      alert(err?.message || 'Error saving community info');
    } finally {
      setIsSavingHome(false);
    }
  };

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
      } else {
        alert(result?.error || 'Failed to resolve claim request');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to resolve claim request');
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

  const topPlayer = rankings && rankings.length > 0 ? rankings[0] : null;

  return (
    <>
      <div className="space-y-6 bg-white min-h-[500px]">

        {/* TAB CONTENTS */}
        <div className="min-h-[400px]">

          {/* TAB 1: HOME KOMUNITAS */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Community Description & Overview Card */}
              <div className="p-5 rounded-3xl bg-zinc-50 border border-zinc-100 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                      About Community
                    </span>
                    <h2 className="text-xl font-black text-zinc-900 tracking-tight mt-1">
                      {communityName}
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-2xl">
                      {communityDescription}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => setIsEditHomeOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Info</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-semibold pt-3 border-t border-zinc-200/70">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-orange-500" />
                    <span>Est. {new Date(community?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    <span>{memberCount} Members</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-orange-500" />
                    <span>{sessions.length} Sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    <span>{totalMatchesCount} Matches Scored</span>
                  </div>
                </div>
              </div>

              {/* Community STAR Section */}
              {(() => {
                const getCommunityStars = (sportRankings: any[]) => {
                  if (!sportRankings || sportRankings.length === 0) return null;
                  const activePlayers = sportRankings.filter((r) => Number(r.total_matches || 0) > 0);
                  if (activePlayers.length === 0) return null;

                  const topElo = [...activePlayers].sort((a, b) => Number(b.elo_rating) - Number(a.elo_rating))[0];
                  const mostWins = [...activePlayers].sort((a, b) => Number(b.total_wins || 0) - Number(a.total_wins || 0))[0];
                  const topCp = [...activePlayers].sort((a, b) => (cpMap[b.profile?.id] || 0) - (cpMap[a.profile?.id] || 0))[0];
                  const topWinRate = [...activePlayers].sort((a, b) => {
                    const wrA = a.total_matches > 0 ? a.total_wins / a.total_matches : 0;
                    const wrB = b.total_matches > 0 ? b.total_wins / b.total_matches : 0;
                    return wrB - wrA;
                  })[0];
                  const mostMatches = [...activePlayers].sort((a, b) => Number(b.total_matches || 0) - Number(a.total_matches || 0))[0];
                  const mostImproved = [...activePlayers].sort((a, b) => (Number(b.elo_rating) - 1000) - (Number(a.elo_rating) - 1000))[0];

                  return { topElo, mostWins, topCp, topWinRate, mostMatches, mostImproved };
                };

                const padelStars = getCommunityStars(rankingsBySport.PADEL || rankings);
                const tennisStars = getCommunityStars(rankingsBySport.TENNIS);

                const hasPadel = !!padelStars;
                const hasTennis = !!tennisStars;

                if (!hasPadel && !hasTennis) return null;

                const activeSportStars =
                  starSportTab === 'TENNIS' && hasTennis ? tennisStars : padelStars || tennisStars;
                const activeSportName =
                  starSportTab === 'TENNIS' && hasTennis ? 'TENNIS' : 'PADEL';

                if (!activeSportStars) return null;

                const starItems = [
                  {
                    key: 'topElo',
                    badge: '🏆 Peringkat 1 ELO',
                    player: activeSportStars.topElo,
                    stat: `${Math.round(Number(activeSportStars.topElo?.elo_rating || 1000))} ELO`,
                    subStat: `${activeSportStars.topElo?.total_wins || 0} Wins`,
                  },
                  {
                    key: 'mostWins',
                    badge: '🥇 Juara 1 Terbanyak',
                    player: activeSportStars.mostWins,
                    stat: `${activeSportStars.mostWins?.total_wins || 0} Kemenangan`,
                    subStat: `${activeSportStars.mostWins?.total_matches || 0} Match Played`,
                  },
                  {
                    key: 'topCp',
                    badge: '💎 CP Tertinggi',
                    player: activeSportStars.topCp,
                    stat: `${Math.round(cpMap[activeSportStars.topCp?.profile?.id] || 0)} CP Points`,
                    subStat: 'Community Champion',
                  },
                  {
                    key: 'topWinRate',
                    badge: '🔥 Win Rate Tertinggi',
                    player: activeSportStars.topWinRate,
                    stat: `${
                      activeSportStars.topWinRate?.total_matches > 0
                        ? Math.round(
                            (activeSportStars.topWinRate.total_wins /
                              activeSportStars.topWinRate.total_matches) *
                              100
                          )
                        : 0
                    }% Win Rate`,
                    subStat: `${activeSportStars.topWinRate?.total_wins || 0}W - ${
                      (activeSportStars.topWinRate?.total_matches || 0) -
                      (activeSportStars.topWinRate?.total_wins || 0)
                    }L`,
                  },
                  {
                    key: 'mostMatches',
                    badge: '⚔️ Match Terbanyak',
                    player: activeSportStars.mostMatches,
                    stat: `${activeSportStars.mostMatches?.total_matches || 0} Pertandingan`,
                    subStat: 'Most Active Competitor',
                  },
                  {
                    key: 'mostImproved',
                    badge: '📈 Paling Improved (30 Hari)',
                    player: activeSportStars.mostImproved,
                    stat: `+${Math.max(
                      1,
                      Math.round(
                        Number(activeSportStars.mostImproved?.elo_rating || 1000) - 1000
                      )
                    )} ELO Delta`,
                    subStat: 'Highest ELO Growth',
                  },
                ];

                return (
                  <div className="p-5 rounded-3xl bg-zinc-50 border border-zinc-100 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                            WALL OF FAME
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 border border-orange-200/80">
                            {activeSportName}
                          </span>
                        </div>
                        <h3 className="text-xl font-black tracking-tight text-zinc-900 mt-1">
                          Wall of Fame {activeSportName}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                          Pemain berprestasi teratas dalam berbagai kategori performa komunitas.
                        </p>
                      </div>

                      {/* Sport Selector if both Padel and Tennis have records */}
                      {hasPadel && hasTennis && (
                        <div className="inline-flex p-1 bg-zinc-200/60 rounded-xl border border-zinc-200 self-start sm:self-auto shrink-0">
                          <button
                            onClick={() => setStarSportTab('PADEL')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                              activeSportName === 'PADEL'
                                ? 'bg-orange-500 text-white shadow-xs'
                                : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            🎾 Padel
                          </button>
                          <button
                            onClick={() => setStarSportTab('TENNIS')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                              activeSportName === 'TENNIS'
                                ? 'bg-orange-500 text-white shadow-xs'
                                : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            🎾 Tennis
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 6 STAR Cards Grid - Sketch Layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {starItems.map((item) => {
                        const profile = item.player?.profile;
                        if (!profile) return null;

                        return (
                          <div
                            key={item.key}
                            className="overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-white flex items-stretch shadow-xs hover:shadow-md hover:border-orange-400 transition-all group"
                          >
                            {/* Left Side: Square Photo */}
                            <div className="w-20 sm:w-24 shrink-0 relative bg-zinc-200 border-r border-orange-200/60 flex items-center justify-center overflow-hidden">
                              <img
                                src={getAvatarUrl(profile)}
                                alt={getDisplayName(profile)}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>

                            {/* Right Side: Details with Orange Gradient Shading */}
                            <div className="p-3 flex-1 flex flex-col justify-center space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-200/80 w-fit">
                                  {item.badge}
                                </span>
                                {getPlayerGender(profile) === 'FEMALE' ? (
                                  <span className="text-[8px] font-extrabold uppercase bg-pink-50 text-pink-600 border border-pink-200/80 px-1.5 py-0.2 rounded-full">
                                    ♀️ Female
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-extrabold uppercase bg-blue-50 text-blue-600 border border-blue-200/80 px-1.5 py-0.2 rounded-full">
                                    ♂️ Male
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-black text-zinc-900 truncate group-hover:text-orange-600 transition-colors">
                                {getDisplayName(profile)}
                              </h4>
                              <p className="text-[11px] font-extrabold text-orange-600">
                                {item.stat} <span className="text-[9px] text-zinc-500 font-medium">({item.subStat})</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Quick Action Navigation Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleTabChange('sessions')}
                  className="p-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-left transition-all shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <Calendar className="h-6 w-6 text-white/90" />
                    <ChevronRight className="h-4 w-4 text-white/80 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-sm font-extrabold mt-3">Game Sessions</h4>
                  <p className="text-[11px] text-white/80 font-medium">Create or view sessions</p>
                </button>

                <button
                  onClick={() => handleTabChange('members')}
                  className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-left transition-all shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <Users className="h-6 w-6 text-orange-400" />
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-sm font-extrabold mt-3">Community Members</h4>
                  <p className="text-[11px] text-zinc-400 font-medium">View admins & players</p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GAME SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">
                    Game Sessions
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Match sessions, live scoring boards, and historical tournament records.
                  </p>
                </div>

                {isHostOrAdmin && (
                  <Link
                    href={`/c/${communitySlug}/sessions/new`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    New Session
                  </Link>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 space-y-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <Calendar className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
                  <p className="text-sm font-semibold">No game sessions created yet.</p>
                  {isHostOrAdmin && (
                    <Link
                      href={`/c/${communitySlug}/sessions/new`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Session
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s: any) => {
                    const isActive = s.status === 'ACTIVE';
                    return (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <Link href={`/c/${communitySlug}/sessions/${s.id}`} className="min-w-0 flex-1 group/link">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-zinc-900 truncate group-hover/link:text-orange-600 transition-colors">
                              {s.session_name}
                            </p>
                            {isActive ? (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-green-50 text-green-600 border border-green-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                Live · Ongoing
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200">
                                Ended
                              </span>
                            )}
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200">
                              {s.format} · {s.sport}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 font-semibold">
                            <span>{new Date(s.created_at).toLocaleDateString()}</span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {s.court_count} Courts
                            </span>
                          </div>
                        </Link>

                        <Link
                          href={`/c/${communitySlug}/sessions/${s.id}`}
                          className={`inline-flex h-9 px-4 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            isActive
                              ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-xs'
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
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === 'members' && (() => {
            const adminsList = members.filter((m) => m.role === 'ADMIN');
            const hostsList = members.filter((m) => m.role === 'HOST');
            const generalMembers = members.filter((m) => m.role === 'MEMBER');

            const filteredAdmins = adminsList.filter((m) => {
              if (!memberSearchQuery.trim()) return true;
              const pName = getDisplayName(m.profile).toLowerCase();
              return pName.includes(memberSearchQuery.toLowerCase());
            });

            const filteredHosts = hostsList.filter((m) => {
              if (!memberSearchQuery.trim()) return true;
              const pName = getDisplayName(m.profile).toLowerCase();
              return pName.includes(memberSearchQuery.toLowerCase());
            });

            const filteredMembers = generalMembers.filter((m) => {
              if (!memberSearchQuery.trim()) return true;
              const pName = getDisplayName(m.profile).toLowerCase();
              return pName.includes(memberSearchQuery.toLowerCase());
            });

            return (
              <div className="grid gap-6 grid-cols-1">
                <div className="space-y-6">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      id="member-search-input"
                      type="text"
                      placeholder="Search..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 bg-zinc-100/90 focus:bg-white text-xs font-semibold rounded-full text-zinc-900 placeholder-zinc-400 border border-transparent focus:border-orange-500 focus:outline-none transition-all shadow-2xs"
                    />
                    {memberSearchQuery && (
                      <button
                        onClick={() => setMemberSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded-full"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* ADMINS SECTION */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Admins</h3>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setRoleSearchQuery('');
                            setTargetRoleToAdd('ADMIN');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200 transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus className="h-3 w-3" /> Add Admin
                        </button>
                      )}
                    </div>

                    {filteredAdmins.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">No admins found.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-3 gap-y-5 justify-items-center">
                        {filteredAdmins.map((m: any) => {
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
                                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white shadow-xs"
                                    />
                                  ) : (
                                    <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-black text-base uppercase shadow-xs">
                                      {pName.slice(0, 2)}
                                    </div>
                                  )}
                                  <div className="absolute top-0 right-0 bg-blue-600 rounded-full p-1 text-white shadow-sm border-2 border-white">
                                    <Shield className="h-3 w-3 fill-current" />
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                  {pName}
                                </span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* HOSTS SECTION */}
                  {(hostsList.length > 0 || isAdmin) && (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Hosts</h3>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setRoleSearchQuery('');
                              setTargetRoleToAdd('HOST');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200 transition-all cursor-pointer shadow-2xs"
                          >
                            <Plus className="h-3 w-3" /> Add Host
                          </button>
                        )}
                      </div>

                      {filteredHosts.length === 0 ? (
                        <p className="text-xs text-zinc-400 py-2">No hosts assigned yet.</p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-3 gap-y-5 justify-items-center">
                          {filteredHosts.map((m: any) => {
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
                                    <img
                                      src={getAvatarUrl(p)}
                                      alt={pName}
                                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white shadow-xs group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute top-0 right-0 bg-amber-500 rounded-full p-1 text-white shadow-sm border-2 border-white">
                                      <UserCheck className="h-3 w-3" />
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                    {pName}
                                  </span>
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MEMBERS SECTION */}
                  <div className="space-y-3.5 pt-2">
                    <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">
                      Members · {generalMembers.length}
                    </h3>

                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">No members found.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-3 gap-y-5 justify-items-center">
                        {filteredMembers.map((m: any) => {
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
                                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white shadow-xs"
                                    />
                                  ) : (
                                    <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 font-extrabold text-base uppercase shadow-xs">
                                      {pName.slice(0, 2)}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                  {pName}
                                </span>
                              </Link>
                              {p.is_guest ? (
                                myClaimedGuestIds.includes(p.id) ? (
                                  <span className="text-[8px] font-extrabold uppercase bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full mt-1">
                                    Pending
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setGuestToClaim({ id: p.id, name: pName })}
                                    className="text-[8px] font-black uppercase bg-orange-500 text-white hover:bg-orange-600 px-2 py-0.5 rounded-full transition-all mt-1 cursor-pointer shadow-2xs"
                                    title="Request to claim this guest profile"
                                  >
                                    Claim
                                  </button>
                                )
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Admin Side Panel: Pending Claims & Add Guest */}
                <div className="space-y-6">
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
                  ) : null}
                </div>
              </div>
            );
          })()}

          {/* TAB 4: LEADERBOARD GLOBAL */}
          {activeTab === 'leaderboard' && (() => {
            const currentLeaderboard =
              rankingsBySport[selectedLeaderboardSport] || rankings || [];

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">
                      {selectedLeaderboardSport} ELO Standings
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Official leaderboard standings computed using mathematical ELO formulas.
                    </p>
                  </div>

                  {/* Sport Toggle (PADEL / TENNIS) */}
                  <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 self-start sm:self-auto">
                    <button
                      onClick={() => setSelectedLeaderboardSport('PADEL')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                        selectedLeaderboardSport === 'PADEL'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      🎾 Padel ELO
                    </button>
                    <button
                      onClick={() => setSelectedLeaderboardSport('TENNIS')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                        selectedLeaderboardSport === 'TENNIS'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      🎾 Tennis ELO
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                  {currentLeaderboard.length === 0 ? (
                    <div className="text-center py-16 text-zinc-400 space-y-2">
                      <Trophy className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
                      <p className="text-sm font-semibold">No standings computed yet for {selectedLeaderboardSport}.</p>
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
                          {currentLeaderboard.map((r: any, idx) => {
                          const rank = idx + 1;
                          const winRate =
                            r.total_matches > 0
                              ? Math.round((r.total_wins / r.total_matches) * 100)
                              : 0;

                          const pDiff = r.points_for - r.points_against;
                          const playerCp = Math.round(cpMap[r.profile.id] || 0);
                          const skillRating = Number(1.0 + Math.max(0, (Number(r.elo_rating) - 800) / 250)).toFixed(2);

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
                                  <img
                                     src={getAvatarUrl(r.profile)}
                                     alt={getDisplayName(r.profile)}
                                     className="h-8 w-8 shrink-0 rounded-full object-cover border border-zinc-100 shadow-2xs"
                                   />
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
          );
        })()}

          {/* TAB 5: WIKI & RULEBOOK */}
          {activeTab === 'wiki' && (() => {
            const wikiSections = [
              {
                id: 'elo',
                title: 'Sistem Perhitungan ELO Rating & Effective Team Rating',
                icon: Trophy,
                badge: 'Rating Engine',
                content: [
                  {
                    subtitle: 'Ekspektasi Kemenangan & Gap Dampening',
                    text: 'Rating ELO dihitung dari probabilitas kemenangan tim. Apabila terdapat perbedaan rating besar antarpasangan tim, sistem menerapkan Effective Team Rating dengan penalti gap (0.25 × Δ) untuk menyeimbangkan nilai ekspektasi tim dan mencegah penurunan poin berlebihan saat berpasangan dengan pemula.',
                  },
                  {
                    subtitle: 'Margin of Victory (MoV) & K-Factor',
                    text: 'Kemenangan telak (misal 21-5) memberikan bonus pengali ELO berbasis logaritma alami. K-Factor bernilai 48 untuk Pemain Baru (Provisional < 10 pertandingan) agar rating cepat menyesuaikan, dan 24 untuk Pemain Mapan (Settled ≥ 10 pertandingan).',
                  },
                  {
                    subtitle: 'Skill Rating & Drift Review Triggers',
                    text: 'Skill Rating adalah nilai penilaian resmi Admin (1.00 – 7.00). Apabila pergeseran ELO pemain mencapai ≥ 100 poin dari penilaian terakhir atau terjadi carry overperformance (gap > 150 selama ≥ 5 match), sistem mengaktifkan bendera peninjauan otomatis (review_flagged) untuk admin.',
                  },
                ],
              },
              {
                id: 'formats',
                title: 'Format Turnamen: Americano vs Mexicano',
                icon: Star,
                badge: 'Tournament Formats',
                content: [
                  {
                    subtitle: 'Americano (Rotasi Seragam)',
                    text: 'Dalam format Americano, algoritma rotasi menyusun jadwal agar setiap pemain merasakan berpasangan dengan semua pemain lain secara merata. Tujuannya adalah keadilan sosialisasi dan perimbangan mitra tanding.',
                  },
                  {
                    subtitle: 'Mexicano (Dynamic Standings-Based)',
                    text: 'Dalam format Mexicano, jadwal disusun secara dinamis berbasis klasemen sesi berjalan. Di setiap lapangan, pemain dipasangkan dengan skema 1+4 vs 2+3 (peringkat 1 berpasangan dengan peringkat 4 melawan peringkat 2 dan 3) agar pertandingan berlangsung seimbang antar pemain berkemampuan setara.',
                  },
                ],
              },
              {
                id: 'sitout',
                title: 'Aturan Sit-Out Keadilan & Bye Points',
                icon: Clock,
                badge: 'Sit-Out Priority',
                content: [
                  {
                    subtitle: 'Urutan Prioritas Sit-Out (Siapa yang Istirahat)',
                    text: '1. Jumlah Main Paling Sedikit: Pemain dengan jumlah pertandingan real lebih sedikit mendapat prioritas tertinggi untuk main.\n2. Interval Sit-Out Terlama: Pemain yang paling lama tidak istirahat mendapat prioritas main.\n3. Kumulatif Poin Lebih Rendah: Pemain dengan poin lebih kecil diprioritaskan main untuk menyusul.\n4. Deterministic Seed tie-breaker.',
                  },
                  {
                    subtitle: 'Pemberian Bye Point',
                    text: 'Pemain yang harus istirahat (sit-out) di suatu ronde otomatis dianugerahi Bye Point sebesar (Target Points Per Match / 2). Poin ini permanen dicatat dan ditambahkan ke poin kumulatif sesi.',
                  },
                ],
              },
              {
                id: 'cp',
                title: 'Community Points (CP) Engine',
                icon: Award,
                badge: 'Participation Rewards',
                content: [
                  {
                    subtitle: 'Formula Hadiah CP',
                    text: 'Community Points (CP) dibagikan otomatis saat sesi difinalisasi (finalize_session):\n• Sesi N ≥ 10: Juara 1 (100 CP), Juara 2 (75 CP), Juara 3 (50 CP), Juara 4 (20 CP), Peringkat 5..N decay linear hingga floor 8 CP.\n• Sesi N < 10: Juara 1 (75 CP), Juara 2 (50 CP), Juara 3 (25 CP), Peringkat 4..N (10 CP).',
                  },
                ],
              },
              {
                id: 'roles',
                title: 'Peran & Hak Akses (ADMIN, HOST, MEMBER)',
                icon: Shield,
                badge: 'RBAC Hierarchy',
                content: [
                  {
                    subtitle: 'ADMIN (Tingkat Tertinggi)',
                    text: 'Kontrol penuh komunitas: mengedit profil komunitas, mengubah peran anggota, menambah/mengapus Admin/Host, menyetujui klaim akun tamu, serta menginisiasi musim CP baru.',
                  },
                  {
                    subtitle: 'HOST (Penyelenggara Lapangan)',
                    text: 'Dapat membuat sesi game baru, menyetujui pendaftaran profil tamu (guest), menginput skor pertandingan, dan memfinalisasi sesi game.',
                  },
                  {
                    subtitle: 'MEMBER (Pemain Terdaftar)',
                    text: 'Hak akses Read-Only untuk melihat klasemen ELO, riwayat sesi, profil pemain, statistik umum, serta memantau papan skor live real-time.',
                  },
                ],
              },
            ];

            const filteredSections = wikiSections.filter((sec) => {
              if (!wikiSearchQuery.trim()) return true;
              const q = wikiSearchQuery.toLowerCase();
              return (
                sec.title.toLowerCase().includes(q) ||
                sec.badge.toLowerCase().includes(q) ||
                sec.content.some(
                  (c) => c.subtitle.toLowerCase().includes(q) || c.text.toLowerCase().includes(q)
                )
              );
            });

            return (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">
                    Communitrix Wiki & Rulebook
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Panduan resmi kalkulasi ELO, Effective Team Rating, format turnamen, dan aturan main.
                  </p>
                </div>

                {/* Search Bar inside Wiki */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search Wiki topics & rules (e.g. Elo, Mexicano, Bye point)..."
                    value={wikiSearchQuery}
                    onChange={(e) => setWikiSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-zinc-100/90 focus:bg-white text-xs font-semibold rounded-full text-zinc-900 placeholder-zinc-400 border border-transparent focus:border-orange-500 focus:outline-none transition-all shadow-2xs"
                  />
                  {wikiSearchQuery && (
                    <button
                      onClick={() => setWikiSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded-full"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Wiki Topic Cards Grid */}
                <div className="grid gap-5 grid-cols-1">
                  {filteredSections.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-8">
                      No wiki topics found matching "{wikiSearchQuery}".
                    </p>
                  ) : (
                    filteredSections.map((sec) => {
                      const IconComp = sec.icon;
                      return (
                        <div
                          key={sec.id}
                          className="p-6 rounded-3xl border border-zinc-100 bg-zinc-50 shadow-xs space-y-4"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
                            <h3 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                              <IconComp className="h-5 w-5 text-orange-500 shrink-0" />
                              <span>{sec.title}</span>
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
                              {sec.badge}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {sec.content.map((item, idx) => (
                              <div key={idx} className="border-l-4 border-orange-500/80 pl-4 space-y-1">
                                <h4 className="font-bold text-xs text-zinc-900">{item.subtitle}</h4>
                                <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line font-medium">
                                  {item.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-t border-zinc-800/80 backdrop-blur-xl shadow-2xl px-2 py-2 select-none">
        <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-around">

          {/* TAB 1: HOME */}
          <button
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'home'
                ? 'text-orange-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'home' && (
              <span className="absolute -top-2 h-1 w-6 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            )}
            <Home className={`h-5 w-5 ${activeTab === 'home' ? 'text-orange-500 scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 tracking-tight">Home</span>
          </button>

          {/* TAB 2: SESSIONS */}
          <button
            onClick={() => handleTabChange('sessions')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'sessions'
                ? 'text-orange-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'sessions' && (
              <span className="absolute -top-2 h-1 w-6 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            )}
            <Calendar className={`h-5 w-5 ${activeTab === 'sessions' ? 'text-orange-500 scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 tracking-tight">Sessions</span>
          </button>

          {/* TAB 3: MEMBERS */}
          <button
            onClick={() => handleTabChange('members')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'members'
                ? 'text-orange-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'members' && (
              <span className="absolute -top-2 h-1 w-6 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            )}
            <Users className={`h-5 w-5 ${activeTab === 'members' ? 'text-orange-500 scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 tracking-tight">Members</span>
          </button>

          {/* TAB 4: LEADERBOARD */}
          <button
            onClick={() => handleTabChange('leaderboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'leaderboard'
                ? 'text-orange-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'leaderboard' && (
              <span className="absolute -top-2 h-1 w-6 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            )}
            <Trophy className={`h-5 w-5 ${activeTab === 'leaderboard' ? 'text-orange-500 scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 tracking-tight">Rank</span>
          </button>

          {/* TAB 5: WIKI */}
          <button
            onClick={() => handleTabChange('wiki')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'wiki'
                ? 'text-orange-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-medium'
            }`}
          >
            {activeTab === 'wiki' && (
              <span className="absolute -top-2 h-1 w-6 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            )}
            <BookOpen className={`h-5 w-5 ${activeTab === 'wiki' ? 'text-orange-500 scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-1 tracking-tight">Wiki</span>
          </button>

        </div>
      </nav>

      {/* EDIT COMMUNITY INFO MODAL (Admin Only) */}
      {isEditHomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-orange-500" />
                Edit Community Info
              </h3>
              <button
                onClick={() => setIsEditHomeOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Community Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe your community..."
                  className="w-full p-3 bg-zinc-100 rounded-xl text-zinc-900 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Default Sport</label>
                <select
                  value={editSport}
                  onChange={(e) => setEditSport(e.target.value)}
                  className="w-full p-3 bg-zinc-100 rounded-xl text-zinc-900 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none font-bold"
                >
                  <option value="PADEL">PADEL</option>
                  <option value="TENNIS">TENNIS</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsEditHomeOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHomeInfo}
                disabled={isSavingHome}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {isSavingHome ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ADD ADMIN / ADD HOST MODAL */}
      {targetRoleToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-500" />
                Manage {targetRoleToAdd === 'ADMIN' ? 'Admins' : 'Hosts'}
              </h3>
              <button
                onClick={() => setTargetRoleToAdd(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder={`Search member...`}
                value={roleSearchQuery}
                onChange={(e) => setRoleSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-100 rounded-xl text-zinc-900 placeholder-zinc-400 border border-transparent focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 pr-1 space-y-1">
              {members
                .filter((m) => {
                  const pName = getDisplayName(m.profile).toLowerCase();
                  return pName.includes(roleSearchQuery.toLowerCase());
                })
                .map((m) => {
                  const p = m.profile;
                  if (!p) return null;
                  const pName = getDisplayName(p);
                  const isCurrentTargetRole = m.role === targetRoleToAdd;

                  return (
                    <div key={p.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={pName} className="h-9 w-9 rounded-full object-cover border border-zinc-100" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center justify-center">
                            {pName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{pName}</p>
                          <p className="text-[10px] text-zinc-400 font-medium uppercase">Current: {m.role}</p>
                        </div>
                      </div>

                      {isCurrentTargetRole ? (
                        <button
                          onClick={() => {
                            handleUpdateRole(p.id, 'MEMBER');
                            setTargetRoleToAdd(null);
                          }}
                          className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleUpdateRole(p.id, targetRoleToAdd);
                            setTargetRoleToAdd(null);
                          }}
                          className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                        >
                          Make {targetRoleToAdd}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

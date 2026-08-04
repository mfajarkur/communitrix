'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  Users,
  Trophy,
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
  UserCheck,
  Sparkles,
  CalendarDays,
  User,
  LogOut,
  Flame,
  ArrowLeft,
  Filter,
  MapPin,
  Clock,
  UserMinus,
  UserPlus,
  Award,
  TrendingUp,
} from 'lucide-react';
import AddGuestForm from './add-guest-form';
import BannerImageEditor from './banner-image-editor';
import EditCommunityInfoButton from './edit-community-info-button';
import { getDisplayName, getPlayerGender, getAvatarUrl } from '@/lib/utils/profile';
import { requestClaimAction, resolveClaimAction } from '@/server/actions/claim.actions';
import { updateMemberRoleAction, removeMemberAction } from '@/server/actions/member.actions';
import { resolveJoinRequestAction } from '@/server/actions/join-request.actions';
import { requestSkillLevelAction, resolveSkillLevelRequestAction, type SkillLevel } from '@/server/actions/skill.actions';

const SKILL_LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};
const SKILL_LEVEL_STYLE: Record<string, string> = {
  BEGINNER: 'bg-zinc-100 text-zinc-600',
  INTERMEDIATE: 'bg-blue-50 text-blue-600 border border-blue-200',
  ADVANCED: 'bg-orange-50 text-orange-600 border border-orange-200',
};
const SKILL_LEVEL_ORDER: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

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
  pendingJoinRequests?: any[];
  pendingSkillRequests?: any[];
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
  pendingJoinRequests = [],
  pendingSkillRequests = [],
}: CommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'sessions' | 'members' | 'leaderboard'>('home');
  const [selectedLeaderboardSport, setSelectedLeaderboardSport] = useState<'PADEL' | 'TENNIS'>(
    defaultSport === 'TENNIS' ? 'TENNIS' : 'PADEL'
  );
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'elo' | 'cp' | 'skill' | 'winrate' | 'wins' | 'diff'>('elo');
  const [leaderboardSearchQuery, setLeaderboardSearchQuery] = useState('');
  const [starSportTab, setStarSportTab] = useState<'PADEL' | 'TENNIS'>('PADEL');
  const [guestToClaim, setGuestToClaim] = useState<{ id: string; name: string } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingJoinId, setResolvingJoinId] = useState<string | null>(null);
  const [resolvingSkillId, setResolvingSkillId] = useState<string | null>(null);
  const [skillLevelPickerOpen, setSkillLevelPickerOpen] = useState(false);
  const [isRequestingSkillLevel, setIsRequestingSkillLevel] = useState(false);
  const [skillLevelError, setSkillLevelError] = useState<string | null>(null);
  const [memberSelectionMode, setMemberSelectionMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isBatchRemoving, setIsBatchRemoving] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [targetRoleToAdd, setTargetRoleToAdd] = useState<'ADMIN' | 'HOST' | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const router = useRouter();
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'open' | 'ended'>('open');
  const [sessionSportFilter, setSessionSportFilter] = useState<'ALL' | 'PADEL' | 'TENNIS'>('ALL');

  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['home', 'sessions', 'members', 'leaderboard', 'dashboard'].includes(tab)) {
        if (tab === 'dashboard') setActiveTab('home');
        else setActiveTab(tab as any);
      }
    }
  }, []);

  const handleTabChange = (tab: 'home' | 'sessions' | 'members' | 'leaderboard') => {
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

  // Admin approves or rejects a join request
  const handleResolveJoin = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setResolvingJoinId(requestId);
    try {
      const result = await resolveJoinRequestAction(requestId, action, communitySlug, communityId);
      if (result?.success) {
        window.location.reload();
      } else {
        alert(result?.error || 'Failed to resolve join request');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to resolve join request');
    } finally {
      setResolvingJoinId(null);
    }
  };

  // Admin approves or rejects a skill level request
  const handleResolveSkill = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setResolvingSkillId(requestId);
    try {
      const result = await resolveSkillLevelRequestAction(requestId, action, communitySlug, communityId);
      if (result?.success) {
        window.location.reload();
      } else {
        alert(result?.error || 'Failed to resolve skill level request');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to resolve skill level request');
    } finally {
      setResolvingSkillId(null);
    }
  };

  // Member requests their own skill level be raised
  const handleRequestSkillLevel = async (requestedLevel: SkillLevel) => {
    setIsRequestingSkillLevel(true);
    setSkillLevelError(null);
    try {
      const result = await requestSkillLevelAction(communityId, requestedLevel, communitySlug);
      if (result?.success) {
        setSkillLevelPickerOpen(false);
        window.location.reload();
      } else {
        setSkillLevelError(result?.error || 'Failed to request skill level');
      }
    } catch (err: any) {
      setSkillLevelError(err?.message || 'Failed to request skill level');
    } finally {
      setIsRequestingSkillLevel(false);
    }
  };

  const toggleMemberSelected = (targetProfileId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetProfileId)) next.delete(targetProfileId);
      else next.add(targetProfileId);
      return next;
    });
  };

  // Removes every selected member one at a time — removeMemberAction's own last-admin guard
  // re-checks the live active-admin count on each call, so it stays correct even if the batch
  // includes several admins (the last one simply fails with a clear reason while the rest go
  // through). Reports a summary instead of one alert per failure.
  const handleBatchRemove = async () => {
    const count = selectedMemberIds.size;
    if (count === 0) return;
    if (!confirm(`Remove ${count} selected member${count === 1 ? '' : 's'} from this community?`)) return;

    setIsBatchRemoving(true);
    const failures: string[] = [];
    for (const targetProfileId of selectedMemberIds) {
      try {
        const result = await removeMemberAction({ communityId, targetProfileId, communitySlug });
        if (!result.ok) failures.push(result.message || 'Unknown error');
      } catch (err: any) {
        failures.push(err?.message || 'Unknown error');
      }
    }
    setIsBatchRemoving(false);

    if (failures.length > 0) {
      alert(`Removed ${count - failures.length} of ${count} members.\n\nFailed:\n${failures.join('\n')}`);
    }
    window.location.reload();
  };

  const topPlayer = rankings && rankings.length > 0 ? rankings[0] : null;

  const role = isAdmin ? 'ADMIN' : isHostOrAdmin ? 'HOST' : 'MEMBER';
  const bannerImage = community?.logo_url || '/community_banner_placeholder.png';
  return (
    <>
      {/* Compact header — unconditional, shown on every tab, replacing the old
          Home-only tall hero banner and the old per-tab "plain title + back"
          pattern. The global bottom nav now owns "where am I / how do I leave
          entirely", so this only needs to say which community and give one
          quick way back to the list. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-50 via-orange-50/40 to-white border border-orange-100/70 px-3 py-3 mb-3 flex items-center gap-3">
        <Link
          href="/communities"
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-500 hover:text-orange-600 hover:border-orange-200 shadow-sm transition-all cursor-pointer"
          title="Back to Communities"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <img
          src={bannerImage}
          alt={communityName}
          className="h-11 w-11 rounded-xl object-cover shrink-0 ring-2 ring-white shadow-sm border border-orange-100"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-black tracking-tight text-zinc-900 truncate">{communityName}</h1>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 mt-0.5 text-[9px] font-black tracking-wider uppercase ${
            role === 'ADMIN'
              ? 'bg-orange-500 text-white'
              : role === 'HOST'
              ? 'bg-orange-50 text-orange-600 border border-orange-200'
              : 'bg-zinc-100 text-zinc-600'
          }`}>
            {role === 'ADMIN' ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {role}
          </span>
        </div>
      </div>

      {/* Top tab strip — moved here from a fixed bottom bar so only the global
          Profile/Community/Activities nav ever occupies the bottom of the screen.
          Segmented-control style (filled pill on the active tab) to read as the
          same "nav" language as the global dock below. */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-100 mb-4 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-1 max-w-md sm:max-w-xl mx-auto bg-zinc-100/80 rounded-2xl p-1">
          {([
            { tab: 'home' as const, label: 'Home', Icon: Home },
            { tab: 'sessions' as const, label: 'Sessions', Icon: Calendar },
            { tab: 'members' as const, label: 'Members', Icon: Users },
            { tab: 'leaderboard' as const, label: 'Rank', Icon: Trophy },
          ]).map(({ tab, label, Icon }) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === tab ? 'bg-white text-orange-500 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${activeTab === tab ? 'scale-105' : ''} transition-transform`} />
              <span className={`text-[9px] mt-1 tracking-tight ${activeTab === tab ? 'font-extrabold' : 'font-medium'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-6 bg-white min-h-[500px]">

        {/* TAB CONTENTS */}
        <div className="min-h-[400px]">

          {/* TAB 1: HOME KOMUNITAS */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* About card — banner image + info editing (admin only), sport/join code,
                  quick stats. Name/role/breadcrumb now live in the compact header above
                  instead of repeating here, but everything else from the old hero banner
                  still lives here rather than disappearing. */}
              <div className="relative overflow-hidden rounded-2xl bg-zinc-950 p-4 text-white shadow-sm border border-zinc-100 space-y-3">
                {isAdmin && (
                  <div className="flex items-center justify-between gap-2">
                    <BannerImageEditor communityId={communityId} communitySlug={communitySlug} />
                    <EditCommunityInfoButton
                      communityId={communityId}
                      communitySlug={communitySlug}
                      community={community}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-white/90 font-medium">
                  <p>
                    Default Sport: <span className="font-extrabold uppercase">{defaultSport}</span>
                  </p>
                  {community?.code && (
                    <p className="bg-white/15 px-2 py-0.5 rounded font-mono text-[9px] tracking-wider uppercase border border-white/10 shadow-sm">
                      CODE: {community.code}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-white/90 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {memberCount} Members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {sessions.length} Sessions
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" />
                    {totalMatchesCount} Matches Scored
                  </span>
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
                        <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight mt-1">
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
          {activeTab === 'sessions' && (() => {
            // Count metrics for filter tabs
            const openSessionsCount = sessions.filter(
              (s: any) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED' && s.status !== 'ENDED'
            ).length;
            const endedSessionsCount = sessions.filter(
              (s: any) => s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'ENDED'
            ).length;

            // Filter logic (status + sport)
            const filteredSessions = sessions.filter((s: any) => {
              const isEnded = s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'ENDED';
              if (sessionStatusFilter === 'open' && isEnded) return false;
              if (sessionStatusFilter === 'ended' && !isEnded) return false;

              if (sessionSportFilter !== 'ALL' && s.sport !== sessionSportFilter) return false;

              return true;
            });

            // Sort by date descending (newest timestamp first)
            const sortedSessions = [...filteredSessions].sort((a: any, b: any) => {
              const dateA = new Date(a.scheduled_for || a.started_at || a.created_at).getTime();
              const dateB = new Date(b.scheduled_for || b.started_at || b.created_at).getTime();
              return dateB - dateA;
            });

            // Group by Date String Header
            const groupedSessionsByDate: { dateLabel: string; items: any[] }[] = [];
            sortedSessions.forEach((s: any) => {
              const rawDate = s.scheduled_for || s.started_at || s.created_at;
              const dateObj = new Date(rawDate);
              let dateLabel = 'Unknown Date';
              if (!isNaN(dateObj.getTime())) {
                const isCurrentYear = dateObj.getFullYear() === new Date().getFullYear();
                dateLabel = dateObj.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  ...(isCurrentYear ? {} : { year: 'numeric' }),
                });
              }

              let group = groupedSessionsByDate.find((g) => g.dateLabel === dateLabel);
              if (!group) {
                group = { dateLabel, items: [] };
                groupedSessionsByDate.push(group);
              }
              group.items.push(s);
            });

            return (
              <div className="space-y-6 relative pb-16">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">
                      Game Sessions
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Match sessions, live scoring boards, and historical tournament records.
                    </p>
                  </div>

                  {isHostOrAdmin && (
                    <Link
                      href={`/c/${communitySlug}/sessions/new`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      New Session
                    </Link>
                  )}
                </div>

                {/* Filter Bar: Status Pills (Open / Ended) & Sport Tabs (All / Padel / Tennis) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                  {/* Status Pills */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSessionStatusFilter('open')}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                        sessionStatusFilter === 'open'
                          ? 'bg-orange-500 text-white shadow-xs font-extrabold'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200/60'
                      }`}
                    >
                      Open • {openSessionsCount}
                    </button>

                    <button
                      onClick={() => setSessionStatusFilter('ended')}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                        sessionStatusFilter === 'ended'
                          ? 'bg-orange-500 text-white shadow-xs font-extrabold'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200/60'
                      }`}
                    >
                      Ended • {endedSessionsCount}
                    </button>
                  </div>

                  {/* Sport Filter Tabs */}
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full border border-zinc-200/60">
                    <button
                      onClick={() => setSessionSportFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        sessionSportFilter === 'ALL'
                          ? 'bg-orange-500 text-white shadow-xs font-black'
                          : 'text-zinc-500 hover:text-orange-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSessionSportFilter('PADEL')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        sessionSportFilter === 'PADEL'
                          ? 'bg-orange-500 text-white shadow-xs font-black'
                          : 'text-zinc-500 hover:text-orange-600'
                      }`}
                    >
                      Padel
                    </button>
                    <button
                      onClick={() => setSessionSportFilter('TENNIS')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        sessionSportFilter === 'TENNIS'
                          ? 'bg-orange-500 text-white shadow-xs font-black'
                          : 'text-zinc-500 hover:text-orange-600'
                      }`}
                    >
                      Tennis
                    </button>
                  </div>
                </div>

                {/* Sessions List grouped by Date */}
                {sessions.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 space-y-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <Calendar className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
                    <p className="text-sm font-semibold">No game sessions created yet.</p>
                    {isHostOrAdmin && (
                      <Link
                        href={`/c/${communitySlug}/sessions/new`}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Create First Session
                      </Link>
                    )}
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <Calendar className="h-8 w-8 mx-auto opacity-30 text-zinc-500" />
                    <p className="text-sm font-semibold text-zinc-600">
                      No {sessionStatusFilter} {sessionSportFilter !== 'ALL' ? sessionSportFilter.toLowerCase() : ''} sessions found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedSessionsByDate.map((group) => (
                      <div key={group.dateLabel} className="space-y-3">
                        <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight pt-1">
                          {group.dateLabel}
                        </h3>

                        <div className="space-y-3">
                          {group.items.map((s: any) => {
                            const rawDate = s.scheduled_for || s.started_at || s.created_at;
                            const dateObj = new Date(rawDate);
                            const timeStr = !isNaN(dateObj.getTime())
                              ? dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
                              : '6:00 PM';

                            const joinedCount = Array.isArray(s.session_players)
                              ? s.session_players.filter((sp: any) => sp.status === 'ACTIVE').length
                              : 0;

                            const isLoadingThis = loadingSessionId === s.id;
                            const isSessionEnded = s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'ENDED';

                            return (
                              <Link
                                key={s.id}
                                href={`/c/${communitySlug}/sessions/${s.id}`}
                                onClick={() => setLoadingSessionId(s.id)}
                                className={`group rounded-2xl border transition-all flex flex-row items-stretch cursor-pointer select-none active:scale-[0.98] ${
                                  isLoadingThis
                                    ? 'border-orange-500 ring-2 ring-orange-400/40 bg-orange-50/40 shadow-inner'
                                    : 'border-orange-100 bg-white hover:shadow-md hover:border-orange-300'
                                }`}
                              >
                                {/* Kotak Kiri: Jam dan Jenis Game (Shading Orange Transparan, abu-abu jika sudah Ended) */}
                                <div
                                  className={`border-r p-3.5 sm:p-4 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[125px] shrink-0 text-center transition-colors ${
                                    isSessionEnded
                                      ? 'bg-zinc-100 border-zinc-200'
                                      : isLoadingThis
                                      ? 'bg-orange-100/80 border-orange-200'
                                      : 'bg-orange-50/80 border-orange-100/80'
                                  }`}
                                >
                                  <span className={`text-sm sm:text-base font-black tracking-tight ${isSessionEnded ? 'text-zinc-600' : 'text-orange-950'}`}>
                                    {timeStr}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase mt-0.5 ${isSessionEnded ? 'text-zinc-500' : 'text-orange-600/90'}`}>
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                        isSessionEnded ? 'bg-zinc-400' : 'bg-green-500 animate-pulse'
                                      }`}
                                    />
                                    {s.format || s.sport}
                                  </span>
                                </div>

                                {/* Kotak Kanan: Nama Sesi, Jumlah Peserta Join, Berapa Court */}
                                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between min-w-0 bg-white">
                                  <div>
                                    <h4 className="text-base sm:text-lg font-black text-zinc-900 group-hover:text-orange-600 transition-colors truncate">
                                      {s.session_name}
                                    </h4>
                                  </div>

                                  <div className="flex items-center justify-between mt-2.5 text-xs text-zinc-500 font-semibold pt-1 border-t border-zinc-100/60">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                      <span className="truncate">
                                        {joinedCount > 0 ? `${joinedCount} Joined` : `${s.court_count} Courts`}
                                      </span>
                                      {joinedCount > 0 && <span className="shrink-0">• {s.court_count} Courts</span>}
                                    </span>

                                    {isLoadingThis ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 animate-pulse shrink-0 ml-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                        Opening...
                                      </span>
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                                    )}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Floating Action Button (FAB) */}
                {isHostOrAdmin && (
                  <Link
                    href={`/c/${communitySlug}/sessions/new`}
                    className="fixed bottom-28 right-6 z-40 h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Create New Session"
                  >
                    <Plus className="h-7 w-7" />
                  </Link>
                )}
              </div>
            );
          })()}

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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">Members</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">Admins, hosts, and players in this community.</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setMemberSelectionMode((v) => !v);
                          setSelectedMemberIds(new Set());
                        }}
                        className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                          memberSelectionMode
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        {memberSelectionMode ? 'Cancel' : 'Select'}
                      </button>
                    )}
                  </div>

                  {memberSelectionMode && (
                    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-4 z-40 flex justify-center px-4 pointer-events-none">
                      <div className="pointer-events-auto flex items-center gap-3 bg-zinc-900 text-white rounded-full shadow-lg px-4 py-2.5 max-w-full">
                        <span className="text-xs font-bold whitespace-nowrap">
                          {selectedMemberIds.size} selected
                        </span>
                        <button
                          onClick={handleBatchRemove}
                          disabled={selectedMemberIds.size === 0 || isBatchRemoving}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                        >
                          {isBatchRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

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
                      <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight">Admins</h3>
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
                                onClick={(e) => {
                                  if (memberSelectionMode && p.id !== callerProfile?.id) {
                                    e.preventDefault();
                                    toggleMemberSelected(p.id);
                                  } else if (memberSelectionMode) {
                                    e.preventDefault();
                                  }
                                }}
                                className="flex flex-col items-center w-full"
                              >
                                <div className="relative">
                                  {p.avatar_url ? (
                                    <img
                                      src={p.avatar_url}
                                      alt={pName}
                                      className={`h-[74px] w-[74px] sm:h-[92px] sm:w-[92px] rounded-full object-cover border-2 shadow-xs ${
                                        memberSelectionMode && selectedMemberIds.has(p.id) ? 'border-orange-500' : 'border-white'
                                      }`}
                                    />
                                  ) : (
                                    <div className="flex h-[74px] w-[74px] sm:h-[92px] sm:w-[92px] items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-black text-base uppercase shadow-xs">
                                      {pName.slice(0, 2)}
                                    </div>
                                  )}
                                  <div className="absolute top-0 right-0 bg-blue-600 rounded-full p-1 text-white shadow-sm border-2 border-white">
                                    <Shield className="h-3 w-3 fill-current" />
                                  </div>
                                  {memberSelectionMode && p.id !== callerProfile?.id && (
                                    <div
                                      className={`absolute top-0 left-0 h-5 w-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                        selectedMemberIds.has(p.id) ? 'bg-orange-500' : 'bg-white/90'
                                      }`}
                                    >
                                      {selectedMemberIds.has(p.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                  {pName}
                                </span>
                              </Link>
                              {m.skill_level && (
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-1 ${SKILL_LEVEL_STYLE[m.skill_level]}`}>
                                  {SKILL_LEVEL_LABEL[m.skill_level]}
                                </span>
                              )}
                              {!memberSelectionMode && callerProfile && p.id === callerProfile.id && m.skill_level !== 'ADVANCED' && (
                                <button
                                  onClick={() => setSkillLevelPickerOpen(true)}
                                  className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                  title="Request a higher skill level"
                                >
                                  <TrendingUp className="h-2.5 w-2.5" /> Level Up
                                </button>
                              )}
                              {!memberSelectionMode && isAdmin && p.id !== callerProfile?.id && (
                                <button
                                  onClick={() => handleRemoveMember(p.id, pName)}
                                  className="text-[8px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* HOSTS SECTION */}
                  {(hostsList.length > 0 || isAdmin) && (
                    <div className="space-y-3.5 pt-5 mt-2 border-t border-zinc-100/60">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight">Hosts</h3>
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
                                  onClick={(e) => {
                                    if (memberSelectionMode && p.id !== callerProfile?.id) {
                                      e.preventDefault();
                                      toggleMemberSelected(p.id);
                                    } else if (memberSelectionMode) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="flex flex-col items-center w-full"
                                >
                                  <div className="relative">
                                    <img
                                      src={getAvatarUrl(p)}
                                      alt={pName}
                                      className={`h-[74px] w-[74px] sm:h-[92px] sm:w-[92px] rounded-full object-cover border-2 shadow-xs group-hover:scale-105 transition-transform ${
                                        memberSelectionMode && selectedMemberIds.has(p.id) ? 'border-orange-500' : 'border-white'
                                      }`}
                                    />
                                    <div className="absolute top-0 right-0 bg-amber-500 rounded-full p-1 text-white shadow-sm border-2 border-white">
                                      <UserCheck className="h-3 w-3" />
                                    </div>
                                    {memberSelectionMode && p.id !== callerProfile?.id && (
                                      <div
                                        className={`absolute top-0 left-0 h-5 w-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                          selectedMemberIds.has(p.id) ? 'bg-orange-500' : 'bg-white/90'
                                        }`}
                                      >
                                        {selectedMemberIds.has(p.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                    {pName}
                                  </span>
                                </Link>
                                {m.skill_level && (
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-1 ${SKILL_LEVEL_STYLE[m.skill_level]}`}>
                                    {SKILL_LEVEL_LABEL[m.skill_level]}
                                  </span>
                                )}
                                {!memberSelectionMode && callerProfile && p.id === callerProfile.id && m.skill_level !== 'ADVANCED' && (
                                  <button
                                    onClick={() => setSkillLevelPickerOpen(true)}
                                    className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                    title="Request a higher skill level"
                                  >
                                    <TrendingUp className="h-2.5 w-2.5" /> Level Up
                                  </button>
                                )}
                                {!memberSelectionMode && isAdmin && p.id !== callerProfile?.id && (
                                  <button
                                    onClick={() => handleRemoveMember(p.id, pName)}
                                    className="text-[8px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MEMBERS SECTION */}
                  <div className="space-y-3.5 pt-5 mt-2 border-t border-zinc-100/60">
                    <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight">
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
                                onClick={(e) => {
                                  if (memberSelectionMode && p.id !== callerProfile?.id) {
                                    e.preventDefault();
                                    toggleMemberSelected(p.id);
                                  } else if (memberSelectionMode) {
                                    e.preventDefault();
                                  }
                                }}
                                className="flex flex-col items-center w-full"
                              >
                                <div className="relative">
                                  {p.avatar_url ? (
                                    <img
                                      src={p.avatar_url}
                                      alt={pName}
                                      className={`h-[74px] w-[74px] sm:h-[92px] sm:w-[92px] rounded-full object-cover border-2 shadow-xs ${
                                        memberSelectionMode && selectedMemberIds.has(p.id) ? 'border-orange-500' : 'border-white'
                                      }`}
                                    />
                                  ) : (
                                    <div className="flex h-[74px] w-[74px] sm:h-[92px] sm:w-[92px] items-center justify-center rounded-full bg-zinc-200 text-zinc-700 font-extrabold text-base uppercase shadow-xs">
                                      {pName.slice(0, 2)}
                                    </div>
                                  )}
                                  {memberSelectionMode && p.id !== callerProfile?.id && (
                                    <div
                                      className={`absolute top-0 left-0 h-5 w-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                        selectedMemberIds.has(p.id) ? 'bg-orange-500' : 'bg-white/90'
                                      }`}
                                    >
                                      {selectedMemberIds.has(p.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-zinc-900 mt-2 line-clamp-2 leading-tight w-full px-0.5 group-hover:underline">
                                  {pName}
                                </span>
                              </Link>
                              {!memberSelectionMode && (p.is_guest ? (
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
                              ) : null)}
                              {m.skill_level && (
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-1 ${SKILL_LEVEL_STYLE[m.skill_level]}`}>
                                  {SKILL_LEVEL_LABEL[m.skill_level]}
                                </span>
                              )}
                              {!memberSelectionMode && callerProfile && p.id === callerProfile.id && m.skill_level !== 'ADVANCED' && (
                                <button
                                  onClick={() => setSkillLevelPickerOpen(true)}
                                  className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                  title="Request a higher skill level"
                                >
                                  <TrendingUp className="h-2.5 w-2.5" /> Level Up
                                </button>
                              )}
                              {!memberSelectionMode && isAdmin && p.id !== callerProfile?.id && (
                                <button
                                  onClick={() => handleRemoveMember(p.id, pName)}
                                  className="text-[8px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 px-1.5 py-0.5 rounded-full transition-all mt-1 cursor-pointer"
                                >
                                  Remove
                                </button>
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

                  {isAdmin && pendingJoinRequests.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm space-y-3.5">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
                        <h3 className="font-black text-xs uppercase tracking-widest text-amber-800 flex items-center gap-1.5 font-sans">
                          <UserPlus className="h-4 w-4 text-amber-600" />
                          Pending Join Requests ({pendingJoinRequests.length})
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {pendingJoinRequests.map((req) => {
                          const reqName = getDisplayName(req.profile);
                          const username = req.profile?.username ? `@${req.profile.username}` : '';
                          const isProcessingThis = resolvingJoinId === req.id;

                          return (
                            <div
                              key={req.id}
                              className="p-3.5 rounded-xl bg-white border border-amber-200/80 space-y-3 shadow-xs"
                            >
                              <div className="text-xs text-gray-800 space-y-1 font-sans">
                                <p className="font-bold">
                                  {reqName} <span className="text-gray-400 font-normal">{username}</span>
                                </p>
                                <p className="text-gray-500 font-light text-[11px]">Wants to join this community</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResolveJoin(req.id, 'APPROVE')}
                                  disabled={isProcessingThis}
                                  className="flex-1 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  {isProcessingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleResolveJoin(req.id, 'REJECT')}
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

                  {isAdmin && pendingSkillRequests.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm space-y-3.5">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
                        <h3 className="font-black text-xs uppercase tracking-widest text-amber-800 flex items-center gap-1.5 font-sans">
                          <Award className="h-4 w-4 text-amber-600" />
                          Pending Skill Requests ({pendingSkillRequests.length})
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {pendingSkillRequests.map((req) => {
                          const reqName = getDisplayName(req.profile);
                          const isProcessingThis = resolvingSkillId === req.id;

                          return (
                            <div
                              key={req.id}
                              className="p-3.5 rounded-xl bg-white border border-amber-200/80 space-y-3 shadow-xs"
                            >
                              <div className="text-xs text-gray-800 space-y-1 font-sans">
                                <p className="font-bold">{reqName}</p>
                                <p className="text-gray-500 font-light text-[11px]">
                                  {req.current_level ? SKILL_LEVEL_LABEL[req.current_level] : 'Unrated'} →{' '}
                                  <span className="font-extrabold text-orange-600">
                                    {SKILL_LEVEL_LABEL[req.requested_level]}
                                  </span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResolveSkill(req.id, 'APPROVE')}
                                  disabled={isProcessingThis}
                                  className="flex-1 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  {isProcessingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleResolveSkill(req.id, 'REJECT')}
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
                        <h3 className="text-sm font-extrabold text-zinc-800 tracking-tight">Add Guest Player</h3>
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
            const getSortValue = (r: any) => {
              switch (leaderboardSortBy) {
                case 'elo':
                  return Number(r.elo_rating);
                case 'cp':
                  return Math.round(cpMap[r.profile.id] || 0);
                case 'skill':
                  return Number(1.0 + Math.max(0, (Number(r.elo_rating) - 800) / 250));
                case 'winrate':
                  return r.total_matches > 0 ? r.total_wins / r.total_matches : 0;
                case 'wins':
                  return r.total_wins;
                case 'diff':
                  return r.points_for - r.points_against;
                default:
                  return Number(r.elo_rating);
              }
            };

            const currentLeaderboard = [...(rankingsBySport[selectedLeaderboardSport] || rankings || [])]
              .filter((r: any) =>
                leaderboardSearchQuery.trim()
                  ? getDisplayName(r.profile).toLowerCase().includes(leaderboardSearchQuery.trim().toLowerCase())
                  : true
              )
              .sort((a, b) => getSortValue(b) - getSortValue(a));

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">
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

                {/* Search + Sort By */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={leaderboardSearchQuery}
                      onChange={(e) => setLeaderboardSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 bg-zinc-100/90 focus:bg-white text-xs font-semibold rounded-full text-zinc-900 placeholder-zinc-400 border border-transparent focus:border-orange-500 focus:outline-none transition-all shadow-2xs"
                    />
                    {leaderboardSearchQuery && (
                      <button
                        onClick={() => setLeaderboardSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded-full"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="leaderboard-sort" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Sort by
                    </label>
                    <select
                      id="leaderboard-sort"
                      value={leaderboardSortBy}
                      onChange={(e) => setLeaderboardSortBy(e.target.value as typeof leaderboardSortBy)}
                      className="text-xs font-bold rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
                    >
                      <option value="elo">Elo Rating</option>
                      <option value="cp">Community Points</option>
                      <option value="skill">Skill Rating</option>
                      <option value="winrate">Win Rate</option>
                      <option value="wins">Wins</option>
                      <option value="diff">Diff</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                  {currentLeaderboard.length === 0 ? (
                    <div className="text-center py-16 text-zinc-400 space-y-2">
                      <Trophy className="h-10 w-10 mx-auto opacity-30 text-orange-500" />
                      <p className="text-sm font-semibold">
                        {leaderboardSearchQuery.trim()
                          ? `No players found matching "${leaderboardSearchQuery}".`
                          : `No standings computed yet for ${selectedLeaderboardSport}.`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <th className="p-3 sm:p-4 w-12 text-center">Rank</th>
                            <th className="p-3 sm:p-4">Name</th>
                            <th className="p-3 sm:p-4 text-center">Elo</th>
                            <th className="p-3 sm:p-4 text-center">CP</th>
                            <th className="p-3 sm:p-4 text-center">W-L-T</th>
                            <th className="p-3 sm:p-4 text-center">WR%</th>
                            <th className="p-3 sm:p-4 text-center">Diff</th>
                            <th className="p-3 sm:p-4 text-center">Skill</th>
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
                              className="group hover:bg-zinc-50/40 transition-all text-xs sm:text-sm text-[#111827]"
                            >
                              <td className="p-3 sm:p-4 text-center align-middle font-extrabold">
                                {rank === 1 ? (
                                  <span className="inline-flex h-5.5 w-5.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-orange-500/10 text-orange-650 text-xs font-black border border-orange-500/20 shadow-2xs">
                                    🏆
                                  </span>
                                ) : rank === 2 ? (
                                  <span className="inline-flex h-5.5 w-5.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 text-xs font-black border border-zinc-200 shadow-2xs">
                                    🥈
                                  </span>
                                ) : rank === 3 ? (
                                  <span className="inline-flex h-5.5 w-5.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-orange-500/[0.04] text-orange-600 text-xs font-black border border-orange-500/10 shadow-2xs">
                                    🥉
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-zinc-400">#{rank}</span>
                                )}
                              </td>

                              <td className="p-3 sm:p-4 align-middle">
                                <Link
                                  href={`/c/${communitySlug}/players/${r.profile.id}`}
                                  className="flex items-center gap-3 hover:underline"
                                >
                                  <img
                                     src={getAvatarUrl(r.profile)}
                                     alt={getDisplayName(r.profile)}
                                     className="h-10 w-10 shrink-0 rounded-full object-cover border border-zinc-100 shadow-2xs"
                                   />
                                  <p className="text-xs sm:text-sm font-extrabold text-[#111827] truncate max-w-[90px] sm:max-w-[180px] md:max-w-[260px] lg:max-w-none flex items-center gap-1.5">
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
                                </Link>
                              </td>

                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-black text-xs sm:text-sm text-orange-600">
                                {Number(r.elo_rating).toFixed(0)}
                              </td>

                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-bold text-xs">
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-black text-[11px] shadow-2xs">
                                  {playerCp}
                                </span>
                              </td>

                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-bold text-xs text-zinc-700">
                                {r.total_wins}-{r.total_losses}-{r.total_draws}
                              </td>
                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-bold text-xs text-zinc-700">
                                {winRate}%
                              </td>
                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-bold text-xs">
                                <span className={pDiff > 0 ? 'text-emerald-600' : pDiff < 0 ? 'text-rose-600' : 'text-zinc-500'}>
                                  {pDiff > 0 ? `+${pDiff}` : pDiff}
                                </span>
                              </td>

                              <td className="p-3 sm:p-4 text-center align-middle font-mono font-bold text-xs">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 font-black text-[11px] shadow-2xs">
                                  {skillRating}
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


        </div>
      </div>

      {/* Claim Guest Modal */}
      {guestToClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 font-sans">
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

      {/* Skill Level Picker Modal — member requests their own level be raised */}
      {skillLevelPickerOpen && (() => {
        const myMember = members.find((m: any) => m.profile?.id === callerProfile?.id);
        const myCurrentLevel: string | undefined = myMember?.skill_level;
        const myRank = myCurrentLevel ? SKILL_LEVEL_ORDER.indexOf(myCurrentLevel as SkillLevel) : -1;
        const availableLevels = SKILL_LEVEL_ORDER.slice(myRank + 1);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-zinc-100 text-[#111827]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 font-sans">
                  Request Skill Level
                </h3>
                <button
                  onClick={() => {
                    setSkillLevelPickerOpen(false);
                    setSkillLevelError(null);
                  }}
                  disabled={isRequestingSkillLevel}
                  className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed font-light">
                Pick the level you'd like to be rated at. A community admin reviews and approves this before it shows on your profile.
              </p>

              {skillLevelError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                  {skillLevelError}
                </div>
              )}

              <div className="space-y-2">
                {availableLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => handleRequestSkillLevel(level)}
                    disabled={isRequestingSkillLevel}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 hover:border-orange-300 hover:bg-orange-50/60 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="text-sm font-bold text-zinc-900">{SKILL_LEVEL_LABEL[level]}</span>
                    {isRequestingSkillLevel ? (
                      <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD ADMIN / ADD HOST MODAL */}
      {targetRoleToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-100 text-[#111827]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
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

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
} from 'lucide-react';
import AddGuestForm from './add-guest-form';

interface CommunityTabsProps {
  communityId: string;
  communitySlug: string;
  communityName: string;
  defaultSport: string;
  isAdmin: boolean;
  memberCount: number;
  activeSessionsCount: number;
  totalMatchesCount: number;
  sessions: any[];
  members: any[];
  rankings: any[];
}

export default function CommunityTabs({
  communityId,
  communitySlug,
  communityName,
  defaultSport,
  isAdmin,
  memberCount,
  activeSessionsCount,
  totalMatchesCount,
  sessions,
  members,
  rankings,
}: CommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'members' | 'info'>('dashboard');

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
    <div className="space-y-6">
      {/* Dynamic Tab Switcher (Horizontally scrollable for mobile widths) */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto whitespace-nowrap scroll-smooth shrink-0 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'dashboard'
              ? 'border-indigo-655 text-indigo-655 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-300'
          }`}
        >
          <Activity className="h-4 w-4" />
          Dashboard
        </button>
        <button
          onClick={() => handleTabChange('leaderboard')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'leaderboard'
              ? 'border-indigo-655 text-indigo-655 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-300'
          }`}
        >
          <Trophy className="h-4 w-4" />
          Leaderboard
        </button>
        <button
          onClick={() => handleTabChange('members')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'members'
              ? 'border-indigo-655 text-indigo-655 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-300'
          }`}
        >
          <Users className="h-4 w-4" />
          Members
        </button>
        <button
          onClick={() => handleTabChange('info')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'info'
              ? 'border-indigo-655 text-indigo-655 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-300'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Glossary & Guide
        </button>
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Overview Stat Cards */}
            <div className="grid gap-3 grid-cols-1">
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400">Total Players</p>
                  <h4 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">{memberCount}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400">Active Sessions</p>
                  <h4 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">{activeSessionsCount}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400">Matches Played</p>
                  <h4 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">{totalMatchesCount}</h4>
                </div>
              </div>
            </div>

            {/* Sessions History section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-indigo-500" />
                  Matchmaking Sessions History
                </h3>
                {isAdmin && (
                  <Link
                    href={`/c/${communitySlug}/sessions/new`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-sm cursor-pointer"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Start Session
                  </Link>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20 text-zinc-400 space-y-3">
                  <Calendar className="h-10 w-10 mx-auto opacity-50" />
                  <p className="text-sm font-semibold">No sessions created yet.</p>
                  {isAdmin && (
                    <Link
                      href={`/c/${communitySlug}/sessions/new`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer"
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
                        className={`p-5 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
                          isActive
                            ? 'border-emerald-350 dark:border-emerald-900/50'
                            : 'border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-450'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                          <h4 className="text-base font-extrabold text-zinc-900 dark:text-white">
                            {s.session_name}
                          </h4>
                          <p className="text-xs text-zinc-400">
                            Created: {new Date(s.created_at).toLocaleDateString()} • {s.court_count} Courts
                          </p>
                        </div>

                        <Link
                          href={`/c/${communitySlug}/sessions/${s.id}`}
                          className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {isActive ? 'Open Live Board' : 'View Stats Summary'}
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
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                {defaultSport} ELO Standings
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Official leaderboard standings computed using the mathematical ELO formulas.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              {rankings.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 space-y-2">
                  <Trophy className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-semibold">No standings computed yet for {defaultSport}.</p>
                  <p className="text-xs">Start a session and enter scores to compute ELO ratings.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/20">
                        <th className="p-3 w-12 text-center">Rank</th>
                        <th className="p-3">Player</th>
                        <th className="p-3 text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                      {rankings.map((r: any, idx) => {
                        const rank = idx + 1;
                        const winRate =
                          r.total_matches > 0
                            ? Math.round((r.total_wins / r.total_matches) * 100)
                            : 0;

                        const pDiff = r.points_for - r.points_against;

                        return (
                          <tr
                            key={r.id}
                            className="group hover:bg-zinc-50/40 dark:hover:bg-zinc-850/20 transition-all text-xs"
                          >
                            <td className="p-3 text-center align-middle">
                              {rank === 1 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-black dark:bg-amber-950/40 dark:text-amber-400">
                                  🏆
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-800 text-[10px] font-black dark:bg-slate-900/60 dark:text-slate-400">
                                  🥈
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-700/10 text-amber-800 text-[10px] font-black dark:bg-amber-700/20 dark:text-amber-400">
                                  🥉
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-400">{rank}</span>
                              )}
                            </td>

                            <td className="p-3 align-middle">
                              <Link
                                href={`/c/${communitySlug}/players/${r.profile.id}`}
                                className="flex items-center gap-2.5 hover:underline"
                              >
                                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-extrabold text-[10px] text-zinc-650 uppercase dark:bg-zinc-800 dark:text-zinc-300">
                                  {r.profile.full_name.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                                    {r.profile.full_name}
                                    {r.profile.is_guest && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 text-[8px] font-bold uppercase dark:bg-zinc-800 dark:text-zinc-450">
                                        Guest
                                      </span>
                                    )}
                                    {r.is_provisional && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 text-[8px] font-bold uppercase dark:bg-indigo-950/20 dark:text-indigo-400">
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

                            <td className="p-3 text-right align-middle">
                              <div className="text-right">
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                  {Number(r.elo_rating).toFixed(0)}
                                </span>
                                <span className="block text-[9px] text-zinc-400 font-bold">
                                  Peak: {Number(r.elo_peak).toFixed(0)}
                                </span>
                              </div>
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
                <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <Shield className="h-4.5 w-4.5 text-indigo-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">ADMINS & HOSTS</h3>
                  </div>
                  
                  {adminsAndHosts.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">No admins or hosts registered.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-4 justify-items-center">
                      {adminsAndHosts.map((m: any) => {
                        const p = m.profile;
                        if (!p) return null;
                        return (
                          <Link
                            key={p.id}
                            href={`/c/${communitySlug}/players/${p.id}`}
                            className="flex flex-col items-center group w-full text-center"
                          >
                            <div className="relative">
                              {p.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt={p.full_name}
                                  className="h-12 w-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 font-extrabold text-sm uppercase">
                                  {p.full_name.slice(0, 2)}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-0.5 text-white shadow-sm border border-white dark:border-zinc-900">
                                <Shield className="h-2.5 w-2.5" />
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-zinc-900 dark:text-white mt-1.5 truncate w-full group-hover:underline">
                              {p.full_name.split(' ')[0]}
                            </span>
                            <span className={`text-[8px] font-extrabold uppercase tracking-wider mt-0.5 ${
                              m.role === 'ADMIN' ? 'text-amber-500' : 'text-indigo-455'
                            }`}>
                              {m.role}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MEMBERS SECTION */}
                <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <Users className="h-4.5 w-4.5 text-indigo-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">MEMBERS ({generalMembers.length})</h3>
                  </div>

                  {generalMembers.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">No regular members registered.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-4 justify-items-center">
                      {generalMembers.map((m: any) => {
                        const p = m.profile;
                        if (!p) return null;
                        return (
                          <Link
                            key={p.id}
                            href={`/c/${communitySlug}/players/${p.id}`}
                            className="flex flex-col items-center group w-full text-center"
                          >
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.full_name}
                                className="h-12 w-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-350 font-bold text-sm uppercase">
                                {p.full_name.slice(0, 2)}
                              </div>
                            )}
                            <span className="text-[10px] font-black text-zinc-950 dark:text-white mt-1.5 truncate w-full group-hover:underline">
                              {p.full_name.split(' ')[0]}
                            </span>
                            {p.is_guest && (
                              <span className="text-[7px] font-extrabold uppercase bg-zinc-100 text-zinc-500 px-1 py-0.2 rounded dark:bg-zinc-800 dark:text-zinc-400 mt-0.5">
                                Guest
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Admin Add Guest side panel */}
              <div>
                {isAdmin ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-zinc-950 dark:text-white">Add Guest Player</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Register quick guest profiles for sessions without account verification emails.
                      </p>
                    </div>
                    <AddGuestForm communityId={communityId} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Only community administrators can register guest players or adjust player permissions.
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
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Sistem ELO Rating
                </h3>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  <strong>ELO Rating</strong> adalah metode matematis untuk mengukur tingkat keahlian relatif pemain dalam permainan 1-lawan-1 atau ganda. Dibandingkan dengan sistem skor kumulatif, nilai ELO naik atau turun berdasarkan **ekspektasi kemenangan** (Expectation).
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-indigo-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">1. Nilai Ekspektasi (Probability of Winning)</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Sistem menghitung probabilitas kemenangan tim Anda ($E_A$) berdasarkan perbandingan ELO tim Anda melawan ELO tim lawan. Jika Anda mengalahkan lawan dengan ELO yang jauh lebih tinggi, rating Anda akan naik pesat. Sebaliknya, kalah dari lawan dengan ELO lebih rendah akan mengurangi poin Anda secara signifikan.
                    </p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">2. Margin Kemenangan (Margin of Victory)</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
                      Kalkulator ELO kami menggunakan pengali **Margin of Victory (MoV)**. Kemenangan mutlak (misalnya skor 21-5) akan memberikan pengali bonus ELO yang lebih besar dibandingkan kemenangan tipis (misalnya 21-19). MoV dihitung menggunakan formula logaritma alami agar sebaran poin tetap proporsional dan tidak mengalami inflasi.
                    </p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">3. Skala K-Factor & Pemain Provisional</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
                      <strong>K-Factor</strong> menentukan seberapa sensitif rating Anda terhadap hasil pertandingan terakhir:
                      <br />• <strong>Pemain Baru (Provisional)</strong>: Pemain dengan jumlah tanding di bawah 10 mendapat $K = 48$. Ini mempercepat sistem menemukan kisaran rating aslinya.
                      <br />• <strong>Pemain Mapat (Settled)</strong>: Setelah melewati 10 pertandingan, K-Factor turun menjadi $K = 24$ agar rating tetap stabil.
                    </p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-4 space-y-1.5">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">4. Keseimbangan Nol (Zero-Sum Invariant)</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
                      Semua perhitungan dilakukan dengan prinsip seimbang. Jumlah total ELO yang didapatkan oleh tim pemenang sama persis dengan total ELO yang dikurangi dari tim yang kalah (jumlah net = 0). Di akhir laga ganda, rata-rata K-Factor dan delta didistribusikan secara adil kepada setiap rekan setim. Batas rating terendah adalah **100.00** guna mencegah rating jatuh negatif.
                    </p>
                  </div>
                </div>
              </div>

              {/* AMERICANO FORMAT SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Format Turnamen: Americano
                </h3>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  Dalam format <strong>Americano</strong>, tujuannya adalah agar setiap pemain merasakan bermain berpasangan (rekan satu tim) dengan semua orang lainnya, sekaligus bermain berhadapan (sebagai lawan) secara merata.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Skema Rotasi Berputar</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Sistem menggunakan tabel rotasi matematis untuk jumlah pemain genap ($N = 4, 8$) demi rotasi sempurna. Untuk jumlah pemain lainnya, algoritma melakukan simulasi pencarian lokal 10.000 iterasi untuk menyusun jadwal terbaik dengan penalti partner tumpuk seminimal mungkin.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Sistem Sit-Out yang Adil</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
                      Jika jumlah pemain tidak kelipatan 4, beberapa pemain harus beristirahat (*sit-out*) bergantian di tiap ronde. Algoritma menjamin:
                      <br />• Tidak ada pemain yang beristirahat 2 kali sebelum semua orang mendapat giliran istirahat 1 kali.
                      <br />• Proteksi ketat mencegah satu orang istirahat berturut-turut (*consecutive sit-out*).
                    </p>
                  </div>
                </div>
              </div>

              {/* MEXICANO FORMAT SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Format Turnamen: Mexicano
                </h3>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  Dalam format <strong>Mexicano</strong>, jadwal dipasangkan secara dinamis berdasarkan klasemen sesi berjalan (*standing-based pairings*). Tujuannya agar tercipta laga seru antar pemain dengan tingkat kekuatan yang setara di lapangan yang sama.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Pengelompokan Lapangan (Court Grouping)</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Ronde pertama dipasangkan acak. Untuk ronde selanjutnya, pemain diurutkan berdasarkan poin klasemen sesi berjalan:
                      <br />• <strong>Lapangan 1</strong>: Diisi oleh peringkat 1 sampai 4.
                      <br />• <strong>Lapangan 2</strong>: Diisi oleh peringkat 5 sampai 8, dan seterusnya.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Skema Pairing Dalam Lapangan</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
                      Di dalam tiap lapangan, peringkat dipasangkan dengan skema **$1+4$ vs $2+3$** (peringkat 1 berpasangan dengan peringkat 4 melawan peringkat 2 dan 3) untuk menciptakan kekuatan tim yang paling seimbang.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Pencegahan Partner Berulang</h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-455 leading-relaxed">
                      Algoritma menyimpan memori riwayat tanding. Jika di lapangan tersebut peringkat $1+4$ sudah pernah berpasangan sebelumnya, sistem otomatis melakukan pergeseran peringkat (*shifting*) agar Anda tidak bosan berpasangan dengan orang yang sama.
                    </p>
                  </div>
                </div>
              </div>

              {/* MEMBER ROLES SECTION */}
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Peran & Hak Akses Anggota (ADMIN, HOST, MEMBER)
                </h3>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  Dalam Communitrix, setiap komunitas memiliki pembagian hak akses teratur demi kelancaran pengelolaan dan pencegahan penyalahgunaan data:
                </p>

                <div className="space-y-4 pt-2">
                  <div className="border-l-4 border-amber-500 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      1. ADMIN (Tingkat Tertinggi)
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Admin memiliki kontrol penuh atas seluruh komunitas. Hanya Admin yang dapat **menambah/mengundang member baru**, **mengeluarkan/kick member**, **mengubah tingkat peran keanggotaan**, serta melakukan tindakan administratif sensitif seperti **amend (koreksi skor)** dan **void (membatalkan laga)** yang mempengaruhi recalculation ELO global.
                    </p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      2. HOST (Penyelenggara Lapangan)
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Host adalah asisten pengelola yang bertanggung jawab di lapangan. Host dapat **membuat sesi tanding baru**, **mendaftarkan profil tamu (guest)** di tempat, **mengatur antrean main**, dan **menginput/submit skor pertandingan aktif**. Namun, Host **tidak memiliki hak** untuk mengedit, membatalkan (void/amend) skor yang sudah final, ataupun mengeluarkan/kick member dari komunitas.
                    </p>
                  </div>

                  <div className="border-l-4 border-zinc-400 pl-4 space-y-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-450" />
                      3. MEMBER (Pemain Biasa)
                    </h4>
                    <p className="text-xs text-zinc-655 dark:text-zinc-450 leading-relaxed">
                      Member adalah pemain terdaftar dalam komunitas. Member memiliki hak baca penuh (Read-Only) untuk **melihat statistik umum**, **leaderboard ELO**, **profil pemain (termasuk grafik tren ELO)**, serta **pantauan Live Board** pertandingan yang sedang berjalan secara real-time dari HP mereka.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Glossary Sidebar */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-4">
                <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <BookOpen className="h-4.5 w-4.5 text-indigo-500" />
                  Glosarium Singkat
                </h4>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">ELO Rating</span>
                    <p className="text-zinc-450 mt-0.5">Rating kepiawaian relatif pemain. Angka default 1000.00.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">K-Factor</span>
                    <p className="text-zinc-450 mt-0.5">Sensitivitas perubahan ELO per pertandingan (24 atau 48).</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">Provisional</span>
                    <p className="text-zinc-450 mt-0.5">Status pemain dengan kurang dari 10 pertandingan.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">Zero-Sum</span>
                    <p className="text-zinc-450 mt-0.5">Sistem perolehan nilai seimbang; poin plus sama dengan poin minus.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">MoV</span>
                    <p className="text-zinc-450 mt-0.5">Margin of Victory; bobot tambahan ELO untuk skor kemenangan telak.</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-zinc-850 dark:text-zinc-200">Sit-Out</span>
                    <p className="text-zinc-450 mt-0.5">Istirahat giliran tanding demi keadilan pembagian waktu bermain.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

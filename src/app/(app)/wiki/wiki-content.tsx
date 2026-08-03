'use client';

import { useState } from 'react';
import { Search, X, Trophy, Star, Clock, Award, Shield } from 'lucide-react';

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
        text: 'Kemenangan dengan margin skor lebih besar memberi bonus pengali ELO secara linear — dari ×1.0 (menang tipis) hingga ×1.5 (menang telak, saat margin skor mencapai skor target sesi). K-Factor bernilai 48 untuk Pemain Baru (Provisional < 10 pertandingan) agar rating cepat menyesuaikan, dan 24 untuk Pemain Mapan (Settled ≥ 10 pertandingan).',
      },
      {
        subtitle: 'Skill Rating (Estimasi Otomatis, Bukan Nilai Admin)',
        text: 'Skill Rating yang tampil di leaderboard bukan nilai yang dinilai manual oleh Admin — ini murni angka estimasi yang dihitung otomatis dari ELO Rating pemain saat ini, sekadar untuk memberi gambaran cepat level pemain pada skala 1.00–7.00. Angka ini otomatis naik-turun mengikuti pergerakan ELO, dan saat ini belum ada mekanisme peninjauan otomatis (review flag) yang berjalan di sistem.',
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

// Rules/rulebook content is the same for every community — it's not scoped to community
// data, so it lives under the profile rather than inside a specific community's tabs.
export default function WikiContent() {
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');

  const filteredSections = wikiSections.filter((sec) => {
    if (!wikiSearchQuery.trim()) return true;
    const q = wikiSearchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.badge.toLowerCase().includes(q) ||
      sec.content.some((c) => c.subtitle.toLowerCase().includes(q) || c.text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">Communitrix Wiki & Rulebook</h2>
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
              <div key={sec.id} className="p-6 rounded-3xl border border-zinc-100 bg-zinc-50 shadow-xs space-y-4">
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
}

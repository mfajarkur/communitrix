'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { EloTrend } from './profile-actions';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

type PeriodLabel = (typeof PERIODS)[number]['label'];

export default function EloTrendChart({ sport, trend }: { sport: string; trend: EloTrend }) {
  const [period, setPeriod] = useState<PeriodLabel>('30D');
  // A stable, instance-unique id — deriving this from `sport` alone (as it used to) collides
  // once more than one chart for the same sport can render on a page at once (e.g. a player
  // active in two communities playing the same sport, one chart per community).
  const reactId = useId();

  const { referenceElo, points, currentElo } = useMemo(() => {
    const days = PERIODS.find((p) => p.label === period)!.days;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const before = trend.points.filter((p) => new Date(p.date) < cutoff);
    const inWindow = trend.points.filter((p) => new Date(p.date) >= cutoff);
    const reference = before.length > 0 ? before[before.length - 1].elo : trend.startingElo;
    const current = inWindow.length > 0 ? inWindow[inWindow.length - 1].elo : reference;

    return { referenceElo: reference, points: inWindow, currentElo: current };
  }, [trend, period]);

  if (trend.points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-xs text-zinc-400">
        No {sport.toLowerCase()} matches yet — play a scored match to start tracking Elo.
      </div>
    );
  }

  const delta = currentElo - referenceElo;
  const isFlat = Math.abs(delta) < 0.5;
  const isUp = delta > 0;

  const series = [referenceElo, ...points.map((p) => p.elo)];
  const minElo = Math.min(...series) - 15;
  const maxElo = Math.max(...series) + 15;
  const range = maxElo - minElo === 0 ? 1 : maxElo - minElo;

  const w = 400;
  const h = 120;
  const padding = 12;
  const plotWidth = w - padding * 2;
  const plotHeight = h - padding * 2;

  const coords = series.map((val, i) => {
    const x = series.length > 1 ? padding + (i / (series.length - 1)) * plotWidth : w / 2;
    const y = padding + plotHeight - ((val - minElo) / range) * plotHeight;
    return { x, y };
  });

  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaD =
    coords.length > 0
      ? `${lineD} L ${coords[coords.length - 1].x} ${h - padding} L ${coords[0].x} ${h - padding} Z`
      : '';
  const referenceY = padding + plotHeight - ((referenceElo - minElo) / range) * plotHeight;
  const last = coords[coords.length - 1];
  const gradientId = `eloGradient-${reactId}`;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{sport}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black text-zinc-900 tabular-nums">{Math.round(currentElo)}</span>
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                isFlat
                  ? 'text-zinc-400 bg-zinc-100'
                  : isUp
                  ? 'text-green-700 bg-green-100'
                  : 'text-red-700 bg-red-100'
              }`}
            >
              {isFlat ? (
                <Minus className="h-3 w-3" />
              ) : isUp ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(0)}
            </span>
          </div>
        </div>

        <div className="flex p-0.5 bg-zinc-100 rounded-lg shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.label)}
              className={`px-2.5 py-1 rounded text-[10px] font-extrabold cursor-pointer transition-all ${
                period === p.label ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={referenceY} x2={w - padding} y2={referenceY} stroke="#d4d4d8" strokeDasharray="4 4" />

        {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
        {lineD && (
          <path d={lineD} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {last && (
          <>
            <circle cx={last.x} cy={last.y} r="7" fill="#f97316" opacity="0.25" />
            <circle cx={last.x} cy={last.y} r="4" fill="#f97316" stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
}

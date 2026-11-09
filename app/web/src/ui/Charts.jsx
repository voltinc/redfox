import React, { useMemo, useState } from 'react';
import { cx } from '../lib/format.js';
import { Sparkline } from './index.jsx';

/* SVG line/area chart. Real values only: the caller passes the data it fetched. */
export function AreaChart({
  series = [], labels = [], height = 150, unit = '', yMax, className, showAxis = true, decimals = 0,
}) {
  const [hover, setHover] = useState(null);
  const width = 640;
  const padding = { top: 8, right: 4, bottom: showAxis ? 16 : 2, left: showAxis ? 26 : 2 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.values.filter((v) => typeof v === 'number'));
  const max = yMax ?? Math.max(...allValues, 1);
  const maxNice = max <= 100 ? Math.ceil(max / 25) * 25 : Math.ceil(max / 10) * 10;
  const count = Math.max(...series.map((s) => s.values.length), 2);

  const x = (i) => padding.left + (i / (count - 1)) * innerW;
  const y = (v) => padding.top + innerH - (Math.min(v, maxNice) / maxNice) * innerH;

  const buildPath = (values) => values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v ?? 0).toFixed(1)}`)
    .join(' ');

  const areaPath = (values) => `${buildPath(values)} L${x(values.length - 1).toFixed(1)},${padding.top + innerH} L${x(0).toFixed(1)},${padding.top + innerH} Z`;

  const ticks = [0, 0.5, 1].map((f) => maxNice * f);

  return (
    <div className={cx('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (count - 1));
          if (index >= 0 && index < count) setHover(index);
        }}
      >
        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
            {showAxis ? (
              <text x={padding.left - 5} y={y(tick) + 3} textAnchor="end" fontSize="9" fill="var(--fg-dim)" style={{ fontFamily: 'inherit' }}>
                {Math.round(tick)}{unit === '%' ? '%' : ''}
              </text>
            ) : null}
          </g>
        ))}

        {series.map((s) => (
          <g key={s.key}>
            {s.fill ? (
              <defs>
                <linearGradient id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color || 'var(--accent)'} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={s.color || 'var(--accent)'} stopOpacity="0" />
                </linearGradient>
              </defs>
            ) : null}
            {s.fill ? <path d={areaPath(s.values)} fill={`url(#grad-${s.key})`} /> : null}
            <path d={buildPath(s.values)} fill="none" stroke={s.color || 'var(--accent)'} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}

        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padding.top} y2={padding.top + innerH} stroke="var(--line-strong)" strokeWidth="1" />
            {series.map((s) => (
              typeof s.values[hover] === 'number' ? (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="2.5" fill={s.color || 'var(--accent)'} />
              ) : null
            ))}
          </g>
        ) : null}
      </svg>

      {hover !== null && labels[hover] ? (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[110px] rounded border border-line bg-panel px-2 py-1.5 text-2xs shadow-pop"
          style={{ left: `${Math.min(78, (hover / (count - 1)) * 100)}%` }}
        >
          <div className="mb-1 text-dim">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-muted">
                <span className="h-[2px] w-2 rounded" style={{ background: s.color || 'var(--accent)' }} />
                {s.label}
              </span>
              <span className="tabular text-fg">
                {typeof s.values[hover] === 'number' ? s.values[hover].toFixed(decimals) : '—'}{unit}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {showAxis && labels.length ? (
        <div className="mt-0.5 flex justify-between px-0.5 text-2xs text-dim">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      ) : null}
    </div>
  );
}

/* Grouped bars: one bar per series per bucket. */
export function BarSeries({ data = [], height = 96, series = [], className, unit = '' }) {
  const max = Math.max(...data.flatMap((d) => series.map((s) => d[s.key] || 0)), 1);
  return (
    <div className={className}>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((row, index) => (
          <div key={row.date || index} className="group relative flex h-full flex-1 items-end gap-[2px]" title={`${row.date}\n${series.map((s) => `${s.label}: ${row[s.key] ?? 0}`).join('\n')}`}>
            {series.map((s) => (
              <div
                key={s.key}
                className="w-full rounded-t-[1px] transition-opacity group-hover:opacity-100"
                style={{
                  height: `${Math.max((row[s.key] || 0) / max) * 100, row[s.key] ? 4 : 0.8}%`,
                  background: row[s.key] ? s.color : 'var(--line)',
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-2xs text-dim">
              <span className="h-[6px] w-[6px] rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <span className="text-2xs text-dim">{data.length} days</span>
      </div>
    </div>
  );
}

export function StatTile({ label, value, hint, icon: Icon, trend, spark, tone = 'default', onClick }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'group rounded-lg border border-line bg-panel px-3.5 py-3 transition-colors',
        onClick && 'cursor-pointer hover:border-strong',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-[0.07em] text-dim">{label}</span>
        {Icon ? <Icon size={12} className="text-dim group-hover:text-muted" /> : null}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className={cx('text-[19px] font-semibold leading-6 tracking-[-0.02em] tabular', tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-fg')}>
          {value}
        </span>
        {spark ? <Sparkline values={spark} width={64} height={18} tone={tone === 'danger' ? 'danger' : 'accent'} /> : null}
      </div>
      {hint ? <p className="mt-1 truncate text-xs text-dim">{hint}</p> : null}
    </div>
  );
}

export function UsageBar({ value, max = 100, tone = 'accent', label, detail, className }) {
  const pct = Math.min(100, Math.max(0, (Number(value) / (max || 1)) * 100));
  const colors = { accent: 'var(--accent)', success: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)', info: 'var(--info)' };
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="tabular text-dim">{detail ?? `${pct.toFixed(0)}%`}</span>
        </div>
      ) : null}
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[tone] }} />
      </div>
    </div>
  );
}

export function MiniBars({ values = [], height = 18, tone = 'accent' }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{ height: `${Math.max((v / max) * 100, 8)}%`, background: tone === 'accent' ? 'var(--accent)' : 'var(--info)', opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

export function useChartLabels(timestamps) {
  return useMemo(() => timestamps.map((ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })), [timestamps]);
}
